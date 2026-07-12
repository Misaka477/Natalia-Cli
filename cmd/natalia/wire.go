package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/Misaka477/Natalia-Cli/internal/config"
	"github.com/Misaka477/Natalia-Cli/internal/session"
	"github.com/Misaka477/Natalia-Cli/internal/soul"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
)

func runWire(cfg *config.Config, tools *toolset.Registry, in io.Reader, out io.Writer, debug bool) error {
	return runWireWithOptions(cfg, tools, in, out, debug, wireRunOptions{})
}

func runWireCLI(cfg *config.Config, tools *toolset.Registry, in io.Reader, out io.Writer, debug bool) error {
	store, err := session.NewStore()
	if err != nil {
		return err
	}
	return runWireWithOptions(cfg, tools, in, out, debug, wireRunOptions{SessionStore: store})
}

type wireRunOptions struct {
	SessionStore *session.SessionStore
}

func runWireWithOptions(cfg *config.Config, tools *toolset.Registry, in io.Reader, out io.Writer, debug bool, opts wireRunOptions) error {
	w := wire.NewWire()
	engine := buildEngine(cfg, tools, debug)
	configureEngineForWire(engine, w)
	closeRecorder, err := attachWireRecorder(w, cfg, opts.SessionStore)
	if err != nil {
		return err
	}
	defer closeRecorder()

	var approvalCtxMu sync.RWMutex
	var approvalCtx context.Context
	server := wire.NewServer(w, in, out, wire.ServerHandler{
		Initialize: func(context.Context, wire.InitializeParams) (any, error) {
			return map[string]any{"status": "ok", "server": "natalia-cli"}, nil
		},
		Prompt: func(ctx context.Context, params wire.PromptParams) (any, error) {
			if engine.LLM == nil {
				return nil, fmt.Errorf("LLM 未配置，请先运行 /setup")
			}
			input, _ := json.Marshal(params.UserInput)
			if event, err := wire.NewEvent(wire.EventTurnBegin, wire.TurnBegin{UserInput: input}); err == nil {
				w.SoulSide.PublishEvent(event)
			}
			engine.ResetCancel()
			approvalCtxMu.Lock()
			approvalCtx = ctx
			approvalCtxMu.Unlock()
			defer func() {
				approvalCtxMu.Lock()
				approvalCtx = nil
				approvalCtxMu.Unlock()
			}()
			outcome, err := engine.Run(params.UserInput)
			if err != nil {
				return nil, err
			}
			if outcome.FinalMessage != "" && !engine.Stream {
				publishWireContent(w, wire.ContentText, outcome.FinalMessage)
			}
			if event, err := wire.NewEvent(wire.EventTurnEnd, wire.TurnEnd{}); err == nil {
				w.SoulSide.PublishEvent(event)
			}
			return map[string]any{"status": "completed", "stop_reason": outcome.StopReason}, nil
		},
		Steer: func(ctx context.Context, params wire.SteerParams) (any, error) {
			engine.Steer.Push(params.UserInput)
			return map[string]any{"status": "accepted"}, nil
		},
		Cancel: func(context.Context) (any, error) {
			engine.Cancel()
			return map[string]any{"status": "ok"}, nil
		},
		SetPlanMode: func(ctx context.Context, params wire.SetPlanModeParams) (any, error) {
			if event, err := wire.NewEvent(wire.EventStatusUpdate, wire.StatusUpdate{PlanMode: &params.Enabled}); err == nil {
				w.SoulSide.PublishEvent(event)
			}
			return map[string]any{"status": "ok"}, nil
		},
	})
	if engine.Approver != nil {
		baseRequest := engine.Approver.RequestFunc
		engine.Approver.RequestFunc = func(toolName, description string) bool {
			approvalCtxMu.RLock()
			ctx := approvalCtx
			approvalCtxMu.RUnlock()
			if ctx == nil {
				ctx = context.Background()
			}
			if baseRequest != nil {
				return baseRequest(toolName, description)
			}
			return requestWireApproval(ctx, w, toolName, description)
		}
	}
	return server.Run(context.Background())
}

