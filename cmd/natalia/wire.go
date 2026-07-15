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
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/config"
	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/hook"
	"github.com/Misaka477/Natalia-Cli/internal/securefs"
	"github.com/Misaka477/Natalia-Cli/internal/session"
	"github.com/Misaka477/Natalia-Cli/internal/soul"
	"github.com/Misaka477/Natalia-Cli/internal/tools/ask_user"
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

type wireHTTPCLIOptions struct {
	AuthToken      string
	AllowedMethods []string
	TLSCertFile    string
	TLSKeyFile     string
}

func runWireHTTPCLI(cfg *config.Config, tools *toolset.Registry, addr string, debug bool, opts wireHTTPCLIOptions) error {
	store, err := session.NewStore()
	if err != nil {
		return err
	}
	runtimeServer, err := newWireRuntimeServer(cfg, tools, debug, wireRunOptions{SessionStore: store})
	if err != nil {
		return err
	}
	defer runtimeServer.close()
	server := wire.NewHTTPServerWithOptions(runtimeServer.w, runtimeServer.handler, wire.HTTPServerOptions{AuthToken: opts.AuthToken, AllowedMethods: opts.AllowedMethods})
	if opts.TLSCertFile != "" || opts.TLSKeyFile != "" {
		if opts.TLSCertFile == "" || opts.TLSKeyFile == "" {
			return fmt.Errorf("wire TLS requires both cert and key files")
		}
		return server.ListenAndServeTLS(addr, opts.TLSCertFile, opts.TLSKeyFile)
	}
	return server.ListenAndServe(addr)
}

func runWireUnixCLI(cfg *config.Config, tools *toolset.Registry, path string, debug bool, opts wireHTTPCLIOptions) error {
	store, err := session.NewStore()
	if err != nil {
		return err
	}
	runtimeServer, err := newWireRuntimeServer(cfg, tools, debug, wireRunOptions{SessionStore: store})
	if err != nil {
		return err
	}
	defer runtimeServer.close()
	server := wire.NewHTTPServerWithOptions(runtimeServer.w, runtimeServer.handler, wire.HTTPServerOptions{AuthToken: opts.AuthToken, AllowedMethods: opts.AllowedMethods})
	return server.ListenAndServeUnix(path)
}

type wireRunOptions struct {
	SessionStore *session.SessionStore
}

type wireRuntimeServer struct {
	w       *wire.Wire
	handler wire.ServerHandler
	close   func()
}

func runWireWithOptions(cfg *config.Config, tools *toolset.Registry, in io.Reader, out io.Writer, debug bool, opts wireRunOptions) error {
	runtimeServer, err := newWireRuntimeServer(cfg, tools, debug, opts)
	if err != nil {
		return err
	}
	defer runtimeServer.close()
	server := wire.NewServer(runtimeServer.w, in, out, runtimeServer.handler)
	return server.Run(context.Background())
}

