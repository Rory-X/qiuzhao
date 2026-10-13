package gateway

import "testing"

func TestRouterSelectsPreferredHealthyProvider(t *testing.T) {
	router := NewRouter([]Provider{
		{Name: "openai", Healthy: true},
		{Name: "anthropic", Healthy: true},
	})

	selected, err := router.Select("anthropic")
	if err != nil {
		t.Fatalf("select provider: %v", err)
	}

	if selected.Name != "anthropic" {
		t.Fatalf("expected anthropic, got %q", selected.Name)
	}
}

func TestRouterFallsBackWhenPreferredProviderIsUnhealthy(t *testing.T) {
	router := NewRouter([]Provider{
		{Name: "anthropic", Healthy: false},
		{Name: "openai", Healthy: true},
		{Name: "mock", Healthy: true},
	})

	selected, err := router.Select("anthropic")
	if err != nil {
		t.Fatalf("select provider: %v", err)
	}

	if selected.Name != "openai" {
		t.Fatalf("expected fallback openai, got %q", selected.Name)
	}
}

func TestRouterReturnsErrorWhenNoProviderIsHealthy(t *testing.T) {
	router := NewRouter([]Provider{
		{Name: "openai", Healthy: false},
	})

	_, err := router.Select("openai")
	if err == nil {
		t.Fatal("expected error")
	}
}
