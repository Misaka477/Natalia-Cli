package wire

import (
	"bufio"
	"bytes"
	"compress/flate"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestHTTPServerRPCInitialize(t *testing.T) {
	t.Parallel()
	w := NewWire()
	srv := httptest.NewServer(NewHTTPServer(w, ServerHandler{Initialize: func(context.Context, InitializeParams) (any, error) {
		return map[string]any{"status": "ok", "server": "test"}, nil
	}}))
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/rpc", "application/json", strings.NewReader(`{"jsonrpc":"2.0","method":"initialize","id":"init_1","params":{"client_name":"test"}}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", resp.StatusCode)
	}
	var msg RPCMessage
	if err := json.NewDecoder(resp.Body).Decode(&msg); err != nil {
		t.Fatal(err)
	}
	if string(msg.ID) != `"init_1"` || len(msg.Result) == 0 || msg.Error != nil {
		t.Fatalf("unexpected rpc response: %+v", msg)
	}
}

func TestHTTPServerAuthAndMethodPolicy(t *testing.T) {
	t.Parallel()
	w := NewWire()
	srv := httptest.NewServer(NewHTTPServerWithOptions(w, ServerHandler{Initialize: func(context.Context, InitializeParams) (any, error) {
		return map[string]any{"status": "ok"}, nil
	}}, HTTPServerOptions{AuthToken: "secret", AllowedMethods: []string{MethodInitialize}}))
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/rpc", "application/json", strings.NewReader(`{"jsonrpc":"2.0","method":"initialize","id":"init_1","params":{}}`))
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 without token, got %d", resp.StatusCode)
	}

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/rpc", strings.NewReader(`{"jsonrpc":"2.0","method":"cancel","id":"cancel_1"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer secret")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected HTTP 403 for disallowed method, got %d", resp.StatusCode)
	}
	var msg RPCMessage
	if err := json.NewDecoder(resp.Body).Decode(&msg); err != nil {
		t.Fatal(err)
	}
	if msg.Error == nil || msg.Error.Code != ErrorMethodNotFound {
		t.Fatalf("expected method policy RPC error, got %+v", msg)
	}
}

func TestHTTPServerHealthAndTLSServeHTTP(t *testing.T) {
	t.Parallel()
	srv := httptest.NewTLSServer(NewHTTPServerWithOptions(NewWire(), ServerHandler{}, HTTPServerOptions{AuthToken: "secret"}))
	defer srv.Close()

	resp, err := srv.Client().Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", resp.StatusCode)
	}
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" || body["transport"] != "wire-http" || body["auth_enabled"] != true {
		t.Fatalf("unexpected health body: %+v", body)
	}
}

func TestHTTPServerSSEStreamsEventsAndRequests(t *testing.T) {
	t.Parallel()
	w := NewWire()
	srv := httptest.NewServer(NewHTTPServer(w, ServerHandler{}))
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/events")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Fatalf("expected SSE content type, got %q", ct)
	}
	publishTransportEvent(t, w, EventTurnBegin, TurnBegin{UserInput: json.RawMessage(`"hi"`)})
	req, err := NewRequest("approval_1", RequestApproval, ApprovalRequest{ID: "approval_1", Action: "run_shell"})
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishRequest(req)

	messages := readSSEDataLines(t, resp.Body, 2)
	first := messages[0]
	second := messages[1]
	if !strings.Contains(first, `"method":"event"`) || !strings.Contains(first, string(EventTurnBegin)) {
		t.Fatalf("expected first SSE message to be TurnBegin event, got %s", first)
	}
	if !strings.Contains(second, `"method":"request"`) || !strings.Contains(second, string(RequestApproval)) {
		t.Fatalf("expected second SSE message to be ApprovalRequest, got %s", second)
	}
}

func TestHTTPServerSSEReconnectLastEventIDAndSessionFilter(t *testing.T) {
	t.Parallel()
	w := NewWire()
	h := NewHTTPServer(w, ServerHandler{})
	srv := httptest.NewServer(h)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/events?session_id=a")
	if err != nil {
		t.Fatal(err)
	}
	publishTransportEvent(t, w, EventNotification, map[string]any{"session_id": "a", "title": "first"})
	firstID, firstData := readSSEMessageForTest(t, resp.Body)
	_ = resp.Body.Close()
	if firstID == 0 || !strings.Contains(firstData, "first") {
		t.Fatalf("expected first session event with id, id=%d data=%s", firstID, firstData)
	}
	publishTransportEvent(t, w, EventNotification, map[string]any{"session_id": "b", "title": "other"})
	publishTransportEvent(t, w, EventNotification, map[string]any{"session_id": "a", "title": "second"})

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/events?session_id=a", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Last-Event-ID", fmt.Sprint(firstID))
	reconnect, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer reconnect.Body.Close()
	_, replayed := readSSEMessageForTest(t, reconnect.Body)
	if !strings.Contains(replayed, "second") || strings.Contains(replayed, "other") || strings.Contains(replayed, "first") {
		t.Fatalf("expected only session a events after Last-Event-ID, got %s", replayed)
	}
}

