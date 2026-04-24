package proxy

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRuleTesterReturnsMatchedRule(t *testing.T) {
	p := newTestProxy(t)
	h := p.ManagementHandler()

	addRuleReq := httptest.NewRequest(http.MethodPost, "/api/v1/rules", bytes.NewBufferString(`{
		"id":"rule-openai",
		"vault_id":"vault-a",
		"name":"Allow OpenAI",
		"host_match":"api.openai.com",
		"path_match":"/v1/*",
		"methods":["POST"],
		"action":"allow",
		"created_at":"2026-01-01T00:00:00Z"
	}`))
	addRuleReq.Header.Set("Content-Type", "application/json")
	addRuleRec := httptest.NewRecorder()
	h.ServeHTTP(addRuleRec, addRuleReq)
	if addRuleRec.Code != http.StatusCreated {
		t.Fatalf("expected create rule 201, got %d body=%s", addRuleRec.Code, addRuleRec.Body.String())
	}

	testReq := httptest.NewRequest(http.MethodPost, "/api/v1/rules/test", bytes.NewBufferString(`{
		"vault_id":"vault-a",
		"host":"api.openai.com",
		"path":"/v1/responses",
		"method":"POST"
	}`))
	testReq.Header.Set("Content-Type", "application/json")
	testRec := httptest.NewRecorder()
	h.ServeHTTP(testRec, testReq)
	if testRec.Code != http.StatusOK {
		t.Fatalf("expected rule test 200, got %d body=%s", testRec.Code, testRec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(testRec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode rule test response: %v", err)
	}
	if allow, _ := body["allow"].(bool); !allow {
		t.Fatalf("expected request to be allowed, got %#v", body["allow"])
	}
	matched, ok := body["matched_rule"].(map[string]any)
	if !ok {
		t.Fatalf("expected matched_rule object")
	}
	if name, _ := matched["name"].(string); name != "Allow OpenAI" {
		t.Fatalf("expected matched rule name Allow OpenAI, got %q", name)
	}
}

func TestPolicyTemplateListAndApply(t *testing.T) {
	p := newTestProxy(t)
	h := p.ManagementHandler()

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/policy-templates", nil)
	listRec := httptest.NewRecorder()
	h.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected list templates 200, got %d body=%s", listRec.Code, listRec.Body.String())
	}

	var templates []map[string]any
	if err := json.Unmarshal(listRec.Body.Bytes(), &templates); err != nil {
		t.Fatalf("failed to decode templates list: %v", err)
	}
	if len(templates) < 4 {
		t.Fatalf("expected at least 4 templates, got %d", len(templates))
	}

	applyReq := httptest.NewRequest(http.MethodPost, "/api/v1/policy-templates", bytes.NewBufferString(`{
		"vault_id":"vault-tpl",
		"template_id":"openai"
	}`))
	applyReq.Header.Set("Content-Type", "application/json")
	applyRec := httptest.NewRecorder()
	h.ServeHTTP(applyRec, applyReq)
	if applyRec.Code != http.StatusCreated {
		t.Fatalf("expected apply template 201, got %d body=%s", applyRec.Code, applyRec.Body.String())
	}

	rulesReq := httptest.NewRequest(http.MethodGet, "/api/v1/rules", nil)
	rulesRec := httptest.NewRecorder()
	h.ServeHTTP(rulesRec, rulesReq)
	if rulesRec.Code != http.StatusOK {
		t.Fatalf("expected list rules 200, got %d body=%s", rulesRec.Code, rulesRec.Body.String())
	}

	var ruleList []map[string]any
	if err := json.Unmarshal(rulesRec.Body.Bytes(), &ruleList); err != nil {
		t.Fatalf("failed to decode rules list: %v", err)
	}
	if len(ruleList) == 0 {
		t.Fatalf("expected at least one rule after template apply")
	}
}
