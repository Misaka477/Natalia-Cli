package wire

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"
)

type RecordedMessage struct {
	At      time.Time   `json:"at"`
	Message WireMessage `json:"message"`
}

type Recorder struct {
	mu sync.Mutex
	w  io.Writer
}

func NewRecorder(w io.Writer) *Recorder {
	return &Recorder{w: w}
}

func (r *Recorder) Record(message WireMessage) error {
	if r == nil || r.w == nil {
		return nil
	}
	recorded := RecordedMessage{At: time.Now().UTC(), Message: message}
	data, err := json.Marshal(recorded)
	if err != nil {
		return fmt.Errorf("marshal wire record: %w", err)
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, err := r.w.Write(data); err != nil {
		return fmt.Errorf("write wire record: %w", err)
	}
	if _, err := r.w.Write([]byte("\n")); err != nil {
		return fmt.Errorf("write wire record newline: %w", err)
	}
	return nil
}

func (r *Recorder) Attach(wire *Wire) func() {
	if wire == nil {
		return func() {}
	}
	return wire.AddSink(func(message WireMessage) {
		_ = r.Record(message)
	})
}

func Replay(reader io.Reader) ([]WireMessage, error) {
	scanner := bufio.NewScanner(reader)
	messages := make([]WireMessage, 0)
	line := 0
	for scanner.Scan() {
		line++
		data := scanner.Bytes()
		if len(data) == 0 {
			continue
		}
		var recorded RecordedMessage
		if err := json.Unmarshal(data, &recorded); err != nil {
			return nil, fmt.Errorf("decode wire record line %d: %w", line, err)
		}
		messages = append(messages, recorded.Message)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read wire records: %w", err)
	}
	return messages, nil
}