func TestHTTPServerRPCPromptPublishesSSEEvent(t *testing.T) {
	t.Parallel()
	w := NewWire()
	srv := httptest.NewServer(NewHTTPServer(w, ServerHandler{Prompt: func(ctx context.Context, params PromptParams) (any, error) {
		if params.UserInput != "hello" {
			t.Fatalf("unexpected prompt input: %q", params.UserInput)
		}
		publishTransportEvent(t, w, EventStepBegin, StepBegin{N: 1})
		return map[string]any{"status": "completed"}, nil
	}}))
	defer srv.Close()

	events, err := http.Get(srv.URL + "/events")
	if err != nil {
		t.Fatal(err)
	}
	defer events.Body.Close()
	rpcResp, err := http.Post(srv.URL+"/rpc", "application/json", strings.NewReader(`{"jsonrpc":"2.0","method":"prompt","id":"prompt_1","params":{"user_input":"hello"}}`))
	if err != nil {
		t.Fatal(err)
	}
	defer rpcResp.Body.Close()
	if rpcResp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", rpcResp.StatusCode)
	}
	var msg RPCMessage
	if err := json.NewDecoder(rpcResp.Body).Decode(&msg); err != nil {
		t.Fatal(err)
	}
	if string(msg.ID) != `"prompt_1"` || len(msg.Result) == 0 {
		t.Fatalf("unexpected prompt rpc response: %+v", msg)
	}
	data := readSSEDataLine(t, events.Body)
	if !strings.Contains(data, string(EventStepBegin)) {
		t.Fatalf("expected StepBegin SSE event, got %s", data)
	}
}

func TestHTTPServerWebSocketRoundTripAndEvents(t *testing.T) {
	t.Parallel()
	w := NewWire()
	srv := httptest.NewServer(NewHTTPServer(w, ServerHandler{Initialize: func(context.Context, InitializeParams) (any, error) {
		publishTransportEvent(t, w, EventStatusUpdate, StatusUpdate{Mode: "code"})
		return map[string]any{"status": "ok"}, nil
	}}))
	defer srv.Close()
	conn := dialWebSocketForTest(t, srv.URL+"/ws")
	defer conn.Close()

	writeMaskedWebSocketText(t, conn, []byte(`{"jsonrpc":"2.0","method":"initialize","id":"init_ws","params":{}}`))
	first := readWebSocketTextForTest(t, conn)
	second := readWebSocketTextForTest(t, conn)
	joined := string(first) + "\n" + string(second)
	if !strings.Contains(joined, string(EventStatusUpdate)) || !strings.Contains(joined, `"id":"init_ws"`) {
		t.Fatalf("expected websocket event and rpc response, got %s", joined)
	}
}

func TestHTTPServerWebSocketFragmentSubprotocolAndDeflate(t *testing.T) {
	t.Parallel()
	w := NewWire()
	srv := httptest.NewServer(NewHTTPServer(w, ServerHandler{Initialize: func(context.Context, InitializeParams) (any, error) {
		return map[string]any{"status": "ok"}, nil
	}}))
	defer srv.Close()
	conn, handshake := dialWebSocketWithHeadersForTest(t, srv.URL+"/ws", map[string]string{
		"Sec-WebSocket-Protocol":   wireWebSocketSubprotocol,
		"Sec-WebSocket-Extensions": "permessage-deflate",
	})
	defer conn.Close()
	if !strings.Contains(handshake, "Sec-WebSocket-Protocol: "+wireWebSocketSubprotocol) || !strings.Contains(handshake, "permessage-deflate") {
		t.Fatalf("expected subprotocol and deflate negotiation, got %s", handshake)
	}

	writeMaskedWebSocketFragmentedText(t, conn, []byte(`{"jsonrpc":"2.0","method":"initialize","id":"frag_1","params":{}}`), 24)
	resp := readWebSocketTextForTest(t, conn)
	if !strings.Contains(string(resp), `"id":"frag_1"`) {
		t.Fatalf("expected fragmented initialize response, got %s", resp)
	}

	writeMaskedWebSocketCompressedText(t, conn, []byte(`{"jsonrpc":"2.0","method":"initialize","id":"zip_1","params":{}}`))
	resp = readWebSocketTextForTest(t, conn)
	if !strings.Contains(string(resp), `"id":"zip_1"`) {
		t.Fatalf("expected compressed initialize response, got %s", resp)
	}
}

