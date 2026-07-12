package notifications

import (
	"sync"
	"time"
)

type Notification struct {
	ID        string
	Source    string
	Title     string
	Message   string
	CreatedAt time.Time
}

type Store struct {
	mu        sync.Mutex
	nextID    int
	items     []Notification
	retained  []Notification
	policy    Policy
	lastByKey map[string]time.Time
}

type Policy struct {
	MaxRetained       int
	RetentionDuration time.Duration
	DedupWindow       time.Duration
}

var defaultStore = NewStore()

func DefaultStore() *Store { return defaultStore }

func ResetDefaultStoreForTest() { defaultStore = NewStore() }

func NewStore() *Store { return &Store{policy: DefaultPolicy(), lastByKey: map[string]time.Time{}} }

func DefaultPolicy() Policy {
	return Policy{MaxRetained: 100, RetentionDuration: 24 * time.Hour, DedupWindow: time.Second}
}

func (s *Store) SetPolicy(policy Policy) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.policy = normalizePolicy(policy)
	s.pruneLocked(time.Now())
}

func (s *Store) Add(source, title, message string) Notification {
	if s == nil {
		return Notification{}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.lastByKey == nil {
		s.lastByKey = map[string]time.Time{}
	}
	now := time.Now()
	policy := normalizePolicy(s.policy)
	key := source + "\x00" + title + "\x00" + message
	if last, ok := s.lastByKey[key]; ok && policy.DedupWindow > 0 && now.Sub(last) < policy.DedupWindow {
		return Notification{}
	}
	s.lastByKey[key] = now
	s.nextID++
	n := Notification{ID: "notif_" + itoa(s.nextID), Source: source, Title: title, Message: message, CreatedAt: now}
	s.items = append(s.items, n)
	s.retained = append(s.retained, n)
	s.policy = policy
	s.pruneLocked(now)
	return n
}

func (s *Store) Drain() []Notification {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	out := append([]Notification(nil), s.items...)
	s.items = nil
	return out
}

func (s *Store) Retained() []Notification {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked(time.Now())
	return append([]Notification(nil), s.retained...)
}

func (s *Store) Prune(now time.Time) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked(now)
}

func (s *Store) pruneLocked(now time.Time) {
	policy := normalizePolicy(s.policy)
	if policy.RetentionDuration > 0 {
		cutoff := now.Add(-policy.RetentionDuration)
		kept := s.retained[:0]
		for _, item := range s.retained {
			if item.CreatedAt.After(cutoff) || item.CreatedAt.Equal(cutoff) {
				kept = append(kept, item)
			}
		}
		s.retained = kept
	}
	if policy.MaxRetained > 0 && len(s.retained) > policy.MaxRetained {
		s.retained = append([]Notification(nil), s.retained[len(s.retained)-policy.MaxRetained:]...)
	}
	if len(s.lastByKey) > 0 && policy.DedupWindow > 0 {
		cutoff := now.Add(-policy.DedupWindow)
		for key, last := range s.lastByKey {
			if last.Before(cutoff) {
				delete(s.lastByKey, key)
			}
		}
	}
}

func normalizePolicy(policy Policy) Policy {
	if policy.MaxRetained == 0 && policy.RetentionDuration == 0 && policy.DedupWindow == 0 {
		return DefaultPolicy()
	}
	return policy
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
