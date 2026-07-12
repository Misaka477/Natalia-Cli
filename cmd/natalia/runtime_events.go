package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/config"
	"github.com/Misaka477/Natalia-Cli/internal/hook"
	"github.com/Misaka477/Natalia-Cli/internal/notifications"
	"github.com/Misaka477/Natalia-Cli/internal/processmgr"
	"github.com/Misaka477/Natalia-Cli/internal/soul"
	"github.com/Misaka477/Natalia-Cli/internal/tools/agent"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
	"github.com/Misaka477/Natalia-Cli/internal/worker"
)

func registerAgentToolsForEngine(cfg *config.Config, engine *soul.Engine, tools *toolset.Registry) {
	if cfg == nil || engine == nil || engine.LLM == nil || tools == nil {
		return
	}
	if workerPool == nil {
		workerPool = worker.NewPool()
	}
	eff, err := cfg.EffectiveProfile(runtime.Mode, runtime.ModelProfile, runtime.PermissionProfile)
	if err != nil {
		return
	}
	workerClient := newLLMClient(&eff.Profile, &eff.Provider)
	tools.Register(&agent.Spawn{Pool: workerPool, Client: workerClient, Tools: tools, Approver: engine.Approver})
	tools.Register(&agent.List{Pool: workerPool})
	tools.Register(&agent.Output{Pool: workerPool})
	tools.Register(&agent.Stop{Pool: workerPool})
	tools.Register(&agent.Resume{Pool: workerPool})
}

func bridgeRuntimeEvents(engine *soul.Engine, w *wire.Wire) func() {
	detachProcess := bridgeProcessNotifications(engine, w)
	detachWorker := bridgeWorkerEvents(w)
	return func() {
		detachProcess()
		detachWorker()
	}
}

func bridgeProcessNotifications(engine *soul.Engine, w *wire.Wire) func() {
	return processmgr.DefaultManager().SubscribeComplete(func(sess processmgr.Session) {
		if sess.Kind != processmgr.KindBackground {
			return
		}
		message := processCompletionMessage(sess)
		n := notifications.DefaultStore().Add("background", "Background task completed", message)
		if engine != nil && engine.Hooks != nil {
			engine.Hooks.Trigger(context.Background(), hook.EventNotification, "background_complete", map[string]any{"id": sess.ID, "kind": string(sess.Kind), "status": string(sess.Status), "message": message})
		}
		if w != nil {
			publishWireNotification(w, wire.Notification{Title: n.Title, Message: n.Message})
		}
	})
}

func processCompletionMessage(sess processmgr.Session) string {
	parts := []string{fmt.Sprintf("%s %s", sess.ID, sess.Status)}
	if sess.ExitCode != nil {
		parts = append(parts, fmt.Sprintf("exit_code=%d", *sess.ExitCode))
	}
	cmd := strings.TrimSpace(sess.Command + " " + strings.Join(sess.Args, " "))
	if cmd != "" {
		parts = append(parts, "command="+cmd)
	}
	if sess.Error != "" {
		parts = append(parts, "error="+sess.Error)
	}
	return strings.Join(parts, ", ")
}

func bridgeWorkerEvents(w *wire.Wire) func() {
	if workerPool == nil {
		return func() {}
	}
	return workerPool.Subscribe(func(event worker.Event) {
		if w == nil {
			return
		}
		payload, err := json.Marshal(event)
		if err != nil {
			return
		}
		wireEvent, err := wire.NewEvent(wire.EventSubagentEvent, wire.SubagentEvent{ID: event.WorkerID, Event: event.Event, Payload: payload})
		if err != nil {
			return
		}
		w.SoulSide.PublishEvent(wireEvent)
	})
}

func publishWireNotification(w *wire.Wire, notification wire.Notification) {
	if w == nil {
		return
	}
	event, err := wire.NewEvent(wire.EventNotification, notification)
	if err != nil {
		return
	}
	w.SoulSide.PublishEvent(event)
}
