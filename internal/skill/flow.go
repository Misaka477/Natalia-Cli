package skill

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

type NodeKind string

const (
	NodeBegin    NodeKind = "begin"
	NodeEnd      NodeKind = "end"
	NodeTask     NodeKind = "task"
	NodeDecision NodeKind = "decision"
)

type FlowNode struct {
	ID    string   `yaml:"id"`
	Label string   `yaml:"label"`
	Kind  NodeKind `yaml:"kind"`
}

type FlowEdge struct {
	Src   string `yaml:"src"`
	Dst   string `yaml:"dst"`
	Label string `yaml:"label,omitempty"`
}

type FlowDef struct {
	Nodes []FlowNode `yaml:"nodes"`
	Edges []FlowEdge `yaml:"edges"`
}

type Flow struct {
	Def      FlowDef
	beginID  string
	endID    string
	nodeMap  map[string]FlowNode
	outgoing map[string][]FlowEdge
}

func ParseFlow(yamlContent string) (*Flow, error) {
	var def FlowDef
	if err := yaml.Unmarshal([]byte(yamlContent), &def); err != nil {
		return nil, fmt.Errorf("解析 flow 失败: %w", err)
	}

	f := &Flow{
		Def:      def,
		nodeMap:  make(map[string]FlowNode),
		outgoing: make(map[string][]FlowEdge),
	}

	for _, n := range def.Nodes {
		f.nodeMap[n.ID] = n
		switch n.Kind {
		case NodeBegin:
			f.beginID = n.ID
		case NodeEnd:
			f.endID = n.ID
		}
	}

	for _, e := range def.Edges {
		f.outgoing[e.Src] = append(f.outgoing[e.Src], e)
	}

	if f.beginID == "" {
		return nil, fmt.Errorf("flow 缺少 begin 节点")
	}
	if f.endID == "" {
		return nil, fmt.Errorf("flow 缺少 end 节点")
	}

	return f, nil
}

func (f *Flow) BeginID() string { return f.beginID }
func (f *Flow) Node(id string) *FlowNode {
	n, ok := f.nodeMap[id]
	if !ok {
		return nil
	}
	return &n
}
func (f *Flow) Edges(id string) []FlowEdge { return f.outgoing[id] }

type FlowRunner struct {
	Flow     *Flow
	Current  string
	MaxMoves int
	moves    int
}

func NewFlowRunner(flow *Flow) *FlowRunner {
	return &FlowRunner{
		Flow:     flow,
		Current:  flow.BeginID(),
		MaxMoves: 20,
	}
}

func (r *FlowRunner) CurrentNode() *FlowNode {
	return r.Flow.Node(r.Current)
}

func (r *FlowRunner) IsDone() bool {
	return r.Current == r.Flow.endID || r.moves >= r.MaxMoves
}

func (r *FlowRunner) Advance(choice string) (*FlowNode, string, error) {
	if r.IsDone() {
		return nil, "", fmt.Errorf("flow 已结束")
	}

	node := r.Flow.Node(r.Current)
	if node == nil {
		return nil, "", fmt.Errorf("节点 %s 不存在", r.Current)
	}

	r.moves++

	switch node.Kind {
	case NodeBegin:
		edges := r.Flow.Edges(r.Current)
		if len(edges) == 0 {
			return nil, "", fmt.Errorf("begin 节点没有出边")
		}
		r.Current = edges[0].Dst

	case NodeTask:
		edges := r.Flow.Edges(r.Current)
		if len(edges) > 0 {
			r.Current = edges[0].Dst
		}

	case NodeDecision:
		edges := r.Flow.Edges(r.Current)
		if len(edges) == 0 {
			r.Current = r.Flow.endID
			return node, "", nil
		}
		if choice == "" {
			options := make([]string, len(edges))
			for i, e := range edges {
				options[i] = e.Label
			}
			return node, fmt.Sprintf("决策: %s\n选项: %s\n请回复 <choice>选项</choice>", node.Label, strings.Join(options, ", ")), nil
		}
		for _, e := range edges {
			if strings.EqualFold(e.Label, choice) {
				r.Current = e.Dst
				current := r.Flow.Node(r.Current)
				if current != nil {
					return current, current.Label, nil
				}
				return current, "", nil
			}
		}
		options := make([]string, len(edges))
		for i, e := range edges {
			options[i] = e.Label
		}
		return nil, "", fmt.Errorf("invalid choice %q for decision %s; options: %s", choice, node.ID, strings.Join(options, ", "))

	case NodeEnd:
		return node, "", nil
	}

	current := r.Flow.Node(r.Current)
	if current != nil {
		return current, current.Label, nil
	}
	return current, "", nil
}
