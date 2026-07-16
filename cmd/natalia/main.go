package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/agentspec"
	"github.com/Misaka477/Natalia-Cli/internal/approval"
	"github.com/Misaka477/Natalia-Cli/internal/autoflow"
	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/compaction"
	"github.com/Misaka477/Natalia-Cli/internal/config"
	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/filepolicy"
	"github.com/Misaka477/Natalia-Cli/internal/hook"
	"github.com/Misaka477/Natalia-Cli/internal/interactivemgr"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	coremcp "github.com/Misaka477/Natalia-Cli/internal/mcp"
	"github.com/Misaka477/Natalia-Cli/internal/mode"
	"github.com/Misaka477/Natalia-Cli/internal/networkpolicy"
	"github.com/Misaka477/Natalia-Cli/internal/notifications"
	"github.com/Misaka477/Natalia-Cli/internal/orchestrator"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
	"github.com/Misaka477/Natalia-Cli/internal/planexec"
	presentation "github.com/Misaka477/Natalia-Cli/internal/presentation"
	"github.com/Misaka477/Natalia-Cli/internal/processmgr"
	"github.com/Misaka477/Natalia-Cli/internal/sandbox"
	"github.com/Misaka477/Natalia-Cli/internal/secret"
	"github.com/Misaka477/Natalia-Cli/internal/session"
	"github.com/Misaka477/Natalia-Cli/internal/skill"
	"github.com/Misaka477/Natalia-Cli/internal/snapshot"
	"github.com/Misaka477/Natalia-Cli/internal/term"
	tui "github.com/Misaka477/Natalia-Cli/internal/terminalui/tui"
	"github.com/Misaka477/Natalia-Cli/internal/tools/ask_user"
	"github.com/Misaka477/Natalia-Cli/internal/tools/browser"
	filetool "github.com/Misaka477/Natalia-Cli/internal/tools/file"
	mcptools "github.com/Misaka477/Natalia-Cli/internal/tools/mcptools"
	"github.com/Misaka477/Natalia-Cli/internal/tools/plantools"
	"github.com/Misaka477/Natalia-Cli/internal/tools/skilltools"
	"github.com/Misaka477/Natalia-Cli/internal/tools/web"
	workflowtools "github.com/Misaka477/Natalia-Cli/internal/tools/workflowtools"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
	"github.com/Misaka477/Natalia-Cli/internal/ui"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
	"github.com/Misaka477/Natalia-Cli/internal/worker"
	workflowcore "github.com/Misaka477/Natalia-Cli/internal/workflow"
	"github.com/peterh/liner"
)

// Legacy globals below are backward-compatible adapters.
// New code must use AppRuntime directly. These will be removed in a future slice.
// Legacy globals below are backward-compatible adapters for DefaultAppRuntime().
// New code must use AppRuntime directly. These will be removed in a future slice.
var (
	sessStore        *session.SessionStore
	currentSession   *session.Session
	workerPool       *worker.Pool
	skillRegistry    *skill.Registry
	runtime          runtimeOverrides
	currentPlan      *planexec.Session
	currentPlanMTime time.Time
	activeConfig     *config.Config
	mcpMu            sync.Mutex
	mcpClients       = map[string]*coremcp.Client{}
	mcpDiagnostics   = map[string]string{}
	workflowReg      *workflowcore.Registry
	planManager      = &plan.Manager{}
	wireInstance     *wire.Wire
)

type runtimeOverrides struct {
	Mode              string
	ModelProfile      string
	PermissionProfile string
}

func main() {
	defer closeRuntimeResources()

	noSetupFlag := flag.Bool("no-setup", false, "跳过交互式配置引导")
	debug := flag.Bool("debug", false, "打印调试日志")
	profile := flag.String("profile", "", "使用指定配置")
	wireFlag := flag.Bool("wire", false, "通过 stdin/stdout 运行 Wire JSON-RPC 服务")
	wireHTTP := flag.String("wire-http", "", "通过 HTTP/SSE/WebSocket 提供 Wire 服务，例如 127.0.0.1:8787")
	wireUnix := flag.String("wire-unix", "", "通过 Unix socket 提供 Wire HTTP 服务")
	wireAuthToken := flag.String("wire-auth-token", "", "HTTP/SSE/WebSocket/Unix Wire transport Bearer token")
	wireAllowMethods := flag.String("wire-allow-methods", "", "逗号分隔的 Wire JSON-RPC method allowlist，默认允许全部内置方法")
	wireTLSCert := flag.String("wire-tls-cert", "", "Wire HTTP TLS certificate file")
	wireTLSKey := flag.String("wire-tls-key", "", "Wire HTTP TLS private key file")
	wireReplay := flag.String("wire-replay", "", "重放 wire.jsonl 到 stdout")
	tuiFlag := flag.Bool("tui", false, "启动 Bubble Tea TUI 模式（实验性）")
	flag.Parse()

	cfg, _ := config.Load()

	if *profile != "" && cfg != nil {
		cfg.DefaultProfile = *profile
	}
	DefaultAppRuntime().SetActiveConfig(cfg)

	tools := toolset.NewRegistry()
	registerTools(tools, DefaultAppRuntime())
	if *wireReplay != "" {
		if err := runWireReplay(*wireReplay, os.Stdout); err != nil {
			fmt.Fprintf(os.Stderr, "wire replay error: %v\n", err)
			exitWithCleanup(1)
		}
		return
	}
	if *wireFlag {
		if err := runWireCLI(cfg, tools, os.Stdin, os.Stdout, *debug); err != nil {
			fmt.Fprintf(os.Stderr, "wire error: %v\n", err)
			exitWithCleanup(1)
		}
		return
	}
	if *wireHTTP != "" {
		if err := runWireHTTPCLI(cfg, tools, *wireHTTP, *debug, wireHTTPCLIOptions{AuthToken: *wireAuthToken, AllowedMethods: parseWireAllowedMethods(*wireAllowMethods), TLSCertFile: *wireTLSCert, TLSKeyFile: *wireTLSKey}); err != nil {
			fmt.Fprintf(os.Stderr, "wire http error: %v\n", err)
			exitWithCleanup(1)
		}
		return
	}
	if *wireUnix != "" {
		if err := runWireUnixCLI(cfg, tools, *wireUnix, *debug, wireHTTPCLIOptions{AuthToken: *wireAuthToken, AllowedMethods: parseWireAllowedMethods(*wireAllowMethods)}); err != nil {
			fmt.Fprintf(os.Stderr, "wire unix error: %v\n", err)
			exitWithCleanup(1)
		}
		return
	}

	if len(flag.Args()) > 0 {
		runOnce(cfg, tools, strings.Join(flag.Args(), " "))
		return
	}

	if *tuiFlag && !isTerminal(int(os.Stdout.Fd())) {
		fmt.Fprintln(os.Stderr, "非 TTY 模式，禁用 --tui")
		*tuiFlag = false
	}

	runInteractive(cfg, tools, *noSetupFlag, *debug, *tuiFlag)
}

func isTerminal(fd int) bool {
	stat, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return (stat.Mode() & os.ModeCharDevice) != 0
}

func parseWireAllowedMethods(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func registerTools(r *toolset.Registry, rt *AppRuntime) {
	cfg := rt.GetActiveConfig()
	configureWebBrowserTools(cfg)
	skill.ConfigureInstructions(cfg)
	wd, _ := os.Getwd()
	reg, _ := workflowcore.Discover(wd)
	rt.SetWorkflowRegistry(reg)
	workflowtools.SetDefaultRegistry(reg)
	if err := toolset.RegisterDefaultTools(r); err != nil {
		fmt.Fprintf(os.Stderr, "加载默认工具失败: %v\n", err)
	}
	registerRuntimePlanTools(r, rt)
	registerPolicyAwareFileTools(r, rt)
}

func registerRuntimePlanTools(r *toolset.Registry, rt *AppRuntime) {
	if r == nil || rt == nil {
		return
	}
	r.Register(&plantools.Enter{Manager: rt.GetPlanManager()})
	r.Register(&plantools.Exit{Manager: rt.GetPlanManager()})
	r.Register(&plantools.Status{Manager: rt.GetPlanManager()})
}

func registerPolicyAwareFileTools(r *toolset.Registry, rt *AppRuntime) {
	cfg := rt.GetActiveConfig()
	policy := runtimeFilePolicy(cfg, rt.GetOverrides())
	pm := rt.GetPlanManager()
	writeGuard := func(path string) error {
		if err := policy.GuardWrite(path); err != nil {
			return err
		}
		return pm.GuardWrite(path)
	}
	r.Register(&filetool.Read{Guard: policy.GuardRead})
	r.Register(&filetool.Write{Guard: writeGuard})
	r.Register(&filetool.Edit{Guard: writeGuard})
	r.Register(&filetool.Grep{Guard: policy})
	r.Register(&filetool.Glob{Guard: policy})
}

func runtimeFilePolicy(cfg *config.Config, o runtimeOverrides) filepolicy.Policy {
	workDir := ""
	if cfg != nil {
		if eff, err := cfg.EffectiveProfile(o.Mode, o.ModelProfile, o.PermissionProfile); err == nil {
			workDir = eff.Profile.WorkDir
		}
	}
	if workDir == "" {
		workDir, _ = os.Getwd()
	}
	return filepolicy.New(workDir, effectiveAdditionalDirs(cfg, o))
}

func configureWebBrowserTools(cfg *config.Config) {
	if cfg == nil {
		return
	}
	secret.SetEnvAllowlist(cfg.Security.EnvAllowlist)
	policy, err := networkPolicyFromConfig(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "网络策略配置无效，使用默认策略: %v\n", err)
		policy = networkpolicy.Default()
	}
	web.ConfigureNetworkPolicy(policy)
	if len(cfg.WebSearch.ProviderPriority) > 0 {
		web.SearchProviderPriority = strings.Join(cfg.WebSearch.ProviderPriority, ",")
	}
	if cfg.WebSearch.BaseURL != "" {
		web.SearchBaseURL = cfg.WebSearch.BaseURL
	}
	browser.Configure(browser.Options{
		Backend:           cfg.Browser.Backend,
		PersistentProfile: cfg.Browser.PersistentProfile,
		ProfileDir:        cfg.Browser.ProfileDir,
		UserAgent:         cfg.Browser.UserAgent,
		Locale:            cfg.Browser.Locale,
		Timezone:          cfg.Browser.Timezone,
		Headers:           cfg.Browser.Headers,
		Stealth:           cfg.Browser.Stealth,
		Trace:             cfg.Browser.Trace,
		NetworkPolicy:     policy,
	})
}