func newWireRuntimeServer(cfg *config.Config, tools *toolset.Registry, debug bool, opts wireRunOptions) (*wireRuntimeServer, error) {
	w := wire.NewWire()
	wireInstance = w
	rt := DefaultAppRuntime()
	w.SetPendingOnExpired(func(requestID, reason string) {
		if event, err := wire.NewEvent(wire.EventStatusUpdate, wire.StatusUpdate{Diagnostics: []string{fmt.Sprintf("pending %s expired: %s", requestID, reason)}}); err == nil {
			w.SoulSide.PublishEvent(event)
		}
	})
	engine := buildEngine(cfg, tools, debug)
	registerAgentToolsForEngine(cfg, engine, tools)
	var approvalCtxMu sync.RWMutex
	var approvalCtx context.Context
	activeApprovalCtx := func() context.Context {
		approvalCtxMu.RLock()
		defer approvalCtxMu.RUnlock()
		return approvalCtx
	}
	configureRuntimeEngine := func() {
		configureEngineForWire(engine, w)
		configureEngineApprovalForWire(engine, w, activeApprovalCtx)
	}
	configureRuntimeEngine()
	detachRuntimeEvents := bridgeRuntimeEvents(engine, w)
	closeRecorder, wireSession, err := attachWireRecorder(w, cfg, opts.SessionStore, rt)
	if err != nil {
		detachRuntimeEvents()
		return nil, err
	}
	persistWireSessionState(cfg, opts.SessionStore, wireSession, rt)

	handler := wire.ServerHandler{
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
			turnStarted := time.Now()
			stopTurnStatus := startWireTurnStatusTicker(w, cfg, func() *soul.Engine { return engine }, turnStarted, time.Second, rt)
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
			stopTurnStatus()
			if err != nil {
				return nil, err
			}
			publishOutcomeFinalMessage(w, outcome, engine.Stream)
			if event, err := wire.NewEvent(wire.EventTurnEnd, wire.TurnEnd{}); err == nil {
				w.SoulSide.PublishEvent(event)
			}
			status := runtimeStatusUpdate(cfg, engine, rt)
			setTurnElapsed(&status, turnStarted, false)
			if event, err := wire.NewEvent(wire.EventStatusUpdate, status); err == nil {
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
			if params.Enabled {
				planManager.Enter("", "", "wire set_plan_mode")
			} else {
				planManager.Exit()
			}
			persistWireSessionState(cfg, opts.SessionStore, wireSession, rt)
			status := runtimeStatusUpdate(cfg, engine, rt)
			status.PlanMode = &params.Enabled
			if event, err := wire.NewEvent(wire.EventStatusUpdate, status); err == nil {
				w.SoulSide.PublishEvent(event)
			}
			return map[string]any{"status": "ok"}, nil
		},
		SetRuntimeProfile: func(ctx context.Context, params wire.SetRuntimeProfileParams) (any, error) {
			if cfg == nil {
				return nil, fmt.Errorf("未配置 runtime profile")
			}
			if _, err := cfg.EffectiveProfile(params.Mode, params.ModelProfile, params.PermissionProfile); err != nil {
				return nil, err
			}
			runtime.Mode = params.Mode
			runtime.ModelProfile = params.ModelProfile
			runtime.PermissionProfile = params.PermissionProfile
			if rt != nil {
				rt.SetOverrides(runtimeOverrides{Mode: params.Mode, ModelProfile: params.ModelProfile, PermissionProfile: params.PermissionProfile})
			}
			engine = rebuildEnginePreservingState(cfg, engine, tools, debug)
			registerAgentToolsForEngine(cfg, engine, tools)
			configureRuntimeEngine()
			persistWireSessionState(cfg, opts.SessionStore, wireSession, rt)
			status := runtimeStatusUpdate(cfg, engine, rt)
			if event, err := wire.NewEvent(wire.EventStatusUpdate, status); err == nil {
				w.SoulSide.PublishEvent(event)
			}
			return map[string]any{"status": "ok"}, nil
		},
		RestoreSession: func(ctx context.Context, params wire.RestoreSessionParams) (any, error) {
			if opts.SessionStore == nil {
				return nil, fmt.Errorf("会话存储不可用")
			}
			if cfg == nil {
				return nil, fmt.Errorf("未配置 runtime profile")
			}
			sess, err := opts.SessionStore.Load(params.SessionID)
			if err != nil {
				return nil, err
			}
			state, err := opts.SessionStore.LoadState(sess.ID)
			if err != nil {
				return nil, err
			}
			messages, err := opts.SessionStore.LoadMessages(sess.ID)
			if err != nil {
				return nil, err
			}
			restoredRuntime, warnings := validateRestoredRuntime(cfg, state)
			runtime = restoredRuntime
			if rt != nil {
				rt.SetOverrides(restoredRuntime)
			}
			restorePlanMode(state)
			warnings = append(warnings, restorePlanSession(state)...)
			engine = buildEngine(cfg, tools, debug)
			registerAgentToolsForEngine(cfg, engine, tools)
			engine.Context.Messages = append(engine.Context.Messages, messages...)
			attachSnapshotter(engine, sess)
			configureRuntimeEngine()
			persistWireSessionState(cfg, opts.SessionStore, wireSession, rt)
			status := runtimeStatusUpdate(cfg, engine, rt)
			if event, err := wire.NewEvent(wire.EventStatusUpdate, status); err == nil {
				w.SoulSide.PublishEvent(event)
			}
			return map[string]any{"status": "restored", "session_id": sess.ID, "messages_restored": len(messages), "warnings": warnings}, nil
		},
		ListSessions: func(ctx context.Context) (any, error) {
			if opts.SessionStore == nil {
				return nil, fmt.Errorf("会话存储不可用")
			}
			return map[string]any{"sessions": wireSessionSummaries(opts.SessionStore)}, nil
		},
	}
	if engine.Hooks != nil {
		engine.Hooks.OnWireHook = func(ctx context.Context, req hook.WireHookRequest) hook.HookResult {
			approvalCtxMu.RLock()
			activeCtx := approvalCtx
			approvalCtxMu.RUnlock()
			if activeCtx == nil {
				activeCtx = ctx
			}
			if activeCtx == nil {
				activeCtx = context.Background()
			}
			return requestWireHook(activeCtx, w, req)
		}
	}
	clearQuestionHandler := ask_user.SetHandler(func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		approvalCtxMu.RLock()
		activeCtx := approvalCtx
		approvalCtxMu.RUnlock()
		if activeCtx == nil {
			activeCtx = ctx
		}
		if activeCtx == nil {
			activeCtx = context.Background()
		}
		return requestWireQuestion(activeCtx, w, req)
	})
	return &wireRuntimeServer{w: w, handler: handler, close: func() {
		w.Close()
		clearQuestionHandler()
		closeRecorder()
		detachRuntimeEvents()
	}}, nil
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

