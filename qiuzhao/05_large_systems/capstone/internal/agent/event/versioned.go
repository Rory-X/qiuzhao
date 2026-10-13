package event

import (
	"encoding/json"
)

type StoredEvent struct {
	ID      string
	Version int
	Type    EventType
	Data    json.RawMessage
}

type Upcaster func(StoredEvent) (StoredEvent, error)

func DecodeStored(stored StoredEvent) (Event, error) {
	var decoded Event
	if len(stored.Data) > 0 {
		if err := json.Unmarshal(stored.Data, &decoded); err != nil {
			return Event{}, err
		}
	}
	decoded.ID = stored.ID
	decoded.Type = stored.Type
	return decoded, nil
}

func ReplayStored(events []StoredEvent, upcasters ...Upcaster) (State, error) {
	decoded := make([]Event, 0, len(events))
	for _, stored := range events {
		var err error
		for _, upcast := range upcasters {
			stored, err = upcast(stored)
			if err != nil {
				return State{}, err
			}
		}
		event, err := DecodeStored(stored)
		if err != nil {
			return State{}, err
		}
		decoded = append(decoded, event)
	}
	return Replay(decoded), nil
}

func UpcastToolStartedV1ToV2(stored StoredEvent) (StoredEvent, error) {
	if stored.Version != 1 || stored.Type != ToolStarted {
		return stored, nil
	}

	var old struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(stored.Data, &old); err != nil {
		return StoredEvent{}, err
	}

	next := Event{
		ToolCallID: old.ID,
		ToolName:   old.Name,
	}
	data, err := json.Marshal(next)
	if err != nil {
		return StoredEvent{}, err
	}
	stored.Version = 2
	stored.Data = data
	return stored, nil
}
