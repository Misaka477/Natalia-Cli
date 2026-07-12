package notifications

import (
	"testing"
	"time"
)

func TestStoreAddAndDrain(t *testing.T) {
	store := NewStore()
	first := store.Add("background", "done", "proc_1 exited")
	second := store.Add("subagent", "worker", "w1 completed")
	if first.ID != "notif_1" || second.ID != "notif_2" || first.CreatedAt.IsZero() || second.CreatedAt.IsZero() {
		t.Fatalf("unexpected notifications: first=%+v second=%+v", first, second)
	}
	items := store.Drain()
	if len(items) != 2 || items[0].Message != "proc_1 exited" || items[1].Source != "subagent" {
		t.Fatalf("unexpected drained notifications: %+v", items)
	}
	if again := store.Drain(); len(again) != 0 {
		t.Fatalf("expected drain to clear store, got %+v", again)
	}
}

func TestStorePolicyDeduplicatesAndRetains(t *testing.T) {
	store := NewStore()
	store.SetPolicy(Policy{MaxRetained: 2, RetentionDuration: time.Hour, DedupWindow: time.Hour})
	first := store.Add("background", "done", "same")
	dup := store.Add("background", "done", "same")
	second := store.Add("background", "done", "second")
	third := store.Add("background", "done", "third")
	if first.ID == "" || dup.ID != "" || second.ID == "" || third.ID == "" {
		t.Fatalf("unexpected policy add results: first=%+v dup=%+v second=%+v third=%+v", first, dup, second, third)
	}
	retained := store.Retained()
	if len(retained) != 2 || retained[0].Message != "second" || retained[1].Message != "third" {
		t.Fatalf("expected retained max window, got %+v", retained)
	}
}

func TestStorePruneDropsExpiredRetainedNotifications(t *testing.T) {
	store := NewStore()
	store.SetPolicy(Policy{MaxRetained: 10, RetentionDuration: time.Nanosecond, DedupWindow: 0})
	store.Add("background", "done", "old")
	store.Prune(time.Now().Add(time.Second))
	if retained := store.Retained(); len(retained) != 0 {
		t.Fatalf("expected expired retained notifications pruned, got %+v", retained)
	}
}
