# Backlink Index

这个文件是全局反向索引：从一个概念反查所有来源材料和本地 Go 代码。

## Architecture Boundaries

Sources:

- [project-layout](../github-materials/project-structure-style.md#golang-standardsproject-layout)
- [Google Go Styleguide](../github-materials/project-structure-style.md#googlestyleguide-go)
- [Wild Workouts DDD](../github-materials/architecture-patterns.md#threedotslabswild-workouts-go-ddd-example)
- [go-kit examples](../github-materials/architecture-patterns.md#go-kitexamples)
- [Caddy](../github-materials/real-projects.md#caddyservercaddy)
- [OpenTelemetry Collector](../github-materials/advanced-systems.md#open-telemetryopentelemetry-collector)

Local:

- [`api_service`](../../api_service/README.md)
- [`architecture_labs/gateway`](../../architecture_labs/gateway/router.go)
- [`architecture_labs/agent`](../../architecture_labs/agent/session.go)
- [`reference-implementations.md`](reference-implementations.md)
- [`production-patterns-cookbook.md`](production-patterns-cookbook.md)
- [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- [`key-code-index.md`](key-code-index.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)

## AI Gateway

Sources:

- [awesome-architecture AI Gateway](../architecture-to-go/templates/ai-gateway.md)
- [Bifrost](../github-materials/advanced-systems.md#maximhqbifrost)
- [Tyk](../github-materials/advanced-systems.md#tyktechnologiestyk)
- [go-kit examples](../github-materials/architecture-patterns.md#go-kitexamples)
- [Caddy](../github-materials/real-projects.md#caddyservercaddy)

Local:

- [`architecture_labs/gateway`](../../architecture_labs/gateway/router.go)
- [`docs/target-ai-gateway-agent-platform.md`](../target-ai-gateway-agent-platform.md)
- [`ai-gateway-agent-runtime-playbook.md`](ai-gateway-agent-runtime-playbook.md)
- [`production-readiness-checklist.md`](production-readiness-checklist.md)
- [`reference-implementations.md`](reference-implementations.md)
- [`production-patterns-cookbook.md`](production-patterns-cookbook.md)
- [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- [`key-code-index.md`](key-code-index.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)

## Agent Runtime

Sources:

- [awesome-architecture AI Agent Platform](../architecture-to-go/templates/ai-agent-platform.md)
- [trpc-agent-go](../github-materials/advanced-systems.md#trpc-grouptrpc-agent-go)
- [Temporal](../github-materials/advanced-systems.md#temporaliotemporal)
- [Memos](../github-materials/real-projects.md#usememosmemos)
- [Evrone clean template](../github-materials/architecture-patterns.md#evronego-clean-template)

Local:

- [`architecture_labs/agent`](../../architecture_labs/agent/session.go)
- [`architecture_labs/realtime`](../../architecture_labs/realtime/conversation.go)
- [`ai-gateway-agent-runtime-playbook.md`](ai-gateway-agent-runtime-playbook.md)
- [`architecture-experience-lessons.md`](architecture-experience-lessons.md)
- [`reference-implementations.md`](reference-implementations.md)
- [`production-patterns-cookbook.md`](production-patterns-cookbook.md)
- [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- [`key-code-index.md`](key-code-index.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)

## Concurrency And Backpressure

Sources:

- [Go by Example](../github-materials/language-basics.md#mmcgranagobyexample)
- [Uber Go Guide](../github-materials/project-structure-style.md#uber-goguide)
- [Hertz](../github-materials/advanced-systems.md#cloudwegohertz)
- [NATS](../github-materials/advanced-systems.md#nats-ionats-server)
- [Inference Serving](../architecture-to-go/templates/inference-serving.md)

Local:

- [`architecture_labs/inference`](../../architecture_labs/inference/batch_queue.go)
- [`architecture_labs/realtime`](../../architecture_labs/realtime/conversation.go)
- [`architecture-anti-patterns.md`](architecture-anti-patterns.md)
- [`production-readiness-checklist.md`](production-readiness-checklist.md)
- [`reference-implementations.md`](reference-implementations.md)
- [`production-patterns-cookbook.md`](production-patterns-cookbook.md)
- [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- [`key-code-index.md`](key-code-index.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)

## Observability

Sources:

- [OpenTelemetry Collector](../github-materials/advanced-systems.md#open-telemetryopentelemetry-collector)
- [Modern Go Application](../github-materials/project-structure-style.md#sagikazarmarkmodern-go-application)
- [go-kit examples](../github-materials/architecture-patterns.md#go-kitexamples)
- [Bifrost](../github-materials/advanced-systems.md#maximhqbifrost)

Local:

- [`docs/target-ai-gateway-agent-platform.md`](../target-ai-gateway-agent-platform.md)
- [`../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry)
- [`production-readiness-checklist.md`](production-readiness-checklist.md)
- [`reference-implementations.md`](reference-implementations.md)
- [`production-patterns-cookbook.md`](production-patterns-cookbook.md)
- [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- [`key-code-index.md`](key-code-index.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)

## Durable Workflow

Sources:

- [Temporal](../github-materials/advanced-systems.md#temporaliotemporal)
- [NATS](../github-materials/advanced-systems.md#nats-ionats-server)
- [Syncthing](../github-materials/real-projects.md#syncthingsyncthing)
- [Notification System](../architecture-to-go/templates/notification-system.md)

Local:

- [`architecture_labs/agent`](../../architecture_labs/agent/session.go)
- [`architecture_labs/notification`](../../architecture_labs/notification/pipeline.go)
- [`architecture-experience-lessons.md`](architecture-experience-lessons.md)
- [`production-readiness-checklist.md`](production-readiness-checklist.md)
- [`reference-implementations.md`](reference-implementations.md)
- [`production-patterns-cookbook.md`](production-patterns-cookbook.md)
- [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- [`key-code-index.md`](key-code-index.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)
