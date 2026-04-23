package rules

import (
	"strings"
	"sync"
)

type Action string

const (
	Allow Action = "allow"
	Deny  Action = "deny"
)

type Rule struct {
	ID        string   `json:"id"`
	VaultID   string   `json:"vault_id"`
	Name      string   `json:"name"`
	HostMatch string   `json:"host_match"`
	PathMatch string   `json:"path_match"`
	Methods   []string `json:"methods"`
	Action    Action   `json:"action"`
	CreatedAt string   `json:"created_at"`
}

func (r *Rule) Matches(host, path, method string) bool {
	if !MatchPattern(r.HostMatch, host) {
		return false
	}
	if r.PathMatch != "" && r.PathMatch != "*" && !MatchPattern(r.PathMatch, path) {
		return false
	}
	if len(r.Methods) > 0 {
		methodAllowed := false
		for _, m := range r.Methods {
			if strings.EqualFold(m, method) || m == "*" {
				methodAllowed = true
				break
			}
		}
		if !methodAllowed {
			return false
		}
	}
	return true
}

func MatchPattern(pattern, s string) bool {
	if pattern == "*" || pattern == "" {
		return true
	}
	if pattern == s {
		return true
	}
	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:]
		return strings.HasSuffix(s, suffix)
	}
	if strings.HasSuffix(pattern, "/*") {
		prefix := pattern[:len(pattern)-2]
		if strings.HasPrefix(s, prefix) {
			return true
		}
	}
	return false
}

type Engine struct {
	mu    sync.RWMutex
	rules []Rule
}

func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Add(rule Rule) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.rules = append(e.rules, rule)
}

func (e *Engine) Remove(id string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	for i, r := range e.rules {
		if r.ID == id {
			e.rules = append(e.rules[:i], e.rules[i+1:]...)
			return
		}
	}
}

func (e *Engine) List() []Rule {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]Rule, len(e.rules))
	copy(result, e.rules)
	return result
}

type Decision struct {
	Allow  bool
	Rule   *Rule
	Reason string
}

func (e *Engine) Evaluate(vaultID, host, path, method string) Decision {
	e.mu.RLock()
	defer e.mu.RUnlock()

	for i := range e.rules {
		r := &e.rules[i]
		if r.VaultID != "" && r.VaultID != vaultID {
			continue
		}
		if r.Matches(host, path, method) {
			cp := *r
			if r.Action == Deny {
				return Decision{Allow: false, Rule: &cp, Reason: "denied by rule: " + r.Name}
			}
			return Decision{Allow: true, Rule: &cp, Reason: "allowed by rule: " + r.Name}
		}
	}

	return Decision{Allow: true, Rule: nil, Reason: "no matching rules — default allow"}
}