package approval

type Mode string

const (
	ModeFuck     Mode = "fuck"
	ModeAsk      Mode = "ask"
	ModeReadOnly Mode = "read_only"
)

type Approver struct {
	Mode Mode
}

func New(mode Mode) *Approver {
	return &Approver{Mode: mode}
}

func (a *Approver) Request(action, description string) bool {
	switch a.Mode {
	case ModeFuck:
		return true
	case ModeReadOnly:
		return false
	default: // ask
		// TODO: implement interactive approval prompt
		return true
	}
}
