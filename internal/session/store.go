package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
)

type Session struct {
	ID            string    `json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Title         string    `json:"title,omitempty"`
	Model         string    `json:"model"`
	ContextTokens int       `json:"context_tokens,omitempty"`
	Dir           string    `json:"-"`
}

const StateVersion = 1

type State struct {
	Version           int      `json:"version"`
	Mode              string   `json:"mode,omitempty"`
	ModelProfile      string   `json:"model_profile,omitempty"`
	PermissionProfile string   `json:"permission_profile,omitempty"`
	PlanMode          bool     `json:"plan_mode,omitempty"`
	PlanSessionID     string   `json:"plan_session_id,omitempty"`
	PlanSlug          string   `json:"plan_slug,omitempty"`
	PlanPath          string   `json:"plan_path,omitempty"`
	PlanDoneLines     []int    `json:"plan_done_lines,omitempty"`
	AdditionalDirs    []string `json:"additional_dirs,omitempty"`
}

type SessionStore struct {
	BaseDir string
}

func NewStore() (*SessionStore, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(home, ".config", "natalia-cli", "sessions")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	return &SessionStore{BaseDir: dir}, nil
}

func (s *SessionStore) NewSession(model string) *Session {
	id := fmt.Sprintf("%d", time.Now().UnixNano())
	dir := filepath.Join(s.BaseDir, id)
	os.MkdirAll(dir, 0755)

	sess := &Session{
		ID:        id,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Model:     model,
		Dir:       dir,
	}
	s.writeMeta(sess)
	return sess
}

func (s *SessionStore) List() []Session {
	entries, err := os.ReadDir(s.BaseDir)
	if err != nil {
		return nil
	}
	var sessions []Session
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		meta, err := s.readMeta(e.Name())
		if err != nil {
			continue
		}
		sessions = append(sessions, *meta)
	}
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt.After(sessions[j].UpdatedAt)
	})
	return sessions
}

func (s *SessionStore) AppendMessage(sessionID string, msg chat.Message) error {
	dir := filepath.Join(s.BaseDir, sessionID)
	f, err := os.OpenFile(filepath.Join(dir, "context.jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	if _, err := f.Write(append(data, '\n')); err != nil {
		return err
	}
	meta, err := s.readMeta(sessionID)
	if err == nil {
		meta.UpdatedAt = time.Now()
		meta.ContextTokens += estimateMessageTokens(msg)
		s.writeMeta(meta)
	}
	return nil
}

func (s *SessionStore) LoadMessages(sessionID string) ([]chat.Message, error) {
	dir := filepath.Join(s.BaseDir, sessionID)
	data, err := os.ReadFile(filepath.Join(dir, "context.jsonl"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	messages := make([]chat.Message, 0, len(lines))
	for _, line := range lines {
		if line == "" {
			continue
		}
		var msg chat.Message
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			continue
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

func (s *SessionStore) Load(id string) (*Session, error) {
	return s.readMeta(id)
}

func (s *SessionStore) SaveState(sessionID string, state State) error {
	dir := filepath.Join(s.BaseDir, sessionID)
	if state.Version == 0 {
		state.Version = StateVersion
	}
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "state.json"), data, 0644); err != nil {
		return err
	}
	meta, err := s.readMeta(sessionID)
	if err == nil {
		meta.UpdatedAt = time.Now()
		return s.writeMeta(meta)
	}
	return nil
}

func (s *SessionStore) LoadState(sessionID string) (State, error) {
	dir := filepath.Join(s.BaseDir, sessionID)
	data, err := os.ReadFile(filepath.Join(dir, "state.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return State{}, nil
		}
		return State{}, err
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return State{}, err
	}
	if state.Version == 0 {
		state.Version = StateVersion
	}
	return state, nil
}

func estimateMessageTokens(msg chat.Message) int {
	if msg.Content == "" {
		return 0
	}
	tokens := len(msg.Content) / 4
	if tokens == 0 {
		return 1
	}
	return tokens
}

func (s *SessionStore) Cleanup(maxSessions int) {
	sessions := s.List()
	if len(sessions) <= maxSessions {
		return
	}
	for _, sess := range sessions[maxSessions:] {
		os.RemoveAll(sess.Dir)
	}
}

func (s *SessionStore) readMeta(id string) (*Session, error) {
	dir := filepath.Join(s.BaseDir, id)
	data, err := os.ReadFile(filepath.Join(dir, "meta.json"))
	if err != nil {
		return nil, err
	}
	var sess Session
	if err := json.Unmarshal(data, &sess); err != nil {
		return nil, err
	}
	sess.Dir = dir
	return &sess, nil
}

func (s *SessionStore) writeMeta(sess *Session) error {
	data, err := json.Marshal(sess)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(sess.Dir, "meta.json"), data, 0644)
}
