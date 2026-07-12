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

func TestCleanupBoundaryCases(t *testing.T) {
	base := time.Date(2026, 7, 11, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name       string
		max        int
		wantRemain []string
	}{
		{name: "keep all when equal", max: 3, wantRemain: []string{"oldest", "newer", "newest"}},
		{name: "keep all when max larger", max: 20, wantRemain: []string{"oldest", "newer", "newest"}},
		{name: "delete all when max zero", max: 0, wantRemain: nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := &SessionStore{BaseDir: t.TempDir()}
			sessions := map[string]*Session{
				"oldest": writeTestSession(t, store, "oldest", base),
				"newer":  writeTestSession(t, store, "newer", base.Add(time.Minute)),
				"newest": writeTestSession(t, store, "newest", base.Add(2*time.Minute)),
			}

			store.Cleanup(tc.max)

			remaining := map[string]bool{}
			for _, id := range tc.wantRemain {
				remaining[id] = true
			}
			for id, sess := range sessions {
				_, err := os.Stat(sess.Dir)
				if remaining[id] && err != nil {
					t.Fatalf("expected %s to remain: %v", id, err)
				}
				if !remaining[id] && !os.IsNotExist(err) {
					t.Fatalf("expected %s to be deleted, stat err=%v", id, err)
				}
			}
		})
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
