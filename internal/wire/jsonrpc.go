package wire

import (
	"encoding/json"
	"fmt"
)

const JSONRPCVersion = "2.0"

const (
	MethodEvent             = "event"
	MethodRequest           = "request"
	MethodInitialize        = "initialize"
	MethodPrompt            = "prompt"
	MethodSteer             = "steer"
	MethodCancel            = "cancel"
	MethodSetPlanMode       = "set_plan_mode"
	MethodSetRuntimeProfile = "set_runtime_profile"
	MethodRestoreSession    = "restore_session"
	MethodListSessions      = "list_sessions"
)

const (
	ErrorParseError     = -32700
	ErrorInvalidRequest = -32600
	ErrorMethodNotFound = -32601
	ErrorInvalidParams  = -32602
	ErrorInternal       = -32603
)

type RPCMessage struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

type RPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

type TypedPayload struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type IncomingMessage struct {
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	ID     json.RawMessage `json:"id,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *RPCError       `json:"error,omitempty"`
}

type InitializeParams struct {
	ClientName    string `json:"client_name,omitempty"`
	ClientVersion string `json:"client_version,omitempty"`
}

type PromptParams struct {
	UserInput string `json:"user_input"`
}

type SteerParams struct {
	UserInput string `json:"user_input"`
}

type SetPlanModeParams struct {
	Enabled bool `json:"enabled"`
}

type SetRuntimeProfileParams struct {
	Mode              string `json:"mode,omitempty"`
	ModelProfile      string `json:"model_profile,omitempty"`
	PermissionProfile string `json:"permission_profile,omitempty"`
}

type RestoreSessionParams struct {
	SessionID string `json:"session_id"`
}

func MarshalEvent(event WireEvent) ([]byte, error) {
	params, err := json.Marshal(TypedPayload{Type: string(event.Type), Payload: event.Payload})
	if err != nil {
		return nil, err
	}
	return json.Marshal(RPCMessage{JSONRPC: JSONRPCVersion, Method: MethodEvent, Params: params})
}

func MarshalRequest(request WireRequest) ([]byte, error) {
	params, err := json.Marshal(TypedPayload{Type: string(request.Type), Payload: request.Payload})
	if err != nil {
		return nil, err
	}
	id, err := json.Marshal(request.ID)
	if err != nil {
		return nil, err
	}
	return json.Marshal(RPCMessage{JSONRPC: JSONRPCVersion, Method: MethodRequest, ID: id, Params: params})
}

func MarshalResult(id json.RawMessage, result any) ([]byte, error) {
	raw, err := marshalPayload(result)
	if err != nil {
		return nil, err
	}
	return json.Marshal(RPCMessage{JSONRPC: JSONRPCVersion, ID: id, Result: raw})
}

func MarshalError(id json.RawMessage, code int, message string, data any) ([]byte, error) {
	raw, err := marshalPayload(data)
	if err != nil {
		return nil, err
	}
	return json.Marshal(RPCMessage{JSONRPC: JSONRPCVersion, ID: id, Error: &RPCError{Code: code, Message: message, Data: raw}})
}

func UnmarshalIncoming(data []byte) (IncomingMessage, error) {
	var msg RPCMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return IncomingMessage{}, fmt.Errorf("parse JSON-RPC: %w", err)
	}
	if msg.JSONRPC != JSONRPCVersion {
		return IncomingMessage{}, fmt.Errorf("invalid jsonrpc version %q", msg.JSONRPC)
	}
	if len(msg.ID) == 0 && msg.Method == "" {
		return IncomingMessage{}, fmt.Errorf("invalid JSON-RPC message: missing method or id")
	}
	return IncomingMessage{Method: msg.Method, Params: msg.Params, ID: msg.ID, Result: msg.Result, Error: msg.Error}, nil
}

func DecodeParams[T any](raw json.RawMessage) (T, error) {
	var value T
	if len(raw) == 0 {
		return value, nil
	}
	if err := json.Unmarshal(raw, &value); err != nil {
		return value, err
	}
	return value, nil
}