func attachWireRecorder(w *wire.Wire, cfg *config.Config, store *session.SessionStore, rt *AppRuntime) (func(), *session.Session, error) {
	if store == nil {
		return func() {}, nil, nil
	}
	model := "wire"
	o := runtimeOverrides{}
	if rt != nil {
		o = rt.GetOverrides()
	}
	if o == (runtimeOverrides{}) {
		o = runtime
	}
	if cfg != nil {
		if eff, err := cfg.EffectiveProfile(o.Mode, o.ModelProfile, o.PermissionProfile); err == nil && eff.Profile.Model != "" {
			model = eff.Profile.Model
		}
	}
	sess := store.NewSession(model)
	if sess == nil || sess.Dir == "" {
		return func() {}, nil, nil
	}
	file, err := securefs.OpenAppend(filepath.Join(sess.Dir, "wire.jsonl"))
	if err != nil {
		return nil, nil, err
	}
	detach := wire.NewRecorder(file).Attach(w)
	return func() {
		detach()
		_ = file.Close()
	}, sess, nil
}

func persistWireSessionState(cfg *config.Config, store *session.SessionStore, sess *session.Session, rt *AppRuntime) {
	if store == nil || sess == nil {
		return
	}
	planState := planManager.Status()
	o := runtimeOverrides{}
	if rt != nil {
		o = rt.GetOverrides()
	}
	if o == (runtimeOverrides{}) {
		o = runtime
	}
	state := session.State{
		Mode:              o.Mode,
		ModelProfile:      o.ModelProfile,
		PermissionProfile: o.PermissionProfile,
		PlanMode:          planState.Enabled,
		PlanSessionID:     planState.Slug,
		PlanSlug:          planState.Slug,
		PlanPath:          planState.Path,
		AdditionalDirs:    effectiveAdditionalDirs(cfg, o),
	}
	cp := currentPlan
	if rt != nil {
		cp = rt.GetCurrentPlan()
	}
	if cp != nil {
		state.PlanSlug = cp.Slug
		state.PlanPath = cp.Path
		state.PlanDoneLines = donePlanLines(cp)
	}
	_ = store.SaveState(sess.ID, state)
}

