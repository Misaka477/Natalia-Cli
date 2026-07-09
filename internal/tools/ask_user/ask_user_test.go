package ask_user

import "testing"

func TestName(t *testing.T) {
	a := AskUser{}
	if a.Name() != "ask_user" {
		t.Errorf("expected ask_user, got %s", a.Name())
	}
}

func TestRequiredParams(t *testing.T) {
	a := AskUser{}
	_, err := a.Execute(map[string]any{})
	if err == nil {
		t.Error("expected error for missing question")
	}
}
