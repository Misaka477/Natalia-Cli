package terminalspike

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/rivo/uniseg"
	"golang.org/x/term"
)

type CustomShell struct {
	in          io.Reader
	out         io.Writer
	editor      *Editor
	width       int
	bottomLines int
	committed   int
	metrics     []Sample
}

func RunCustomShell(in io.Reader, out io.Writer) error {
	rawMode := "skip"
	if stdin, ok := in.(*os.File); ok && term.IsTerminal(int(stdin.Fd())) {
		oldState, err := term.MakeRaw(int(stdin.Fd()))
		if err == nil {
			rawMode = "ok"
			defer term.Restore(int(stdin.Fd()), oldState)
		} else {
			rawMode = "error"
		}
	}
	width := terminalWidth()
	if os.Getenv("NATALIA_TERMINAL_SPIKE_CHILD") == "" {
		width = 40
	}
	s := &CustomShell{in: in, out: out, width: width, editor: NewEditor(width-4, 8)}
	fmt.Fprintln(out, trimCells("Natalia terminal spike custom renderer", width))
	fmt.Fprintln(out, trimCells("detected-width: "+fmt.Sprint(width), width))
	fmt.Fprintln(out, trimCells("raw-mode: "+rawMode, width))
	fmt.Fprintln(out, trimCells("history: committed line 1", width))
	fmt.Fprintln(out, trimCells("history: committed line 2", width))
	s.committed = 3
	fmt.Fprint(out, "\x1b[s")
	s.renderBottom("ready", "")
	return s.loop()
}

func (s *CustomShell) loop() error {
	r := bufio.NewReader(s.in)
	for {
		b, err := r.ReadByte()
		if err != nil {
			return err
		}
		switch b {
		case 0x04: // Ctrl+D submits and exits the spike.
			return s.finish()
		case 0x01:
			s.sample("buffer_start", s.editor.BufferStart)
			s.renderBottom("editing", "")
		case 0x05:
			s.sample("buffer_end", s.editor.BufferEnd)
			s.renderBottom("editing", "")
		case 0x15:
			s.sample("clear", s.editor.Clear)
			s.renderBottom("editing", "")
		case 0x7f, 0x08:
			s.sample("backspace", s.editor.Backspace)
			s.renderBottom("editing", "")
		case 0x1b:
			if err := s.handleEscape(r); err != nil {
				return err
			}
		case '\r', '\n':
			s.editor.Insert("\n")
			s.renderBottom("editing", "")
		default:
			if b >= 0x20 {
				if err := r.UnreadByte(); err != nil {
					return err
				}
				rn, _, err := r.ReadRune()
				if err != nil {
					return err
				}
				s.editor.Insert(string(rn))
				s.renderBottom("editing", "")
			}
		}
	}
}

func (s *CustomShell) handleEscape(r *bufio.Reader) error {
	next, err := r.ReadByte()
	if err != nil {
		return err
	}
	if next == '[' {
		seq, err := readCSI(r)
		if err != nil {
			return err
		}
		switch seq {
		case "D":
			s.sample("left", s.editor.Left)
		case "C":
			s.sample("right", s.editor.Right)
		case "A":
			s.sample("up", s.editor.Up)
		case "B":
			s.sample("down", s.editor.Down)
		case "H", "1~":
			s.sample("home", s.editor.Home)
		case "F", "4~":
			s.sample("end", s.editor.End)
		case "3~":
			s.sample("delete", s.editor.Delete)
		case "200~":
			start := time.Now()
			paste, err := readBracketedPaste(r)
			if err != nil {
				return err
			}
			s.editor.Insert(paste)
			s.metrics = append(s.metrics, Sample{Name: "paste", Duration: time.Since(start)})
		case "8~":
			s.sample("end", s.editor.End)
		}
		s.renderBottom("editing", "")
		return nil
	}
	return nil
}

func (s *CustomShell) renderBottom(status, live string) {
	start := time.Now()
	spinnerLine := "spinner: " + spinnerFrame() + " " + status
	streamLine := "stream: " + livePreview(live)
	statusLine := "status: bytes=" + fmt.Sprint(s.editor.Integrity().Bytes)
	editorLines := s.editor.Render()

	allLines := make([]string, 0, 3+len(editorLines))
	allLines = append(allLines, spinnerLine, streamLine, statusLine)
	for _, line := range editorLines {
		allLines = append(allLines, "> "+line)
	}

	fmt.Fprint(s.out, "\x1b[0m\x1b[u\x1b[J")
	for _, line := range allLines {
		fmt.Fprint(s.out, "\r\x1b[2K")
		fmt.Fprintln(s.out, trimCells(line, s.width))
	}
	if len(allLines) > 0 {
		if up := len(allLines) - 1; up > 0 {
			fmt.Fprintf(s.out, "\x1b[%dA", up)
		}
		last := allLines[len(allLines)-1]
		if w := uniseg.StringWidth(last); w > 0 {
			fmt.Fprintf(s.out, "\x1b[%dC", w)
		}
	}
	s.bottomLines = len(allLines)
	s.metrics = append(s.metrics, Sample{Name: "render", Duration: time.Since(start)})
}

func (s *CustomShell) sample(name string, fn func()) {
	start := time.Now()
	fn()
	s.metrics = append(s.metrics, Sample{Name: name, Duration: time.Since(start)})
}

func (s *CustomShell) finish() error {
	fmt.Fprint(s.out, "\x1b[u\x1b[J")
	text := s.editor.Text()
	result := integrity(text)
	fmt.Fprintf(s.out, "RESULT bytes=%d lines=%d sha256=%s\n", result.Bytes, result.Lines, result.SHA256)
	for _, metric := range summarizeSamples(s.metrics) {
		fmt.Fprintf(s.out, "METRIC name=%s p95_ms=%.3f max_ms=%.3f count=%d\n", metric.Name, metric.P95, metric.Max, metric.Count)
	}
	return nil
}

func terminalWidth() int {
	if w, _, err := term.GetSize(int(os.Stdin.Fd())); err == nil && w > 0 {
		return w
	}
	if w, _, err := term.GetSize(int(os.Stdout.Fd())); err == nil && w > 0 {
		return w
	}
	return 80
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
			text := b.String()
			return strings.TrimSuffix(text, end), nil
		}
	}
}

func spinnerFrame() string { return "-" }

func livePreview(s string) string {
	if s == "" {
		return "streaming text tail"
	}
	return s
}

func trimCells(s string, width int) string {
	if width <= 0 || uniseg.StringWidth(s) <= width {
		return s
	}
	var out strings.Builder
	used := 0
	gr := uniseg.NewGraphemes(s)
	for gr.Next() {
		part := gr.Str()
		w := uniseg.StringWidth(part)
		if used+w > width {
			break
		}
		out.WriteString(part)
		used += w
	}
	return out.String()
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
		out = append(out, metricSummary{Name: name, P95: values[idx], Max: values[len(values)-1], Count: len(values)})
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
