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
	mu     sync.Mutex
	nextID int
	items  []Notification
}

var defaultStore = NewStore()

func DefaultStore() *Store { return defaultStore }

func ResetDefaultStoreForTest() { defaultStore = NewStore() }

func NewStore() *Store { return &Store{} }

func (s *Store) Add(source, title, message string) Notification {
	if s == nil {
		return Notification{}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextID++
	n := Notification{ID: "notif_" + itoa(s.nextID), Source: source, Title: title, Message: message, CreatedAt: time.Now()}
	s.items = append(s.items, n)
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
