package wire

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sync"
)

type ServerHandler struct {
	Initialize  func(context.Context, InitializeParams) (any, error)
	Prompt      func(context.Context, PromptParams) (any, error)
	Steer       func(context.Context, SteerParams) (any, error)
	Cancel      func(context.Context) (any, error)
	SetPlanMode func(context.Context, SetPlanModeParams) (any, error)
}

type Server struct {
	wire    *Wire
	in      io.Reader
	out     io.Writer
	handler ServerHandler
	outMu   sync.Mutex
}

func NewServer(w *Wire, in io.Reader, out io.Writer, handler ServerHandler) *Server {
	if w == nil {
		w = NewWire()
	}
	return &Server{wire: w, in: in, out: out, handler: handler}
}

func (s *Server) Run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	var handlers sync.WaitGroup
	errCh := make(chan error, 1)

	unsubscribe := s.wire.AddSink(func(msg WireMessage) {
		_ = s.writeWireMessage(msg)
	})
	defer unsubscribe()

	scanner := bufio.NewScanner(s.in)
	for scanner.Scan() {
		line := scanner.Bytes()
		incoming, err := UnmarshalIncoming(line)
		if err != nil {
			_ = s.writeRPCError(nil, ErrorParseError, err.Error(), nil)
			continue
		}
		if incoming.Method == "" {
			s.resolveResponse(incoming)
			continue
		}
		handlers.Add(1)
		go func(msg IncomingMessage) {
			defer handlers.Done()
			if err := s.handle(ctx, msg); err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(incoming)
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read wire input: %w", err)
	}
	handlers.Wait()
	cancel()
	select {
	case err := <-errCh:
		return err
	default:
	}
	return nil
}

func (s *Server) resolveResponse(incoming IncomingMessage) {
	id, err := rpcIDString(incoming.ID)
	if err != nil || id == "" || len(incoming.Result) == 0 {
		return
	}
	s.wire.ResolveResponse(id, incoming.Result)
}

func (s *Server) handle(ctx context.Context, incoming IncomingMessage) error {
	result, rpcErr := s.dispatch(ctx, incoming)
	if len(incoming.ID) == 0 {
		return nil
	}
	if rpcErr != nil {
		return s.writeRPCError(incoming.ID, rpcErr.Code, rpcErr.Message, rpcErr.Data)
	}
	data, err := MarshalResult(incoming.ID, result)
	if err != nil {
		return err
	}
	return s.writeLine(data)
}

func (s *Server) dispatch(ctx context.Context, incoming IncomingMessage) (any, *RPCError) {
	switch incoming.Method {
	case MethodInitialize:
		params, err := DecodeParams[InitializeParams](incoming.Params)
		if err != nil {
			return nil, rpcError(ErrorInvalidParams, err.Error(), nil)
		}
		return callHandler(ctx, params, s.handler.Initialize, map[string]any{"status": "ok"})
	case MethodPrompt:
		params, err := DecodeParams[PromptParams](incoming.Params)
		if err != nil {
			return nil, rpcError(ErrorInvalidParams, err.Error(), nil)
		}
		return callHandler(ctx, params, s.handler.Prompt, map[string]any{"status": "accepted"})
	case MethodSteer:
		params, err := DecodeParams[SteerParams](incoming.Params)
		if err != nil {
			return nil, rpcError(ErrorInvalidParams, err.Error(), nil)
		}
		return callHandler(ctx, params, s.handler.Steer, map[string]any{"status": "accepted"})
	case MethodCancel:
		if s.handler.Cancel == nil {
			return map[string]any{"status": "ok"}, nil
		}
		result, err := s.handler.Cancel(ctx)
		if err != nil {
			return nil, rpcError(ErrorInternal, err.Error(), nil)
		}
		return result, nil
	case MethodSetPlanMode:
		params, err := DecodeParams[SetPlanModeParams](incoming.Params)
		if err != nil {
			return nil, rpcError(ErrorInvalidParams, err.Error(), nil)
		}
		return callHandler(ctx, params, s.handler.SetPlanMode, map[string]any{"status": "ok"})
	default:
		return nil, rpcError(ErrorMethodNotFound, fmt.Sprintf("method %q not found", incoming.Method), nil)
	}
}

func callHandler[T any](ctx context.Context, params T, fn func(context.Context, T) (any, error), fallback any) (any, *RPCError) {
	if fn == nil {
		return fallback, nil
	}
	result, err := fn(ctx, params)
	if err != nil {
		return nil, rpcError(ErrorInternal, err.Error(), nil)
	}
	return result, nil
}

func rpcError(code int, message string, data any) *RPCError {
	raw, _ := marshalPayload(data)
	return &RPCError{Code: code, Message: message, Data: raw}
}

func (s *Server) writeWireMessage(msg WireMessage) error {
	if msg.Kind == MessageEvent && msg.Event != nil {
		data, err := MarshalEvent(*msg.Event)
		if err != nil {
			return err
		}
		return s.writeLine(data)
	}
	if msg.Kind == MessageRequest && msg.Request != nil {
		data, err := MarshalRequest(*msg.Request)
		if err != nil {
			return err
		}
		return s.writeLine(data)
	}
	return nil
}

func (s *Server) writeRPCError(id json.RawMessage, code int, message string, data any) error {
	msg, err := MarshalError(id, code, message, data)
	if err != nil {
		return err
	}
	return s.writeLine(msg)
}

func (s *Server) writeLine(data []byte) error {
	s.outMu.Lock()
	defer s.outMu.Unlock()
	if _, err := s.out.Write(data); err != nil {
		return err
	}
	_, err := s.out.Write([]byte("\n"))
	return err
}

func rpcIDString(raw json.RawMessage) (string, error) {
	if len(raw) == 0 {
		return "", nil
	}
	var id string
	if err := json.Unmarshal(raw, &id); err == nil {
		return id, nil
	}
	return string(raw), nil
}
