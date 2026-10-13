package event

import (
	"encoding/json"
	"testing"
)

func TestReplayUpcastsOldToolEventVersion(t *testing.T) {
	data, err := json.Marshal(struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}{ID: "tool-1", Name: "search"})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	state, err := ReplayStored([]StoredEvent{
		{ID: "event-1", Version: 1, Type: ToolStarted, Data: data},
	}, UpcastToolStartedV1ToV2)
	if err != nil {
		t.Fatalf("replay: %v", err)
	}

	got, ok := state.RunningTools["tool-1"]
	if !ok {
		t.Fatalf("missing running tool: %+v", state.RunningTools)
	}
	if got.Name != "search" {
		t.Fatalf("tool name: want search got %s", got.Name)
	}
}
