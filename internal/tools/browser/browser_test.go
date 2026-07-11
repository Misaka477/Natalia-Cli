package browser

import "testing"

func TestParseWait(t *testing.T) {
	got, err := parseWait("5")
	if err != nil || got != 5 {
		t.Fatalf("expected wait 5, got %d err=%v", got, err)
	}
	if _, err := parseWait("abc"); err == nil {
		t.Fatal("expected invalid wait error")
	}
	if _, err := parseWait("61"); err == nil {
		t.Fatal("expected max wait error")
	}
}
