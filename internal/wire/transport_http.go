package wire

import (
	"bufio"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
)

const maxHTTPRPCBody = 1 << 20

type HTTPServer struct {
	wire    *Wire
	server  *Server
	handler ServerHandler
	http    *http.Server
}

func NewHTTPServer(w *Wire, handler ServerHandler) *HTTPServer {
	if w == nil {
		w = NewWire()
	}
	return &HTTPServer{wire: w, server: NewServer(w, nil, io.Discard, handler), handler: handler}
}

func (s *HTTPServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/rpc":
		s.handleRPC(w, r)
	case "/events":
		s.handleSSE(w, r)
	case "/ws":
		s.handleWebSocket(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *HTTPServer) ListenAndServe(addr string) error {
	s.http = &http.Server{Addr: addr, Handler: s}
	return s.http.ListenAndServe()
}

func (s *HTTPServer) ListenAndServeUnix(path string) error {
	ln, err := net.Listen("unix", path)
	if err != nil {
		return err
	}
	s.http = &http.Server{Handler: s}
	return s.http.Serve(ln)
}

func (s *HTTPServer) Shutdown(ctx context.Context) error {
	if s == nil || s.http == nil {
		return nil
	}
	return s.http.Shutdown(ctx)
}

func (s *HTTPServer) handleRPC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, maxHTTPRPCBody+1))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(body) > maxHTTPRPCBody {
		http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
		return
	}
	incoming, err := UnmarshalIncoming(body)
	if err != nil {
		writeHTTPRPC(w, http.StatusBadRequest, mustMarshalRPCError(nil, ErrorParseError, err.Error()))
		return
	}
	data, err := s.server.HandleIncoming(r.Context(), incoming)
	if err != nil {
		writeHTTPRPC(w, http.StatusInternalServerError, mustMarshalRPCError(incoming.ID, ErrorInternal, err.Error()))
		return
	}
	if len(data) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeHTTPRPC(w, http.StatusOK, data)
}

func (s *HTTPServer) handleSSE(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	ch, cancel := s.wire.UISide().SubscribeRaw()
	defer cancel()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			data, err := MarshalWireMessage(msg)
			if err != nil || len(data) == 0 {
				continue
			}
			_, _ = fmt.Fprintf(w, "event: message\ndata: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func (s *HTTPServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") || !strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade") {
		http.Error(w, "websocket upgrade required", http.StatusBadRequest)
		return
	}
	key := r.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		http.Error(w, "missing Sec-WebSocket-Key", http.StatusBadRequest)
		return
	}
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "hijacking unsupported", http.StatusInternalServerError)
		return
	}
	conn, rw, err := hijacker.Hijack()
	if err != nil {
		return
	}
	ws := &webSocketConn{conn: conn, rw: rw}
	if err := ws.handshake(key); err != nil {
		_ = conn.Close()
		return
	}
	defer conn.Close()
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	detach := s.wire.AddSink(func(msg WireMessage) {
		data, err := MarshalWireMessage(msg)
		if err == nil && len(data) > 0 {
			_ = ws.writeText(data)
		}
	})
	defer detach()
	for {
		payload, opcode, err := ws.readFrame()
		if err != nil {
			return
		}
		switch opcode {
		case 0x8:
			_ = ws.writeClose()
			return
		case 0x9:
			_ = ws.writeFrame(0xA, payload)
			continue
		case 0x1:
		default:
			continue
		}
		incoming, err := UnmarshalIncoming(payload)
		if err != nil {
			_ = ws.writeText(mustMarshalRPCError(nil, ErrorParseError, err.Error()))
			continue
		}
		data, err := s.server.HandleIncoming(ctx, incoming)
		if err != nil {
			_ = ws.writeText(mustMarshalRPCError(incoming.ID, ErrorInternal, err.Error()))
			continue
		}
		if len(data) > 0 {
			_ = ws.writeText(data)
		}
	}
}

func writeHTTPRPC(w http.ResponseWriter, status int, data []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}

func mustMarshalRPCError(id []byte, code int, message string) []byte {
	data, err := MarshalError(id, code, message, nil)
	if err != nil {
		return []byte(`{"jsonrpc":"2.0","error":{"code":-32603,"message":"internal error"}}`)
	}
	return data
}

type webSocketConn struct {
	conn net.Conn
	rw   *bufio.ReadWriter
	mu   sync.Mutex
}

func (c *webSocketConn) handshake(key string) error {
	h := sha1.New()
	_, _ = h.Write([]byte(key))
	_, _ = h.Write([]byte("258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	accept := base64.StdEncoding.EncodeToString(h.Sum(nil))
	_, err := fmt.Fprintf(c.rw, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n", accept)
	if err != nil {
		return err
	}
	return c.rw.Flush()
}

func (c *webSocketConn) readFrame() ([]byte, byte, error) {
	first, err := c.rw.ReadByte()
	if err != nil {
		return nil, 0, err
	}
	second, err := c.rw.ReadByte()
	if err != nil {
		return nil, 0, err
	}
	opcode := first & 0x0F
	masked := second&0x80 != 0
	length := uint64(second & 0x7F)
	if length == 126 {
		var buf [2]byte
		if _, err := io.ReadFull(c.rw, buf[:]); err != nil {
			return nil, 0, err
		}
		length = uint64(binary.BigEndian.Uint16(buf[:]))
	} else if length == 127 {
		var buf [8]byte
		if _, err := io.ReadFull(c.rw, buf[:]); err != nil {
			return nil, 0, err
		}
		length = binary.BigEndian.Uint64(buf[:])
	}
	if length > maxHTTPRPCBody {
		return nil, 0, fmt.Errorf("websocket frame too large")
	}
	var mask [4]byte
	if masked {
		if _, err := io.ReadFull(c.rw, mask[:]); err != nil {
			return nil, 0, err
		}
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(c.rw, payload); err != nil {
		return nil, 0, err
	}
	if masked {
		for i := range payload {
			payload[i] ^= mask[i%4]
		}
	}
	return payload, opcode, nil
}

func (c *webSocketConn) writeText(data []byte) error { return c.writeFrame(0x1, data) }

func (c *webSocketConn) writeClose() error { return c.writeFrame(0x8, nil) }

func (c *webSocketConn) writeFrame(opcode byte, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.rw.WriteByte(0x80 | opcode); err != nil {
		return err
	}
	length := len(data)
	if length < 126 {
		if err := c.rw.WriteByte(byte(length)); err != nil {
			return err
		}
	} else if length <= 65535 {
		if err := c.rw.WriteByte(126); err != nil {
			return err
		}
		var buf [2]byte
		binary.BigEndian.PutUint16(buf[:], uint16(length))
		if _, err := c.rw.Write(buf[:]); err != nil {
			return err
		}
	} else {
		if err := c.rw.WriteByte(127); err != nil {
			return err
		}
		var buf [8]byte
		binary.BigEndian.PutUint64(buf[:], uint64(length))
		if _, err := c.rw.Write(buf[:]); err != nil {
			return err
		}
	}
	if _, err := c.rw.Write(data); err != nil {
		return err
	}
	return c.rw.Flush()
}
