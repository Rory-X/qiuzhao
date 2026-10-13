package provider

import (
	"sync"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type Runtime struct {
	name    core.ProviderName
	client  Client
	healthy bool
}

func NewRuntime(name core.ProviderName, client Client) Runtime {
	return Runtime{name: name, client: client, healthy: true}
}

func (r Runtime) WithHealthy(healthy bool) Runtime {
	r.healthy = healthy
	return r
}

type Registry struct {
	mu       sync.RWMutex
	runtimes map[core.ProviderName]Runtime
}

func NewRegistry() *Registry {
	return &Registry{runtimes: map[core.ProviderName]Runtime{}}
}

func (r *Registry) Replace(name core.ProviderName, runtime Runtime) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.runtimes[name] = runtime
}

func (r *Registry) Client(name core.ProviderName) (Client, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	runtime, ok := r.runtimes[name]
	if !ok || runtime.client == nil {
		return nil, false
	}
	return runtime.client, true
}

func (r *Registry) Healthy(name core.ProviderName) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	runtime, ok := r.runtimes[name]
	return ok && runtime.healthy
}
