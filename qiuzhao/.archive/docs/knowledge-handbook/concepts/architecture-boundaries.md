# Concept: Architecture Boundaries

大业务系统首先需要稳定边界：入口、业务规则、状态、外部依赖和观测能力不能混在一个 handler 里。

## Source Backlinks

- [project-layout](../../github-materials/project-structure-style.md#golang-standardsproject-layout)：目录名词如何表达边界。
- [Google Go Styleguide](../../github-materials/project-structure-style.md#googlestyleguide-go)：小接口和清晰 API。
- [Wild Workouts DDD](../../github-materials/architecture-patterns.md#threedotslabswild-workouts-go-ddd-example)：port、command、domain、repository。
- [go-kit examples](../../github-materials/architecture-patterns.md#go-kitexamples)：service、endpoint、transport 三层。
- [Caddy](../../github-materials/real-projects.md#caddyservercaddy)：模块注册和生命周期。

## Local Go Backlinks

- [`api_service`](../../../api_service/README.md)：handler -> service -> repository。
- [`architecture_labs/gateway`](../../../architecture_labs/gateway/router.go)：router 只负责 provider selection，不做 HTTP 或真实调用。
- [`architecture_labs/agent`](../../../architecture_labs/agent/session.go)：session 只负责事件顺序，不做模型调用。

## Go Design Rule

初始阶段只建真实需要的边界：

```text
cmd -> internal/httpapi -> service/usecase -> domain/repository
```

进入 AI 网关后，再把 provider、router、rate limit、telemetry 拆出来。

## Code Patterns

Executable entry:

```go
func main() {
	cfg := LoadConfig()
	router := gateway.NewRouter(cfg.Providers)
	handler := httpapi.NewHandler(router)
	server := &http.Server{Addr: cfg.Addr, Handler: handler.Routes()}
	if err := RunServer(context.Background(), server); err != nil {
		log.Fatal(err)
	}
}
```

Consumer-side interface:

```go
type Router interface {
	Select(preferred string) (Provider, error)
}

type Handler struct {
	router Router
}
```

More patterns: [`../go-code-patterns.md`](../go-code-patterns.md).

## Failure Modes

- Handler 直接调用数据库和 provider，导致测试困难。
- 过早建立大接口，最后每个实现都被迫写空方法。
- `pkg` 目录滥用，让内部业务 API 过早承诺对外稳定。

## Source To Code Deep Dive

这个概念的完整闭环：

```text
project-layout cmd/internal
  -> Google small interfaces
  -> Wild Workouts port/usecase/domain/repository
  -> go-kit service/endpoint/transport
  -> capstone cmd/gateway + internal/app + internal/gateway + internal/agent
```

关键本地代码：

- Composition root: [`../../../capstone_ai_gateway_agent_runtime/internal/app/demo.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/demo.go)
- Runnable entry: [`../../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go`](../../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go)
- Gateway service boundary: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go)
- HTTP adapter: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)

`cmd/gateway` 只做进程入口，业务装配在 `internal/app`：

```go
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	demo := app.BuildDemo()

	server := &http.Server{
		Addr:              ":8080",
		Handler:           demo.Handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	runtime := lifecycle.App{
		Components: []lifecycle.Component{
			lifecycle.NewHTTPServer("http", server),
		},
		ShutdownTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := runtime.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		logger.Error("gateway stopped", "err", err)
		os.Exit(1)
	}
}
```

Service 只编排业务接口：

```go
type Service struct {
	Policy   Authorizer
	Limiter  Limiter
	Router   Router
	Executor Executor
}

func (s Service) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	policy, err := s.Policy.Authorize(ctx, req)
	if err != nil {
		return ChatResponse{}, err
	}
	if err := s.Limiter.Admit(ctx, req.TenantID, req.EstimatedTokens()); err != nil {
		return ChatResponse{}, err
	}
	plan, err := s.Router.Plan(ctx, req, policy)
	if err != nil {
		return ChatResponse{}, err
	}
	return s.Executor.Execute(ctx, req, plan)
}
```

HTTP adapter 保持薄：

```go
func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	var req core.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := h.service.Chat(r.Context(), req)
	if err != nil {
		writeError(w, statusFor(err), err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}
```

继续扩展时优先读：

- [`../production-patterns-cookbook.md#config-validation-before-hot-swap`](../production-patterns-cookbook.md#config-validation-before-hot-swap)
- [`../production-patterns-cookbook.md#graceful-drain`](../production-patterns-cookbook.md#graceful-drain)
- [`../key-code-index.md#7-demo-composition-root`](../key-code-index.md#7-demo-composition-root)
- [`../capstone-implementation-manual.md`](../capstone-implementation-manual.md)