func networkPolicyFromConfig(cfg *config.Config) (*networkpolicy.Policy, error) {
	if cfg == nil {
		return networkpolicy.Default(), nil
	}
	return networkpolicy.New(networkpolicy.Config{
		AllowedHosts:   cfg.NetworkPolicy.AllowedHosts,
		AllowedCIDRs:   cfg.NetworkPolicy.AllowedCIDRs,
		AllowedSchemes: cfg.NetworkPolicy.AllowedSchemes,
		AllowLocalhost: cfg.NetworkPolicy.AllowLocalhost,
		AllowPrivate:   cfg.NetworkPolicy.AllowPrivate,
	})
}

func loadMCPServers(cfg *config.Config, r *toolset.Registry, modeConfig *config.ModeProfile) error {
	if cfg == nil || r == nil || modeConfig == nil || len(cfg.MCPServers) == 0 || len(modeConfig.MCPServers) == 0 {
		return nil
	}
	var errs []string
	for _, serverName := range modeConfig.MCPServers {
		serverName = strings.TrimSpace(serverName)
		if serverName == "" {
			continue
		}
		serverCfg, ok := cfg.MCPServers[serverName]
		if !ok {
			errs = append(errs, fmt.Sprintf("%s: 未配置", serverName))
			recordMCPDiagnostic(serverName, "missing config")
			continue
		}
		if err := loadMCPServer(serverName, serverCfg, r); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", serverName, err))
			recordMCPDiagnostic(serverName, err.Error())
		}
	}
	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

func loadMCPServer(serverName string, cfg config.MCPServerConfig, r *toolset.Registry) error {
	client, err := mcpClientForServer(serverName, cfg)
	if err != nil {
		return err
	}
	tools, err := client.ListTools(nil)
	if err != nil {
		return err
	}
	registered := 0
	for _, remoteTool := range tools {
		wrapped, err := mcptools.NewTool(serverName, remoteTool, client)
		if err != nil {
			return err
		}
		if !mcpToolAllowed(cfg, remoteTool.Name, wrapped.Name()) {
			continue
		}
		r.Register(wrapped)
		registered++
		if !cfg.ReadOnly && !mcptools.IsReadOnly(remoteTool) {
			approval.RegisterWriteTool(wrapped.Name())
		}
	}
	stats := client.Stats()
	recordMCPDiagnostic(serverName, fmt.Sprintf("ok transport=%s tools=%d registered=%d requests=%d errors=%d", stats.Transport, len(tools), registered, stats.Requests, stats.Errors))
	return nil
}

func mcpClientForServer(serverName string, cfg config.MCPServerConfig) (*coremcp.Client, error) {
	mcpMu.Lock()
	defer mcpMu.Unlock()
	if client := mcpClients[serverName]; client != nil {
		return client, nil
	}
	headers := map[string]string{}
	for key, value := range cfg.Headers {
		headers[key] = value
	}
	if cfg.OAuthToken != "" {
		headers["Authorization"] = "Bearer " + cfg.OAuthToken
	}
	policy, err := networkPolicyFromConfig(DefaultAppRuntime().GetActiveConfig())
	if err != nil {
		return nil, err
	}
	client, err := coremcp.Start(context.Background(), coremcp.ServerConfig{Command: cfg.Command, Args: cfg.Args, Cwd: cfg.Cwd, URL: cfg.URL, Headers: headers, TimeoutSec: cfg.TimeoutSec, Policy: policy})
	if err != nil {
		return nil, err
	}
	if err := client.Initialize(nil); err != nil {
		_ = client.Close()
		return nil, err
	}
	mcpClients[serverName] = client
	return client, nil
}

func recordMCPDiagnostic(server, message string) {
	mcpMu.Lock()
	mcpDiagnostics[server] = message
	mcpMu.Unlock()
}

func currentMCPDiagnostics() map[string]string {
	mcpMu.Lock()
	defer mcpMu.Unlock()
	out := make(map[string]string, len(mcpDiagnostics))
	for key, value := range mcpDiagnostics {
		out[key] = value
	}
	return out
}

func closeMCPClients() {
	mcpMu.Lock()
	clients := mcpClients
	mcpClients = map[string]*coremcp.Client{}
	mcpMu.Unlock()
	for _, client := range clients {
		_ = client.Close()
	}
}

func closeRuntimeResources() {
	if wireInstance != nil {
		wireInstance.Close()
		wireInstance = nil
	}
	if workerPool != nil {
		workerPool.Shutdown()
	}
	processmgr.DefaultManager().Shutdown()
	interactivemgr.DefaultManager().Shutdown()
	notifications.DefaultStore().Drain()
	closeMCPClients()
	_ = browser.Close()
}

func exitWithCleanup(code int) {
	closeRuntimeResources()
	os.Exit(code)
}

func mcpToolAllowed(cfg config.MCPServerConfig, originalName, registeredName string) bool {
	if len(cfg.AllowedTools) > 0 && !matchesAnyToolPattern(cfg.AllowedTools, originalName, registeredName) {
		return false
	}
	if matchesAnyToolPattern(cfg.ExcludeTools, originalName, registeredName) {
		return false
	}
	return true
}

func matchesAnyToolPattern(patterns []string, names ...string) bool {
	for _, patternValue := range patterns {
		patternValue = strings.TrimSpace(patternValue)
		if patternValue == "" {
			continue
		}
		for _, name := range names {
			if patternValue == name {
				return true
			}
			if matched, err := path.Match(patternValue, name); err == nil && matched {
				return true
			}
		}
	}
	return false
}

func buildEngine(cfg *config.Config, tools *toolset.Registry, debug bool) *orchestrator.Engine {
	if cfg == nil {
		return orchestrator.NewEngine(nil, tools)
	}
	pr, p, err := cfg.ActiveProfile()
	eff, effErr := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
	if err != nil && effErr != nil {
		return orchestrator.NewEngine(nil, tools)
	}
	if effErr == nil {
		pr = &eff.Profile
		p = &eff.Provider
		if err := loadMCPServers(cfg, tools, &eff.ModeConfig); err != nil {
			fmt.Fprintf(os.Stderr, "加载 MCP 工具失败: %v\n", err)
		}
	}

	llmClient := newLLMClient(pr, p)

	engine := orchestrator.NewEngine(llmClient, tools)
	engine.InjectionProviders = []orchestrator.InjectionProvider{
		orchestrator.PlanModeInjectionProvider{Manager: DefaultAppRuntime().GetPlanManager()},
		orchestrator.SafetyInjectionProvider{},
		orchestrator.NotificationInjectionProvider{Store: notifications.DefaultStore()},
		&orchestrator.AFKInjectionProvider{},
	}
	engine.Context.MaxSteps = pr.MaxSteps
	if engine.Context.MaxSteps == 0 {
		engine.Context.MaxSteps = 50
	}

	systemPrompt := "你是 Natalia CLI，一个运行在用户电脑上的交互式编程助手。"
	if spec, err := agentspec.LoadDefaultAgentSpec(); err == nil {
		if prompt, err := spec.RenderSystemPrompt(agentspec.DefaultTemplateArgs()); err == nil {
			systemPrompt = prompt
		}
	}
	if pr.SystemPrompt != "" {
		systemPrompt = pr.SystemPrompt
	}
	engine.Context.Messages = append(engine.Context.Messages, chat.Message{
		Role:    chat.RoleSystem,
		Content: systemPrompt,
	})

	engine.Stream = pr.Stream
	engine.OnToken = func(s string) { fmt.Print(s) }
	inReasoning := false
	engine.OnReasoning = func(s string) {
		if !inReasoning {
			fmt.Print("\n\033[38;5;245m")
			inReasoning = true
		}
		fmt.Print(s)
	}
	engine.OnToken = func(s string) {
		if inReasoning {
			fmt.Print("\033[0m\n\n")
			inReasoning = false
		}
		fmt.Print(s)
	}
	engine.OnStreamEnd = func() {
		if inReasoning {
			fmt.Print("\033[0m\n\n")
			inReasoning = false
		}
	}

	ctxSize := pr.MaxContext
	if ctxSize == 0 {
		ctxSize = ui.DetectContext(pr.Model)
		if ctxSize == 0 {
			ctxSize = 128000
		}
	}
	engine.Compactor = compaction.NewSimpleCompaction()
	engine.MaxContextSize = ctxSize
	engine.CompactRatio = 0.85
	engine.ReservedTokens = 50000
	engine.AutoCompact = true

	approvalMode := approval.Mode(pr.AutoApprove)
	if effErr == nil && eff.Approval != "" {
		approvalMode = approval.Mode(eff.Approval)
	}
	if approvalMode == "" {
		approvalMode = approval.ModeAsk
	}
	engine.Approver = approval.New(approvalMode)

	modeName := pr.Mode
	if effErr == nil {
		modeName = eff.Mode
	}
	if modeName == "" {
		modeName = "code"
	}
	if effErr == nil {
		if m, err := modeFromEffective(eff); err == nil {
			engine.Mode = m
		}
	} else if m, err := mode.Get(modeName); err == nil {
		engine.Mode = m
	}

	engine.Debug = debug
	if debug {
		engine.Log = func(format string, args ...any) {
			fmt.Fprintf(os.Stderr, "[DEBUG] "+format+"\n", args...)
		}
	}
	engine.Hooks = buildHookEngine(cfg)
	return engine
}

