package shell

import (
	"bufio"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
	"golang.org/x/term"
)

type Renderer struct {
	in           io.Reader
	out          io.Writer
	editor       *Editor
	history      *History
	theme        Theme
	width        int
	height       int
	dirty        bool
	resized      bool
	committed    int
	welcomeLines []string
	metrics      []Sample
	cancelled    bool
	processing   bool
	eventCh      chan presentation.Event
	streamBuf    string
	toolName     string
	statusText   string
}

type Sample struct {
	Name     string
	Duration time.Duration
}

func NewRenderer(in io.Reader, out io.Writer, theme Theme) *Renderer {
	width, height := terminalSize(in, out)
	return &Renderer{
		in:      in,
		out:     out,
		history: NewHistory(50),
		theme:   theme,
		width:   width,
		height:  height,
		editor:  NewEditor(width-4, 8),
		eventCh: make(chan presentation.Event, 64),
	}
}

func (r *Renderer) Run() error {
	if stdin, ok := r.in.(*os.File); ok && term.IsTerminal(int(stdin.Fd())) {
		oldState, err := term.MakeRaw(int(stdin.Fd()))
		if err == nil {
			defer term.Restore(int(stdin.Fd()), oldState)
		}
	}
	r.renderWelcome()
	return r.loop()
}

func (r *Renderer) renderWelcome() {
	width := r.width
	lines := []string{
		"Natalia shell renderer",
		fmt.Sprintf("detected-width: %d", width),
		"history: committed line 1",
		"history: committed line 2",
	}
	r.welcomeLines = lines
	for _, line := range lines {
		clearLine(r.out)
		fmt.Fprintln(r.out, trimCells(line, width))
	}
	r.committed = 0
	r.dirty = true
	fmt.Fprint(r.out, "\x1b[s")
	r.renderLive("ready", "")
}

func (r *Renderer) loop() error {
	reader := bufio.NewReader(r.in)
	for {
		b, err := reader.ReadByte()
		if err != nil {
			return err
		}
		r.checkResize()
		changed := false
		switch b {
		case 0x03:
			r.cancelled = true
			r.dirty = true
			r.renderLive("cancelled", "")
		case 0x04:
			return r.finish()
		case 0x01:
			r.sample("buffer_start", r.editor.BufferStart)
			changed = true
		case 0x05:
			r.sample("buffer_end", r.editor.BufferEnd)
			changed = true
		case 0x15:
			r.sample("clear", r.editor.Clear)
			changed = true
		case 0x7f, 0x08:
			r.sample("backspace", r.editor.Backspace)
			changed = true
		case 0x1b:
			if err := r.handleEscape(reader); err != nil {
				return err
			}
			changed = true
		case '\r', '\n':
			r.editor.Insert("\n")
			changed = true
		default:
			if b >= 0x20 {
				if err := reader.UnreadByte(); err != nil {
					return err
				}
				rn, _, err := reader.ReadRune()
				if err != nil {
					return err
				}
				r.editor.Insert(string(rn))
				changed = true
			}
		}
		if changed {
			r.dirty = true
			r.renderLive("editing", "")
		}
	}
}

func (r *Renderer) checkResize() {
	if f, ok := r.out.(*os.File); ok && term.IsTerminal(int(f.Fd())) {
		w, _, err := term.GetSize(int(f.Fd()))
		if err == nil && w > 0 && w != r.width {
			r.width = w
			r.editor.SetWidth(w - 4)
			r.resized = true
		}
	}
}

func (r *Renderer) handleEscape(reader *bufio.Reader) error {
	next, err := reader.ReadByte()
	if err != nil {
		return err
	}
	if next != '[' {
		return nil
	}
	seq, err := readCSI(reader)
	if err != nil {
		return err
	}
	switch seq {
	case "D":
		r.sample("left", r.editor.Left)
	case "C":
		r.sample("right", r.editor.Right)
	case "A":
		if r.editor.CursorPos() == 0 {
			r.sample("history_up", r.Up)
		} else {
			r.sample("up", r.editor.Up)
		}
	case "B":
		if r.editor.CursorPos() >= r.editor.Len() {
			r.sample("history_down", r.Down)
		} else {
			r.sample("down", r.editor.Down)
		}
	case "H", "1~":
		r.sample("home", r.editor.Home)
	case "F", "4~":
		r.sample("end", r.editor.End)
	case "3~":
		r.sample("delete", r.editor.Delete)
	case "200~":
		start := time.Now()
		paste, err := readBracketedPaste(reader)
		if err != nil {
			return err
		}
		r.editor.Insert(paste)
		r.metrics = append(r.metrics, Sample{Name: "paste", Duration: time.Since(start)})
	case "8~":
		r.sample("end", r.editor.End)
	}
	return nil
}

