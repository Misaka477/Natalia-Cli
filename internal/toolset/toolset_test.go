package toolset

import "testing"

func TestDedupResetTurn(t *testing.T) {
	d := NewDedup()
	args := map[string]any{"path": "test.txt"}
	if got := d.Count("read_file", args); got != 1 {
		t.Fatalf("expected first count to be 1, got %d", got)
	}
	if got := d.Count("read_file", args); got != 2 {
		t.Fatalf("expected second count to be 2, got %d", got)
	}
	d.ResetTurn()
	if got := d.Count("read_file", args); got != 1 {
		t.Fatalf("expected reset count to be 1, got %d", got)
	}
}
