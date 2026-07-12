package wire

import (
	"bufio"
	"bytes"
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
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestHTTPServerRPCInitialize(t *testing.T) {
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

func TestHTTPServerSSEStreamsEventsAndRequests(t *testing.T) {
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

	first := readSSEDataLine(t, resp.Body)
	second := readSSEDataLine(t, resp.Body)
	if !strings.Contains(first, `"method":"event"`) || !strings.Contains(first, string(EventTurnBegin)) {
		t.Fatalf("expected first SSE message to be TurnBegin event, got %s", first)
	}
	if !strings.Contains(second, `"method":"request"`) || !strings.Contains(second, string(RequestApproval)) {
		t.Fatalf("expected second SSE message to be ApprovalRequest, got %s", second)
	}
}

func TestHTTPServerRPCPromptPublishesSSEEvent(t *testing.T) {
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

func TestHTTPServerUnixSocketRPCRoundTrip(t *testing.T) {
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

func readSSEDataLine(t *testing.T, r io.Reader) string {
	t.Helper()
	scanner := bufio.NewScanner(r)
	deadline := time.After(2 * time.Second)
	lines := make(chan string, 1)
	go func() {
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data: ") {
				lines <- strings.TrimPrefix(line, "data: ")
				return
			}
		}
	}()
	select {
	case line := <-lines:
		return line
	case <-deadline:
		t.Fatal("timed out waiting for SSE data")
		return ""
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
	_, _ = fmt.Fprintf(conn, "GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n", path, host, key)
	reader := bufio.NewReader(conn)
	status, err := reader.ReadString('\n')
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(status, "101") {
		t.Fatalf("expected websocket 101 response, got %q", status)
	}
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatal(err)
		}
		if line == "\r\n" {
			break
		}
	}
	return &bufferedConn{Conn: conn, reader: reader}
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *bufferedConn) Read(p []byte) (int, error) { return c.reader.Read(p) }

func writeMaskedWebSocketText(t *testing.T, w io.Writer, data []byte) {
	t.Helper()
	var frame bytes.Buffer
	frame.WriteByte(0x81)
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
