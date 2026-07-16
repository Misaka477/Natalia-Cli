package shell

import (
	"bytes"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
)

func TestEditorGraphemeWidthAndSoftWrap(t *testing.T) {
	e := NewEditor(4, 8)
	input := "你a\u0301🙂界"
	e.Insert(input)
	lines := e.Render()
	if got := e.Text(); got != input {
		t.Fatalf("Text()=%q want %q", got, input)
	}
	if len(lines) < 2 {
		t.Fatalf("expected soft-wrap across visual rows, got %q", lines)
	}
}

func TestEditorWordMoveAndDelete(t *testing.T) {
	e := NewEditor(80, 8)
	e.Insert("alpha beta 世界")
	e.WordLeft()
	if got := e.CursorPos(); got >= e.Len() {
		t.Fatalf("WordLeft did not move cursor, pos=%d len=%d", got, e.Len())
	}
	e.DeleteWordBackward()
	if got := e.Text(); got != "alpha 世界" {
		t.Fatalf("DeleteWordBackward text=%q", got)
	}
	e.DeleteWordForward()
	if got := e.Text(); got != "alpha " {
		t.Fatalf("DeleteWordForward text=%q", got)
	}
}

func TestEditorLargeInputRegression(t *testing.T) {
	e := NewEditor(80, 8)
	e.Insert(strings.Repeat("中", 10_000))
	for i := 0; i < 300; i++ {
		e.Left()
	}
	for i := 0; i < 300; i++ {
		e.Right()
	}
	for _, width := range []int{200, 160, 120, 80, 60, 40} {
		e.SetWidth(width)
		e.Up()
		e.Down()
	}
	if got, want := e.ByteLen(), len([]byte(strings.Repeat("中", 10_000))); got != want {
		t.Fatalf("ByteLen=%d want %d", got, want)
	}
}

func TestEditorMixedGraphemePressure(t *testing.T) {
	e := NewEditor(100, 8)
	unit := "a你🙂e\u0301，"
	e.Insert(strings.Repeat(unit, 4_000))
	if got := e.Len(); got < 20_000 {
		t.Fatalf("grapheme len=%d want at least 20000", got)
	}
	if rendered := e.Render(); len(rendered) == 0 || len(rendered) > 10 {
		t.Fatalf("expected bounded rendered lines, got %d", len(rendered))
	}
}

func TestRendererPasteLimitIsAtomic(t *testing.T) {
	r := NewRenderer(strings.NewReader(""), &strings.Builder{}, DarkTheme())
	r.editor.Insert("keep")
	tooLarge := strings.Repeat("x", MaxEditorBytes)
	if r.insertWithLimit(tooLarge, true) {
		t.Fatal("expected oversized paste to be rejected")
	}
	if got := r.editor.Text(); got != "keep" {
		t.Fatalf("buffer changed after rejected paste: %q", got)
	}
}

func TestOnePhysicalLineEscapesNewlines(t *testing.T) {
	got := onePhysicalLine("stream: hello\n你好\r\tend")
	if strings.ContainsAny(got, "\n\r\t") {
		t.Fatalf("line still contains terminal-breaking controls: %q", got)
	}
	if !strings.Contains(got, `\n`) || !strings.Contains(got, `\r`) {
		t.Fatalf("escaped controls not visible in preview: %q", got)
	}
}

func TestContentEndKeepsStreamBufferWhenFullContentEmpty(t *testing.T) {
	var out bytes.Buffer
	r := NewRenderer(strings.NewReader(""), &out, DarkTheme())
	r.renderWelcome()
	r.handlePresentationEvent(presentation.Event{Type: presentation.EvtContentPart, Data: presentation.ContentPartPayload{Content: "你好\n第二行"}})
	r.handlePresentationEvent(presentation.Event{Type: presentation.EvtContentEnd, Data: presentation.ContentEndPayload{}})
	got := out.String()
	if !strings.Contains(got, "你好") || !strings.Contains(got, "第二行") {
		t.Fatalf("final streamed content was not committed: %q", got)
	}
	if strings.Contains(got, "stream: 你好") {
		t.Fatalf("stream preview should not render raw model content: %q", got)
	}
}