func buildHookEngine(cfg *config.Config) *hook.Engine {
	if cfg == nil {
		return nil
	}
	defs := append([]config.HookDef(nil), cfg.Hooks...)
	if eff, err := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile); err == nil {
		defs = append(defs, eff.ModeConfig.Hooks...)
	}
	if len(defs) == 0 {
		return nil
	}
	hooks := make([]hook.HookDef, 0, len(defs))
	for _, def := range defs {
		hooks = append(hooks, hook.HookDef{ID: def.ID, Event: hook.EventType(def.Event), Target: def.Target, Command: def.Command, Cwd: def.Cwd, TimeoutSec: def.TimeoutSec, OnFailure: def.OnFailure})
	}
	return hook.NewEngine(hooks)
}

func rebuildEnginePreservingState(cfg *config.Config, old *orchestrator.Engine, tools *toolset.Registry, debug bool) *orchestrator.Engine {
	engine := buildEngine(cfg, tools, debug)
	if old == nil {
		return engine
	}
	engine.Context = old.Context
	engine.Snapshotter = old.Snapshotter
	engine.ToolCache = old.ToolCache
	if engine.Mode != nil {
		applyModePrompt(engine, engine.Mode)
	}
	return engine
}

func applyModePrompt(engine *orchestrator.Engine, m *mode.Mode) {
	if engine == nil || m == nil || len(engine.Context.Messages) == 0 || engine.Context.Messages[0].Role != chat.RoleSystem {
		return
	}
	msg := &engine.Context.Messages[0]
	const modeSection = "\n\n当前 mode：\n"
	if i := strings.Index(msg.Content, modeSection); i >= 0 {
		msg.Content = msg.Content[:i]
	}
	msg.Content += modeSection + m.Prompt
}

func currentModeName(cfg *config.Config) string {
	if cfg == nil {
		return "code"
	}
	eff, err := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
	if err != nil || eff.Mode == "" {
		return "code"
	}
	return eff.Mode
}

func applyAutoflowDecision(decision autoflow.Decision, cfg *config.Config, engine **orchestrator.Engine, tools *toolset.Registry, debug bool) {
	if decision.Action == autoflow.ActionNone || decision.TargetMode == "" {
		return
	}
	runtime.Mode = decision.TargetMode
	runtime.ModelProfile = ""
	runtime.PermissionProfile = ""
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
}

func maybeRecordAutoflow(enabled bool, escalator *autoflow.Escalator, outcome *orchestrator.Outcome, cfg *config.Config) autoflow.Decision {
	if !enabled || escalator == nil {
		return autoflow.Decision{}
	}
	return escalator.Record(outcome, currentModeName(cfg))
}

func handleAuto(input string, enabled *bool, escalator *autoflow.Escalator) {
	if enabled == nil {
		return
	}
	parts := strings.Fields(input)
	cmd := "status"
	if len(parts) > 1 {
		cmd = parts[1]
	}
	switch cmd {
	case "status":
		state := "off"
		if *enabled {
			state = "on"
		}
		consecutive := 0
		autoDebug := false
		previousMode := ""
		threshold := autoflow.DefaultFailureThreshold
		if escalator != nil {
			consecutive = escalator.Consecutive
			autoDebug = escalator.AutoDebug
			previousMode = escalator.PreviousMode
			if escalator.Threshold > 0 {
				threshold = escalator.Threshold
			}
		}
		fmt.Printf("auto: %s\n", state)
		fmt.Printf("failure_threshold: %d\n", threshold)
		fmt.Printf("consecutive_failures: %d\n", consecutive)
		fmt.Printf("auto_debug: %t\n", autoDebug)
		if previousMode != "" {
			fmt.Printf("previous_mode: %s\n", previousMode)
		}
		for _, line := range currentPlan.StatusLines() {
			fmt.Println(line)
		}
	case "on":
		*enabled = true
		if escalator != nil {
			escalator.Reset()
		}
		fmt.Println("✓ auto 已开启")
	case "off":
		*enabled = false
		if escalator != nil {
			escalator.Reset()
		}
		fmt.Println("✓ auto 已关闭")
	default:
		fmt.Println("用法: /auto [status|on|off]")
	}
}

func handleExecutePlan(input string, cfg *config.Config, engine **orchestrator.Engine, tools *toolset.Registry, debug bool, rt *AppRuntime) {
	parts := strings.Fields(input)
	if len(parts) < 2 {
		fmt.Println("用法: /execute-plan <plan.md>")
		return
	}
	planPath, err := resolvePlanArgument(strings.Trim(parts[1], "\"'"))
	if err != nil {
		fmt.Printf("读取计划失败: %v\n", err)
		return
	}
	planPath = filepath.Clean(planPath)
	info, err := os.Stat(planPath)
	if err != nil {
		fmt.Printf("读取计划失败: %v\n", err)
		return
	}
	if info.IsDir() {
		fmt.Println("计划路径不能是目录")
		return
	}
	if info.Size() > 200*1024 {
		fmt.Println("计划文件过大，当前限制 200 KiB")
		return
	}
	data, err := os.ReadFile(planPath)
	if err != nil {
		fmt.Printf("读取计划失败: %v\n", err)
		return
	}
	currentPlan = planexec.Parse(planPath, string(data))
	currentPlanMTime = info.ModTime()
	o := runtimeOverrides{Mode: "code"}
	if rt != nil {
		rt.SetOverrides(o)
	}
	runtime = o
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
	(*engine).Steer.Push(currentPlan.Instruction())
	persistCurrentSessionState()
	fmt.Printf("✓ 已载入计划并切换到 code mode: %s\n", planPath)
	if step, ok := currentPlan.NextOpenStep(); ok {
		fmt.Printf("下一未完成项: line %d: %s\n", step.Line, step.Text)
	}
	fmt.Println("下一条普通输入将带着该计划继续执行。")
}

