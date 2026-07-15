package main

import (
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/config"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
	"github.com/Misaka477/Natalia-Cli/internal/planexec"
	"github.com/Misaka477/Natalia-Cli/internal/session"
	coremcp "github.com/Misaka477/Natalia-Cli/internal/mcp"
	workflowcore "github.com/Misaka477/Natalia-Cli/internal/workflow"
	"github.com/Misaka477/Natalia-Cli/internal/worker"
)

func TestAppRuntimeIsolation(t *testing.T) {
	a := NewAppRuntimeForTest()
	b := NewAppRuntimeForTest()

	a.SetOverrides(runtimeOverrides{Mode: "ask"})
	b.SetOverrides(runtimeOverrides{Mode: "code"})
	if a.GetOverrides().Mode != "ask" {
		t.Fatalf("expected a overrides mode=ask, got %+v", a.GetOverrides())
	}
	if b.GetOverrides().Mode != "code" {
		t.Fatalf("expected b overrides mode=code, got %+v", b.GetOverrides())
	}

	a.SetActiveConfig(&config.Config{DefaultProfile: "a"})
	b.SetActiveConfig(&config.Config{DefaultProfile: "b"})
	if a.GetActiveConfig().DefaultProfile != "a" {
		t.Fatalf("expected a config profile=a, got %s", a.GetActiveConfig().DefaultProfile)
	}
	if b.GetActiveConfig().DefaultProfile != "b" {
		t.Fatalf("expected b config profile=b, got %s", b.GetActiveConfig().DefaultProfile)
	}

	a.SetWorkflowRegistry(&workflowcore.Registry{})
	b.SetWorkflowRegistry(&workflowcore.Registry{})
	if a.GetWorkflowRegistry() == b.GetWorkflowRegistry() {
		t.Fatalf("expected workflow registries to be distinct instances")
	}

	planMgrA := &plan.Manager{}
	planMgrB := &plan.Manager{}
	_ = planMgrA
	_ = planMgrB

	a.SetMCPClient("server-a", &coremcp.Client{})
	b.SetMCPClient("server-b", &coremcp.Client{})
	if a.GetMCPClient("server-a") == nil {
		t.Fatalf("expected a to have server-a client")
	}
	if b.GetMCPClient("server-b") == nil {
		t.Fatalf("expected b to have server-b client")
	}
	if a.GetMCPClient("server-b") != nil {
		t.Fatalf("expected a not to have server-b client")
	}
	if b.GetMCPClient("server-a") != nil {
		t.Fatalf("expected b not to have server-a client")
	}

	poolA := worker.NewPool()
	poolB := worker.NewPool()
	a.SetWorkerPool(poolA)
	b.SetWorkerPool(poolB)
	if a.GetWorkerPool() != poolA {
		t.Fatalf("expected a to reference poolA")
	}
	if b.GetWorkerPool() != poolB {
		t.Fatalf("expected b to reference poolB")
	}

	storeA := &session.SessionStore{}
	storeB := &session.SessionStore{}
	a.SetSessionStore(storeA)
	b.SetSessionStore(storeB)
	if a.GetSessionStore() != storeA {
		t.Fatalf("expected a to reference storeA")
	}
	if b.GetSessionStore() != storeB {
		t.Fatalf("expected b to reference storeB")
	}

	sessA := &session.Session{ID: "a"}
	sessB := &session.Session{ID: "b"}
	a.SetCurrentSession(sessA)
	b.SetCurrentSession(sessB)
	if a.GetCurrentSession().ID != "a" {
		t.Fatalf("expected a session ID=a, got %s", a.GetCurrentSession().ID)
	}
	if b.GetCurrentSession().ID != "b" {
		t.Fatalf("expected b session ID=b, got %s", b.GetCurrentSession().ID)
	}

	planExecA := planexec.Parse("plan-a.md", "- [ ] task a")
	planExecB := planexec.Parse("plan-b.md", "- [ ] task b")
	a.SetCurrentPlan(planExecA)
	b.SetCurrentPlan(planExecB)
	if a.GetCurrentPlan().Slug != "plan-a" {
		t.Fatalf("expected a plan slug=plan-a, got %s", a.GetCurrentPlan().Slug)
	}
	if b.GetCurrentPlan().Slug != "plan-b" {
		t.Fatalf("expected b plan slug=plan-b, got %s", b.GetCurrentPlan().Slug)
	}

	mtimeA := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	mtimeB := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	a.SetCurrentPlanMTime(mtimeA)
	b.SetCurrentPlanMTime(mtimeB)
	if !a.GetCurrentPlanMTime().Equal(mtimeA) {
		t.Fatalf("expected a plan mtime=%v, got %v", mtimeA, a.GetCurrentPlanMTime())
	}
	if !b.GetCurrentPlanMTime().Equal(mtimeB) {
		t.Fatalf("expected b plan mtime=%v, got %v", mtimeB, b.GetCurrentPlanMTime())
	}
}

func TestNewAppRuntimeDefaults(t *testing.T) {
	r := NewAppRuntime()
	if r.PlanManager == nil {
		t.Fatalf("expected default PlanManager to be initialized")
	}
	if r.MCPClients == nil {
		t.Fatalf("expected default MCPClients map to be initialized")
	}
	if r.WorkflowRegistry == nil {
		t.Fatalf("expected default WorkflowRegistry to be initialized")
	}
}

func TestNewAppRuntimeForTestDefaults(t *testing.T) {
	r := NewAppRuntimeForTest()
	if r.PlanManager == nil {
		t.Fatalf("expected test PlanManager to be initialized, got nil")
	}
	if r.MCPClients == nil {
		t.Fatalf("expected test MCPClients map to be initialized")
	}
	if r.WorkflowRegistry == nil {
		t.Fatalf("expected test WorkflowRegistry to be initialized")
	}
}