func TestHTTPServerUnixSocketRPCRoundTrip(t *testing.T) {
	t.Parallel()
	sock := filepath.Join(t.TempDir(), "natalia-wire.sock")
	srv := NewHTTPServer(NewWire(), ServerHandler{Initialize: func(context.Context, InitializeParams) (any, error) {
		return map[string]any{"status": "ok"}, nil
	}})
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServeUnix(sock) }()
	waitForUnixSocket(t, sock)
	t.Cleanup(func() {
		_ = srv.Shutdown(context.Background())
		select {
		case err := <-errCh:
			if err != nil && err != http.ErrServerClosed {
				t.Fatalf("unix server failed: %v", err)
			}
		case <-time.After(time.Second):
			t.Fatal("unix server did not shut down")
		}
	})

	client := &http.Client{Transport: &http.Transport{DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", sock)
	}}}
	resp, err := client.Post("http://unix/rpc", "application/json", strings.NewReader(`{"jsonrpc":"2.0","method":"initialize","id":"unix_1","params":{}}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", resp.StatusCode)
	}
	var msg RPCMessage
	if err := json.NewDecoder(resp.Body).Decode(&msg); err != nil {
		t.Fatal(err)
	}
	if string(msg.ID) != `"unix_1"` || msg.Error != nil {
		t.Fatalf("unexpected unix rpc response: %+v", msg)
	}
}

func TestHTTPServerUnixSocketStaleCleanup(t *testing.T) {
	t.Parallel()
	sock := filepath.Join(t.TempDir(), "natalia-wire.sock")
	fd, err := syscall.Socket(syscall.AF_UNIX, syscall.SOCK_STREAM, 0)
	if err != nil {
		t.Fatal(err)
	}
	if err := syscall.Bind(fd, &syscall.SockaddrUnix{Name: sock}); err != nil {
		_ = syscall.Close(fd)
		t.Fatal(err)
	}
	_ = syscall.Close(fd)
	if _, err := os.Lstat(sock); err != nil {
		t.Fatalf("expected stale socket path: %v", err)
	}

	srv := NewHTTPServer(NewWire(), ServerHandler{Initialize: func(context.Context, InitializeParams) (any, error) {
		return map[string]any{"status": "ok"}, nil
	}})
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServeUnix(sock) }()
	waitForUnixSocket(t, sock)
	_ = srv.Shutdown(context.Background())
	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			t.Fatalf("unix server failed: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("unix server did not shut down")
	}
	if _, err := os.Lstat(sock); !os.IsNotExist(err) {
		t.Fatalf("expected socket path removed after shutdown, got %v", err)
	}
}

func readSSEDataLine(t *testing.T, r io.Reader) string {
	t.Helper()
	messages := readSSEDataLines(t, r, 1)
	return messages[0]
}

func readSSEDataLines(t *testing.T, r io.Reader, count int) []string {
	t.Helper()
	scanner := bufio.NewScanner(r)
	deadline := time.After(2 * time.Second)
	lines := make(chan []string, 1)
	go func() {
		out := make([]string, 0, count)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data: ") {
				out = append(out, strings.TrimPrefix(line, "data: "))
				if len(out) == count {
					lines <- out
					return
				}
			}
		}
	}()
	select {
	case out := <-lines:
		return out
	case <-deadline:
		t.Fatal("timed out waiting for SSE data")
		return nil
	}
}

func readSSEMessageForTest(t *testing.T, r io.Reader) (int64, string) {
	t.Helper()
	scanner := bufio.NewScanner(r)
	deadline := time.After(2 * time.Second)
	type result struct {
		id   int64
		data string
	}
	results := make(chan result, 1)
	go func() {
		var current result
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "id: ") {
				_, _ = fmt.Sscanf(strings.TrimPrefix(line, "id: "), "%d", &current.id)
				continue
			}
			if strings.HasPrefix(line, "data: ") {
				current.data = strings.TrimPrefix(line, "data: ")
				results <- current
				return
			}
		}
	}()
	select {
	case result := <-results:
		return result.id, result.data
	case <-deadline:
		t.Fatal("timed out waiting for SSE message")
		return 0, ""
	}
}

func publishTransportEvent(t *testing.T, w *Wire, typ EventType, payload any) {
	t.Helper()
	event, err := NewEvent(typ, payload)
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishEvent(event)
}

func dialWebSocketForTest(t *testing.T, rawURL string) net.Conn {
	t.Helper()
	conn, _ := dialWebSocketWithHeadersForTest(t, rawURL, nil)
	return conn
}

func dialWebSocketWithHeadersForTest(t *testing.T, rawURL string, headers map[string]string) (net.Conn, string) {
	t.Helper()
	addr := strings.TrimPrefix(rawURL, "http://")
	host, path, ok := strings.Cut(addr, "/")
	if !ok {
		path = "ws"
	}
	keyBytes := make([]byte, 16)
	if _, err := rand.Read(keyBytes); err != nil {
		t.Fatal(err)
	}
	key := base64.StdEncoding.EncodeToString(keyBytes)
	conn, err := net.Dial("tcp", host)
	if err != nil {
		t.Fatal(err)
	}
	var req bytes.Buffer
	fmt.Fprintf(&req, "GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n", path, host, key)
	for name, value := range headers {
		fmt.Fprintf(&req, "%s: %s\r\n", name, value)
	}
	req.WriteString("\r\n")
	_, _ = conn.Write(req.Bytes())
	reader := bufio.NewReader(conn)
	status, err := reader.ReadString('\n')
	if err != nil {
		t.Fatal(err)
	}
	var handshake strings.Builder
	handshake.WriteString(status)
	if !strings.Contains(status, "101") {
		t.Fatalf("expected websocket 101 response, got %q", status)
	}
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatal(err)
		}
		handshake.WriteString(line)
		if line == "\r\n" {
			break
		}
	}
	return &bufferedConn{Conn: conn, reader: reader}, handshake.String()
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *bufferedConn) Read(p []byte) (int, error) { return c.reader.Read(p) }

func writeMaskedWebSocketText(t *testing.T, w io.Writer, data []byte) {
	t.Helper()
	writeMaskedWebSocketFrame(t, w, 0x81, data)
}

func writeMaskedWebSocketFragmentedText(t *testing.T, w io.Writer, data []byte, split int) {
	t.Helper()
	if split <= 0 || split >= len(data) {
		t.Fatalf("invalid websocket split %d for %d bytes", split, len(data))
	}
	writeMaskedWebSocketFrame(t, w, 0x01, data[:split])
	writeMaskedWebSocketFrame(t, w, 0x80, data[split:])
}

func writeMaskedWebSocketCompressedText(t *testing.T, w io.Writer, data []byte) {
	t.Helper()
	compressed := compressWebSocketPayloadForTest(t, data)
	writeMaskedWebSocketFrame(t, w, 0xC1, compressed)
}

func writeMaskedWebSocketFrame(t *testing.T, w io.Writer, firstByte byte, data []byte) {
	t.Helper()
	var frame bytes.Buffer
	frame.WriteByte(firstByte)
	if len(data) >= 126 {
		t.Fatalf("test frame too large: %d", len(data))
	}
	frame.WriteByte(0x80 | byte(len(data)))
	mask := []byte{1, 2, 3, 4}
	frame.Write(mask)
	masked := append([]byte(nil), data...)
	for i := range masked {
		masked[i] ^= mask[i%4]
	}
	frame.Write(masked)
	if _, err := w.Write(frame.Bytes()); err != nil {
		t.Fatal(err)
	}
}

func compressWebSocketPayloadForTest(t *testing.T, data []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw, err := flate.NewWriter(&buf, flate.DefaultCompression)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := zw.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func readWebSocketTextForTest(t *testing.T, r io.Reader) []byte {
	t.Helper()
	header := make([]byte, 2)
	if _, err := io.ReadFull(r, header); err != nil {
		t.Fatal(err)
	}
	if header[0]&0x0F != 0x1 {
		t.Fatalf("expected text frame opcode, got %x", header[0]&0x0F)
	}
	length := int(header[1] & 0x7F)
	if length == 126 {
		buf := make([]byte, 2)
		if _, err := io.ReadFull(r, buf); err != nil {
			t.Fatal(err)
		}
		length = int(binary.BigEndian.Uint16(buf))
	} else if length == 127 {
		t.Fatal("unexpected 64-bit websocket test frame")
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(r, payload); err != nil {
		t.Fatal(err)
	}
	return payload
}

func waitForUnixSocket(t *testing.T, path string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		conn, err := net.Dial("unix", path)
		if err == nil {
			_ = conn.Close()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("unix socket %s did not become ready", path)
}
