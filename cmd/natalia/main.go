package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/agentspec"
	"github.com/Misaka477/Natalia-Cli/internal/approval"
	"github.com/Misaka477/Natalia-Cli/internal/autoflow"
	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/compaction"
	"github.com/Misaka477/Natalia-Cli/internal/config"
	"github.com/Misaka477/Natalia-Cli/internal/hook"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	coremcp "github.com/Misaka477/Natalia-Cli/internal/mcp"
	"github.com/Misaka477/Natalia-Cli/internal/mode"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
	"github.com/Misaka477/Natalia-Cli/internal/planexec"
	"github.com/Misaka477/Natalia-Cli/internal/sandbox"
	"github.com/Misaka477/Natalia-Cli/internal/session"
	"github.com/Misaka477/Natalia-Cli/internal/skill"
	"github.com/Misaka477/Natalia-Cli/internal/snapshot"
	"github.com/Misaka477/Natalia-Cli/internal/soul"
	"github.com/Misaka477/Natalia-Cli/internal/term"
	"github.com/Misaka477/Natalia-Cli/internal/tools/agent"
	mcptools "github.com/Misaka477/Natalia-Cli/internal/tools/mcptools"
	"github.com/Misaka477/Natalia-Cli/internal/tools/skilltools"
	workflowtools "github.com/Misaka477/Natalia-Cli/internal/tools/workflowtools"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
	"github.com/Misaka477/Natalia-Cli/internal/ui"
	"github.com/Misaka477/Natalia-Cli/internal/worker"
	workflowcore "github.com/Misaka477/Natalia-Cli/internal/workflow"
	"github.com/peterh/liner"
)

var (
	sessStore      *session.SessionStore
	currentSession *session.Session
	workerPool     *worker.Pool
	skillRegistry  *skill.Registry
	runtime        runtimeOverrides
	currentPlan    *planexec.Session
	mcpMu          sync.Mutex
	mcpClients     = map[string]*coremcp.Client{}
	workflowReg    *workflowcore.Registry
)

type runtimeOverrides struct {
	Mode              string
	ModelProfile      string
	PermissionProfile string
}

func main() {
	defer closeMCPClients()

	noSetupFlag := flag.Bool("no-setup", false, "跳过交互式配置引导")
	debug := flag.Bool("debug", false, "打印调试日志")
	profile := flag.String("profile", "", "使用指定配置")
	wireFlag := flag.Bool("wire", false, "通过 stdin/stdout 运行 Wire JSON-RPC 服务")
	wireReplay := flag.String("wire-replay", "", "重放 wire.jsonl 到 stdout")
	flag.Parse()

	cfg, _ := config.Load()

	if *profile != "" && cfg != nil {
		cfg.DefaultProfile = *profile
	}

	tools := toolset.NewRegistry()
	registerTools(tools)
	if *wireReplay != "" {
		if err := runWireReplay(*wireReplay, os.Stdout); err != nil {
			fmt.Fprintf(os.Stderr, "wire replay error: %v\n", err)
			os.Exit(1)
		}
		return
	}
	if *wireFlag {
		if err := runWireCLI(cfg, tools, os.Stdin, os.Stdout, *debug); err != nil {
			fmt.Fprintf(os.Stderr, "wire error: %v\n", err)
			os.Exit(1)
		}
		return
	}

	if len(flag.Args()) > 0 {
		runOnce(cfg, tools, strings.Join(flag.Args(), " "))
		return
	}

	runInteractive(cfg, tools, *noSetupFlag, *debug)
}

func registerTools(r *toolset.Registry) {
	wd, _ := os.Getwd()
	workflowReg, _ = workflowcore.Discover(wd)
	workflowtools.SetDefaultRegistry(workflowReg)
	if err := toolset.RegisterDefaultTools(r); err != nil {
		fmt.Fprintf(os.Stderr, "加载默认工具失败: %v\n", err)
	}
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
			continue
		}
		if err := loadMCPServer(serverName, serverCfg, r); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", serverName, err))
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
	for _, remoteTool := range tools {
		wrapped, err := mcptools.NewTool(serverName, remoteTool, client)
		if err != nil {
			return err
		}
		if !mcpToolAllowed(cfg, remoteTool.Name, wrapped.Name()) {
			continue
		}
		r.Register(wrapped)
		if !cfg.ReadOnly {
			approval.RegisterWriteTool(wrapped.Name())
		}
	}
	return nil
}