func runWireReplay(path string, out io.Writer) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	messages, err := wire.Replay(file)
	if err != nil {
		return err
	}
	for _, message := range messages {
		data, err := marshalWireReplayMessage(message)
		if err != nil {
			return err
		}
		if _, err := out.Write(data); err != nil {
			return err
		}
		if _, err := out.Write([]byte("\n")); err != nil {
			return err
		}
	}
	return nil
}

func marshalWireReplayMessage(message wire.WireMessage) ([]byte, error) {
	if message.Kind == wire.MessageEvent && message.Event != nil {
		return wire.MarshalEvent(*message.Event)
	}
	if message.Kind == wire.MessageRequest && message.Request != nil {
		return wire.MarshalRequest(*message.Request)
	}
	return nil, fmt.Errorf("invalid replay message kind %q", message.Kind)
}

func attachWireRecorder(w *wire.Wire, cfg *config.Config, store *session.SessionStore) (func(), error) {
	if store == nil {
		return func() {}, nil
	}
	model := "wire"
	if cfg != nil {
		if eff, err := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile); err == nil && eff.Profile.Model != "" {
			model = eff.Profile.Model
		}
	}
	sess := store.NewSession(model)
	if sess == nil || sess.Dir == "" {
		return func() {}, nil
	}
	file, err := os.OpenFile(filepath.Join(sess.Dir, "wire.jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}
	detach := wire.NewRecorder(file).Attach(w)
	return func() {
		detach()
		_ = file.Close()
	}, nil
}

func configureEngineForWire(engine *soul.Engine, w *wire.Wire) {
	engine.OnToken = func(s string) { publishWireContent(w, wire.ContentText, s) }
	engine.OnReasoning = func(s string) { publishWireContent(w, wire.ContentThink, s) }
	engine.OnStreamEnd = nil
	engine.OnStepBegin = func(n int) {
		if event, err := wire.NewEvent(wire.EventStepBegin, wire.StepBegin{N: n}); err == nil {
			w.SoulSide.PublishEvent(event)
		}
	}
	engine.OnCompactBegin = func() {
		if event, err := wire.NewEvent(wire.EventCompactionBegin, wire.CompactionBegin{}); err == nil {
			w.SoulSide.PublishEvent(event)
		}
	}
	engine.OnCompactEnd = func() {
		if event, err := wire.NewEvent(wire.EventCompactionEnd, wire.CompactionEnd{}); err == nil {
			w.SoulSide.PublishEvent(event)
		}
	}
	engine.OnToolCall = func(event soul.ToolCallEvent) {
		args, _ := json.Marshal(event.Arguments)
		wireEvent, err := wire.NewEvent(wire.EventToolCall, wire.ToolCall{ID: event.ID, Name: event.Name, Arguments: args})
		if err == nil {
			w.SoulSide.PublishEvent(wireEvent)
		}
	}
	engine.OnToolResult = func(event soul.ToolResultEvent) {
		wireEvent, err := wire.NewEvent(wire.EventToolResult, wire.ToolResult{ToolCallID: event.ToolCallID, Name: event.Name, Content: event.Content, Display: event.Display, Error: event.Error})
		if err == nil {
			w.SoulSide.PublishEvent(wireEvent)
		}
	}
}

func publishWireContent(w *wire.Wire, typ wire.ContentType, text string) {
	if event, err := wire.NewEvent(wire.EventContentPart, wire.ContentPart{Type: typ, Text: text}); err == nil {
		w.SoulSide.PublishEvent(event)
	}
}

var approvalRequestSeq uint64

func requestWireApproval(ctx context.Context, w *wire.Wire, toolName, description string) bool {
	id := fmt.Sprintf("approval_%d", atomic.AddUint64(&approvalRequestSeq, 1))
	req, err := wire.NewRequest(id, wire.RequestApproval, wire.ApprovalRequest{ID: id, Action: toolName, Description: description})
	if err != nil {
		return false
	}
	result, err := w.SoulSide.Request(ctx, req)
	if err != nil {
		return false
	}
	var resp wire.ApprovalResponse
	if err := json.Unmarshal(result, &resp); err != nil {
		return false
	}
	return resp.RequestID == id && (resp.Response == "approve" || resp.Response == "approved")
}