type wireSessionSummary struct {
	ID                string `json:"id"`
	Title             string `json:"title,omitempty"`
	Model             string `json:"model"`
	UpdatedAt         string `json:"updated_at"`
	ContextTokens     int    `json:"context_tokens,omitempty"`
	Mode              string `json:"mode,omitempty"`
	ModelProfile      string `json:"model_profile,omitempty"`
	PermissionProfile string `json:"permission_profile,omitempty"`
	PlanMode          bool   `json:"plan_mode,omitempty"`
	PlanSlug          string `json:"plan_slug,omitempty"`
	PlanPath          string `json:"plan_path,omitempty"`
}

func wireSessionSummaries(store *session.SessionStore) []wireSessionSummary {
	if store == nil {
		return nil
	}
	sessions := store.List()
	out := make([]wireSessionSummary, 0, len(sessions))
	for _, sess := range sessions {
		state, _ := store.LoadState(sess.ID)
		out = append(out, wireSessionSummary{
			ID:                sess.ID,
			Title:             sess.Title,
			Model:             sess.Model,
			UpdatedAt:         sess.UpdatedAt.Format(time.RFC3339Nano),
			ContextTokens:     sess.ContextTokens,
			Mode:              state.Mode,
			ModelProfile:      state.ModelProfile,
			PermissionProfile: state.PermissionProfile,
			PlanMode:          state.PlanMode,
			PlanSlug:          state.PlanSlug,
			PlanPath:          state.PlanPath,
		})
	}
	return out
}

func runtimeStatusUpdate(cfg *config.Config, engine *soul.Engine, rt *AppRuntime) wire.StatusUpdate {
	status := wire.StatusUpdate{}
	planState := planManager.Status()
	status.PlanMode = &planState.Enabled
	contextTokens, maxContextTokens, contextUsage := contextTokenStats(engine)
	status.ContextTokens = &contextTokens
	status.MaxContextTokens = &maxContextTokens
	status.ContextUsage = &contextUsage
	if cfg == nil {
		status.Diagnostics = runtimeDiagnostics(engine, rt)
		return status
	}
	o := runtimeOverrides{}
	if rt != nil {
		o = rt.GetOverrides()
	}
	if o == (runtimeOverrides{}) {
		o = runtime
	}
	if eff, err := cfg.EffectiveProfile(o.Mode, o.ModelProfile, o.PermissionProfile); err == nil {
		status.Mode = eff.Mode
		status.ModelProfile = eff.ModelProfile
		status.PermissionProfile = eff.PermissionProfile
		status.Provider = eff.Profile.Provider
		status.Model = eff.Profile.Model
	}
	status.Diagnostics = runtimeDiagnostics(engine, rt)
	return status
}

func startWireTurnStatusTicker(w *wire.Wire, cfg *config.Config, engine func() *soul.Engine, started time.Time, interval time.Duration, rt *AppRuntime) func() {
	if w == nil || interval <= 0 {
		return func() {}
	}
	done := make(chan struct{})
	var once sync.Once
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				status := runtimeStatusUpdate(cfg, engine(), rt)
				setTurnElapsed(&status, started, true)
				if event, err := wire.NewEvent(wire.EventStatusUpdate, status); err == nil {
					w.SoulSide.PublishEvent(event)
				}
			case <-done:
				return
			}
		}
	}()
	return func() { once.Do(func() { close(done) }) }
}

