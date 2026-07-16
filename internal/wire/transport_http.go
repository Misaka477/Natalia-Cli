package wire

import (
	"bufio"
	"bytes"
	"compress/flate"
	"context"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const maxHTTPRPCBody = 1 << 20

const maxTransportReplayEvents = 256

const wireWebSocketSubprotocol = "natalia.wire.v1"

var defaultHTTPAllowedMethods = []string{
	MethodInitialize,
	MethodPrompt,
	MethodSteer,
	MethodCancel,
	MethodSetPlanMode,
	MethodSetRuntimeProfile,
	MethodRestoreSession,
	MethodListSessions,
}

type HTTPServerOptions struct {
	AuthToken      string
	AllowedMethods []string
}

type HTTPServer struct {
	mu        sync.Mutex
	wire      *Wire
	server    *Server
	handler   ServerHandler
	http      *http.Server
	options   HTTPServerOptions
	methods   map[string]struct{}
	events    *transportEventLog
	detachLog func()
	startedAt time.Time
	unixPath  string
	closed    bool
}

func NewHTTPServer(w *Wire, handler ServerHandler) *HTTPServer {
	return NewHTTPServerWithOptions(w, handler, HTTPServerOptions{})
}

func NewHTTPServerWithOptions(w *Wire, handler ServerHandler, options HTTPServerOptions) *HTTPServer {
	if w == nil {
		w = NewWire()
	}
	methods := make(map[string]struct{})
	allowed := options.AllowedMethods
	if len(allowed) == 0 {
		allowed = defaultHTTPAllowedMethods
	}
	for _, method := range allowed {
		method = strings.TrimSpace(method)
		if method != "" {
			methods[method] = struct{}{}
		}
	}
	log := newTransportEventLog(maxTransportReplayEvents)
	s := &HTTPServer{wire: w, server: NewServer(w, nil, io.Discard, handler), handler: handler, options: options, methods: methods, events: log, startedAt: time.Now()}
	detach, _ := w.AddSink(func(msg WireMessage) { log.append(msg) })
	s.detachLog = detach
	return s
}

func (s *HTTPServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/healthz" && !s.authorized(r) {
		w.Header().Set("WWW-Authenticate", `Bearer realm="natalia-wire"`)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	switch r.URL.Path {
	case "/rpc":
		s.handleRPC(w, r)
	case "/events":
		s.handleSSE(w, r)
	case "/ws":
		s.handleWebSocket(w, r)
	case "/healthz":
		s.handleHealth(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *HTTPServer) ListenAndServe(addr string) error {
	server, err := s.setHTTPServer(&http.Server{Addr: addr, Handler: s}, "")
	if err != nil {
		return err
	}
	return server.ListenAndServe()
}

func (s *HTTPServer) ListenAndServeTLS(addr, certFile, keyFile string) error {
	server, err := s.setHTTPServer(&http.Server{Addr: addr, Handler: s}, "")
	if err != nil {
		return err
	}
	return server.ListenAndServeTLS(certFile, keyFile)
}

func (s *HTTPServer) ListenAndServeUnix(path string) error {
	if err := cleanupStaleUnixSocket(path); err != nil {
		return err
	}
	ln, err := net.Listen("unix", path)
	if err != nil {
		return err
	}
	server, err := s.setHTTPServer(&http.Server{Handler: s}, path)
	if err != nil {
		_ = ln.Close()
		_ = os.Remove(path)
		return err
	}
	err = server.Serve(ln)
	_ = os.Remove(path)
	return err
}

func (s *HTTPServer) Shutdown(ctx context.Context) error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	s.closed = true
	server := s.http
	s.http = nil
	unixPath := s.unixPath
	s.unixPath = ""
	detachLog := s.detachLog
	s.detachLog = nil
	s.mu.Unlock()
	if detachLog != nil {
		detachLog()
	}
	if server == nil {
		return nil
	}
	err := server.Shutdown(ctx)
	if unixPath != "" {
		_ = os.Remove(unixPath)
	}
	return err
}

func (s *HTTPServer) setHTTPServer(server *http.Server, unixPath string) (*http.Server, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, http.ErrServerClosed
	}
	s.http = server
	s.unixPath = unixPath
	return server, nil
}

func (s *HTTPServer) authorized(r *http.Request) bool {
	if s == nil || s.options.AuthToken == "" {
		return true
	}
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	token := strings.TrimSpace(strings.TrimPrefix(value, "Bearer "))
	if token == value {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(s.options.AuthToken)) == 1
}

func (s *HTTPServer) methodAllowed(method string) bool {
	if method == "" || len(s.methods) == 0 {
		return true
	}
	_, ok := s.methods[method]
	return ok
}

func (s *HTTPServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.mu.Lock()
	unixPath := s.unixPath
	s.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":       "ok",
		"transport":    "wire-http",
		"uptime_ms":    time.Since(s.startedAt).Milliseconds(),
		"auth_enabled": s.options.AuthToken != "",
		"unix_socket":  unixPath,
	})
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
	if !s.methodAllowed(incoming.Method) {
		writeHTTPRPC(w, http.StatusForbidden, mustMarshalRPCError(incoming.ID, ErrorMethodNotFound, "method not allowed by transport policy"))
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
	sessionID := strings.TrimSpace(r.URL.Query().Get("session_id"))
	lastID := parseSSELastEventID(r.Header.Get("Last-Event-ID"))
	ch, cancel := s.wire.UISide().SubscribeRaw()
	defer cancel()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	for _, entry := range s.events.after(lastID, sessionID) {
		data, err := MarshalWireMessage(entry.message)
		if err == nil && len(data) > 0 {
			_, _ = fmt.Fprintf(w, "id: %d\nevent: message\ndata: %s\n\n", entry.id, data)
		}
	}
	flusher.Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			if !messageMatchesSession(msg, sessionID) {
				continue
			}
			data, err := MarshalWireMessage(msg)
			if err != nil || len(data) == 0 {
				continue
			}
			id := s.events.idFor(msg)
			_, _ = fmt.Fprintf(w, "id: %d\nevent: message\ndata: %s\n\n", id, data)
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
	compress := clientWantsWebSocketDeflate(r.Header.Get("Sec-WebSocket-Extensions"))
	subprotocol := chooseWebSocketSubprotocol(r.Header.Get("Sec-WebSocket-Protocol"))
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "hijacking unsupported", http.StatusInternalServerError)
		return
	}
	conn, rw, err := hijacker.Hijack()
	if err != nil {
		return
	}
	ws := &webSocketConn{conn: conn, rw: rw, enableDeflate: compress}
	if err := ws.handshake(key, subprotocol, compress); err != nil {
		_ = conn.Close()
		return
	}
	defer conn.Close()
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	sessionID := strings.TrimSpace(r.URL.Query().Get("session_id"))
	out := make(chan WireMessage, 64)
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		for {
			select {
			case msg, ok := <-out:
				if !ok {
					return
				}
				if !messageMatchesSession(msg, sessionID) {
					continue
				}
				data, err := MarshalWireMessage(msg)
				if err == nil && len(data) > 0 {
					_ = ws.writeText(data)
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	detach, _ := s.wire.AddSink(func(msg WireMessage) {
		select {
		case out <- msg:
		case <-writerDone:
		case <-ctx.Done():
		default:
			if event, err := NewEvent(EventStatusUpdate, StatusUpdate{Diagnostics: []string{fmt.Sprintf("ws subscriber dropped events")}}); err == nil {
				s.wire.RuntimeSide.PublishEvent(event)
			}
		}
	})
	defer func() {
		close(out)
		<-writerDone
		detach()
	}()
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
		if !s.methodAllowed(incoming.Method) {
			_ = ws.writeText(mustMarshalRPCError(incoming.ID, ErrorMethodNotFound, "method not allowed by transport policy"))
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
	conn          net.Conn
	rw            *bufio.ReadWriter
	mu            sync.Mutex
	enableDeflate bool
}

func (c *webSocketConn) handshake(key, subprotocol string, enableDeflate bool) error {
	h := sha1.New()
	_, _ = h.Write([]byte(key))
	_, _ = h.Write([]byte("258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	accept := base64.StdEncoding.EncodeToString(h.Sum(nil))
	_, err := fmt.Fprintf(c.rw, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n", accept)
	if err != nil {
		return err
	}
	if subprotocol != "" {
		if _, err := fmt.Fprintf(c.rw, "Sec-WebSocket-Protocol: %s\r\n", subprotocol); err != nil {
			return err
		}
	}
	if enableDeflate {
		if _, err := fmt.Fprint(c.rw, "Sec-WebSocket-Extensions: permessage-deflate; server_no_context_takeover; client_no_context_takeover\r\n"); err != nil {
			return err
		}
	}
	if _, err := fmt.Fprint(c.rw, "\r\n"); err != nil {
		return err
	}
	return c.rw.Flush()
}

func (c *webSocketConn) readFrame() ([]byte, byte, error) {
	return c.readMessage()
}

func (c *webSocketConn) readMessage() ([]byte, byte, error) {
	var assembled []byte
	var messageOpcode byte
	compressed := false
	for {
		payload, opcode, fin, rsv1, err := c.readSingleFrame()
		if err != nil {
			return nil, 0, err
		}
		switch opcode {
		case 0x0:
			if messageOpcode == 0 {
				return nil, 0, fmt.Errorf("websocket continuation without message")
			}
		case 0x1, 0x2:
			if messageOpcode != 0 {
				return nil, 0, fmt.Errorf("websocket fragmented message interrupted")
			}
			messageOpcode = opcode
			compressed = rsv1
		case 0x8, 0x9, 0xA:
			return payload, opcode, nil
		default:
			return nil, 0, fmt.Errorf("unsupported websocket opcode %x", opcode)
		}
		if len(assembled)+len(payload) > maxHTTPRPCBody {
			return nil, 0, fmt.Errorf("websocket message too large")
		}
		assembled = append(assembled, payload...)
		if !fin {
			continue
		}
		if compressed {
			if !c.enableDeflate {
				return nil, 0, fmt.Errorf("websocket compressed message without negotiation")
			}
			decoded, err := decompressWebSocketMessage(assembled)
			if err != nil {
				return nil, 0, err
			}
			assembled = decoded
		}
		return assembled, messageOpcode, nil
	}
}

func (c *webSocketConn) readSingleFrame() ([]byte, byte, bool, bool, error) {
	first, err := c.rw.ReadByte()
	if err != nil {
		return nil, 0, false, false, err
	}
	second, err := c.rw.ReadByte()
	if err != nil {
		return nil, 0, false, false, err
	}
	fin := first&0x80 != 0
	rsv1 := first&0x40 != 0
	opcode := first & 0x0F
	masked := second&0x80 != 0
	length := uint64(second & 0x7F)
	if length == 126 {
		var buf [2]byte
		if _, err := io.ReadFull(c.rw, buf[:]); err != nil {
			return nil, 0, false, false, err
		}
		length = uint64(binary.BigEndian.Uint16(buf[:]))
	} else if length == 127 {
		var buf [8]byte
		if _, err := io.ReadFull(c.rw, buf[:]); err != nil {
			return nil, 0, false, false, err
		}
		length = binary.BigEndian.Uint64(buf[:])
	}
	if length > maxHTTPRPCBody {
		return nil, 0, false, false, fmt.Errorf("websocket frame too large")
	}
	var mask [4]byte
	if masked {
		if _, err := io.ReadFull(c.rw, mask[:]); err != nil {
			return nil, 0, false, false, err
		}
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(c.rw, payload); err != nil {
		return nil, 0, false, false, err
	}
	if masked {
		for i := range payload {
			payload[i] ^= mask[i%4]
		}
	}
	return payload, opcode, fin, rsv1, nil
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

type transportEventEntry struct {
	id      int64
	message WireMessage
}

type transportEventLog struct {
	mu      sync.Mutex
	nextID  int64
	limit   int
	entries []transportEventEntry
}

func newTransportEventLog(limit int) *transportEventLog {
	return &transportEventLog{limit: limit}
}

func (l *transportEventLog) append(message WireMessage) int64 {
	if l == nil {
		return 0
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if id, ok := l.idForLocked(message); ok {
		return id
	}
	id := atomic.AddInt64(&l.nextID, 1)
	l.entries = append(l.entries, transportEventEntry{id: id, message: message})
	if l.limit > 0 && len(l.entries) > l.limit {
		copy(l.entries, l.entries[len(l.entries)-l.limit:])
		l.entries = l.entries[:l.limit]
	}
	return id
}

func (l *transportEventLog) idFor(message WireMessage) int64 {
	return l.append(message)
}

func (l *transportEventLog) idForLocked(message WireMessage) (int64, bool) {
	for i := len(l.entries) - 1; i >= 0; i-- {
		entry := l.entries[i]
		if entry.message.Event != nil && entry.message.Event == message.Event {
			return entry.id, true
		}
		if entry.message.Request != nil && entry.message.Request == message.Request {
			return entry.id, true
		}
	}
	return 0, false
}

func (l *transportEventLog) after(lastID int64, sessionID string) []transportEventEntry {
	if l == nil {
		return nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]transportEventEntry, 0, len(l.entries))
	for _, entry := range l.entries {
		if entry.id <= lastID || !messageMatchesSession(entry.message, sessionID) {
			continue
		}
		out = append(out, entry)
	}
	return out
}

func parseSSELastEventID(value string) int64 {
	var id int64
	_, _ = fmt.Sscanf(strings.TrimSpace(value), "%d", &id)
	return id
}

func messageMatchesSession(message WireMessage, sessionID string) bool {
	if sessionID == "" {
		return true
	}
	return messageSessionID(message) == sessionID
}

func messageSessionID(message WireMessage) string {
	var payload json.RawMessage
	if message.Event != nil {
		payload = message.Event.Payload
	} else if message.Request != nil {
		payload = message.Request.Payload
	}
	if len(payload) == 0 {
		return ""
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(payload, &fields) != nil {
		return ""
	}
	var sessionID string
	if raw := fields["session_id"]; len(raw) > 0 && json.Unmarshal(raw, &sessionID) == nil {
		return sessionID
	}
	return ""
}

func cleanupStaleUnixSocket(path string) error {
	if path == "" {
		return fmt.Errorf("unix socket path is required")
	}
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSocket == 0 {
		return fmt.Errorf("refusing to remove non-socket file at %s", path)
	}
	conn, err := net.DialTimeout("unix", path, 100*time.Millisecond)
	if err == nil {
		_ = conn.Close()
		return fmt.Errorf("unix socket %s is already in use", path)
	}
	return os.Remove(path)
}

func chooseWebSocketSubprotocol(header string) string {
	for _, raw := range strings.Split(header, ",") {
		if strings.TrimSpace(raw) == wireWebSocketSubprotocol {
			return wireWebSocketSubprotocol
		}
	}
	return ""
}

func clientWantsWebSocketDeflate(header string) bool {
	for _, raw := range strings.Split(header, ",") {
		if strings.Contains(strings.ToLower(raw), "permessage-deflate") {
			return true
		}
	}
	return false
}

func decompressWebSocketMessage(payload []byte) ([]byte, error) {
	data := append(append([]byte(nil), payload...), 0x00, 0x00, 0xff, 0xff)
	r := flate.NewReader(bytes.NewReader(data))
	defer r.Close()
	out, err := io.ReadAll(io.LimitReader(r, maxHTTPRPCBody+1))
	if err != nil {
		return nil, fmt.Errorf("decompress websocket message: %w", err)
	}
	if len(out) > maxHTTPRPCBody {
		return nil, fmt.Errorf("websocket message too large")
	}
	return out, nil
}
