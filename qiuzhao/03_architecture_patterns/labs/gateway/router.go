package gateway

import "errors"

var ErrNoHealthyProvider = errors.New("no healthy provider")

type Router struct {
	providers []Provider
}

func NewRouter(providers []Provider) Router {
	copied := make([]Provider, len(providers))
	copy(copied, providers)
	return Router{providers: copied}
}

func (r Router) Select(preferred string) (Provider, error) {
	for _, provider := range r.providers {
		if provider.Name == preferred && provider.Healthy {
			return provider, nil
		}
	}

	for _, provider := range r.providers {
		if provider.Healthy {
			return provider, nil
		}
	}

	return Provider{}, ErrNoHealthyProvider
}