func (r *Renderer) renderLive(status, live string) {
	if !r.dirty {
		return
	}
	r.dirty = false
	start := time.Now()
	spinnerLine := "spinner: - " + status
	streamLine := "stream: " + livePreview(live)
	statusLine := "status: bytes=" + fmt.Sprint(len([]byte(r.editor.Text())))
	editorLines := r.editor.Render()

	allLines := make([]string, 0, 3+len(editorLines))
	allLines = append(allLines, spinnerLine, streamLine, statusLine)
	for _, line := range editorLines {
		allLines = append(allLines, "> "+line)
	}

	fmt.Fprint(r.out, "\x1b[u")
	if r.resized {
		r.resized = false
		fmt.Fprint(r.out, "\x1b[2J\x1b[H")
		for _, line := range r.welcomeLines {
			clearLine(r.out)
			fmt.Fprintln(r.out, trimCells(line, r.width))
		}
		fmt.Fprint(r.out, "\x1b[s")
	} else if r.committed > 0 {
		moveUp(r.out, r.committed)
	}
	fmt.Fprint(r.out, "\x1b[J")
	for _, line := range allLines {
		clearLine(r.out)
		fmt.Fprintln(r.out, trimCells(line, r.width))
	}
	fmt.Fprint(r.out, "\x1b[s")
	for i := len(allLines); i < r.committed; i++ {
		clearLine(r.out)
		fmt.Fprintln(r.out, "")
	}
	if len(allLines) > 0 {
		cursorRow, cursorCol := r.editor.CursorRenderedPosition()
		total := r.committed
		if len(allLines) > total {
			total = len(allLines)
		}
		targetRow := 3 + cursorRow
		if up := total - targetRow; up > 0 {
			moveUp(r.out, up)
		}
		if targetCol := cursorCol + 3; targetCol > 0 {
			fmt.Fprintf(r.out, "\x1b[%dG", targetCol)
		}
	}
	r.committed = len(allLines)
	r.metrics = append(r.metrics, Sample{Name: "render", Duration: time.Since(start)})
}

func (r *Renderer) sample(name string, fn func()) {
	start := time.Now()
	fn()
	r.metrics = append(r.metrics, Sample{Name: name, Duration: time.Since(start)})
}

func (r *Renderer) Up() {
	r.history.SaveDraft(r.editor.Text())
	text := r.history.Up()
	r.editor.SetText(text)
	r.dirty = true
}

func (r *Renderer) Down() {
	text := r.history.Down()
	r.editor.SetText(text)
	r.dirty = true
}

func (r *Renderer) finish() error {
	if r.committed > 0 {
		fmt.Fprint(r.out, "\x1b[u")
		moveUp(r.out, r.committed)
		for i := 0; i < r.committed; i++ {
			clearLine(r.out)
			fmt.Fprintln(r.out, "")
		}
	}
	text := r.editor.Text()
	fmt.Fprintf(r.out, "\rRESULT bytes=%d lines=%d sha256=%s\n", len([]byte(text)), strings.Count(text, "\n")+1, sha256hex(text))
	for _, metric := range summarizeSamples(r.metrics) {
		fmt.Fprintf(r.out, "\rMETRIC name=%s p95_ms=%.3f max_ms=%.3f count=%d\n", metric.Name, metric.P95, metric.Max, metric.Count)
	}
	fmt.Fprint(r.out, "\r\n")
	return nil
}

func terminalSize(in io.Reader, out io.Writer) (int, int) {
	if f, ok := out.(*os.File); ok && term.IsTerminal(int(f.Fd())) {
		if w, h, err := term.GetSize(int(f.Fd())); err == nil && w > 0 && h > 0 {
			return w, h
		}
	}
	if f, ok := in.(*os.File); ok && term.IsTerminal(int(f.Fd())) {
		if w, h, err := term.GetSize(int(f.Fd())); err == nil && w > 0 && h > 0 {
			return w, h
		}
	}
	return 80, 24
}

func readCSI(r *bufio.Reader) (string, error) {
	var b strings.Builder
	for {
		c, err := r.ReadByte()
		if err != nil {
			return "", err
		}
		b.WriteByte(c)
		if c >= '@' && c <= '~' {
			return b.String(), nil
		}
	}
}

func readBracketedPaste(r *bufio.Reader) (string, error) {
	const end = "\x1b[201~"
	var b strings.Builder
	for {
		c, err := r.ReadByte()
		if err != nil {
			return "", err
		}
		b.WriteByte(c)
		if strings.HasSuffix(b.String(), end) {
			return strings.TrimSuffix(b.String(), end), nil
		}
	}
}

func livePreview(s string) string {
	if s == "" {
		return "streaming text tail"
	}
	return s
}

func clearLine(out io.Writer) {
	fmt.Fprint(out, "\r\x1b[2K")
}

func moveUp(out io.Writer, n int) {
	if n > 0 {
		fmt.Fprintf(out, "\x1b[%dA", n)
	}
}

type metricSummary struct {
	Name  string
	P95   float64
	Max   float64
	Count int
}

func summarizeSamples(samples []Sample) []metricSummary {
	groups := map[string][]float64{}
	for _, sample := range samples {
		groups[sample.Name] = append(groups[sample.Name], float64(sample.Duration.Microseconds())/1000)
	}
	out := make([]metricSummary, 0, len(groups))
	for name, values := range groups {
		insertionSort(values)
		idx := int(float64(len(values)-1) * 0.95)
		out = append(out, metricSummary{
			Name:  name,
			P95:   values[idx],
			Max:   values[len(values)-1],
			Count: len(values),
		})
	}
	return out
}

func insertionSort(values []float64) {
	for i := 1; i < len(values); i++ {
		v := values[i]
		j := i - 1
		for ; j >= 0 && values[j] > v; j-- {
			values[j+1] = values[j]
		}
		values[j+1] = v
	}
}

func sha256hex(text string) string {
	sum := sha256.Sum256([]byte(text))
	return fmt.Sprintf("%x", sum)
}
