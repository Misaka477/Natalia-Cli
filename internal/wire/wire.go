package wire

import "encoding/json"

// Wire 协议 — 预留接口
// 未来通过 stdin/stdout JSON-RPC 与外部（Natalia/终端/WebUI）通信
// 当前 CLI 模式直接使用 soul.Engine

type Message struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params,omitempty"`
}

type Event struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params,omitempty"`
}

// 预留：外部 agent 通信
// - StartEngine
// - SendMessage
// - ApproveTool
// - StopEngine
