package agent

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	filetool "github.com/Misaka477/Natalia-Cli/internal/tools/file"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
	"github.com/Misaka477/Natalia-Cli/internal/worker"
)

type testTool struct {
	name      string
	checkArgs func(map[string]any) error
}

func (t testTool) Name() string        { return t.name }
func (t testTool) Description() string { return t.name }
func (t testTool) Execute(args map[string]any) (string, error) {
	if t.checkArgs != nil {
		if err := t.checkArgs(args); err != nil {
			return "", err
		}
	}
	return "tool-result-ok", nil
}
func (t testTool) Parameters() map[string]llm.Property { return nil }
func (t testTool) Required() []string                  { return nil }

func TestSpawnWithoutPool(t *testing.T) {
	s := &Spawn{}
	// Without pool, Execute would fail
	_, err := s.Execute(map[string]any{"task": "test"})
	if err == nil {
		t.Error("expected error (pool is nil)")
	}
}

func TestOutputWithoutPool(t *testing.T) {
	o := &Output{}
	_, err := o.Execute(map[string]any{"agent_id": "w1"})
	if err == nil {
		t.Error("expected error (pool is nil)")
	}
}

func TestListWithoutPool(t *testing.T) {
	_, err := (&List{}).Execute(nil)
	if err == nil {
		t.Fatal("expected error (pool is nil)")
	}
}

func TestStopResumeWithoutPool(t *testing.T) {
	if _, err := (&Stop{}).Execute(map[string]any{"agent_id": "w1"}); err == nil {
		t.Fatal("expected stop error (pool is nil)")
	}
	if _, err := (&Resume{}).Execute(map[string]any{"agent_id": "w1"}); err == nil {
		t.Fatal("expected resume error (pool is nil)")
	}
}

func TestStopResumeUnknownWorker(t *testing.T) {
	pool := worker.NewPool()
	if _, err := (&Stop{Pool: pool}).Execute(map[string]any{"agent_id": "missing"}); err == nil || !strings.Contains(err.Error(), "不存在") {
		t.Fatalf("expected missing stop error, got %v", err)
	}
	if _, err := (&Resume{Pool: pool}).Execute(map[string]any{"agent_id": "missing"}); err == nil || !strings.Contains(err.Error(), "不存在") {
		t.Fatalf("expected missing resume error, got %v", err)
	}
}

func TestParseTimeoutSec(t *testing.T) {
	if got, err := parseTimeoutSec(nil, true); err != nil || got != 30 {
		t.Fatalf("expected foreground default 30, got %d err=%v", got, err)
	}
	if got, err := parseTimeoutSec(nil, false); err != nil || got != 0 {
		t.Fatalf("expected background default 0, got %d err=%v", got, err)
	}
	if _, err := parseTimeoutSec(float64(1.5), false); err == nil {
		t.Fatal("expected non-integer timeout error")
	}
	if _, err := parseTimeoutSec(float64(3601), false); err == nil {
		t.Fatal("expected max timeout error")
	}
}

func TestChildToolRegistryFiltersTools(t *testing.T) {
	base := toolset.NewRegistry()
	base.Register(testTool{name: "read_file"})
	base.Register(testTool{name: "write_file"})
	child, err := childToolRegistry(base, map[string]any{"allowed_tools": []any{"read_file", "write_file"}, "exclude_tools": []any{"write_file"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := child.Get("read_file"); !ok {
		t.Fatal("expected read_file in child registry")
	}
	if _, ok := child.Get("write_file"); ok {
		t.Fatal("expected write_file excluded from child registry")
	}
}

func TestChildToolRegistryRejectsInvalidList(t *testing.T) {
	_, err := childToolRegistry(toolset.NewRegistry(), map[string]any{"allowed_tools": "bad"})
	if err == nil || !strings.Contains(err.Error(), "allowed_tools") {
		t.Fatalf("expected allowed_tools validation error, got %v", err)
	}
}

func TestSpawnForegroundRunsWorkerToolCallChainWithFilteredTools(t *testing.T) {
	var requests atomic.Int32
	toolSchemaChecked := make(chan error, 1)
	dir := t.TempDir()
	fixturePath := filepath.Join(dir, "fixture.txt")
	if err := os.WriteFile(fixturePath, []byte("real-file-tool-ok\n"), 0644); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var req llm.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			toolSchemaChecked <- err
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		call := requests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		if call == 1 {
			seenRead := false
			for _, def := range req.Tools {
				switch def.Function.Name {
				case "read_file":
					seenRead = true
				case "write_file":
					toolSchemaChecked <- errString("write_file leaked into child tool schema")
				}
			}
			if !seenRead {
				toolSchemaChecked <- errString("read_file missing from child tool schema")
			} else {
				toolSchemaChecked <- nil
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"choices": []map[string]any{{"message": map[string]any{
					"role": "assistant",
					"tool_calls": []map[string]any{{
						"id":   "tc_read",
						"type": "function",
						"function": map[string]any{
							"name":      "read_file",
							"arguments": fmt.Sprintf(`{"path":%q,"limit":"all"}`, fixturePath),
						},
					}},
				}}},
				"usage": map[string]any{"completion_tokens": 1, "total_tokens": 1},
			})
			return
		}
		toolResultSeen := false
		for _, msg := range req.Messages {
			if msg.Role == chat.RoleTool && msg.Name == "read_file" && strings.Contains(msg.Content, "real-file-tool-ok") {
				toolResultSeen = true
			}
		}
		if !toolResultSeen {
			_ = json.NewEncoder(w).Encode(map[string]any{"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "missing tool result"}}}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "agent-final-ok"}}},
			"usage":   map[string]any{"completion_tokens": 1, "total_tokens": 2},
		})
	}))
	defer server.Close()

	tools := toolset.NewRegistry()
	tools.Register(&filetool.Read{})
	tools.Register(testTool{name: "write_file"})
	client := llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", APIKey: "test"})
	out, err := (&Spawn{Pool: worker.NewPool(), Client: client, Tools: tools}).Execute(map[string]any{
		"task":          "read fixture",
		"foreground":    true,
		"timeout_sec":   float64(2),
		"allowed_tools": []any{"read_file", "write_file"},
		"exclude_tools": []any{"write_file"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if schemaErr := <-toolSchemaChecked; schemaErr != nil {
		t.Fatal(schemaErr)
	}
	if requests.Load() < 2 {
		t.Fatalf("expected at least two LLM requests, got %d", requests.Load())
	}
	if !strings.Contains(out, "agent-final-ok") || !strings.Contains(out, "completed") {
		t.Fatalf("expected completed foreground output with final answer, got %q", out)
	}
}

type errString string

func (e errString) Error() string { return string(e) }

func TestSpawnMissingTask(t *testing.T) {
	s := &Spawn{}
	_, err := s.Execute(map[string]any{})
	if err == nil {
		t.Error("expected error for missing task")
	}
}

func TestOutputMissingID(t *testing.T) {
	o := &Output{}
	_, err := o.Execute(map[string]any{})
	if err == nil {
		t.Error("expected error for missing agent_id")
	}
}
