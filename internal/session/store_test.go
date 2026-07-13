package session

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/securefs"
)

func TestCleanupKeepsNewestSessions(t *testing.T) {
	store := &SessionStore{BaseDir: t.TempDir()}
	base := time.Date(2026, 7, 11, 12, 0, 0, 0, time.UTC)

	oldest := writeTestSession(t, store, "oldest", base)
	newer := writeTestSession(t, store, "newer", base.Add(time.Minute))
	newest := writeTestSession(t, store, "newest", base.Add(2*time.Minute))

	store.Cleanup(2)

	if _, err := os.Stat(oldest.Dir); !os.IsNotExist(err) {
		t.Fatalf("expected oldest session to be removed, stat err=%v", err)
	}
	for _, sess := range []*Session{newer, newest} {
		if _, err := os.Stat(sess.Dir); err != nil {
			t.Fatalf("expected session %s to remain: %v", sess.ID, err)
		}
	}
}

func TestCleanupBoundaryCases(t *testing.T) {
	base := time.Date(2026, 7, 11, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name       string
		max        int
		wantRemain []string
	}{
		{name: "keep all when equal", max: 3, wantRemain: []string{"oldest", "newer", "newest"}},
		{name: "keep all when max larger", max: 20, wantRemain: []string{"oldest", "newer", "newest"}},
		{name: "delete all when max zero", max: 0, wantRemain: nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := &SessionStore{BaseDir: t.TempDir()}
			sessions := map[string]*Session{
				"oldest": writeTestSession(t, store, "oldest", base),
				"newer":  writeTestSession(t, store, "newer", base.Add(time.Minute)),
				"newest": writeTestSession(t, store, "newest", base.Add(2*time.Minute)),
			}

			store.Cleanup(tc.max)

			remaining := map[string]bool{}
			for _, id := range tc.wantRemain {
				remaining[id] = true
			}
			for id, sess := range sessions {
				_, err := os.Stat(sess.Dir)
				if remaining[id] && err != nil {
					t.Fatalf("expected %s to remain: %v", id, err)
				}
				if !remaining[id] && !os.IsNotExist(err) {
					t.Fatalf("expected %s to be deleted, stat err=%v", id, err)
				}
			}
		})
	}
}

func TestSessionStateRoundTrip(t *testing.T) {
	store := &SessionStore{BaseDir: t.TempDir()}
	sess := writeTestSession(t, store, "stateful", time.Now())
	state := State{
		Version:           StateVersion,
		Mode:              "debug",
		ModelProfile:      "strongest",
		PermissionProfile: "ask",
		PlanMode:          true,
		PlanSessionID:     "roadmap",
		PlanSlug:          "roadmap",
		PlanPath:          filepath.Join(t.TempDir(), "roadmap.md"),
		PlanDoneLines:     []int{3, 7},
		AdditionalDirs:    []string{"/tmp/project"},
	}

	if err := store.SaveState(sess.ID, state); err != nil {
		t.Fatalf("SaveState failed: %v", err)
	}
	got, err := store.LoadState(sess.ID)
	if err != nil {
		t.Fatalf("LoadState failed: %v", err)
	}
	if got.Version != StateVersion || got.Mode != state.Mode || got.ModelProfile != state.ModelProfile || got.PermissionProfile != state.PermissionProfile || !got.PlanMode || got.PlanSlug != state.PlanSlug || got.PlanPath != state.PlanPath || len(got.PlanDoneLines) != 2 || got.PlanDoneLines[1] != 7 || len(got.AdditionalDirs) != 1 {
		t.Fatalf("unexpected restored state: %+v", got)
	}

	raw, err := os.ReadFile(filepath.Join(sess.Dir, "state.json"))
	if err != nil {
		t.Fatalf("expected state.json: %v", err)
	}
	var decoded State
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("state.json should be valid JSON: %v", err)
	}
	assertMode(t, filepath.Join(sess.Dir, "state.json"), securefs.FileMode)
	assertMode(t, sess.Dir, securefs.DirMode)
}

func TestAppendMessageUpdatesContextTokenEstimate(t *testing.T) {
	store := &SessionStore{BaseDir: t.TempDir()}
	sess := writeTestSession(t, store, "tokens", time.Now())

	if err := store.AppendMessage(sess.ID, chatMessage("12345678")); err != nil {
		t.Fatalf("AppendMessage failed: %v", err)
	}
	if err := store.AppendMessage(sess.ID, chatMessage("abc")); err != nil {
		t.Fatalf("AppendMessage failed: %v", err)
	}
	loaded, err := store.Load(sess.ID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if loaded.ContextTokens != 11 {
		t.Fatalf("expected estimated tokens to be accumulated, got %d", loaded.ContextTokens)
	}
	messages, err := store.LoadMessages(sess.ID)
	if err != nil {
		t.Fatalf("LoadMessages failed: %v", err)
	}
	if len(messages) != 2 || messages[0].Content != "12345678" || messages[1].Content != "abc" {
		t.Fatalf("expected real context.jsonl messages, got %+v", messages)
	}
}

func TestAppendMessageRedactsStoredContext(t *testing.T) {
	store := &SessionStore{BaseDir: t.TempDir()}
	sess := writeTestSession(t, store, "redact", time.Now())
	msg := chat.Message{Role: chat.RoleAssistant, Content: "api_key=plain-secret", ToolCalls: []chat.ToolCall{{ID: "call_1", Type: "function", Function: chat.ToolCallFunc{Name: "tool", Arguments: `{"token":"tool-secret","safe":"ok"}`}}}}
	if err := store.AppendMessage(sess.ID, msg); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(sess.Dir, "context.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	if strings.Contains(text, "plain-secret") || strings.Contains(text, "tool-secret") || !strings.Contains(text, "[redacted]") || !strings.Contains(text, "safe") || !strings.Contains(text, "ok") {
		t.Fatalf("expected redacted stored context, got %s", text)
	}
	assertMode(t, filepath.Join(sess.Dir, "context.jsonl"), securefs.FileMode)
}

func chatMessage(content string) chat.Message {
	return chat.Message{Role: chat.RoleUser, Content: content}
}

func TestLoadStateMissingFileReturnsZeroState(t *testing.T) {
	store := &SessionStore{BaseDir: t.TempDir()}
	sess := writeTestSession(t, store, "nostate", time.Now())
	state, err := store.LoadState(sess.ID)
	if err != nil {
		t.Fatalf("LoadState missing file should not fail: %v", err)
	}
	if state.Version != 0 || state.Mode != "" || state.ModelProfile != "" || state.PermissionProfile != "" || state.PlanMode || state.PlanSlug != "" || len(state.PlanDoneLines) != 0 {
		t.Fatalf("expected zero state, got %+v", state)
	}
}

func writeTestSession(t *testing.T, store *SessionStore, id string, updatedAt time.Time) *Session {
	t.Helper()
	sess := &Session{
		ID:        id,
		CreatedAt: updatedAt,
		UpdatedAt: updatedAt,
		Model:     "test-model",
		Dir:       filepath.Join(store.BaseDir, id),
	}
	if err := os.MkdirAll(sess.Dir, 0755); err != nil {
		t.Fatalf("mkdir session: %v", err)
	}
	if err := store.writeMeta(sess); err != nil {
		t.Fatalf("write session meta: %v", err)
	}
	return sess
}

func assertMode(t *testing.T, path string, want os.FileMode) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != want {
		t.Fatalf("expected %s mode %o, got %o", path, want, info.Mode().Perm())
	}
}
