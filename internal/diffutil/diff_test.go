package diffutil

import (
	"strings"
	"testing"
)

func TestUnifiedUsesHunksWithContextAndPathHeaders(t *testing.T) {
	before := "one\ntwo\nthree\nfour\nfive\nsix\n"
	after := "one\ntwo\nTHREE\nfour\nfive\nSIX\n"
	diff := UnifiedWithOptions("file.txt", before, after, 1, 100)
	for _, want := range []string{"--- a/file.txt", "+++ b/file.txt", "@@ -2,2 +2,2 @@", " two", "-three", "+THREE", "-six", "+SIX"} {
		if !strings.Contains(diff, want) {
			t.Fatalf("expected diff to contain %q, got:\n%s", want, diff)
		}
	}
	if strings.Contains(diff, " one\n") {
		t.Fatalf("expected unrelated leading context omitted, got:\n%s", diff)
	}
}

func TestUnifiedTruncatesLongDiff(t *testing.T) {
	diff := UnifiedWithOptions("large.txt", strings.Repeat("a\n", 20), strings.Repeat("b\n", 20), 0, 8)
	if !strings.Contains(diff, "[diff truncated: showing 8") {
		t.Fatalf("expected truncation marker, got:\n%s", diff)
	}
}
