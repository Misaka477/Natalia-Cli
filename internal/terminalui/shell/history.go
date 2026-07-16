package shell

type History struct {
	entries []string
	index   int
	draft   string
	maxSize int
}

func NewHistory(maxSize int) *History {
	if maxSize < 1 {
		maxSize = 1
	}
	return &History{
		index:   -1,
		maxSize: maxSize,
	}
}

func (h *History) AddEntry(text string) {
	if text == "" {
		return
	}
	if len(h.entries) > 0 && h.entries[len(h.entries)-1] == text {
		return
	}
	h.entries = append(h.entries, text)
	if len(h.entries) > h.maxSize {
		h.entries = h.entries[len(h.entries)-h.maxSize:]
	}
	h.index = -1
	h.draft = ""
}

func (h *History) Up() string {
	if len(h.entries) == 0 {
		return h.draft
	}
	if h.index == -1 {
		h.index = len(h.entries) - 1
	} else if h.index > 0 {
		h.index--
	}
	return h.entries[h.index]
}

func (h *History) Down() string {
	if h.index == -1 {
		return h.draft
	}
	h.index++
	if h.index >= len(h.entries) {
		h.index = -1
		return h.draft
	}
	return h.entries[h.index]
}

func (h *History) SaveDraft(text string) {
	h.draft = text
}

func (h *History) Current() string {
	if h.index == -1 {
		return h.draft
	}
	return h.entries[h.index]
}
