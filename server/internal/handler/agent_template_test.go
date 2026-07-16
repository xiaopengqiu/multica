package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateAgentFromTemplate_DefaultsVisibilityToWorkspace(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	const defaultName = "template-default-workspace-visibility-test-agent"
	const privateName = "template-explicit-private-visibility-test-agent"
	t.Cleanup(func() {
		testPool.Exec(context.Background(),
			`DELETE FROM agent WHERE workspace_id = $1 AND name IN ($2, $3)`,
			testWorkspaceID, defaultName, privateName,
		)
	})

	create := func(name string, visibility *string) AgentResponse {
		t.Helper()
		body := map[string]any{
			"template_slug": "adr-writer",
			"name":          name,
			"runtime_id":    handlerTestRuntimeID(t),
		}
		if visibility != nil {
			body["visibility"] = *visibility
		}
		w := httptest.NewRecorder()
		testHandler.CreateAgentFromTemplate(w, newRequest(http.MethodPost, "/api/agents/from-template", body))
		if w.Code != http.StatusCreated {
			t.Fatalf("CreateAgentFromTemplate(%s): expected 201, got %d: %s", name, w.Code, w.Body.String())
		}
		var resp CreateAgentFromTemplateResponse
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode CreateAgentFromTemplate(%s): %v", name, err)
		}
		return resp.Agent
	}

	if got := create(defaultName, nil).Visibility; got != "workspace" {
		t.Fatalf("omitted visibility = %q, want workspace", got)
	}
	private := "private"
	if got := create(privateName, &private).Visibility; got != "private" {
		t.Fatalf("explicit visibility = %q, want private", got)
	}
}
