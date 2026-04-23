package vault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

const (
	keyLen        = 32
	saltLen       = 32
	nonceLen      = 12
	argon2Time    = 3
	argon2Mem     = 64 * 1024
	argon2Threads = 4
)

type Credential struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	VaultID      string `json:"vault_id"`
	TargetHost   string `json:"target_host"`
	TargetPrefix string `json:"target_prefix"`
	AuthType     string `json:"auth_type"`
	HeaderName   string `json:"header_name"`
	HeaderValue  string `json:"header_value"`
	EncryptedKey string `json:"encrypted_key,omitempty"`
	PlainKey     string `json:"-"`
	CreatedAt    string `json:"created_at"`
}

type Config struct {
	Credentials []Credential `json:"credentials"`
}

func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return &cfg, nil
}

func SaveConfig(path string, cfg *Config) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	return os.WriteFile(path, data, 0600)
}

type Store interface {
	Get(id string) (*Credential, error)
	Put(cred Credential) error
	Delete(id string) error
	List() ([]Credential, error)
	FindByTarget(host string) ([]*Credential, error)
}

type MemoryStore struct {
	mu    sync.RWMutex
	creds map[string]Credential
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{creds: make(map[string]Credential)}
}

func (s *MemoryStore) Get(id string) (*Credential, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.creds[id]
	if !ok {
		return nil, fmt.Errorf("credential %s not found", id)
	}
	return &c, nil
}

func (s *MemoryStore) Put(cred Credential) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cred.ID == "" {
		cred.ID = uuid.New().String()
	}
	s.creds[cred.ID] = cred
	return nil
}

func (s *MemoryStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.creds, id)
	return nil
}

func (s *MemoryStore) List() ([]Credential, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Credential, 0, len(s.creds))
	for _, c := range s.creds {
		result = append(result, c)
	}
	return result, nil
}

func (s *MemoryStore) FindByTarget(host string) ([]*Credential, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []*Credential
	for _, c := range s.creds {
		if MatchHost(c.TargetHost, host) {
			cp := c
			result = append(result, &cp)
		}
	}
	return result, nil
}

func MatchHost(pattern, host string) bool {
	if pattern == "*" || pattern == host {
		return true
	}
	if len(pattern) > 0 && pattern[0] == '.' {
		if len(host) >= len(pattern) && host[len(host)-len(pattern):] == pattern {
			return true
		}
	}
	if len(pattern) > 0 && pattern[len(pattern)-1] == '*' {
		prefix := pattern[:len(pattern)-1]
		if len(host) >= len(prefix) && host[:len(prefix)] == prefix {
			return true
		}
	}
	return false
}

func DeriveKeyArgon2(password, saltB64 string) ([]byte, error) {
	salt, err := base64.StdEncoding.DecodeString(saltB64)
	if err != nil {
		return nil, fmt.Errorf("decode salt: %w", err)
	}
	key := argon2.IDKey([]byte(password), salt, argon2Time, argon2Mem, argon2Threads, keyLen)
	return key, nil
}

func EncryptAES256GCM(plaintext string, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create GCM: %w", err)
	}
	nonce := make([]byte, nonceLen)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	ciphertext := aesgcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func DecryptAES256GCM(encoded string, key []byte) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("decode base64: %w", err)
	}
	if len(data) < nonceLen+16 {
		return "", fmt.Errorf("ciphertext too short")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create GCM: %w", err)
	}
	nonceSize := aesgcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("invalid ciphertext")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := aesgcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}
	return string(plaintext), nil
}

func GenerateSalt() (string, error) {
	salt := make([]byte, saltLen)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(salt), nil
}

func NewCredential(name, vaultID, targetHost, targetPrefix, authType, headerValue string) Credential {
	return Credential{
		ID:           uuid.New().String(),
		Name:         name,
		VaultID:      vaultID,
		TargetHost:   targetHost,
		TargetPrefix: targetPrefix,
		AuthType:     authType,
		HeaderValue:  headerValue,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
}