package core

import "context"

type Endpoint func(ctx context.Context, req ChatRequest) (ChatResponse, error)

type EndpointMiddleware func(Endpoint) Endpoint

func MakeEndpoint(service Service) Endpoint {
	return service.Chat
}

func ChainEndpoint(endpoint Endpoint, middleware ...EndpointMiddleware) Endpoint {
	for i := len(middleware) - 1; i >= 0; i-- {
		endpoint = middleware[i](endpoint)
	}
	return endpoint
}
