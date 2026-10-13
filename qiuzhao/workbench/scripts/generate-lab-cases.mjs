import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const notebooksDir = resolve(scriptsDir, "../notebooks");

function markdown(id, source) {
  return { cell_type: "markdown", id, metadata: {}, source: [source] };
}

function code(id, source) {
  return {
    cell_type: "code",
    execution_count: null,
    id,
    metadata: {},
    outputs: [],
    source: [source],
  };
}

function notebook(cells) {
  return {
    cells,
    metadata: {
      kernelspec: {
        display_name: "Go (gonb)",
        language: "go",
        name: "gonb",
      },
      language_info: {
        codemirror_mode: "",
        file_extension: ".go",
        mimetype: "text/x-go",
        name: "go",
        nbconvert_exporter: "",
        pygments_lexer: "",
        version: "go1.26.4",
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

const cases = {
  "00-start-here.ipynb": notebook([
    markdown(
      "start-intro",
      "# Go Learning Lab · 从这里开始\n\n这个工作台面向前端转 Go。建议每个实验都按“先预测 → 再运行 → 改参数 → 解释结果”的节奏完成，而不是只点一次 Run All。",
    ),
    markdown(
      "start-goals",
      "## 你会学会\n\n- 区分 GoNB 的声明 cell 与 `%%` 执行 cell。\n- 确认 Go、GoNB 和三个本地 module 已连接。\n- 根据目标选择基础、工程或系统设计学习路线。",
    ),
    code(
      "start-runtime-declarations",
      `import (
    "fmt"
    "runtime"
)`,
    ),
    code(
      "start-runtime-check",
      `%%
fmt.Printf("Go=%s OS=%s ARCH=%s\\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)`,
    ),
    markdown(
      "start-cell-model",
      "## GoNB cell 模型\n\n类型、函数和 import 属于声明，可以被后续 cell 使用。普通语句要以 `%%` 开头。`%%` 中的局部变量不会可靠地跨执行 cell 保留，因此案例让每个执行 cell 独立建场景。",
    ),
    code(
      "start-workspace-check",
      `!*printf 'API Service: '; test -d "$GO_LEARNING_API_SERVICE" && echo OK || echo MISSING; printf 'Architecture Labs: '; test -d "$GO_LEARNING_LABS" && echo OK || echo MISSING; printf 'Capstone: '; test -d "$GO_LEARNING_CAPSTONE" && echo OK || echo MISSING`,
    ),
    markdown(
      "start-learning-paths",
      "## 三条学习路线\n\n**语言基础**：`01-types` → `01-errors-and-testing` → `01-concurrency`。\n\n**后端工程**：`02-http-api` → `03-middleware` → `03-events-and-cqrs`。\n\n**大型系统**：`04-gateway-fallback` → `05-resilience`。",
    ),
    markdown(
      "start-routine",
      "## 每次实验的完成标准\n\n1. 不运行代码，先写下预测。\n2. Run All，确认基线通过。\n3. 完成末尾的动手挑战。\n4. 能用自己的话回答复盘问题。\n5. Restart Kernel 后再次 Run All。",
    ),
  ]),

  "01-types.ipynb": notebook([
    markdown(
      "types-intro",
      "# 01 · 类型与接口实验\n\n目标：亲手验证 struct 值语义、隐式接口和 typed nil。对应文档：`01_language_basics/1.1-types-and-interfaces.md`。",
    ),
    markdown(
      "types-ts-map",
      "## 从 TypeScript 迁移\n\nGo struct 赋值默认复制值，不像 JS 对象默认复制引用。接口由方法集合隐式满足，接近结构化类型；但接口值同时保存动态类型和值，因此 typed nil 是新的陷阱。",
    ),
    code(
      "types-declarations",
      `import "fmt"

type User struct { Name string }`,
    ),
    markdown(
      "types-value-prediction",
      "## 实验一：值语义\n\n先预测：修改 `b.Name` 后，`a.Name` 会不会一起变化？然后运行下面的 cell。",
    ),
    code(
      "types-value-semantics",
      `%%
a := User{Name: "Ada"}
b := a
b.Name = "Grace"
fmt.Printf("a=%s b=%s\\n", a.Name, b.Name)`,
    ),
    markdown(
      "types-value-explain",
      "结果应为 `a=Ada b=Grace`。赋值复制了整个 struct。若字段是 slice、map 或 pointer，复制的是描述符或地址，底层数据仍可能共享。",
    ),
    code(
      "types-interface-declarations",
      `type Loader interface {
    Load(id string) ([]byte, error)
}

type MemoryLoader map[string][]byte

func (m MemoryLoader) Load(id string) ([]byte, error) {
    value, ok := m[id]
    if !ok { return nil, fmt.Errorf("%s not found", id) }
    return value, nil
}

var _ Loader = MemoryLoader{}`,
    ),
    markdown(
      "types-interface-prediction",
      "## 实验二：隐式接口\n\n`MemoryLoader` 没有声明 implements。编译期断言 `var _ Loader = MemoryLoader{}` 证明它的方法集合满足 `Loader`。",
    ),
    code(
      "types-interface-use",
      `%%
loader := MemoryLoader{"intro": []byte("Go")}
value, err := loader.Load("intro")
fmt.Printf("value=%s err=%v\\n", value, err)`,
    ),
    code(
      "types-nil-declarations",
      `type Problem struct{}
func (*Problem) Error() string { return "problem" }`,
    ),
    markdown(
      "types-nil-prediction",
      "## 实验三：typed nil\n\n先预测 `err == nil`。接口里装入 `(*Problem)(nil)` 后，动态类型仍是 `*Problem`，所以接口本身不为 nil。",
    ),
    code(
      "types-nil-use",
      `%%
pointer := (*Problem)(nil)
err := error(pointer)
fmt.Printf("pointer == nil: %t, interface == nil: %t\\n", pointer == nil, err == nil)`,
    ),
    markdown(
      "types-challenge",
      "## 动手挑战\n\n1. 给 `User` 增加 `Tags []string`，复制后修改 `b.Tags[0]`，观察共享底层数组。\n2. 把 `Load` 改成指针接收者，观察 `MemoryLoader{}` 的编译期断言如何变化。",
    ),
    markdown(
      "types-review",
      "## 复盘\n\n- struct 复制为什么不等于深拷贝？\n- 接口应该定义在实现方还是使用方？\n- 如何避免返回含 typed nil 的 `error`？",
    ),
  ]),

  "01-concurrency.ipynb": notebook([
    markdown(
      "concurrency-intro",
      "# 01 · 并发实验\n\n目标：观察有界 worker、channel 关闭和 context timeout。对应文档：`01_language_basics/1.3-concurrency.md`。",
    ),
    markdown(
      "concurrency-ts-map",
      "## 从 TypeScript 迁移\n\nGoroutine 类似轻量任务，但不是 Promise。Channel 传递值和所有权；`context.Context` 类似可向下传播的 AbortSignal，同时携带 deadline。",
    ),
    code(
      "concurrency-imports",
      `import (
    "context"
    "fmt"
    "sync"
    "time"
)`,
    ),
    markdown(
      "concurrency-worker-prediction",
      "## 实验一：有界 Worker\n\n先预测哪些输出顺序稳定。Worker 获取任务的顺序不确定，但所有任务只处理一次，且主流程等待 worker 后才关闭 results。",
    ),
    code(
      "concurrency-workers",
      `%%
jobs := make(chan int, 4)
results := make(chan int, 4)
var workers sync.WaitGroup

for id := 0; id < 2; id++ {
    workers.Add(1)
    go func(workerID int) {
        defer workers.Done()
        for job := range jobs {
            fmt.Printf("worker=%d job=%d\\n", workerID, job)
            results <- job * job
        }
    }(id)
}

for job := 1; job <= 4; job++ { jobs <- job }
close(jobs)
workers.Wait()
close(results)
for result := range results { fmt.Println("result", result) }`,
    ),
    markdown(
      "concurrency-close-explain",
      "发送方负责关闭 channel。这里 `jobs` 由生产者关闭；`results` 要等所有 worker 退出后再关闭，否则仍在发送的 goroutine 会 panic。",
    ),
    markdown(
      "concurrency-timeout-prediction",
      "## 实验二：取消传播\n\n任务需要 200ms，context 预算只有 50ms。预测 select 会进入哪个分支。",
    ),
    code(
      "concurrency-timeout",
      `%%
ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
defer cancel()

select {
case <-time.After(200 * time.Millisecond):
    fmt.Println("finished")
case <-ctx.Done():
    fmt.Println("canceled:", ctx.Err())
}`,
    ),
    markdown(
      "concurrency-race-heading",
      "## 用 Race Detector 验证真实代码\n\n并发代码“运行一次没报错”不能证明安全。下面运行 Capstone 的队列和有界并发测试，并开启数据竞争检测。",
    ),
    code(
      "concurrency-race-tests",
      `!*cd "$GO_LEARNING_CAPSTONE" && go test -race ./internal/gateway/provider -run 'TestQueue|TestBounded' -v`,
    ),
    markdown(
      "concurrency-challenge",
      "## 动手挑战\n\n1. 把 jobs 改成无缓冲 channel，解释吞吐和背压变化。\n2. 在 worker 中加入 context，超时后停止接收新任务。\n3. 故意提前关闭 results，观察 panic 并解释所有权错误。",
    ),
    markdown(
      "concurrency-review",
      "## 复盘\n\n- 谁应关闭 channel？\n- WaitGroup 解决生命周期还是数据竞争？\n- 为什么生产代码不应靠 `time.Sleep` 等待 goroutine？",
    ),
  ]),

  "03-middleware.ipynb": notebook([
    markdown(
      "middleware-intro",
      "# 03 · Middleware 洋葱模型\n\n目标：用标准库 handler wrapper 观察请求进入与响应退出顺序。对应文档：`03_architecture_patterns/3.2-middleware-and-pipeline.md`。",
    ),
    markdown(
      "middleware-ts-map",
      "## 从 Koa/Express 迁移\n\nGo middleware 通常是 `func(http.Handler) http.Handler`。包装顺序决定进入顺序，`defer` 决定反向退出，形状接近 Koa 洋葱模型。",
    ),
    code(
      "middleware-imports",
      `import (
    "fmt"
    "net/http"
    "net/http/httptest"
)`,
    ),
    code(
      "middleware-trace-declaration",
      `func Trace(name string, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        fmt.Println("enter", name)
        defer fmt.Println("exit ", name)
        next.ServeHTTP(w, r)
    })
}`,
    ),
    markdown(
      "middleware-order-prediction",
      "## 先预测调用顺序\n\n对 `Trace(outer, Trace(inner, endpoint))`，先写下五行日志的顺序，再运行实验。",
    ),
    code(
      "middleware-order-run",
      `%%
endpoint := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
    fmt.Println("handler")
    w.WriteHeader(http.StatusNoContent)
})
handler := Trace("outer", Trace("inner", endpoint))

request := httptest.NewRequest(http.MethodGet, "/", nil)
response := httptest.NewRecorder()
handler.ServeHTTP(response, request)
fmt.Println("status", response.Code)`,
    ),
    markdown(
      "middleware-order-explain",
      "进入顺序是 outer → inner → handler；退出顺序是 inner → outer。认证、限流、recover、日志和 timeout 的相对位置会改变系统语义。",
    ),
    markdown(
      "middleware-module-heading",
      "## 直接调用本地 module\n\n把 Labs module 映射进 GoNB 的临时 module 后，可以直接 import 非 `internal` 包。Go 的 `internal` 规则仍然生效。",
    ),
    code(
      "middleware-module-setup",
      `!*cd "$GONB_TMP_DIR" && go mod edit -require=example.com/architecture-labs@v0.0.0 -replace=example.com/architecture-labs="$GO_LEARNING_LABS"`,
    ),
    code(
      "middleware-lab-import",
      `import gatewaylab "example.com/architecture-labs/gateway"`,
    ),
    code(
      "middleware-lab-use",
      `%%
labRouter := gatewaylab.NewRouter([]gatewaylab.Provider{
    {Name: "primary", Healthy: false},
    {Name: "backup", Healthy: true},
})
selected, err := labRouter.Select("primary")
fmt.Printf("selected=%s err=%v\\n", selected.Name, err)`,
    ),
    code(
      "middleware-real-tests",
      `!*cd "$GO_LEARNING_CAPSTONE" && go test ./internal/gateway/core -run TestEndpointMiddleware -v`,
    ),
    markdown(
      "middleware-challenge",
      "## 动手挑战\n\n1. 增加一个写入 `X-Request-ID` 的 middleware。\n2. 增加 recover middleware，并比较放在 Trace 内外时的日志差异。\n3. 调换 outer/inner，解释为什么代码阅读时要从组装点确认顺序。",
    ),
    markdown(
      "middleware-review",
      "## 复盘\n\n- middleware 为什么是一种装饰器？\n- recover 应覆盖哪些组件？\n- HTTP 边界策略与领域业务规则应如何分工？",
    ),
  ]),

  "01-errors-and-testing.ipynb": notebook([
    markdown(
      "errors-intro",
      "# 01 · 错误链与表格测试\n\n目标：练习 `%w`、`errors.Is/As`、结构化错误与表格用例。对应文档：`01_language_basics/1.2-error-handling.md`、`1.5-testing.md`。",
    ),
    markdown(
      "errors-ts-map",
      "## 从 TypeScript 迁移\n\nGo 的 `error` 是显式返回值，不会像 throw/rejected Promise 跳过调用链。`%w` 类似保留 cause；`errors.Is` 检查类别，`errors.As` 提取结构化类型。",
    ),
    code(
      "errors-declarations",
      `import (
    "errors"
    "fmt"
    "strings"
)

var ErrUserNotFound = errors.New("user not found")

type ValidationError struct {
    Field  string
    Reason string
}

func (e *ValidationError) Error() string {
    return e.Field + ": " + e.Reason
}

func findUser(id string) (string, error) {
    if id != "u-1" {
        return "", fmt.Errorf("lookup user %q: %w", id, ErrUserNotFound)
    }
    return "Ada", nil
}

func renameUser(id, name string) error {
    if strings.TrimSpace(name) == "" {
        return &ValidationError{Field: "name", Reason: "must not be empty"}
    }
    _, err := findUser(id)
    if err != nil {
        return fmt.Errorf("rename user: %w", err)
    }
    return nil
}`,
    ),
    markdown(
      "errors-chain-prediction",
      "## 实验一：检查错误链\n\n先预测：包装两层以后，`errors.Is(err, ErrUserNotFound)` 是否仍为 true？为什么不应该比较 `err.Error()` 字符串？",
    ),
    code(
      "errors-inspect-chain",
      `%%
errMissing := renameUser("missing", "Grace")
fmt.Println("完整错误链:", errMissing)
fmt.Println("errors.Is:", errors.Is(errMissing, ErrUserNotFound))

errValidation := renameUser("u-1", "  ")
var validation *ValidationError
fmt.Println("errors.As:", errors.As(errValidation, &validation))
fmt.Printf("结构化字段: field=%s reason=%s\\n", validation.Field, validation.Reason)`,
    ),
    markdown(
      "errors-chain-explain",
      "`%w` 保留因果链，因此调用方可以判断稳定类别，又能看到 `rename user`、`lookup user` 等定位上下文。HTTP 边界应映射类别，不应把完整内部链直接返回客户端。",
    ),
    markdown(
      "errors-table-heading",
      "## 表格驱动的边界用例\n\nGo 测试通常把输入、期望分类放进同一张表，再用 `t.Run` 执行。这里先在 Notebook 中观察同样的数据结构。",
    ),
    code(
      "errors-table-cases",
      `%%
cases := []struct {
    name      string
    id        string
    newName   string
    wantError error
}{
    {name: "success", id: "u-1", newName: "Grace"},
    {name: "missing", id: "u-2", newName: "Grace", wantError: ErrUserNotFound},
    {name: "invalid name", id: "u-1", newName: "  ", wantError: &ValidationError{}},
}

for _, testCase := range cases {
    err := renameUser(testCase.id, testCase.newName)
    passed := err == nil && testCase.wantError == nil
    if errors.Is(testCase.wantError, ErrUserNotFound) {
        passed = errors.Is(err, ErrUserNotFound)
    }
    if _, ok := testCase.wantError.(*ValidationError); ok {
        var target *ValidationError
        passed = errors.As(err, &target)
    }
    fmt.Printf("%-14s pass=%t err=%v\\n", testCase.name, passed, err)
}`,
    ),
    markdown(
      "errors-real-heading",
      "## 验证真实服务\n\nNotebook 中的表格便于观察结构；真正的 `testing.T`、子测试和 HTTP 错误映射由下面的 API Service 测试验证。",
    ),
    code(
      "errors-real-tests",
      `!*cd "$GO_LEARNING_API_SERVICE" && go test ./internal/httpapi -run 'TestHandlerRejectsInvalidCreateRequests|TestHandlerReturnsNotFoundForMissingResource' -v`,
    ),
    markdown(
      "errors-challenge",
      "## 动手挑战\n\n1. 增加 `PermissionError`，用 `errors.As` 提取用户和动作。\n2. 把 `%w` 改成 `%v`，观察 `errors.Is` 失效。\n3. 为临时错误设计 `Temporary() bool` 行为接口。",
    ),
    markdown(
      "errors-review",
      "## 复盘\n\n- sentinel、自定义类型和行为接口分别适合什么？\n- 为什么同一错误通常只在系统边界记录一次？\n- panic 为什么不适合普通业务失败？",
    ),
  ]),

  "02-http-api.ipynb": notebook([
    markdown(
      "http-intro",
      "# 02 · HTTP API 与 httptest\n\n目标：只用标准库完成 JSON 边界、状态码映射和无需真实端口的 handler 测试。对应文档：`02_project_structure/2.3-api-service-anatomy.md`。",
    ),
    markdown(
      "http-ts-map",
      "## 从 Express/Supertest 迁移\n\n`http.Handler` 对应路由处理边界，`httptest.NewRecorder` 类似无真实端口的请求测试。Go 倾向让 JSON 解码、业务调用和错误映射保持显式。",
    ),
    code(
      "http-declarations",
      `import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "net/http/httptest"
    "strings"
)

type CreateResourceRequest struct {
    Title string \`json:"title"\`
}

func resourceHandler() http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            w.Header().Set("Allow", http.MethodPost)
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }

        var input CreateResourceRequest
        decoder := json.NewDecoder(r.Body)
        decoder.DisallowUnknownFields()
        if err := decoder.Decode(&input); err != nil || strings.TrimSpace(input.Title) == "" {
            http.Error(w, "invalid request", http.StatusBadRequest)
            return
        }

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusCreated)
        _ = json.NewEncoder(w).Encode(map[string]string{
            "id": "res-1", "title": strings.TrimSpace(input.Title),
        })
    })
}`,
    ),
    markdown(
      "http-success-prediction",
      "## 实验一：成功边界\n\n先预测状态码、Content-Type 和返回标题。注意 handler 在边界执行 trim，而不是要求调用方提前清洗输入。",
    ),
    code(
      "http-success",
      `%%
validRequest := httptest.NewRequest(
    http.MethodPost,
    "/resources",
    bytes.NewBufferString(\`{"title":" Learn Go "}\`),
)
validResponse := httptest.NewRecorder()
resourceHandler().ServeHTTP(validResponse, validRequest)

fmt.Println("status:", validResponse.Code)
fmt.Println("content-type:", validResponse.Header().Get("Content-Type"))
fmt.Println("body:", validResponse.Body.String())`,
    ),
    markdown(
      "http-boundary-heading",
      "## 实验二：失败矩阵\n\n空标题、未知字段和非法 JSON 都属于 400，但失败原因不同。稳定协议可以统一公开错误，同时在服务端保留足够诊断信息。",
    ),
    code(
      "http-boundaries",
      `%%
badBodies := []string{
    \`{"title":""}\`,
    \`{"title":"Go","unknown":true}\`,
    \`not-json\`,
}

for _, body := range badBodies {
    request := httptest.NewRequest(http.MethodPost, "/resources", bytes.NewBufferString(body))
    response := httptest.NewRecorder()
    resourceHandler().ServeHTTP(response, request)
    fmt.Printf("body=%-35s status=%d response=%q\\n", body, response.Code, response.Body.String())
}`,
    ),
    markdown(
      "http-real-project-heading",
      "## 验证真实分层服务\n\n下面直接运行 `02_project_structure/api_service` 的端到端 handler 测试，覆盖创建、列表、完成和进度查询。",
    ),
    code(
      "http-real-tests",
      `!*cd "$GO_LEARNING_API_SERVICE" && go test ./internal/httpapi -run 'TestHandlerCreatesListsCompletesAndReportsProgress|TestHandlerRejectsInvalidCreateRequests' -v`,
    ),
    markdown(
      "http-challenge",
      "## 动手挑战\n\n1. 增加 GET 方法并正确设置 `Allow`。\n2. 拒绝一个 JSON 对象后的多余 token。\n3. 加入请求体大小限制，思考应返回 400 还是 413。",
    ),
    markdown(
      "http-review",
      "## 复盘\n\n- transport、service、repository 各自负责什么？\n- 为什么 handler 测试不需要监听真实端口？\n- 哪些内部错误绝不能直接返回客户端？",
    ),
  ]),

  "03-events-and-cqrs.ipynb": notebook([
    markdown(
      "events-intro",
      "# 03 · 领域事件、Replay 与轻量 CQRS\n\n目标：把不可变事件折叠成状态，体验 expected version 乐观并发，并从同一事件构建读模型。对应文档：`03_architecture_patterns/3.4-event-driven-and-cqrs.md`。",
    ),
    markdown(
      "events-ts-map",
      "## 从 Redux 迁移\n\n`ReplayAccount(events)` 很像 reducer：历史事件按顺序折叠成状态。区别是后端事件可能成为长期事实，需要版本并发控制、schema 演进和幂等消费。",
    ),
    code(
      "events-declarations",
      `import (
    "errors"
    "fmt"
    "sync"
)

var ErrVersionConflict = errors.New("event stream version conflict")

type AccountEvent struct {
    Kind   string
    Amount int
}

type Account struct {
    Balance int
    Version int
}

func ReplayAccount(events []AccountEvent) Account {
    var account Account
    for _, event := range events {
        switch event.Kind {
        case "deposited":
            account.Balance += event.Amount
        case "withdrawn":
            account.Balance -= event.Amount
        }
        account.Version++
    }
    return account
}

type MemoryEventStore struct {
    mu      sync.Mutex
    streams map[string][]AccountEvent
}

func NewMemoryEventStore() *MemoryEventStore {
    return &MemoryEventStore{streams: make(map[string][]AccountEvent)}
}

func (s *MemoryEventStore) Append(stream string, expectedVersion int, events ...AccountEvent) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    if len(s.streams[stream]) != expectedVersion {
        return fmt.Errorf("append %s: %w", stream, ErrVersionConflict)
    }
    s.streams[stream] = append(s.streams[stream], events...)
    return nil
}

func (s *MemoryEventStore) Load(stream string) []AccountEvent {
    s.mu.Lock()
    defer s.mu.Unlock()
    return append([]AccountEvent(nil), s.streams[stream]...)
}

func SeedAccount() (*MemoryEventStore, Account) {
    store := NewMemoryEventStore()
    _ = store.Append("account-1", 0,
        AccountEvent{Kind: "deposited", Amount: 100},
        AccountEvent{Kind: "withdrawn", Amount: 30},
    )
    return store, ReplayAccount(store.Load("account-1"))
}`,
    ),
    markdown(
      "events-replay-prediction",
      "## 实验一：Replay\n\n存入 100 的 deposit 和 30 的 withdrawal。先预测余额与 stream version，再运行。Replay 必须是确定性的，不能读取当前时间或随机数。",
    ),
    code(
      "events-replay",
      `%%
eventStore, account := SeedAccount()
history := eventStore.Load("account-1")
fmt.Printf("events=%d balance=%d version=%d\\n", len(history), account.Balance, account.Version)`,
    ),
    markdown(
      "events-conflict-heading",
      "## 实验二：乐观并发\n\n客户端以 expected version 0 写入已经有两个事件的 stream，应得到稳定冲突错误。重新加载 version 后再写入才安全。",
    ),
    code(
      "events-conflict",
      `%%
eventStore, account := SeedAccount()
conflictErr := eventStore.Append("account-1", 0, AccountEvent{Kind: "deposited", Amount: 50})
fmt.Println("并发版本冲突:", errors.Is(conflictErr, ErrVersionConflict))

appendErr := eventStore.Append("account-1", account.Version, AccountEvent{Kind: "deposited", Amount: 50})
updated := ReplayAccount(eventStore.Load("account-1"))
fmt.Printf("appendErr=%v updatedBalance=%d updatedVersion=%d\\n", appendErr, updated.Balance, updated.Version)`,
    ),
    code(
      "events-read-model",
      `type BalanceView struct {
    Deposits    int
    Withdrawals int
    Balance     int
}

func ProjectBalance(events []AccountEvent) BalanceView {
    var view BalanceView
    for _, event := range events {
        if event.Kind == "deposited" {
            view.Deposits++
            view.Balance += event.Amount
        }
        if event.Kind == "withdrawn" {
            view.Withdrawals++
            view.Balance -= event.Amount
        }
    }
    return view
}`,
    ),
    code(
      "events-project",
      `%%
projectionStore, _ := SeedAccount()
view := ProjectBalance(projectionStore.Load("account-1"))
fmt.Printf("CQRS read model: %+v\\n", view)`,
    ),
    markdown(
      "events-cqrs-explain",
      "写模型保护业务不变量，读模型针对查询预计算。两者异步分离时会出现最终一致窗口，调用方必须知道刚写入的数据何时可见。",
    ),
    code(
      "events-real-tests",
      `!*cd "$GO_LEARNING_LABS" && go test ./agent -run TestSessionRecordsToolCallFlowInOrder -v`,
    ),
    markdown(
      "events-challenge",
      "## 动手挑战\n\n1. 增加 `transfer_failed` 事件并保持旧事件可 replay。\n2. 模拟两个 writer 使用同一 expected version。\n3. 为事件增加 ID，并让投影端幂等去重。",
    ),
    markdown(
      "events-review",
      "## 复盘\n\n- 领域事件和事件溯源有什么区别？\n- Outbox 为什么仍可能重复投递？\n- 什么时候轻量 CQRS 只需分开方法，而不需要两套数据库？",
    ),
  ]),

  "04-gateway-fallback.ipynb": notebook([
    markdown(
      "gateway-intro",
      "# 04 · 网关路由、Fallback 与可重放边界\n\n目标：调用仓库中的真实 Router，并理解为什么流式响应开始后不能盲目 fallback。对应文档：`04_real_projects/4.2-gateway-and-proxy.md`。",
    ),
    markdown(
      "gateway-ts-map",
      "## 从前端请求重试迁移\n\n浏览器里重试 fetch 常被看作重新调用一次；网关还要判断请求体能否重放、响应是否已经开始、错误是否可重试，以及总 deadline 是否允许下一次尝试。",
    ),
    code(
      "gateway-module-setup",
      `!*cd "$GONB_TMP_DIR" && go mod edit -require=example.com/architecture-labs@v0.0.0 -replace=example.com/architecture-labs="$GO_LEARNING_LABS"`,
    ),
    code(
      "gateway-imports",
      `import (
    "errors"
    "fmt"

    gatewaylab "example.com/architecture-labs/gateway"
)`,
    ),
    markdown(
      "gateway-route-prediction",
      "## 实验一：健康路由\n\n首选 provider 不健康时，Router 会选择第一个健康候选；全部不健康时返回稳定的 `ErrNoHealthyProvider`，供上层映射为降级响应。",
    ),
    code(
      "gateway-router",
      `%%
router := gatewaylab.NewRouter([]gatewaylab.Provider{
    {Name: "primary", Healthy: false, Weight: 100},
    {Name: "backup", Healthy: true, Weight: 10},
})

selected, selectErr := router.Select("primary")
fmt.Printf("preferred=primary selected=%s err=%v\\n", selected.Name, selectErr)

unavailable := gatewaylab.NewRouter([]gatewaylab.Provider{{Name: "primary", Healthy: false}})
_, unavailableErr := unavailable.Select("primary")
fmt.Println("稳定错误分类:", errors.Is(unavailableErr, gatewaylab.ErrNoHealthyProvider))`,
    ),
    code(
      "gateway-fallback-declarations",
      `type ProviderAttempt struct {
    Provider string
    Started  bool
    Err      error
}

func chooseFallback(replayable bool, attempts []ProviderAttempt) (string, error) {
    for _, attempt := range attempts {
        if attempt.Err == nil {
            return attempt.Provider, nil
        }
        if attempt.Started || !replayable {
            return "", fmt.Errorf("provider %s failed after output started: %w", attempt.Provider, attempt.Err)
        }
    }
    return "", gatewaylab.ErrNoHealthyProvider
}`,
    ),
    code(
      "gateway-fallback-scenarios",
      `%%
providerTimeout := errors.New("provider timeout")

fallbackProvider, fallbackErr := chooseFallback(true, []ProviderAttempt{
    {Provider: "primary", Err: providerTimeout},
    {Provider: "backup"},
})
fmt.Printf("可重放请求: provider=%s err=%v\\n", fallbackProvider, fallbackErr)

_, streamingErr := chooseFallback(true, []ProviderAttempt{
    {Provider: "primary", Started: true, Err: providerTimeout},
    {Provider: "backup"},
})
fmt.Println("已开始流式输出:", streamingErr)`,
    ),
    markdown(
      "gateway-stream-explain",
      "SSE/流式响应一旦写出首字节，再切到 backup 会把两个 provider 的片段混在同一协议流中。此时通常只能中止并记录失败，不能假装无缝重试。",
    ),
    code(
      "gateway-real-tests",
      `!*cd "$GO_LEARNING_LABS" && go test ./gateway -run TestRouter -v`,
    ),
    markdown(
      "gateway-challenge",
      "## 动手挑战\n\n1. 只对 timeout/5xx fallback，拒绝对 4xx 重试。\n2. 加入最大 attempt budget。\n3. 设计 sticky route，让同一 session 优先落到同一 provider。",
    ),
    markdown(
      "gateway-review",
      "## 复盘\n\n- health、weight 和 policy 谁先参与选择？\n- 为什么 fallback 不是简单的 catch？\n- 控制面配置验证与数据面请求路由为什么要分开？",
    ),
  ]),

  "05-resilience.ipynb": notebook([
    markdown(
      "resilience-intro",
      "# 05 · 超时预算、重试与熔断\n\n目标：让 retry 服从总 context budget，并通过可注入时钟观察 Closed → Open → HalfOpen。对应文档：`05_large_systems/5.4-high-concurrency-and-ha.md`。",
    ),
    markdown(
      "resilience-ts-map",
      "## 从 AbortController 迁移\n\n`context.Context` 把取消和 deadline 沿调用链传递。服务端还要组合 retry、breaker、queue 和 fallback，避免每层独立重试导致尝试次数相乘。",
    ),
    code(
      "resilience-declarations",
      `import (
    "context"
    "errors"
    "fmt"
    "time"
)

func Retry(ctx context.Context, maxAttempts int, call func(attempt int) error) error {
    var lastErr error
    for attempt := 1; attempt <= maxAttempts; attempt++ {
        if err := ctx.Err(); err != nil {
            return fmt.Errorf("retry budget exhausted: %w", err)
        }
        lastErr = call(attempt)
        if lastErr == nil {
            return nil
        }
    }
    return fmt.Errorf("all attempts failed: %w", lastErr)
}

type BreakerState string

const (
    BreakerClosed   BreakerState = "closed"
    BreakerOpen     BreakerState = "open"
    BreakerHalfOpen BreakerState = "half-open"
)

type TimedBreaker struct {
    State       BreakerState
    Failures    int
    Threshold   int
    Cooldown    time.Duration
    OpenedAt    time.Time
    Now         func() time.Time
}

func NewTimedBreaker(threshold int, cooldown time.Duration, now func() time.Time) *TimedBreaker {
    return &TimedBreaker{State: BreakerClosed, Threshold: threshold, Cooldown: cooldown, Now: now}
}

func (b *TimedBreaker) Allow() bool {
    if b.State == BreakerOpen && b.Now().Sub(b.OpenedAt) >= b.Cooldown {
        b.State = BreakerHalfOpen
    }
    return b.State != BreakerOpen
}

func (b *TimedBreaker) Record(err error) {
    if err == nil {
        b.State = BreakerClosed
        b.Failures = 0
        return
    }
    b.Failures++
    if b.State == BreakerHalfOpen || b.Failures >= b.Threshold {
        b.State = BreakerOpen
        b.OpenedAt = b.Now()
    }
}`,
    ),
    markdown(
      "resilience-retry-prediction",
      "## 实验一：共享重试预算\n\n前两次调用返回临时错误，第三次成功。先预测实际 attempt 数。随后把 timeout 缩短，观察总 context 如何终止整个策略。",
    ),
    code(
      "resilience-retry",
      `%%
retryCtx, cancelRetry := context.WithTimeout(context.Background(), time.Second)
defer cancelRetry()

retryErr := Retry(retryCtx, 4, func(attempt int) error {
    fmt.Println("attempt", attempt)
    if attempt < 3 {
        return errors.New("temporary provider failure")
    }
    return nil
})
fmt.Println("retry result:", retryErr)`,
    ),
    markdown(
      "resilience-breaker-heading",
      "## 实验二：熔断状态机\n\n连续两次失败后进入 Open；注入 fake clock，无需 sleep 就能推进 cooldown。HalfOpen 探测成功后回到 Closed。",
    ),
    code(
      "resilience-breaker",
      `%%
fakeNow := time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC)
breaker := NewTimedBreaker(2, 30*time.Second, func() time.Time { return fakeNow })

breaker.Record(errors.New("timeout"))
fmt.Printf("after failure 1: state=%s allow=%t\\n", breaker.State, breaker.Allow())
breaker.Record(errors.New("timeout"))
fmt.Printf("after failure 2: state=%s allow=%t\\n", breaker.State, breaker.Allow())

fakeNow = fakeNow.Add(31 * time.Second)
fmt.Printf("after cooldown: state-before=%s allow=%t state-after=%s\\n", BreakerOpen, breaker.Allow(), breaker.State)
breaker.Record(nil)
fmt.Printf("after probe success: state=%s allow=%t\\n", breaker.State, breaker.Allow())`,
    ),
    markdown(
      "resilience-note",
      "## 组合规则\n\n生产代码中 retry、fallback 和 breaker 必须共享总 attempt/deadline budget。客户端 4xx 通常不应计入 provider breaker；半开探测还需要限制并发与加入 jitter。",
    ),
    code(
      "resilience-real-tests",
      `!*cd "$GO_LEARNING_CAPSTONE" && go test ./internal/gateway/provider -run 'TestBreakerOpensAfterRetryableFailures|TestTimedBreakerMovesToHalfOpenAfterCooldown|TestQueueRejectsWhenFull|TestBoundedClientRejectsWhenInFlightFull' -v`,
    ),
    markdown(
      "resilience-challenge",
      "## 动手挑战\n\n1. 让 Retry 只重试可恢复错误。\n2. 为 backoff 增加 jitter，但让测试仍然确定。\n3. 限制 HalfOpen 同时只允许一个探测请求。",
    ),
    markdown(
      "resilience-review",
      "## 复盘\n\n- queue capacity 与 max in-flight 分别保护什么？\n- breaker 应按 provider、endpoint 还是全局划分？\n- 为什么 liveness 不应因一个可 fallback provider 故障而失败？",
    ),
  ]),
};

await mkdir(notebooksDir, { recursive: true });
for (const [name, contents] of Object.entries(cases)) {
  await writeFile(resolve(notebooksDir, name), `${JSON.stringify(contents, null, 2)}\n`);
}

console.log(`Generated ${Object.keys(cases).length} GoNB lab cases in ${notebooksDir}`);
