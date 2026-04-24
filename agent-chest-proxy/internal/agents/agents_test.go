package agents

import (
	"path/filepath"
	"testing"
	"time"
)

func TestPersistenceAndAuthentication(t *testing.T) {
	statePath := filepath.Join(t.TempDir(), "agents.json")

	mgr := NewManagerWithFile(statePath)
	inv := mgr.CreateInvite("vault-a", "worker-a")
	_, agent, token, ok := mgr.RedeemInvite(inv.Code, "", time.Hour)
	if !ok {
		t.Fatalf("expected redeem to succeed")
	}
	if _, ok := mgr.Authenticate(agent.ID, "vault-a", token); !ok {
		t.Fatalf("expected token to authenticate")
	}

	reloaded := NewManagerWithFile(statePath)
	agents := reloaded.ListAgents("vault-a")
	if len(agents) != 1 {
		t.Fatalf("expected 1 agent after reload, got %d", len(agents))
	}
	if agents[0].Token != "" {
		t.Fatalf("expected listed agent token to be omitted")
	}
	if _, ok := reloaded.Authenticate(agent.ID, "vault-a", token); !ok {
		t.Fatalf("expected persisted token hash to authenticate")
	}

	_, rotatedToken, ok := reloaded.RotateToken(agent.ID, time.Hour)
	if !ok {
		t.Fatalf("expected rotate token to succeed")
	}
	if rotatedToken == token {
		t.Fatalf("expected rotated token to differ")
	}
	if _, ok := reloaded.Authenticate(agent.ID, "vault-a", token); ok {
		t.Fatalf("expected old token to fail after rotation")
	}
	if _, ok := reloaded.Authenticate(agent.ID, "vault-a", rotatedToken); !ok {
		t.Fatalf("expected new token to authenticate")
	}
}

func TestTokenAutoExpiryRevokesAgent(t *testing.T) {
	mgr := NewManager()
	inv := mgr.CreateInvite("vault-exp", "expiring")
	_, agent, token, ok := mgr.RedeemInvite(inv.Code, "", 2*time.Second)
	if !ok {
		t.Fatalf("expected redeem to succeed")
	}
	if _, ok := mgr.Authenticate(agent.ID, "vault-exp", token); !ok {
		t.Fatalf("expected token to authenticate before expiry")
	}

	time.Sleep(3 * time.Second)
	if _, ok := mgr.Authenticate(agent.ID, "vault-exp", token); ok {
		t.Fatalf("expected token to fail after expiry")
	}

	listed := mgr.ListAgents("vault-exp")
	if len(listed) != 1 {
		t.Fatalf("expected one listed agent, got %d", len(listed))
	}
	if listed[0].Status != "revoked" {
		t.Fatalf("expected expired agent to be revoked, got %q", listed[0].Status)
	}
}