func resolvePlanArgument(arg string) (string, error) {
	if strings.TrimSpace(arg) == "" {
		return "", fmt.Errorf("plan path or slug is required")
	}
	ext := filepath.Ext(arg)
	if ext != "" || strings.ContainsAny(arg, `/\`) {
		if ext != ".md" {
			return "", fmt.Errorf("计划文件必须是 .md 文件")
		}
		return arg, nil
	}
	wd, _ := os.Getwd()
	return plan.FindBySlug(wd, arg)
}

func handlePlan(input string, rt *AppRuntime) {
	parts := strings.Fields(input)
	cmd := "status"
	if len(parts) > 1 {
		cmd = parts[1]
	}
	switch cmd {
	case "status":
		for _, line := range currentPlan.StatusLines() {
			fmt.Println(line)
		}
	case "done", "confirm":
		markCurrentPlanDone(true)
	case "clear":
		currentPlan = nil
		currentPlanMTime = time.Time{}
		persistCurrentSessionState()
		fmt.Println("✓ 已清除当前计划")
	case "show":
		if currentPlan == nil {
			fmt.Println("没有活动计划。用法: /execute-plan <plan.md|slug>")
			return
		}
		fmt.Println(currentPlan.Instruction())
	default:
		fmt.Println("用法: /plan [status|show|done|confirm|clear]")
	}
}

func markCurrentPlanDone(writeBack bool) bool {
	if currentPlan == nil {
		fmt.Println("没有活动计划。用法: /execute-plan <plan.md|slug>")
		return false
	}
	step, ok := currentPlan.MarkNextDone()
	if !ok {
		fmt.Println("计划中没有未完成项")
		return false
	}
	if writeBack {
		if err := currentPlan.WriteDone(currentPlanMTime); err != nil {
			step.Done = false
			for i := range currentPlan.Steps {
				if currentPlan.Steps[i].Line == step.Line {
					currentPlan.Steps[i].Done = false
				}
			}
			fmt.Printf("写回计划失败: %v\n", err)
			return false
		}
		if info, err := os.Stat(currentPlan.Path); err == nil {
			currentPlanMTime = info.ModTime()
		}
	}
	fmt.Printf("✓ 已标记完成: line %d: %s\n", step.Line, step.Text)
	if writeBack {
		fmt.Printf("✓ 已安全写回计划文件: %s\n", currentPlan.Path)
	}
	if next, ok := currentPlan.NextOpenStep(); ok {
		fmt.Printf("下一未完成项: line %d: %s\n", next.Line, next.Text)
	} else {
		fmt.Println("计划 checklist 已全部完成")
	}
	persistCurrentSessionState()
	return true
}

func handleWorkflow(input string, engine *orchestrator.Engine, rt *AppRuntime) {
	parts := strings.Fields(input)
	cmd := "list"
	if len(parts) > 1 {
		cmd = parts[1]
	}
	reg := rt.GetWorkflowRegistry()
	if reg == nil {
		fmt.Println("没有可用的 workflow registry")
		return
	}
	switch cmd {
	case "list":
		items := reg.List()
		if len(items) == 0 {
			fmt.Println("没有可用的 workflow")
			return
		}
		for _, wf := range items {
			fmt.Printf("- %s: %s (%d steps)\n", wf.Name, displayEmpty(wf.Description, wf.Source), len(wf.Steps))
		}
	case "run":
		if len(parts) < 3 {
			fmt.Println("用法: /workflow run <name> [state_path]")
			return
		}
		state, instruction, err := reg.Run(parts[2])
		if err != nil {
			fmt.Printf("启动 workflow 失败: %v\n", err)
			return
		}
		if len(parts) > 3 {
			statePath := expandSlashVariables(parts[3])
			if err := workflowcore.SaveRunState(statePath, *state); err != nil {
				fmt.Printf("保存 workflow 状态失败: %v\n", err)
				return
			}
			instruction += "\n\nWorkflow state saved to: " + statePath
		}
		if engine != nil && engine.Steer != nil {
			engine.Steer.Push(instruction)
		}
		fmt.Printf("✓ 已载入 workflow: %s (%d steps)\n", state.WorkflowName, state.TotalSteps)
		fmt.Println("下一条普通输入将带着该 workflow 当前步骤继续执行。")
	case "diagnostics":
		diag := reg.Diagnostics()
		if len(diag) == 0 {
			fmt.Println("workflow diagnostics: none")
			return
		}
		for _, item := range diag {
			status := "loaded"
			if !item.Loaded {
				status = "skipped"
			}
			fmt.Printf("- %s: %s %s\n", item.Source, status, item.Reason)
		}
	default:
		fmt.Println("用法: /workflow [list|run <name> [state_path]|diagnostics]")
	}
}

func expandSlashVariables(value string) string {
	return os.Expand(strings.Trim(value, "\"'"), func(key string) string {
		switch key {
		case "workDir", "WORK_DIR":
			wd, _ := os.Getwd()
			return wd
		case "mode", "MODE":
			return runtime.Mode
		case "profile", "PROFILE":
			if activeConfig != nil {
				return activeConfig.DefaultProfile
			}
		case "timestamp", "TIMESTAMP":
			return time.Now().Format("20060102-150405")
		}
		return os.Getenv(key)
	})
}

func newLLMClient(pr *config.Profile, p *config.Provider) *llm.Client {
	return llm.NewClient(llm.Config{
		APIKey:          p.APIKey,
		BaseURL:         p.BaseURL,
		Model:           pr.Model,
		Temperature:     pr.Temperature,
		MaxTokens:       pr.MaxTokens,
		TopP:            pr.TopP,
		ReasoningEffort: pr.ReasoningEffort,
		ThinkingEnabled: pr.ThinkingEnabled,
		AuthHeader:      p.AuthHeader,
		CustomHeaders:   p.CustomHeaders,
		Timeout:         time.Duration(pr.TimeoutSec) * time.Second,
	})
}

func modeFromEffective(eff *config.EffectiveProfile) (*mode.Mode, error) {
	if builtin, err := mode.Get(eff.Mode); err == nil {
		m := *builtin
		if prompt, err := modePrompt(eff.ModeConfig); err != nil {
			return nil, err
		} else if prompt != "" {
			m.Prompt = prompt
		}
		if eff.ModeConfig.Description != "" {
			m.DisplayName = eff.ModeConfig.Description
		}
		m.ToolFilter = applyMCPServerPolicy(applyToolPolicy(m.ToolFilter, eff.ModeConfig.Tools), eff.ModeConfig.MCPServers, eff.ModeConfig.Tools)
		return &m, nil
	}
	if isZeroModeProfile(eff.ModeConfig) {
		return nil, fmt.Errorf("未知模式: %s", eff.Mode)
	}
	baseName := eff.ModeConfig.Extends
	if baseName == "" {
		baseName = "code"
	}
	base, err := mode.Get(baseName)
	if err != nil {
		return nil, fmt.Errorf("模式 %q 继承了未知模式 %q", eff.Mode, baseName)
	}
	m := *base
	m.Name = eff.Mode
	if eff.ModeConfig.Description != "" {
		m.DisplayName = eff.ModeConfig.Description
	} else {
		m.DisplayName = eff.Mode
	}
	if prompt, err := modePrompt(eff.ModeConfig); err != nil {
		return nil, err
	} else if prompt != "" {
		m.Prompt = prompt
	}
	m.ToolFilter = applyMCPServerPolicy(applyToolPolicy(m.ToolFilter, eff.ModeConfig.Tools), eff.ModeConfig.MCPServers, eff.ModeConfig.Tools)
	return &m, nil
}

func isZeroModeProfile(profile config.ModeProfile) bool {
	return profile.Extends == "" && profile.Description == "" && profile.ModelProfile == "" && profile.PermissionProfile == "" && profile.SystemPrompt == "" && profile.SystemPromptPath == "" && profile.ReasoningEffort == "" && profile.ThinkingEnabled == nil && len(profile.Tools.Allowed) == 0 && len(profile.Tools.Exclude) == 0 && len(profile.MCPServers) == 0
}

func modePrompt(profile config.ModeProfile) (string, error) {
	if profile.SystemPrompt != "" {
		return profile.SystemPrompt, nil
	}
	if profile.SystemPromptPath == "" {
		return "", nil
	}
	data, err := os.ReadFile(profile.SystemPromptPath)
	if err != nil {
		return "", fmt.Errorf("读取 mode system_prompt_path 失败: %w", err)
	}
	return string(data), nil
}

func applyToolPolicy(base func(string, map[string]any) bool, policy config.ToolPolicy) func(string, map[string]any) bool {
	allowed := make(map[string]bool, len(policy.Allowed))
	for _, name := range policy.Allowed {
		allowed[name] = true
	}
	excluded := make(map[string]bool, len(policy.Exclude))
	for _, name := range policy.Exclude {
		excluded[name] = true
	}
	if len(allowed) == 0 && len(excluded) == 0 {
		return base
	}
	return func(name string, args map[string]any) bool {
		if len(allowed) > 0 && !allowed[name] {
			return false
		}
		if excluded[name] {
			return false
		}
		return base(name, args)
	}
}

func applyMCPServerPolicy(base func(string, map[string]any) bool, servers []string, policy config.ToolPolicy) func(string, map[string]any) bool {
	if len(servers) == 0 {
		return base
	}
	return func(name string, args map[string]any) bool {
		if matchesAnyToolPattern(policy.Exclude, name) {
			return false
		}
		for _, server := range servers {
			if mcptools.IsToolFromServer(name, server) {
				return true
			}
		}
		return base(name, args)
	}
}

func runOnce(cfg *config.Config, tools *toolset.Registry, input string) {
	engine := buildEngine(cfg, tools, false)
	if engine.LLM == nil {
		fmt.Fprintln(os.Stderr, "未配置模型。设置 --profile 或使用 /setup 配置。")
		exitWithCleanup(1)
	}
	engine.OnReasoning = nil
	engine.OnStreamEnd = nil
	outcome, err := engine.Run(input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		exitWithCleanup(1)
	}
	if engine.Stream {
		fmt.Println()
		return
	}
	fmt.Println(outcome.FinalMessage)
}

func runInteractive(cfg *config.Config, tools *toolset.Registry, noSetup bool, debug bool, tuiMode bool) {
	defer term.Close()
	DefaultAppRuntime().SetActiveConfig(cfg)
	defer persistCurrentSessionState()

	engine := buildEngine(cfg, tools, debug)
	var wireRuntime *wire.Wire
	var stopWireRenderer func()
	if tuiMode {
		wireRuntime = wire.NewWire()
		stopWireRenderer = startTUIWireRenderer(wireRuntime)
	} else {
		wireRuntime, stopWireRenderer = startInteractiveWireRenderer(os.Stdout, os.Stderr)
	}
	defer stopWireRenderer()
	clearAskUserHandler := ask_user.SetHandler(func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		return requestWireQuestion(ctx, wireRuntime, req)
	})
	defer clearAskUserHandler()
	configureInteractiveEngine := func() {
		configureEngineForWire(engine, wireRuntime)
		configureEngineApprovalForWire(engine, wireRuntime, nil)
	}
	configureInteractiveEngine()
	escalator := &autoflow.Escalator{Threshold: autoflow.DefaultFailureThreshold}
	autoEnabled := true
	history := make([]string, 0)

	if engine.LLM == nil && !noSetup {
		fmt.Println("未配置。输入 /setup 开始配置。")
	} else if engine.LLM != nil {
		eff, _ := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
		pr := &eff.Profile
		fmt.Printf("当前配置: %s (%s)\n", cfg.DefaultProfile, pr.Model)

		sessStore, _ = session.NewStore()
		if sessStore != nil {
			currentSession = sessStore.NewSession(pr.Model)
			persistCurrentSessionState()
			msgs, _ := sessStore.LoadMessages(currentSession.ID)
			for _, msg := range msgs {
				engine.Context.Messages = append(engine.Context.Messages, msg)
			}

			wd, _ := os.Getwd()
			snap, err := snapshot.NewEngine(wd, currentSession.Dir)
			if err == nil {
				engine.Snapshotter = snap
			}
		}

		// Discover skills
		wd, _ := os.Getwd()
		skillRegistry, _ = skill.Discover(wd)
		if skillRegistry != nil {
			skillsBlock := skillRegistry.FormatForPrompt()
			if skillsBlock != "" && len(engine.Context.Messages) > 0 {
				// Append skills to system prompt
				msg := &engine.Context.Messages[0]
				if msg.Role == chat.RoleSystem {
					msg.Content += skillsBlock
				}
			}
			// Register skill tools
			tools.Register(&skilltools.List{Registry: skillRegistry})
			tools.Register(&skilltools.Read{Registry: skillRegistry})
		}
	}

	registerAgentToolsForEngine(cfg, engine, tools)
	detachRuntimeEvents := bridgeRuntimeEvents(engine, wireRuntime)
	defer detachRuntimeEvents()

	if tuiMode {
		clearTUIAskUser := ask_user.SetHandler(func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
			answers := make(map[string]string)
			for _, q := range req.Questions {
				if presentation.DefaultDispatch != nil {
					prompt := presentation.QuestionRequestPayload{
						ID:      req.ID,
						Prompt:  q.Question,
						Options: q.Options,
						Multi:   q.Multiple,
					}
					ans := presentation.DefaultDispatch.ShowQuestion(prompt)
					answers[q.Name] = ans
				}
			}
			return wire.QuestionResponse{RequestID: req.ID, Answers: answers}, nil
		})
		defer clearTUIAskUser()
		if engine.Approver != nil {
			origRequestDisplay := engine.Approver.RequestDisplayFunc
			engine.Approver.RequestDisplayFunc = func(toolName, description string, blocks []display.Block) bool {
				if presentation.DefaultDispatch == nil {
					if origRequestDisplay != nil {
						return origRequestDisplay(toolName, description, blocks)
					}
					return false
				}
				presentation.DefaultDispatch.Send(presentation.Event{
					Type: presentation.EvtApprovalRequest,
					Data: presentation.ApprovalRequestPayload{ToolName: toolName},
				})
				apr := presentation.DefaultDispatch.ShowApproval(presentation.ApprovalRequestPayload{ID: toolName, ToolName: toolName})
				return apr.Approved
			}
		}
		tui.Run(func(input string) string {
			if engine.LLM == nil {
				return "请先配置。输入 /setup"
			}
			engine.ResetCancel()
			inputPayload, _ := json.Marshal(input)
			if event, err := wire.NewEvent(wire.EventTurnBegin, wire.TurnBegin{UserInput: inputPayload}); err == nil {
				wireRuntime.RuntimeSide.PublishEvent(event)
			}
			turnStarted := time.Now()
			stopTurnStatus := startWireTurnStatusTicker(wireRuntime, cfg, func() *orchestrator.Engine { return engine }, turnStarted, time.Second, DefaultAppRuntime())
			outcome, err := engine.Run(input)
			stopTurnStatus()
			if err != nil {
				if err.Error() == "context canceled" {
					return "\n⏹ 已停止"
				}
				return "错误: " + err.Error()
			}
			publishOutcomeFinalMessage(wireRuntime, outcome, engine.Stream)
			if event, err := wire.NewEvent(wire.EventTurnEnd, wire.TurnEnd{}); err == nil {
				wireRuntime.RuntimeSide.PublishEvent(event)
			}
			status := runtimeStatusUpdate(cfg, engine, DefaultAppRuntime())
			setTurnElapsed(&status, turnStarted, false)
			if event, err := wire.NewEvent(wire.EventStatusUpdate, status); err == nil {
				wireRuntime.RuntimeSide.PublishEvent(event)
			}
			if outcome.FinalMessage == "" {
				return "(空响应)"
			}
			return ""
		}, func() string {
			eff, _ := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
			return fmt.Sprintf("mode: %s | model: %s", runtime.Mode, eff.Profile.Model)
		})
		return
	}

	for {
		input, err := term.ReadlineWithHistory("> ", history)
		if err != nil {
			if err == io.EOF || err == liner.ErrPromptAborted {
				break
			}
			fmt.Fprintf(os.Stderr, "错误: %v\n", err)
			break
		}
		input = strings.TrimSpace(input)
		if input == "" {
			continue
		}
		if input == "/quit" || input == "/exit" {
			break
		}

		history = append(history, input)

		if strings.HasPrefix(input, "/") {
			handleSlashCommand(input, &cfg, &engine, tools, debug, &autoEnabled, escalator, DefaultAppRuntime())
			configureInteractiveEngine()
			continue
		}

		if engine.LLM == nil {
			fmt.Println("请先配置。输入 /setup")
			continue
		}

		engine.ResetCancel()
		inputPayload, _ := json.Marshal(input)
		if event, err := wire.NewEvent(wire.EventTurnBegin, wire.TurnBegin{UserInput: inputPayload}); err == nil {
			wireRuntime.RuntimeSide.PublishEvent(event)
		}
		turnStarted := time.Now()
		stopTurnStatus := startWireTurnStatusTicker(wireRuntime, cfg, func() *orchestrator.Engine { return engine }, turnStarted, time.Second, DefaultAppRuntime())

		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt)

		type result struct {
			out *orchestrator.Outcome
			err error
		}
		done := make(chan result, 1)
		go func() {
			outcome, err := engine.Run(input)
			done <- result{outcome, err}
		}()

		select {
		case r := <-done:
			stopTurnStatus()
			signal.Stop(sigCh)
			if r.err != nil {
				if r.err.Error() == "context canceled" {
					fmt.Println()
				} else {
					fmt.Fprintf(os.Stderr, "错误: %v\n", r.err)
				}
				continue
			}
			outcome := r.out
			publishOutcomeFinalMessage(wireRuntime, outcome, engine.Stream)
			if outcome.FinalMessage == "" && outcome.StopReason == "error" {
				fmt.Fprintln(os.Stderr, "\n错误: unknown error")
			}
			if event, err := wire.NewEvent(wire.EventTurnEnd, wire.TurnEnd{}); err == nil {
				wireRuntime.RuntimeSide.PublishEvent(event)
			}
			status := runtimeStatusUpdate(cfg, engine, DefaultAppRuntime())
			setTurnElapsed(&status, turnStarted, false)
			if event, err := wire.NewEvent(wire.EventStatusUpdate, status); err == nil {
				wireRuntime.RuntimeSide.PublishEvent(event)
			}
			if currentSession != nil {
				sessStore.AppendMessage(currentSession.ID, chat.Message{Role: chat.RoleUser, Content: input})
				sessStore.AppendMessage(currentSession.ID, chat.Message{Role: chat.RoleAssistant, Content: outcome.FinalMessage})
			}
			decision := maybeRecordAutoflow(autoEnabled, escalator, outcome, cfg)
			applyAutoflowDecision(decision, cfg, &engine, tools, debug)
			registerAgentToolsForEngine(cfg, engine, tools)
			configureInteractiveEngine()
			persistCurrentSessionState()
			printPlanConfirmationHint(os.Stderr)
			if decision.Action == autoflow.ActionDebug {
				fmt.Fprintln(os.Stderr, "连续失败，已自动升级到 debug mode。输入 /status 可查看当前模型和权限。")
			} else if decision.Action == autoflow.ActionRecoveredMode {
				fmt.Fprintln(os.Stderr, "debug 修复完成，已自动回到之前的 mode。")
			}
		case <-sigCh:
			signal.Stop(sigCh)
			engine.Cancel()
			<-done
			stopTurnStatus()
			fmt.Println("\n⏹ 已停止")
		}
	}
}

func printPlanConfirmationHint(w io.Writer) {
	if w == nil || currentPlan == nil {
		return
	}
	if step, ok := currentPlan.NextOpenStep(); ok {
		fmt.Fprintf(w, "plan next_step pending: line %d: %s (use /plan confirm after verification)\n", step.Line, step.Text)
	}
}

func startTurnElapsedDisplay(w io.Writer, started time.Time, interval time.Duration) func() time.Duration {
	if w == nil || interval <= 0 {
		return func() time.Duration { return time.Since(started) }
	}
	done := make(chan struct{})
	var once sync.Once
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				fmt.Fprintf(w, "\r[elapsed %s]", formatElapsed(time.Since(started)))
			case <-done:
				return
			}
		}
	}()
	return func() time.Duration {
		elapsed := time.Since(started)
		once.Do(func() {
			close(done)
			fmt.Fprintf(w, "\r[elapsed %s]\n", formatElapsed(elapsed))
		})
		return elapsed
	}
}

func formatElapsed(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	return d.Truncate(time.Second).String()
}

func handleRollback(input string, engine **orchestrator.Engine) {
	if input == "/rollback" {
		fmt.Println("用法: /rollback <step 编号>")
		fmt.Printf("当前 step: %d\n", (*engine).Context.StepCount)
		return
	}
	if (*engine).Snapshotter == nil {
		fmt.Println("快照系统未启用")
		return
	}
	step := 0
	fmt.Sscanf(input, "/rollback %d", &step)
	if step <= 0 {
		fmt.Println("无效的 step 编号")
		return
	}

	// Stop all sub-agents before rollback
	if workerPool != nil {
		for _, w := range workerPool.List() {
			w.Stop()
		}
	}

	msg, err := (*engine).RollbackTo(step)
	if err != nil {
		fmt.Printf("回退失败: %v\n", err)
		return
	}
	fmt.Println(msg)
}

func handleMode(input string, cfg *config.Config, engine **orchestrator.Engine, tools *toolset.Registry, debug bool, rt *AppRuntime) {
	if input == "/mode" || input == "/mode " {
		m := (*engine).Mode
		if m == nil {
			fmt.Println("当前 mode: code")
		} else {
			fmt.Printf("当前 mode: %s (%s)\n", m.Name, m.DisplayName)
		}
		fmt.Println("可用 modes: /mode <code|ask|plan|debug|chat>")
		return
	}
	parts := strings.Fields(input)
	if len(parts) < 2 {
		return
	}
	eff, err := cfg.EffectiveProfile(parts[1], "", "")
	if err != nil {
		fmt.Println(err)
		return
	}
	m, err := modeFromEffective(eff)
	if err != nil {
		fmt.Println(err)
		return
	}
	o := runtimeOverrides{Mode: m.Name}
	if rt != nil {
		rt.SetOverrides(o)
	}
	runtime = o
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
	registerAgentToolsForEngine(cfg, *engine, tools)
	applyModePrompt(*engine, m)
	persistCurrentSessionState()
	fmt.Printf("✓ 已切换 mode: %s (%s)\n", m.Name, m.DisplayName)
	printRuntimeStatusSummary(cfg, *engine)
}

func handleModel(input string, cfg *config.Config, engine **orchestrator.Engine, tools *toolset.Registry, debug bool, rt *AppRuntime) {
	parts := strings.Fields(input)
	if len(parts) < 2 {
		showModelProfiles(cfg)
		return
	}
	name := strings.Join(parts[1:], " ")
	if _, ok := cfg.ModelProfiles[name]; !ok {
		fmt.Printf("模型配置 %q 不存在\n", name)
		showModelProfiles(cfg)
		return
	}
	o := runtimeOverrides{Mode: rt.GetOverrides().Mode, ModelProfile: name}
	if rt != nil {
		rt.SetOverrides(o)
	}
	runtime = o
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
	registerAgentToolsForEngine(cfg, *engine, tools)
	persistCurrentSessionState()
	fmt.Printf("✓ 已切换 model_profile: %s\n", name)
	printRuntimeStatusSummary(cfg, *engine)
}

func handlePermission(input string, cfg *config.Config, engine **orchestrator.Engine, tools *toolset.Registry, debug bool, rt *AppRuntime) {
	parts := strings.Fields(input)
	if len(parts) < 2 {
		showPermissions(cfg)
		return
	}
	name := parts[1]
	if _, ok := cfg.PermissionProfiles[name]; !ok {
		fmt.Printf("权限模式 %q 不存在\n", name)
		showPermissions(cfg)
		return
	}
	o := runtimeOverrides{Mode: rt.GetOverrides().Mode, PermissionProfile: name}
	if rt != nil {
		rt.SetOverrides(o)
	}
	runtime = o
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
	registerAgentToolsForEngine(cfg, *engine, tools)
	persistCurrentSessionState()
	fmt.Printf("✓ 已切换 permission_profile: %s\n", name)
	printRuntimeStatusSummary(cfg, *engine)
}

func showModelProfiles(cfg *config.Config) {
	fmt.Printf("当前 model_profile: %s\n", currentModelProfile(cfg))
	if len(cfg.ModelProfiles) == 0 {
		fmt.Println("没有配置 model_profiles，当前使用 profile 内的旧 model 字段")
		return
	}
	fmt.Println("可用 model_profiles:")
	for name, mp := range cfg.ModelProfiles {
		fmt.Printf("  %s (%s)\n", name, mp.Model)
	}
}

func showPermissions(cfg *config.Config) {
	fmt.Printf("当前 permission_profile: %s\n", currentPermissionProfile(cfg))
	fmt.Println("可用 permission_profiles:")
	for name, pp := range cfg.PermissionProfiles {
		fmt.Printf("  %s - %s\n", name, pp.Description)
	}
}

func handleStatus(cfg *config.Config, engine *orchestrator.Engine, rt *AppRuntime) {
	if cfg == nil {
		fmt.Println("未配置")
		return
	}
	lines, err := statusLines(cfg, engine, rt)
	if err != nil {
		fmt.Printf("读取状态失败: %v\n", err)
		return
	}
	for _, line := range lines {
		fmt.Println(line)
	}
}

func statusLines(cfg *config.Config, engine *orchestrator.Engine, rt *AppRuntime) ([]string, error) {
	o := runtimeOverrides{}
	if rt != nil {
		o = rt.GetOverrides()
	}
	if o == (runtimeOverrides{}) {
		o = runtime
	}
	eff, err := cfg.EffectiveProfile(o.Mode, o.ModelProfile, o.PermissionProfile)
	if err != nil {
		return nil, err
	}
	modeName := eff.Mode
	if engine != nil && engine.Mode != nil {
		modeName = engine.Mode.Name
	}
	modeSuffix := ""
	if o.Mode != "" {
		modeSuffix = " (manual override)"
	}
	modelSuffix := ""
	if o.ModelProfile != "" {
		modelSuffix = " (manual override)"
	}
	permissionSuffix := ""
	if o.PermissionProfile != "" {
		permissionSuffix = " (manual override)"
	}
	tools := "mode-filtered"
	if len(eff.ModeConfig.Tools.Allowed) > 0 {
		tools = fmt.Sprintf("allow-list (%d tools)", len(eff.ModeConfig.Tools.Allowed))
	} else if len(eff.ModeConfig.Tools.Exclude) > 0 {
		tools = fmt.Sprintf("exclude-list (%d tools)", len(eff.ModeConfig.Tools.Exclude))
	}
	contextTokens, maxContextTokens, contextUsage := contextTokenStats(engine)
	lines := []string{
		fmt.Sprintf("profile: %s", eff.ProfileName),
		fmt.Sprintf("mode: %s%s", modeName, modeSuffix),
		fmt.Sprintf("model_profile: %s%s", displayEmpty(eff.ModelProfile, "<profile model>"), modelSuffix),
		fmt.Sprintf("permission_profile: %s%s", eff.PermissionProfile, permissionSuffix),
		fmt.Sprintf("provider: %s", eff.Profile.Provider),
		fmt.Sprintf("model: %s", eff.Profile.Model),
		fmt.Sprintf("context_tokens: %d/%d (%.1f%% estimated)", contextTokens, maxContextTokens, contextUsage*100),
		fmt.Sprintf("approval: %s", eff.Approval),
		fmt.Sprintf("reasoning_effort: %s", displayEmpty(eff.Profile.ReasoningEffort, "<unset>")),
		fmt.Sprintf("thinking_enabled: %t", eff.Profile.ThinkingEnabled),
		fmt.Sprintf("stream: %t", eff.Profile.Stream),
		fmt.Sprintf("tools: %s", tools),
	}
	lines = append(lines, runtimeDiagnostics(engine, rt)...)
	return lines, nil
}

func runtimeDiagnostics(engine *orchestrator.Engine, rt *AppRuntime) []string {
	lines := []string{"agent_spec_adapters: generic,kimi,kilo,openai,mcp_schema"}
	if engine != nil && engine.Hooks != nil {
		lines = append(lines, fmt.Sprintf("hooks: configured=%d audit_entries=%d", len(engine.Hooks.Hooks()), len(engine.Hooks.AuditLog())))
	}
	if engine != nil {
		diag := engine.LastInjectionDiagnostics()
		if len(diag) > 0 {
			errors := 0
			injections := 0
			for _, item := range diag {
				if item.Error != "" {
					errors++
				}
				injections += item.Count
			}
			lines = append(lines, fmt.Sprintf("injections: providers=%d active=%d errors=%d", len(diag), injections, errors))
		}
	}
	mcpDiag := currentMCPDiagnostics()
	if len(mcpDiag) > 0 {
		keys := make([]string, 0, len(mcpDiag))
		for key := range mcpDiag {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			lines = append(lines, fmt.Sprintf("mcp.%s: %s", key, mcpDiag[key]))
		}
	}
	reg := &workflowcore.Registry{}
	if rt != nil {
		reg = rt.GetWorkflowRegistry()
	}
	if reg != nil {
		lines = append(lines, fmt.Sprintf("workflows: loaded=%d diagnostics=%d", len(reg.List()), len(reg.Diagnostics())))
	}
	if skillRegistry != nil {
		lines = append(lines, fmt.Sprintf("instructions: diagnostics=%d", len(skillRegistry.Diagnostics())))
	}
	return lines
}

func printRuntimeStatusSummary(cfg *config.Config, engine *orchestrator.Engine) {
	if cfg == nil {
		return
	}
	eff, err := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
	if err != nil {
		return
	}
	contextTokens, maxContextTokens, contextUsage := contextTokenStats(engine)
	fmt.Printf("runtime_status: mode=%s model_profile=%s permission_profile=%s model=%s context_tokens=%d/%d (%.1f%% estimated)\n", eff.Mode, displayEmpty(eff.ModelProfile, "<profile>"), eff.PermissionProfile, eff.Profile.Model, contextTokens, maxContextTokens, contextUsage*100)
}

func contextTokenStats(engine *orchestrator.Engine) (int, int, float64) {
	if engine == nil || engine.Context == nil {
		return 0, 0, 0
	}
	model := ""
	if engine.LLM != nil {
		model = engine.LLM.Model()
	}
	tokens := compaction.EstimateTokensForModel(model, engine.Context.Messages)
	maxTokens := engine.Context.MaxTokens
	if engine.MaxContextSize > 0 {
		maxTokens = engine.MaxContextSize
	}
	usage := 0.0
	if maxTokens > 0 {
		usage = float64(tokens) / float64(maxTokens)
	}
	return tokens, maxTokens, usage
}

func displayEmpty(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func currentModelProfile(cfg *config.Config) string {
	if runtime.ModelProfile != "" {
		return runtime.ModelProfile + " (manual override)"
	}
	if eff, err := cfg.EffectiveProfile(runtime.Mode, "", runtime.PermissionProfile); err == nil && eff.ModelProfile != "" {
		return eff.ModelProfile
	}
	return "<profile model>"
}

func currentPermissionProfile(cfg *config.Config) string {
	if runtime.PermissionProfile != "" {
		return runtime.PermissionProfile + " (manual override)"
	}
	if eff, err := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, ""); err == nil {
		return eff.PermissionProfile
	}
	return "ask"
}

func handleSandbox(input string) {
	wd, _ := os.Getwd()
	parts := strings.Fields(input)
	if len(parts) < 2 {
		boxes, _ := sandbox.List(wd)
		if len(boxes) == 0 {
			fmt.Println("没有沙盒。用法: /sandbox create <user|agent> <名称>")
			return
		}
		fmt.Println("沙盒列表：")
		for _, b := range boxes {
			fmt.Printf("  %s (%s) — %s\n", b.Name, b.Type, b.Overlay)
		}
		return
	}

	cmd := parts[1]
	switch cmd {
	case "create":
		if len(parts) < 4 {
			fmt.Println("用法: /sandbox create <user|agent> <名称>")
			return
		}
		b, err := sandbox.Create(parts[3], parts[2], wd)
		if err != nil {
			fmt.Printf("创建沙盒失败: %v\n", err)
			return
		}
		fmt.Printf("✓ 沙盒 %q (%s) 已创建\n", b.Name, b.Type)
	case "merge":
		if len(parts) < 3 {
			fmt.Println("用法: /sandbox merge <名称>")
			return
		}
		name := parts[2]
		boxes, _ := sandbox.List(wd)
		var target *sandbox.Box
		for _, b := range boxes {
			if b.Name == name {
				target = &b
				break
			}
		}
		if target == nil {
			fmt.Printf("沙盒 %q 不存在\n", name)
			return
		}
		changed, err := target.Merge()
		if err != nil {
			fmt.Printf("合并失败: %v\n", err)
			return
		}
		fmt.Printf("✓ 已合并 %d 个文件\n", len(changed))
		for _, f := range changed {
			fmt.Printf("  %s\n", f)
		}
	case "diff":
		if len(parts) < 3 {
			fmt.Println("用法: /sandbox diff <名称>")
			return
		}
		name := parts[2]
		boxes, _ := sandbox.List(wd)
		for _, b := range boxes {
			if b.Name == name {
				diff, err := b.Diff()
				if err != nil {
					fmt.Printf("diff 失败: %v\n", err)
					return
				}
				fmt.Println(diff)
				return
			}
		}
		fmt.Printf("沙盒 %q 不存在\n", name)
	case "delete":
		if len(parts) < 3 {
			fmt.Println("用法: /sandbox delete <名称>")
			return
		}
		name := parts[2]
		boxes, _ := sandbox.List(wd)
		for _, b := range boxes {
			if b.Name == name {
				b.Delete()
				fmt.Printf("✓ 沙盒 %q 已删除\n", name)
				return
			}
		}
		fmt.Printf("沙盒 %q 不存在\n", name)
	default:
		fmt.Printf("未知命令: /sandbox %s\n", cmd)
	}
}

func handleWorkerCommand(input string) {
	switch {
	case input == "/workers" || input == "/workers ":
		if workerPool == nil {
			fmt.Println("子 agent 系统不可用")
			return
		}
		workers := workerPool.List()
		if len(workers) == 0 {
			fmt.Println("没有活动的子 agent")
			return
		}
		fmt.Println("子 agent：")
		for _, w := range workers {
			logs := w.GetLogs()
			last := ""
			if len(logs) > 0 {
				last = logs[len(logs)-1].Tool
			}
			fmt.Printf("  %s [%s] attached=%t %s", w.ID, w.Status, w.IsAttached(), w.Task)
			if last != "" {
				fmt.Printf(" → %s", last)
			}
			fmt.Println()
		}
	case strings.HasPrefix(input, "/stop "):
		if workerPool == nil {
			fmt.Println("子 agent 系统不可用")
			return
		}
		id := strings.TrimPrefix(input, "/stop ")
		w := workerPool.Get(id)
		if w == nil {
			fmt.Printf("子 agent %s 不存在\n", id)
			return
		}
		w.Stop()
		fmt.Printf("⏹ %s 已暂停\n", id)
	case strings.HasPrefix(input, "/go "):
		if workerPool == nil {
			fmt.Println("子 agent 系统不可用")
			return
		}
		id := strings.TrimPrefix(input, "/go ")
		w := workerPool.Get(id)
		if w == nil {
			fmt.Printf("子 agent %s 不存在\n", id)
			return
		}
		w.Resume()
		fmt.Printf("▶ %s 已恢复\n", id)
	case strings.HasPrefix(input, "/attach "):
		if workerPool == nil {
			fmt.Println("子 agent 系统不可用")
			return
		}
		id := strings.TrimPrefix(input, "/attach ")
		if !workerPool.Attach(id) {
			fmt.Printf("子 agent %s 不存在\n", id)
			return
		}
		fmt.Printf("%s 已 attach\n", id)
	case strings.HasPrefix(input, "/detach "):
		if workerPool == nil {
			fmt.Println("子 agent 系统不可用")
			return
		}
		id := strings.TrimPrefix(input, "/detach ")
		if !workerPool.Detach(id) {
			fmt.Printf("子 agent %s 不存在\n", id)
			return
		}
		fmt.Printf("%s 已 detach\n", id)
	default:
		fmt.Println("用法: /workers | /stop <id> | /go <id> | /attach <id> | /detach <id>")
	}
}

func handleSlashCommand(input string, cfg **config.Config, engine **orchestrator.Engine, tools *toolset.Registry, debug bool, autoEnabled *bool, escalator *autoflow.Escalator, rt *AppRuntime) {
	if isSlashCommand(input, "/sessions") {
		handleSessions(input, *cfg, engine, tools, debug, rt)
		return
	}
	if isSlashCommand(input, "/rollback") {
		handleRollback(input, engine)
		return
	}
	if input == "/stop" {
		(*engine).Cancel()
		(*engine).ResetCancel()
		fmt.Println("\n⏹ 已停止")
		return
	}
	if isSlashCommand(input, "/mode") {
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		handleMode(input, *cfg, engine, tools, debug, rt)
		return
	}
	if isSlashCommand(input, "/model") {
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		handleModel(input, *cfg, engine, tools, debug, rt)
		return
	}
	if isSlashCommand(input, "/permission") {
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		handlePermission(input, *cfg, engine, tools, debug, rt)
		return
	}
	if input == "/status" {
		handleStatus(*cfg, *engine, rt)
		return
	}
	if isSlashCommand(input, "/auto") {
		handleAuto(input, autoEnabled, escalator)
		return
	}
	if isSlashCommand(input, "/execute-plan") {
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		handleExecutePlan(input, *cfg, engine, tools, debug, rt)
		return
	}
	if isSlashCommand(input, "/plan") {
		handlePlan(input, rt)
		return
	}
	if isSlashCommand(input, "/workflow") {
		handleWorkflow(input, *engine, rt)
		return
	}
	if strings.HasPrefix(input, "/workers") || strings.HasPrefix(input, "/stop ") || strings.HasPrefix(input, "/go ") || strings.HasPrefix(input, "/attach ") || strings.HasPrefix(input, "/detach ") {
		handleWorkerCommand(input)
		return
	}
	if isSlashCommand(input, "/sandbox") {
		handleSandbox(input)
		return
	}

	switch input {
	case "/setup":
		if *cfg == nil {
			*cfg = &config.Config{
				Providers:          make(map[string]config.Provider),
				Profiles:           make(map[string]config.Profile),
				ModelProfiles:      make(map[string]config.ModelProfile),
				PermissionProfiles: config.DefaultPermissionProfiles(),
			}
		}
		modified := ui.SetupFlow(*cfg)
		if modified {
			(*cfg).Save()
			*engine = buildEngine(*cfg, tools, debug)
			registerAgentToolsForEngine(*cfg, *engine, tools)
		}
	case "/profile":
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		name := ui.PickProfile(*cfg)
		if name != "" {
			(*cfg).DefaultProfile = name
			activeConfig = *cfg
			runtime = runtimeOverrides{}
			(*cfg).Save()
			*engine = buildEngine(*cfg, tools, debug)
			registerAgentToolsForEngine(*cfg, *engine, tools)
			persistCurrentSessionState()
			fmt.Printf("已切换到: %s\n", name)
			printRuntimeStatusSummary(*cfg, *engine)
		}
	case "/compact":
		if (*engine).LLM == nil {
			fmt.Println("模型未配置")
			return
		}
		msg, err := (*engine).CompactNow()
		if err != nil {
			fmt.Printf("压缩失败: %v\n", err)
			return
		}
		fmt.Println(msg)
	case "/checkpoint":
		if (*engine).Snapshotter == nil {
			fmt.Println("快照系统未启用")
			return
		}
		hash, err := (*engine).Snapshotter.Checkpoint((*engine).Context.StepCount, nil)
		if err != nil {
			fmt.Printf("创建快照失败: %v\n", err)
			return
		}
		fmt.Printf("✓ 快照已创建 (step %d, hash: %s)\n", (*engine).Context.StepCount, hash[:12])
	case "/config":
		if *cfg == nil {
			fmt.Println("未配置")
			return
		}
		ui.ShowConfig(*cfg)
	case "/help":
		showHelp()
	default:
		fmt.Printf("未知命令: %s\n", input)
	}
}

func persistCurrentSessionState() {
	if sessStore == nil || currentSession == nil {
		return
	}
	state := session.State{
		Mode:              runtime.Mode,
		ModelProfile:      runtime.ModelProfile,
		PermissionProfile: runtime.PermissionProfile,
		AdditionalDirs:    effectiveAdditionalDirs(activeConfig, runtime),
	}
	planState := planManager.Status()
	state.PlanMode = planState.Enabled
	state.PlanSessionID = planState.Slug
	if planState.Slug != "" {
		state.PlanSlug = planState.Slug
	}
	if planState.Path != "" {
		state.PlanPath = planState.Path
	}
	if currentPlan != nil {
		state.PlanSlug = currentPlan.Slug
		state.PlanPath = currentPlan.Path
		state.PlanDoneLines = donePlanLines(currentPlan)
	}
	if err := sessStore.SaveState(currentSession.ID, state); err != nil {
		fmt.Fprintf(os.Stderr, "保存会话状态失败: %v\n", err)
	}
}

func donePlanLines(planSession *planexec.Session) []int {
	if planSession == nil {
		return nil
	}
	lines := make([]int, 0)
	for _, step := range planSession.Steps {
		if step.Done {
			lines = append(lines, step.Line)
		}
	}
	return lines
}

func isSlashCommand(input, command string) bool {
	return input == command || strings.HasPrefix(input, command+" ")
}

func handleSessions(input string, cfg *config.Config, engine **orchestrator.Engine, tools *toolset.Registry, debug bool, rt *AppRuntime) {
	parts := strings.Fields(input)
	if len(parts) >= 2 && parts[1] == "restore" {
		restoreSession(parts, cfg, engine, tools, debug, rt)
		return
	}
	if len(parts) > 1 {
		fmt.Println("用法: /sessions 或 /sessions restore <id|序号>")
		return
	}
	listSessions()
}

func restoreSession(parts []string, cfg *config.Config, engine **orchestrator.Engine, tools *toolset.Registry, debug bool, rt *AppRuntime) {
	if sessStore == nil {
		fmt.Println("会话存储不可用")
		return
	}
	if cfg == nil {
		fmt.Println("请先配置。输入 /setup")
		return
	}
	if len(parts) < 3 {
		fmt.Println("用法: /sessions restore <id|序号>")
		return
	}
	sess, err := resolveSessionRef(parts[2])
	if err != nil {
		fmt.Printf("恢复会话失败: %v\n", err)
		return
	}
	state, err := sessStore.LoadState(sess.ID)
	if err != nil {
		fmt.Printf("读取会话状态失败: %v\n", err)
		return
	}
	messages, err := sessStore.LoadMessages(sess.ID)
	if err != nil {
		fmt.Printf("读取会话消息失败: %v\n", err)
		return
	}
	restoredRuntime, warnings := validateRestoredRuntime(cfg, state)
	runtime = restoredRuntime
	if rt != nil {
		rt.SetOverrides(restoredRuntime)
	}
	restorePlanMode(state, rt)
	warnings = append(warnings, restorePlanSession(state, rt)...)
	currentSession = sess
	if rt != nil {
		rt.SetCurrentSession(sess)
	}
	*engine = buildEngine(cfg, tools, debug)
	(*engine).Context.Messages = append((*engine).Context.Messages, messages...)
	attachSnapshotter(*engine, sess)
	persistCurrentSessionState()
	fmt.Printf("✓ 已恢复会话: %s\n", sess.ID)
	for _, warning := range warnings {
		fmt.Println(warning)
	}
}

func validateRestoredRuntime(cfg *config.Config, state session.State) (runtimeOverrides, []string) {
	restored := runtimeOverrides{Mode: state.Mode, ModelProfile: state.ModelProfile, PermissionProfile: state.PermissionProfile}
	warnings := make([]string, 0)
	warnings = append(warnings, validateRestoredAdditionalDirs(state.AdditionalDirs)...)
	if cfg == nil {
		return restored, warnings
	}
	if restored.Mode != "" {
		eff, err := cfg.EffectiveProfile(restored.Mode, "", "")
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("⚠ 已忽略已失效 mode %q: %v", restored.Mode, err))
			restored.Mode = ""
		} else if _, err := modeFromEffective(eff); err != nil {
			warnings = append(warnings, fmt.Sprintf("⚠ 已忽略已失效 mode %q: %v", restored.Mode, err))
			restored.Mode = ""
		}
	}
	if restored.ModelProfile != "" {
		if _, ok := cfg.ModelProfiles[restored.ModelProfile]; !ok {
			warnings = append(warnings, fmt.Sprintf("⚠ 已忽略已失效 model_profile %q", restored.ModelProfile))
			restored.ModelProfile = ""
		}
	}
	if restored.PermissionProfile != "" && len(cfg.PermissionProfiles) > 0 {
		if _, ok := cfg.PermissionProfiles[restored.PermissionProfile]; !ok {
			warnings = append(warnings, fmt.Sprintf("⚠ 已忽略已失效 permission_profile %q", restored.PermissionProfile))
			restored.PermissionProfile = ""
		}
	}
	if _, err := cfg.EffectiveProfile(restored.Mode, restored.ModelProfile, restored.PermissionProfile); err != nil {
		warnings = append(warnings, fmt.Sprintf("⚠ 已忽略已恢复 runtime overrides: %v", err))
		restored = runtimeOverrides{}
	}
	return restored, warnings
}

func effectiveAdditionalDirs(cfg *config.Config, o runtimeOverrides) []string {
	if cfg == nil {
		return nil
	}
	eff, err := cfg.EffectiveProfile(o.Mode, o.ModelProfile, o.PermissionProfile)
	if err != nil || len(eff.Profile.AdditionalDirs) == 0 {
		return nil
	}
	out := make([]string, 0, len(eff.Profile.AdditionalDirs))
	seen := make(map[string]bool, len(eff.Profile.AdditionalDirs))
	for _, dir := range eff.Profile.AdditionalDirs {
		dir = strings.TrimSpace(dir)
		if dir == "" {
			continue
		}
		if abs, err := filepath.Abs(dir); err == nil {
			dir = abs
		}
		dir = filepath.Clean(dir)
		if seen[dir] {
			continue
		}
		seen[dir] = true
		out = append(out, dir)
	}
	return out
}

func validateRestoredAdditionalDirs(dirs []string) []string {
	if len(dirs) == 0 {
		return nil
	}
	warnings := make([]string, 0)
	for _, dir := range dirs {
		info, err := os.Stat(dir)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("⚠ additional_dir %q 不可用: %v", dir, err))
			continue
		}
		if !info.IsDir() {
			warnings = append(warnings, fmt.Sprintf("⚠ additional_dir %q 不是目录", dir))
		}
	}
	return warnings
}

func resolveSessionRef(ref string) (*session.Session, error) {
	sessions := sessStore.List()
	var idx int
	if _, err := fmt.Sscanf(ref, "%d", &idx); err == nil && idx > 0 {
		if idx > len(sessions) {
			return nil, fmt.Errorf("序号 %d 不存在", idx)
		}
		return &sessions[idx-1], nil
	}
	for _, sess := range sessions {
		if sess.ID == ref {
			return &sess, nil
		}
	}
	return nil, fmt.Errorf("会话 %q 不存在", ref)
}

func restorePlanMode(state session.State, rt *AppRuntime) {
	if state.PlanMode {
		planManager.Enter(state.PlanSlug, state.PlanPath, "restored session")
		if rt != nil {
			rt.GetPlanManager().Enter(state.PlanSlug, state.PlanPath, "restored session")
		}
		return
	}
	planManager.Exit()
	if rt != nil {
		rt.GetPlanManager().Exit()
	}
}

func restorePlanSession(state session.State, rt *AppRuntime) []string {
	currentPlan = nil
	currentPlanMTime = time.Time{}
	if rt != nil {
		rt.SetCurrentPlan(nil)
		rt.SetCurrentPlanMTime(time.Time{})
	}
	if state.PlanPath == "" {
		return nil
	}
	info, err := os.Stat(state.PlanPath)
	if err != nil {
		return []string{fmt.Sprintf("⚠ 计划文件未恢复: %v", err)}
	}
	data, err := os.ReadFile(state.PlanPath)
	if err != nil {
		return []string{fmt.Sprintf("⚠ 计划文件未恢复: %v", err)}
	}
	currentPlan = planexec.Parse(state.PlanPath, string(data))
	currentPlanMTime = info.ModTime()
	if rt != nil {
		rt.SetCurrentPlan(currentPlan)
		rt.SetCurrentPlanMTime(info.ModTime())
	}
	done := make(map[int]bool, len(state.PlanDoneLines))
	for _, line := range state.PlanDoneLines {
		done[line] = true
	}
	for i := range currentPlan.Steps {
		if done[currentPlan.Steps[i].Line] {
			currentPlan.Steps[i].Done = true
		}
	}
	return nil
}

func attachSnapshotter(engine *orchestrator.Engine, sess *session.Session) {
	if engine == nil || sess == nil {
		return
	}
	wd, _ := os.Getwd()
	snap, err := snapshot.NewEngine(wd, sess.Dir)
	if err == nil {
		engine.Snapshotter = snap
	}
}

func listSessions() {
	if sessStore == nil {
		fmt.Println("会话存储不可用")
		return
	}
	sessions := sessStore.List()
	if len(sessions) == 0 {
		fmt.Println("没有已保存的会话")
		return
	}
	fmt.Println("历史会话：")
	for i, s := range sessions {
		title := s.Title
		if title == "" {
			title = "无标题"
		}
		state, _ := sessStore.LoadState(s.ID)
		stateSummary := ""
		if state.Mode != "" {
			stateSummary += fmt.Sprintf(", mode=%s", state.Mode)
		}
		if state.PlanSlug != "" {
			stateSummary += fmt.Sprintf(", plan=%s", state.PlanSlug)
		}
		tokenSummary := ""
		if s.ContextTokens > 0 {
			tokenSummary = fmt.Sprintf(", context_tokens=%d", s.ContextTokens)
		}
		fmt.Printf("  %d. %s (%s%s%s) [%s]\n", i+1, title, s.Model, stateSummary, tokenSummary, s.ID)
	}
}

func showHelp() {
	fmt.Println(`命令:
  /setup    配置 LLM 服务商和模型
  /profile  切换配置
  /mode     切换模式（code/ask/plan/debug/chat）
  /model    切换 model profile
  /permission 切换权限（just_do_it/ask/read_only）
  /status   查看当前 runtime profile
  /auto     自动流转开关（status/on/off）
  /plan     当前计划状态（status/show/done/confirm/clear）
  /execute-plan <plan.md|slug> 载入计划并切回 code mode
  /workflow 管理 workflow（list/run/diagnostics）
  /checkpoint 手动创建快照
  /rollback <n> 回退到第 n 步
  /compact  手动压缩上下文
  /sandbox  管理沙盒（create/merge/diff/delete）
  /workers  查看子 agent
  /stop <id> 暂停子 agent
  /go <id>  恢复子 agent
  /attach <id> attach 子 agent 事件
  /detach <id> detach 子 agent 事件
  /sessions 查看历史会话
  /sessions restore <id|序号> 恢复历史会话
  /config   查看当前配置
  /help     显示帮助
  /quit     退出`)
}
