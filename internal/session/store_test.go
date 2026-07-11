package session

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCleanupKeepsNewestSessions(t *testing.T) {
	store := &SessionStore{BaseDir: t.TempDir()}
	base := time.Date(2026, 7, 11, 12, 0, 0, 0, time.UTC)

	oldest := writeTestSession(t, store, "oldest", base)
	newer := writeTestSession(t, store, "newer", base.Add(time.Minute))
	newest := writeTestSession(t, store, "newest", base.Add(2*time.Minute))

	store.Cleanup(2)

	if _, err := os.Stat(oldest.Dir); !os.IsNotExist(err) {
		t.Fatalf("expected oldest session to be removed, stat err=%v", err)
	}
	for _, sess := range []*Session{newer, newest} {
		if _, err := os.Stat(sess.Dir); err != nil {
			t.Fatalf("expected session %s to remain: %v", sess.ID, err)
		}
	}
}

func writeTestSession(t *testing.T, store *SessionStore, id string, updatedAt time.Time) *Session {
	t.Helper()
	sess := &Session{
		ID:        id,
		CreatedAt: updatedAt,
		UpdatedAt: updatedAt,
		Model:     "test-model",
		Dir:       filepath.Join(store.BaseDir, id),
	}
	if err := os.MkdirAll(sess.Dir, 0755); err != nil {
		t.Fatalf("mkdir session: %v", err)
	}
	if err := store.writeMeta(sess); err != nil {
		t.Fatalf("write session meta: %v", err)
	}
	return sess
}
