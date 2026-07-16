package shell

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/rivo/uniseg"
)

type Editor struct {
	clusters []string
	cursor   int
	colGoal  int
	width    int
	maxRows  int
	byteLen  int
	revision int64
	cacheRev int64
	cacheW   int
	cache    []visualLine
}

func NewEditor(width, maxRows int) *Editor {
	if width < 1 {
		width = 1
	}
	if maxRows < 1 {
		maxRows = 1
	}
	return &Editor{width: width, maxRows: maxRows}
}

func (e *Editor) SetWidth(width int) {
	if width < 1 {
		width = 1
	}
	if e.width == width {
		return
	}
	e.width = width
	e.revision++
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
	e.byteLen += len(text)
	e.colGoal = -1
	e.revision++
}

func (e *Editor) Backspace() {
	if e.cursor == 0 {
		return
	}
	removed := e.clusters[e.cursor-1]
	e.clusters = append(e.clusters[:e.cursor-1], e.clusters[e.cursor:]...)
	e.cursor--
	e.byteLen -= len(removed)
	e.colGoal = -1
	e.revision++
}

func (e *Editor) Delete() {
	if e.cursor >= len(e.clusters) {
		return
	}
	removed := e.clusters[e.cursor]
	e.clusters = append(e.clusters[:e.cursor], e.clusters[e.cursor+1:]...)
	e.byteLen -= len(removed)
	e.colGoal = -1
	e.revision++
}

func (e *Editor) WordLeft() {
	i := e.cursor
	for i > 0 && isWordSeparator(e.clusters[i-1]) {
		i--
	}
	for i > 0 && !isWordSeparator(e.clusters[i-1]) {
		i--
	}
	e.cursor = i
	e.colGoal = -1
}

func (e *Editor) WordRight() {
	i := e.cursor
	for i < len(e.clusters) && isWordSeparator(e.clusters[i]) {
		i++
	}
	for i < len(e.clusters) && !isWordSeparator(e.clusters[i]) {
		i++
	}
	e.cursor = i
	e.colGoal = -1
}

func (e *Editor) DeleteWordBackward() {
	old := e.cursor
	e.WordLeft()
	if e.cursor == old {
		return
	}
	removed := e.clusters[e.cursor:old]
	e.clusters = append(e.clusters[:e.cursor], e.clusters[old:]...)
	for _, cluster := range removed {
		e.byteLen -= len(cluster)
	}
	e.revision++
}

func (e *Editor) DeleteWordForward() {
	old := e.cursor
	e.WordRight()
	if e.cursor == old {
		return
	}
	removed := e.clusters[old:e.cursor]
	e.clusters = append(e.clusters[:old], e.clusters[e.cursor:]...)
	e.cursor = old
	for _, cluster := range removed {
		e.byteLen -= len(cluster)
	}
	e.revision++
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

func (e *Editor) Up() {
	e.moveVertical(-1)
}

func (e *Editor) Down() {
	e.moveVertical(1)
}

func (e *Editor) BufferStart() {
	e.cursor = 0
	e.colGoal = -1
}

func (e *Editor) BufferEnd() {
	e.cursor = len(e.clusters)
	e.colGoal = -1
}

func (e *Editor) Text() string {
	return strings.Join(e.clusters, "")
}

func (e *Editor) Clear() {
	e.clusters = nil
	e.cursor = 0
	e.byteLen = 0
	e.colGoal = -1
	e.revision++
}

func (e *Editor) SetText(text string) {
	if text == "" {
		e.clusters = nil
	} else {
		e.clusters = splitGraphemes(text)
	}
	e.cursor = len(e.clusters)
	e.byteLen = len(text)
	e.colGoal = -1
	e.revision++
}

func (e *Editor) CursorPos() int {
	return e.cursor
}

func (e *Editor) Len() int {
	return len(e.clusters)
}

func (e *Editor) ByteLen() int {
	return e.byteLen
}

type visualLine struct {
	Start int
	End   int
	Width int
}

func (e *Editor) visualLines() []visualLine {
	if e.cacheRev == e.revision && e.cacheW == e.width && e.cache != nil {
		return e.cache
	}
	if len(e.clusters) == 0 {
		e.cache = []visualLine{{Start: 0, End: 0}}
		e.cacheRev = e.revision
		e.cacheW = e.width
		return e.cache
	}
	lines := make([]visualLine, 0, len(e.clusters)/e.width+1)
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
		if col > 0 && col+w > e.width {
			lines = append(lines, visualLine{Start: start, End: i, Width: col})
			start = i
			col = 0
		}
		col += w
	}
	lines = append(lines, visualLine{Start: start, End: len(e.clusters), Width: col})
	e.cache = lines
	e.cacheRev = e.revision
	e.cacheW = e.width
	return e.cache
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

func (e *Editor) CursorVisualPosition() (int, int) {
	lines := e.visualLines()
	return e.cursorVisual(lines)
}

func (e *Editor) CursorRenderedPosition() (int, int) {
	lines := e.visualLines()
	row, col := e.cursorVisual(lines)
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
	renderedRow := row - start
	if start > 0 {
		renderedRow++
	}
	return renderedRow, col
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

func splitGraphemes(text string) []string {
	gr := uniseg.NewGraphemes(text)
	items := make([]string, 0, len(text)/3)
	for gr.Next() {
		items = append(items, gr.Str())
	}
	return items
}

func isWordSeparator(cluster string) bool {
	if cluster == "" || cluster == "\n" {
		return true
	}
	for _, r := range cluster {
		return !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_')
	}
	return true
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
