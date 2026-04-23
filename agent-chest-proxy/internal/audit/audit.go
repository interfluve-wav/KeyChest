package audit

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

type Action string

const (
	ActionAllow  Action = "allow"
	ActionDeny   Action = "deny"
	ActionBroker Action = "broker"
	ActionError  Action = "error"
)

type AuditEntry struct {
	Timestamp    string `json:"timestamp"`
	AgentID     string `json:"agent_id"`
	VaultID     string `json:"vault_id"`
	Method      string `json:"method"`
	Target      string `json:"target"`
	Path        string `json:"path"`
	Action      Action `json:"action"`
	StatusCode  int    `json:"status_code"`
	CredentialID string `json:"credential_id"`
	Rule        string `json:"rule,omitempty"`
	SourceIP    string `json:"source_ip"`
	UserAgent   string `json:"user_agent,omitempty"`
	DurationMs  int64  `json:"duration_ms"`
}

type Logger struct {
	mu         sync.Mutex
	file        *os.File
	subs       []func(AuditEntry)
	entries    []AuditEntry
	maxEntries int
}

func NewLogger(path string) (*Logger, error) {
	l := &Logger{
		entries:    make([]AuditEntry, 0, 1000),
		maxEntries: 10000,
	}
	if path != "" {
		f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
		if err != nil {
			return nil, err
		}
		l.file = f
	}
	return l, nil
}

func (l *Logger) Log(entry AuditEntry) {
	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	l.mu.Lock()
	l.entries = append(l.entries, entry)
	if len(l.entries) > l.maxEntries {
		l.entries = l.entries[len(l.entries)-l.maxEntries:]
	}
	subs := make([]func(AuditEntry), len(l.subs))
	copy(subs, l.subs)
	l.mu.Unlock()

	if l.file != nil {
		data, _ := json.Marshal(entry)
		l.file.Write(append(data, '\n'))
	}

	for _, fn := range subs {
		fn(entry)
	}
}

func (l *Logger) Subscribe(fn func(AuditEntry)) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.subs = append(l.subs, fn)
}

func (l *Logger) Query(limit, offset int) []AuditEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	if offset >= len(l.entries) {
		return nil
	}
	end := offset + limit
	if end > len(l.entries) {
		end = len(l.entries)
	}
	result := make([]AuditEntry, end-offset)
	copy(result, l.entries[offset:end])
	return result
}

func (l *Logger) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.file != nil {
		return l.file.Close()
	}
	return nil
}

func (l *Logger) Count() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}