package notifications

import "testing"

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
