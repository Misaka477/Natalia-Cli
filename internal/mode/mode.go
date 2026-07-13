package mode

import (
	"fmt"
	"strings"
)

type Mode struct {
	Name        string
	DisplayName string
	Prompt      string
	ToolFilter  func(name string, args map[string]any) bool
}

var codeTools = map[string]bool{
	"read_file": true, "write_file": true, "edit_file": true,
	"glob": true, "grep": true, "run_shell": true,
	"web_fetch": true, "web_search": true,
	"todo_set": true, "todo_add": true, "todo_done": true, "todo_list": true,
	"ask_user":      true,
	"workflow_list": true, "workflow_read": true, "workflow_run": true,
	"plan_mode_enter": true, "plan_mode_exit": true, "plan_mode_status": true,
	"process_start": true, "process_list": true, "process_status": true, "process_output": true, "process_stop": true, "process_restart": true, "process_attach": true, "process_detach": true, "process_cleanup": true, "process_audit": true,
	"background_start": true, "background_list": true, "background_output": true, "background_stop": true, "background_restart": true, "background_cleanup": true, "background_audit": true,
	"interactive_start": true, "interactive_read": true, "interactive_write": true, "interactive_keys": true, "interactive_stop": true, "interactive_list": true, "interactive_attach": true, "interactive_detach": true, "interactive_resize": true, "interactive_transcript": true, "interactive_cleanup": true,
	"agent_spawn": true, "agent_list": true, "agent_output": true, "agent_attach": true, "agent_detach": true, "agent_stop": true, "agent_resume": true,
}

var readTools = map[string]bool{
	"read_file": true, "glob": true, "grep": true,
	"web_fetch": true, "web_search": true,
	"todo_list":     true,
	"ask_user":      true,
	"workflow_list": true, "workflow_read": true,
	"plan_mode_enter": true, "plan_mode_exit": true, "plan_mode_status": true,
	"process_list": true, "process_status": true, "process_output": true, "process_audit": true,
	"background_list": true, "background_output": true, "background_audit": true,
	"interactive_list": true, "interactive_read": true, "interactive_transcript": true,
	"agent_list": true, "agent_output": true,
}

var chatTools = map[string]bool{
	"web_search":             true,
	"ask_user":               true,
	"todo_list":              true,
	"workflow_list":          true,
	"plan_mode_status":       true,
	"process_list":           true,
	"process_status":         true,
	"process_output":         true,
	"process_audit":          true,
	"background_list":        true,
	"background_output":      true,
	"background_audit":       true,
	"interactive_list":       true,
	"interactive_read":       true,
	"interactive_transcript": true,
	"agent_list":             true,
	"agent_output":           true,
}

func makeFilter(allowed map[string]bool) func(string, map[string]any) bool {
	return func(name string, args map[string]any) bool {
		_, ok := allowed[name]
		return ok
	}
}

var Modes = []Mode{
	{
		Name:        "code",
		DisplayName: "编程模式",
		Prompt: `你是 Natalia CLI，一个运行在用户电脑上的交互式编程助手。

你的核心目标是通过调用工具来帮助用户完成软件工程任务。对于涉及文件、代码、命令执行的问题，必须调用工具来实际操作，而不是仅用文字描述。

可用的工具：文件读写、代码搜索、shell 命令、网页获取、任务清单。

规则：
- 文件操作必须调用工具，不要只回复文字
- 调用工具后根据结果决定下一步行动
- 简单的问候可以直接回复`,
		ToolFilter: makeFilter(codeTools),
	},
	{
		Name:        "ask",
		DisplayName: "问答模式",
		Prompt: `你是 Natalia CLI，一个专注于回答问题的助手。

你只能使用只读工具。你可以读取文件、搜索代码、搜索网络来获取信息回答问题。

注意：你不能修改任何文件或执行命令。`,
		ToolFilter: makeFilter(readTools),
	},
	{
		Name:        "plan",
		DisplayName: "规划模式",
		Prompt: `你是 Natalia CLI，一个专注于架构设计和任务规划的助手。

你只能读取文件，或将规划文档写入 PLANS/ 目录。不允许修改项目代码。

你的任务：
1. 理解项目结构和代码
2. 分析需求
3. 制定实施方案
4. 将规划写入 PLANS/ 目录下的 .md 文件

完成规划后让用户切换到 code 模式来执行。`,
		ToolFilter: func(name string, args map[string]any) bool {
			if allowed := readTools[name]; allowed {
				return true
			}
			if name == "write_file" || name == "edit_file" {
				if path, ok := args["path"].(string); ok {
					return strings.HasPrefix(path, "PLANS/") || strings.Contains(path, "/PLANS/")
				}
			}
			return false
		},
	},
	{
		Name:        "debug",
		DisplayName: "调试模式",
		Prompt: `你是 Natalia CLI，一个专注于调试和问题排查的助手。

你有完整的工具权限，但应该优先做以下操作：
1. 读取错误信息
2. 搜索相关代码
3. 分析根因
4. 提出修复方案并执行

调试步骤：
1. 复现问题
2. 定位根因
3. 实施修复
4. 验证修复`,
		ToolFilter: makeFilter(codeTools),
	},
	{
		Name:        "chat",
		DisplayName: "聊天模式",
		Prompt: `你是 Natalia CLI，一个友好的聊天助手。

此模式下你只能进行对话和网络搜索，不能修改任何文件或执行命令。`,
		ToolFilter: makeFilter(chatTools),
	},
}

func Get(name string) (*Mode, error) {
	for _, m := range Modes {
		if m.Name == name {
			return &m, nil
		}
	}
	return nil, fmt.Errorf("未知模式: %s", name)
}

func List() []string {
	names := make([]string, len(Modes))
	for i, m := range Modes {
		names[i] = fmt.Sprintf("%s (%s)", m.Name, m.DisplayName)
	}
	return names
}
