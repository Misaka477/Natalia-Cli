package terminalspike

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/rivo/uniseg"
)

type Editor struct {
	clusters []string
	cursor   int
	colGoal  int
	width    int
	maxRows  int
}

type Integrity struct {
	Bytes  int
	Lines  int
	SHA256 string
}

func NewEditor(width, maxRows int) *Editor {
	if width < 8 {
		width = 8
	}
	if maxRows < 1 {
		maxRows = 1
	}
	return &Editor{width: width, maxRows: maxRows}
}

func (e *Editor) SetWidth(width int) {
	if width < 8 {
		width = 8
	}
	e.width = width
}

func (e *Editor) Insert(text string) {
	if text == "" {
		return
	}
	items := splitGraphemes(text)
	merged := make([]string, 0, len(e.clusters)+len(items))
	merged = append(merged, e.clusters[:e.cursor]...)
	merged = append(merged, items...)
	merged = append(merged, e.clusters[e.cursor:]...)
	e.clusters = merged
	e.cursor += len(items)
	e.colGoal = -1
}

func (e *Editor) Backspace() {
	if e.cursor == 0 {
		return
	}
	e.clusters = append(e.clusters[:e.cursor-1], e.clusters[e.cursor:]...)
	e.cursor--
	e.colGoal = -1
}

func (e *Editor) Delete() {
	if e.cursor >= len(e.clusters) {
		return
	}
	e.clusters = append(e.clusters[:e.cursor], e.clusters[e.cursor+1:]...)
	e.colGoal = -1
}

func (e *Editor) Left() {
	if e.cursor > 0 {
		e.cursor--
	}
	e.colGoal = -1
}

func (e *Editor) Right() {
	if e.cursor < len(e.clusters) {
		e.cursor++
	}
	e.colGoal = -1
}

func (e *Editor) Home() {
	lines := e.visualLines()
	row, _ := e.cursorVisual(lines)
	if row >= 0 && row < len(lines) {
		e.cursor = lines[row].Start
	}
	e.colGoal = -1
}

func (e *Editor) End() {
	lines := e.visualLines()
	row, _ := e.cursorVisual(lines)
	if row >= 0 && row < len(lines) {
		e.cursor = lines[row].End
	}
	e.colGoal = -1
}

func (e *Editor) BufferStart() {
	e.cursor = 0
	e.colGoal = -1
}

func (e *Editor) BufferEnd() {
	e.cursor = len(e.clusters)
	e.colGoal = -1
}

func (e *Editor) Up() {
	e.moveVertical(-1)
}

func (e *Editor) Down() {
	e.moveVertical(1)
}

func (e *Editor) Text() string {
	return strings.Join(e.clusters, "")
}

func (e *Editor) Clear() {
	e.clusters = nil
	e.cursor = 0
	e.colGoal = -1
}

func (e *Editor) Render() []string {
	lines := e.visualLines()
	if len(lines) == 0 {
		return []string{""}
	}
	row, _ := e.cursorVisual(lines)
	start := 0
	if len(lines) > e.maxRows {
		start = row - e.maxRows + 1
		if start < 0 {
			start = 0
		}
		if start+e.maxRows > len(lines) {
			start = len(lines) - e.maxRows
		}
	}
	end := len(lines)
	if end > start+e.maxRows {
		end = start + e.maxRows
	}
	out := make([]string, 0, end-start+1)
	if start > 0 {
		out = append(out, fmt.Sprintf("... %d visual rows above ...", start))
	}
	for _, line := range lines[start:end] {
		out = append(out, strings.Join(e.clusters[line.Start:line.End], ""))
	}
	if end < len(lines) {
		out = append(out, fmt.Sprintf("... %d visual rows below ...", len(lines)-end))
	}
	return out
}

func (e *Editor) Integrity() Integrity {
	text := e.Text()
	return integrity(text)
}

func integrity(text string) Integrity {
	sum := sha256.Sum256([]byte(text))
	lines := 0
	if text != "" {
		lines = strings.Count(text, "\n") + 1
	}
	return Integrity{Bytes: len([]byte(text)), Lines: lines, SHA256: fmt.Sprintf("%x", sum)}
}

type Sample struct {
	Name     string
	Duration time.Duration
}

type visualLine struct {
	Start int
	End   int
	Width int
}

func (e *Editor) moveVertical(delta int) {
	lines := e.visualLines()
	row, col := e.cursorVisual(lines)
	if row < 0 {
		return
	}
	if e.colGoal >= 0 {
		col = e.colGoal
	} else {
		e.colGoal = col
	}
	target := row + delta
	if target < 0 {
		target = 0
	}
	if target >= len(lines) {
		target = len(lines) - 1
	}
	e.cursor = cursorForColumn(e.clusters, lines[target], e.colGoal)
}

func (e *Editor) cursorVisual(lines []visualLine) (int, int) {
	for i, line := range lines {
		if e.cursor >= line.Start && e.cursor <= line.End {
			col := 0
			for _, cluster := range e.clusters[line.Start:e.cursor] {
				col += clusterWidth(cluster)
			}
			return i, col
		}
	}
	if len(lines) == 0 {
		return -1, 0
	}
	last := len(lines) - 1
	return last, lines[last].Width
}

func (e *Editor) visualLines() []visualLine {
	if len(e.clusters) == 0 {
		return []visualLine{{Start: 0, End: 0}}
	}
	width := e.width
	lines := make([]visualLine, 0, len(e.clusters)/width+1)
	start := 0
	col := 0
	for i, cluster := range e.clusters {
		if cluster == "\n" {
			lines = append(lines, visualLine{Start: start, End: i, Width: col})
			start = i + 1
			col = 0
			continue
		}
		w := clusterWidth(cluster)
		if col > 0 && col+w > width {
			lines = append(lines, visualLine{Start: start, End: i, Width: col})
			start = i
			col = 0
		}
		col += w
	}
	lines = append(lines, visualLine{Start: start, End: len(e.clusters), Width: col})
	return lines
}

func cursorForColumn(clusters []string, line visualLine, col int) int {
	current := 0
	for i := line.Start; i < line.End; i++ {
		w := clusterWidth(clusters[i])
		if current+w > col {
			return i
		}
		current += w
	}
	return line.End
}

func splitGraphemes(text string) []string {
	gr := uniseg.NewGraphemes(text)
	items := make([]string, 0, len(text)/3)
	for gr.Next() {
		items = append(items, gr.Str())
	}
	return items
}

func clusterWidth(cluster string) int {
	if cluster == "\n" {
		return 0
	}
	w := uniseg.StringWidth(cluster)
	if w < 1 {
		return 1
	}
	return w
}
