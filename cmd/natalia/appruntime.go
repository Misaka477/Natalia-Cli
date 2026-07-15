package main

import (
	"sync"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/config"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
	"github.com/Misaka477/Natalia-Cli/internal/planexec"
	"github.com/Misaka477/Natalia-Cli/internal/session"
	coremcp "github.com/Misaka477/Natalia-Cli/internal/mcp"
	workflowcore "github.com/Misaka477/Natalia-Cli/internal/workflow"
	"github.com/Misaka477/Natalia-Cli/internal/worker"
)

var defaultApp *AppRuntime
var defaultAppOnce sync.Once
var testApp *AppRuntime

type AppRuntime struct {
	mu               sync.RWMutex
	SessionStore     *session.SessionStore
	CurrentSession   *session.Session
	WorkerPool       *worker.Pool
	Overrides        runtimeOverrides
	ActiveConfig     *config.Config
	PlanManager      *plan.Manager
	WorkflowRegistry *workflowcore.Registry
	MCPClients       map[string]*coremcp.Client
	CurrentPlan      *planexec.Session
	CurrentPlanMTime time.Time
}

func DefaultAppRuntime() *AppRuntime {
	if testApp != nil {
		return testApp
	}
	defaultAppOnce.Do(func() {
		defaultApp = NewAppRuntime()
	})
	return defaultApp
}

func SetTestAppRuntime(rt *AppRuntime) func() {
	prev := testApp
	testApp = rt
	return func() {
		testApp = prev
	}
}

func ResetDefaultAppRuntime() {
	defaultAppOnce = sync.Once{}
	defaultApp = nil
}

func NewAppRuntime() *AppRuntime {
	return &AppRuntime{
		PlanManager:      &plan.Manager{},
		MCPClients:       make(map[string]*coremcp.Client),
		WorkflowRegistry: &workflowcore.Registry{},
	}
}

func NewAppRuntimeForTest() *AppRuntime {
	return &AppRuntime{
		PlanManager:      &plan.Manager{},
		MCPClients:       make(map[string]*coremcp.Client),
		WorkflowRegistry: &workflowcore.Registry{},
	}
}

func (r *AppRuntime) GetSessionStore() *session.SessionStore {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.SessionStore
}

func (r *AppRuntime) SetSessionStore(store *session.SessionStore) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.SessionStore = store
}

func (r *AppRuntime) GetCurrentSession() *session.Session {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.CurrentSession
}

func (r *AppRuntime) SetCurrentSession(sess *session.Session) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.CurrentSession = sess
}

func (r *AppRuntime) GetWorkerPool() *worker.Pool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.WorkerPool
}

func (r *AppRuntime) SetWorkerPool(pool *worker.Pool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.WorkerPool = pool
}

func (r *AppRuntime) GetActiveConfig() *config.Config {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.ActiveConfig
}

func (r *AppRuntime) SetActiveConfig(cfg *config.Config) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.ActiveConfig = cfg
}

func (r *AppRuntime) GetOverrides() runtimeOverrides {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Overrides
}

func (r *AppRuntime) SetOverrides(o runtimeOverrides) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Overrides = o
}

func (r *AppRuntime) GetPlanManager() *plan.Manager {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.PlanManager
}

func (r *AppRuntime) GetWorkflowRegistry() *workflowcore.Registry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.WorkflowRegistry
}

func (r *AppRuntime) SetWorkflowRegistry(reg *workflowcore.Registry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.WorkflowRegistry = reg
}

func (r *AppRuntime) GetMCPClient(name string) *coremcp.Client {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.MCPClients[name]
}

func (r *AppRuntime) SetMCPClient(name string, client *coremcp.Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.MCPClients == nil {
		r.MCPClients = make(map[string]*coremcp.Client)
	}
	r.MCPClients[name] = client
}

func (r *AppRuntime) GetCurrentPlan() *planexec.Session {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.CurrentPlan
}

func (r *AppRuntime) SetCurrentPlan(plan *planexec.Session) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.CurrentPlan = plan
}

func (r *AppRuntime) GetCurrentPlanMTime() time.Time {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.CurrentPlanMTime
}

func (r *AppRuntime) SetCurrentPlanMTime(mt time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.CurrentPlanMTime = mt
}