func mcpClientForServer(serverName string, cfg config.MCPServerConfig) (*coremcp.Client, error) {
	mcpMu.Lock()
	defer mcpMu.Unlock()
	if client := mcpClients[serverName]; client != nil {
		return client, nil
	}
	client, err := coremcp.Start(context.Background(), coremcp.ServerConfig{Command: cfg.Command, Args: cfg.Args, Cwd: cfg.Cwd, TimeoutSec: cfg.TimeoutSec})
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

func closeMCPClients() {
	mcpMu.Lock()
	clients := mcpClients
	mcpClients = map[string]*coremcp.Client{}
	mcpMu.Unlock()
	for _, client := range clients {
		_ = client.Close()
	}
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

func buildEngine(cfg *config.Config, tools *toolset.Registry, debug bool) *soul.Engine {
	if cfg == nil {
		return soul.NewEngine(nil, tools)
	}
	pr, p, err := cfg.ActiveProfile()
	eff, effErr := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
	if err != nil && effErr != nil {
		return soul.NewEngine(nil, tools)
	}
	if effErr == nil {
		pr = &eff.Profile
		p = &eff.Provider
		if err := loadMCPServers(cfg, tools, &eff.ModeConfig); err != nil {
			fmt.Fprintf(os.Stderr, "加载 MCP 工具失败: %v\n", err)
		}
	}

	llmClient := newLLMClient(pr, p)

	engine := soul.NewEngine(llmClient, tools)
	engine.InjectionProviders = []soul.InjectionProvider{soul.SafetyInjectionProvider{}}
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
	if cfg == nil || len(cfg.Hooks) == 0 {
		return nil
	}
	hooks := make([]hook.HookDef, 0, len(cfg.Hooks))
	for _, def := range cfg.Hooks {
		hooks = append(hooks, hook.HookDef{ID: def.ID, Event: hook.EventType(def.Event), Target: def.Target, Command: def.Command, Cwd: def.Cwd, TimeoutSec: def.TimeoutSec})
	}
	return hook.NewEngine(hooks)
}

func rebuildEnginePreservingState(cfg *config.Config, old *soul.Engine, tools *toolset.Registry, debug bool) *soul.Engine {
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

func applyModePrompt(engine *soul.Engine, m *mode.Mode) {
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

func applyAutoflowDecision(decision autoflow.Decision, cfg *config.Config, engine **soul.Engine, tools *toolset.Registry, debug bool) {
	if decision.Action == autoflow.ActionNone || decision.TargetMode == "" {
		return
	}
	runtime.Mode = decision.TargetMode
	runtime.ModelProfile = ""
	runtime.PermissionProfile = ""
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
}

func maybeRecordAutoflow(enabled bool, escalator *autoflow.Escalator, outcome *soul.Outcome, cfg *config.Config) autoflow.Decision {
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

func handleExecutePlan(input string, cfg *config.Config, engine **soul.Engine, tools *toolset.Registry, debug bool) {
	parts := strings.Fields(input)
	if len(parts) < 2 {
		fmt.Println("用法: /execute-plan <plan.md>")
		return
	}
	planPath := strings.Trim(parts[1], "\"'")
	if filepath.Ext(planPath) != ".md" {
		fmt.Println("计划文件必须是 .md 文件")
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
	runtime.Mode = "code"
	runtime.ModelProfile = ""
	runtime.PermissionProfile = ""
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
	(*engine).Steer.Push(currentPlan.Instruction())
	persistCurrentSessionState()
	fmt.Printf("✓ 已载入计划并切换到 code mode: %s\n", planPath)
	if step, ok := currentPlan.NextOpenStep(); ok {
		fmt.Printf("下一未完成项: line %d: %s\n", step.Line, step.Text)
	}
	fmt.Println("下一条普通输入将带着该计划继续执行。")
}

func handlePlan(input string) {
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
	case "done":
		if currentPlan == nil {
			fmt.Println("没有活动计划。用法: /execute-plan <plan.md>")
			return
		}
		step, ok := currentPlan.MarkNextDone()
		if !ok {
			fmt.Println("计划中没有未完成项")
			return
		}
		fmt.Printf("✓ 已标记完成: line %d: %s\n", step.Line, step.Text)
		if next, ok := currentPlan.NextOpenStep(); ok {
			fmt.Printf("下一未完成项: line %d: %s\n", next.Line, next.Text)
		} else {
			fmt.Println("计划 checklist 已全部完成")
		}
		persistCurrentSessionState()
	case "clear":
		currentPlan = nil
		persistCurrentSessionState()
		fmt.Println("✓ 已清除当前计划")
	default:
		fmt.Println("用法: /plan [status|done|clear]")
	}
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
		os.Exit(1)
	}
	engine.OnReasoning = nil
	engine.OnStreamEnd = nil
	outcome, err := engine.Run(input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
	if engine.Stream {
		fmt.Println()
		return
	}
	fmt.Println(outcome.FinalMessage)
}

func runInteractive(cfg *config.Config, tools *toolset.Registry, noSetup bool, debug bool) {
	defer term.Close()
	defer persistCurrentSessionState()

	engine := buildEngine(cfg, tools, debug)
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

	workerPool = worker.NewPool()
	if engine.LLM != nil {
		eff, _ := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
		workerClient := newLLMClient(&eff.Profile, &eff.Provider)
		tools.Register(&agent.Spawn{Pool: workerPool, Client: workerClient, Tools: tools})
		tools.Register(&agent.List{Pool: workerPool})
		tools.Register(&agent.Output{Pool: workerPool})
		tools.Register(&agent.Stop{Pool: workerPool})
		tools.Register(&agent.Resume{Pool: workerPool})
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
			handleSlashCommand(input, &cfg, &engine, tools, debug, &autoEnabled, escalator)
			continue
		}

		if engine.LLM == nil {
			fmt.Println("请先配置。输入 /setup")
			continue
		}

		engine.ResetCancel()
		stopElapsed := startTurnElapsedDisplay(os.Stderr, time.Now(), time.Second)

		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt)

		type result struct {
			out *soul.Outcome
			err error
		}
		done := make(chan result, 1)
		go func() {
			outcome, err := engine.Run(input)
			done <- result{outcome, err}
		}()

		select {
		case r := <-done:
			stopElapsed()
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
			stream := false
			if pr, _, err := cfg.ActiveProfile(); err == nil {
				stream = pr.Stream
			}
			if outcome.FinalMessage != "" && !stream {
				fmt.Println(outcome.FinalMessage)
			}
			if outcome.FinalMessage != "" && stream {
				fmt.Println()
			}
			if outcome.FinalMessage == "" && outcome.StopReason == "error" {
				fmt.Fprintf(os.Stderr, "\n错误: %s\n", outcome.FinalMessage)
			}
			if currentSession != nil {
				sessStore.AppendMessage(currentSession.ID, chat.Message{Role: chat.RoleUser, Content: input})
				sessStore.AppendMessage(currentSession.ID, chat.Message{Role: chat.RoleAssistant, Content: outcome.FinalMessage})
			}
			decision := maybeRecordAutoflow(autoEnabled, escalator, outcome, cfg)
			applyAutoflowDecision(decision, cfg, &engine, tools, debug)
			persistCurrentSessionState()
			if decision.Action == autoflow.ActionDebug {
				fmt.Fprintln(os.Stderr, "连续失败，已自动升级到 debug mode。输入 /status 可查看当前模型和权限。")
			} else if decision.Action == autoflow.ActionRecoveredMode {
				fmt.Fprintln(os.Stderr, "debug 修复完成，已自动回到之前的 mode。")
			}
		case <-sigCh:
			signal.Stop(sigCh)
			engine.Cancel()
			<-done
			stopElapsed()
			fmt.Println("\n⏹ 已停止")
		}
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

func handleRollback(input string, engine **soul.Engine) {
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

func handleMode(input string, cfg *config.Config, engine **soul.Engine, tools *toolset.Registry, debug bool) {
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
	runtime.Mode = m.Name
	runtime.ModelProfile = ""
	runtime.PermissionProfile = ""
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
	applyModePrompt(*engine, m)
	persistCurrentSessionState()
	fmt.Printf("✓ 已切换 mode: %s (%s)\n", m.Name, m.DisplayName)
}

func handleModel(input string, cfg *config.Config, engine **soul.Engine, tools *toolset.Registry, debug bool) {
	parts := strings.Fields(input)
	if len(parts) < 2 {
		showModelProfiles(cfg)
		return
	}
	name := parts[1]
	if _, ok := cfg.ModelProfiles[name]; !ok {
		fmt.Printf("模型配置 %q 不存在\n", name)
		showModelProfiles(cfg)
		return
	}
	runtime.ModelProfile = name
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
	persistCurrentSessionState()
	fmt.Printf("✓ 已切换 model_profile: %s\n", name)
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

func handlePermission(input string, cfg *config.Config, engine **soul.Engine, tools *toolset.Registry, debug bool) {
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
	runtime.PermissionProfile = name
	*engine = rebuildEnginePreservingState(cfg, *engine, tools, debug)
	persistCurrentSessionState()
	fmt.Printf("✓ 已切换 permission_profile: %s\n", name)
}

func showPermissions(cfg *config.Config) {
	fmt.Printf("当前 permission_profile: %s\n", currentPermissionProfile(cfg))
	fmt.Println("可用 permission_profiles:")
	for name, pp := range cfg.PermissionProfiles {
		fmt.Printf("  %s - %s\n", name, pp.Description)
	}
}

func handleStatus(cfg *config.Config, engine *soul.Engine) {
	if cfg == nil {
		fmt.Println("未配置")
		return
	}
	lines, err := statusLines(cfg, engine)
	if err != nil {
		fmt.Printf("读取状态失败: %v\n", err)
		return
	}
	for _, line := range lines {
		fmt.Println(line)
	}
}

func statusLines(cfg *config.Config, engine *soul.Engine) ([]string, error) {
	eff, err := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
	if err != nil {
		return nil, err
	}
	modeName := eff.Mode
	if engine != nil && engine.Mode != nil {
		modeName = engine.Mode.Name
	}
	modeSuffix := ""
	if runtime.Mode != "" {
		modeSuffix = " (manual override)"
	}
	modelSuffix := ""
	if runtime.ModelProfile != "" {
		modelSuffix = " (manual override)"
	}
	permissionSuffix := ""
	if runtime.PermissionProfile != "" {
		permissionSuffix = " (manual override)"
	}
	tools := "mode-filtered"
	if len(eff.ModeConfig.Tools.Allowed) > 0 {
		tools = fmt.Sprintf("allow-list (%d tools)", len(eff.ModeConfig.Tools.Allowed))
	} else if len(eff.ModeConfig.Tools.Exclude) > 0 {
		tools = fmt.Sprintf("exclude-list (%d tools)", len(eff.ModeConfig.Tools.Exclude))
	}
	contextTokens, maxContextTokens, contextUsage := contextTokenStats(engine)
	return []string{
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
	}, nil
}

func contextTokenStats(engine *soul.Engine) (int, int, float64) {
	if engine == nil || engine.Context == nil {
		return 0, 0, 0
	}
	tokens := compaction.EstimateTokens(engine.Context.Messages)
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
			fmt.Printf("  %s [%s] %s", w.ID, w.Status, w.Task)
			if last != "" {
				fmt.Printf(" → %s", last)
			}
			fmt.Println()
		}
	case strings.HasPrefix(input, "/stop "):
		id := strings.TrimPrefix(input, "/stop ")
		w := workerPool.Get(id)
		if w == nil {
			fmt.Printf("子 agent %s 不存在\n", id)
			return
		}
		w.Stop()
		fmt.Printf("⏹ %s 已暂停\n", id)
	case strings.HasPrefix(input, "/go "):
		id := strings.TrimPrefix(input, "/go ")
		w := workerPool.Get(id)
		if w == nil {
			fmt.Printf("子 agent %s 不存在\n", id)
			return
		}
		w.Resume()
		fmt.Printf("▶ %s 已恢复\n", id)
	default:
		fmt.Println("用法: /workers | /stop <id> | /go <id>")
	}
}

func handleSlashCommand(input string, cfg **config.Config, engine **soul.Engine, tools *toolset.Registry, debug bool, autoEnabled *bool, escalator *autoflow.Escalator) {
	if strings.HasPrefix(input, "/sessions") || input == "/sessions" {
		handleSessions(input, *cfg, engine, tools, debug)
		return
	}
	if strings.HasPrefix(input, "/rollback ") || input == "/rollback" {
		handleRollback(input, engine)
		return
	}
	if input == "/stop" {
		(*engine).Cancel()
		(*engine).ResetCancel()
		fmt.Println("\n⏹ 已停止")
		return
	}
	if strings.HasPrefix(input, "/mode") || input == "/mode" {
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		handleMode(input, *cfg, engine, tools, debug)
		return
	}
	if strings.HasPrefix(input, "/model") || input == "/model" {
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		handleModel(input, *cfg, engine, tools, debug)
		return
	}
	if strings.HasPrefix(input, "/permission") || input == "/permission" {
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		handlePermission(input, *cfg, engine, tools, debug)
		return
	}
	if input == "/status" {
		handleStatus(*cfg, *engine)
		return
	}
	if strings.HasPrefix(input, "/auto") || input == "/auto" {
		handleAuto(input, autoEnabled, escalator)
		return
	}
	if strings.HasPrefix(input, "/execute-plan") || input == "/execute-plan" {
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		handleExecutePlan(input, *cfg, engine, tools, debug)
		return
	}
	if strings.HasPrefix(input, "/plan") || input == "/plan" {
		handlePlan(input)
		return
	}
	if strings.HasPrefix(input, "/workers") || strings.HasPrefix(input, "/stop ") || strings.HasPrefix(input, "/go ") {
		handleWorkerCommand(input)
		return
	}
	if strings.HasPrefix(input, "/sandbox ") || input == "/sandbox" {
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
		}
	case "/profile":
		if *cfg == nil {
			fmt.Println("请先配置。输入 /setup")
			return
		}
		name := ui.PickProfile(*cfg)
		if name != "" {
			(*cfg).DefaultProfile = name
			runtime = runtimeOverrides{}
			(*cfg).Save()
			*engine = buildEngine(*cfg, tools, debug)
			persistCurrentSessionState()
			fmt.Printf("已切换到: %s\n", name)
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
	}
	planState := plan.Status()
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

func handleSessions(input string, cfg *config.Config, engine **soul.Engine, tools *toolset.Registry, debug bool) {
	parts := strings.Fields(input)
	if len(parts) >= 2 && parts[1] == "restore" {
		restoreSession(parts, cfg, engine, tools, debug)
		return
	}
	if len(parts) > 1 {
		fmt.Println("用法: /sessions 或 /sessions restore <id|序号>")
		return
	}
	listSessions()
}

func restoreSession(parts []string, cfg *config.Config, engine **soul.Engine, tools *toolset.Registry, debug bool) {
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
	restorePlanMode(state)
	warnings = append(warnings, restorePlanSession(state)...)
	currentSession = sess
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

func restorePlanMode(state session.State) {
	if state.PlanMode {
		plan.Enter(state.PlanSlug, state.PlanPath, "restored session")
		return
	}
	plan.Exit()
}

func restorePlanSession(state session.State) []string {
	currentPlan = nil
	if state.PlanPath == "" {
		return nil
	}
	data, err := os.ReadFile(state.PlanPath)
	if err != nil {
		return []string{fmt.Sprintf("⚠ 计划文件未恢复: %v", err)}
	}
	currentPlan = planexec.Parse(state.PlanPath, string(data))
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

func attachSnapshotter(engine *soul.Engine, sess *session.Session) {
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
  /plan     当前计划状态（status/done/clear）
  /execute-plan <plan.md> 载入计划并切回 code mode
  /checkpoint 手动创建快照
  /rollback <n> 回退到第 n 步
  /compact  手动压缩上下文
  /sandbox  管理沙盒（create/merge/diff/delete）
  /workers  查看子 agent
  /stop <id> 暂停子 agent
  /go <id>  恢复子 agent
  /sessions 查看历史会话
  /sessions restore <id|序号> 恢复历史会话
  /config   查看当前配置
  /help     显示帮助
  /quit     退出`)
}
