package core

type TenantID string
type RequestID string
type ProviderName string
type ModelName string

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	RequestID RequestID    `json:"request_id"`
	TenantID  TenantID     `json:"tenant_id"`
	Model     ModelName    `json:"model"`
	Provider  ProviderName `json:"provider"`
	Messages  []Message    `json:"messages"`
	Fallbacks []Route      `json:"fallbacks"`
}

type ChatResponse struct {
	RequestID    RequestID    `json:"request_id"`
	Provider     ProviderName `json:"provider"`
	Model        ModelName    `json:"model"`
	Content      string       `json:"content"`
	InputTokens  int          `json:"input_tokens"`
	OutputTokens int          `json:"output_tokens"`
}

type Route struct {
	Provider ProviderName `json:"provider"`
	Model    ModelName    `json:"model"`
}

type RoutePlan struct {
	Attempts []Route
}

type TenantPolicy struct {
	TenantID         TenantID
	AllowedModels    map[ModelName]bool
	AllowedProviders map[ProviderName]bool
	AllowFallbacks   bool
	TokenBudget      int
}

func (r ChatRequest) EstimatedTokens() int {
	total := 0
	for _, msg := range r.Messages {
		total += 4 + len(msg.Content)/4
	}
	if total < 1 {
		return 1
	}
	return total
}

func (r ChatRequest) WithRoute(route Route) ChatRequest {
	r.Provider = route.Provider
	r.Model = route.Model
	return r
}
