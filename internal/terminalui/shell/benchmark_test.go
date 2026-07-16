package shell

import (
	"strings"
	"testing"
)

func BenchmarkEditorInsert(b *testing.B) {
	e := NewEditor(80, 10)
	text := strings.Repeat("界", 1000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		e.Insert(text)
		e.Clear()
	}
}

func BenchmarkEditorInsertASCII(b *testing.B) {
	e := NewEditor(80, 10)
	text := strings.Repeat("a", 1000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		e.Insert(text)
		e.Clear()
	}
}

func BenchmarkEditorBackspace(b *testing.B) {
	e := NewEditor(80, 10)
	e.Insert(strings.Repeat("界", 1000))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if e.Len() == 0 {
			e.Insert(strings.Repeat("界", 1000))
		}
		e.Backspace()
	}
}

func BenchmarkEditorRender(b *testing.B) {
	e := NewEditor(80, 10)
	e.Insert(strings.Repeat("Hello 世界\n", 20))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		e.Render()
	}
}
