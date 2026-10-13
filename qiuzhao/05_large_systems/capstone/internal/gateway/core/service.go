package core

import "context"

type Authorizer interface {
	Authorize(ctx context.Context, req ChatRequest) (TenantPolicy, error)
}

type Limiter interface {
	Admit(ctx context.Context, tenantID TenantID, tokens int) error
}

type Router interface {
	Plan(ctx context.Context, req ChatRequest, policy TenantPolicy) (RoutePlan, error)
}

type Executor interface {
	Execute(ctx context.Context, req ChatRequest, plan RoutePlan) (ChatResponse, error)
}

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