func setTurnElapsed(status *wire.StatusUpdate, started time.Time, running bool) {
	if status == nil || started.IsZero() {
		return
	}
	elapsed := time.Since(started).Milliseconds()
	if elapsed < 0 {
		elapsed = 0
	}
	status.TurnElapsedMS = &elapsed
	status.TurnRunning = &running
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
	engine.OnCompact = func(message string) {
		publishWireNotification(w, wire.Notification{Title: "Context compacted", Message: message})
		status := wire.StatusUpdate{}
		contextTokens, maxContextTokens, contextUsage := contextTokenStats(engine)
		status.ContextTokens = &contextTokens
		status.MaxContextTokens = &maxContextTokens
		status.ContextUsage = &contextUsage
		if event, err := wire.NewEvent(wire.EventStatusUpdate, status); err == nil {
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

func configureEngineApprovalForWire(engine *soul.Engine, w *wire.Wire, ctxProvider func() context.Context) {
	if engine == nil || engine.Approver == nil || w == nil {
		return
	}
	baseRequest := engine.Approver.RequestFunc
	engine.Approver.RequestDisplayFunc = func(toolName, description string, blocks []display.Block) bool {
		if baseRequest != nil {
			return baseRequest(toolName, description)
		}
		ctx := context.Background()
		if ctxProvider != nil {
			if provided := ctxProvider(); provided != nil {
				ctx = provided
			}
		}
		return requestWireApproval(ctx, w, toolName, description, blocks)
	}
}

func publishOutcomeFinalMessage(w *wire.Wire, outcome *soul.Outcome, stream bool) {
	if outcome == nil || outcome.FinalMessage == "" {
		return
	}
	if !stream || outcome.StopReason == "error" || outcome.StopReason == "max_steps" {
		publishWireContent(w, wire.ContentText, outcome.FinalMessage)
	}
}

func publishWireContent(w *wire.Wire, typ wire.ContentType, text string) {
	if event, err := wire.NewEvent(wire.EventContentPart, wire.ContentPart{Type: typ, Text: text}); err == nil {
		w.SoulSide.PublishEvent(event)
	}
}

var approvalRequestSeq uint64

var questionRequestSeq uint64

var hookRequestSeq uint64

func requestWireApproval(ctx context.Context, w *wire.Wire, toolName, description string, blocks []display.Block) bool {
	id := fmt.Sprintf("approval_%d", atomic.AddUint64(&approvalRequestSeq, 1))
	req, err := wire.NewRequest(id, wire.RequestApproval, wire.ApprovalRequest{ID: id, Action: toolName, Description: description, Display: blocks})
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

func requestWireQuestion(ctx context.Context, w *wire.Wire, question wire.QuestionRequest) (wire.QuestionResponse, error) {
	id := fmt.Sprintf("question_%d", atomic.AddUint64(&questionRequestSeq, 1))
	question.ID = id
	req, err := wire.NewRequest(id, wire.RequestQuestion, question)
	if err != nil {
		return wire.QuestionResponse{}, err
	}
	result, err := w.SoulSide.Request(ctx, req)
	if err != nil {
		return wire.QuestionResponse{}, err
	}
	var resp wire.QuestionResponse
	if err := json.Unmarshal(result, &resp); err != nil {
		return wire.QuestionResponse{}, err
	}
	if resp.RequestID != id {
		return wire.QuestionResponse{}, fmt.Errorf("question response id mismatch: got %q want %q", resp.RequestID, id)
	}
	return resp, nil
}

func requestWireHook(ctx context.Context, w *wire.Wire, hookReq hook.WireHookRequest) hook.HookResult {
	id := fmt.Sprintf("hook_%d", atomic.AddUint64(&hookRequestSeq, 1))
	result := hook.HookResult{ID: hookReq.SubscriptionID, Event: hookReq.Event, Target: hookReq.Target, Matched: true}
	req, err := wire.NewRequest(id, wire.RequestHook, wire.HookRequest{ID: id, SubscriptionID: hookReq.SubscriptionID, Event: string(hookReq.Event), Target: hookReq.Target, InputData: hookReq.InputData})
	if err != nil {
		result.Error = err.Error()
		return result
	}
	raw, err := w.SoulSide.Request(ctx, req)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	result.Stdout = string(raw)
	var resp wire.HookResponse
	if err := json.Unmarshal(raw, &resp); err == nil {
		if resp.RequestID != "" && resp.RequestID != id {
			result.Error = fmt.Sprintf("hook response id mismatch: got %q want %q", resp.RequestID, id)
			return result
		}
		result.Response = hook.HookResponse{Action: resp.Action, Reason: resp.Reason, Message: resp.Message, ModifiedInputData: resp.ModifiedInputData}
	}
	return result
}
