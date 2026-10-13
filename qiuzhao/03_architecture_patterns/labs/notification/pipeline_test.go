package notification

import "testing"

func TestPipelineDeduplicatesLimitsAndDrainsByPriority(t *testing.T) {
	pipeline := NewPipeline(2)

	if accepted := pipeline.Accept(Notification{ID: "n1", UserID: "u1", Priority: 1, Body: "low"}); !accepted {
		t.Fatal("expected n1 to be accepted")
	}
	if accepted := pipeline.Accept(Notification{ID: "n1", UserID: "u1", Priority: 1, Body: "duplicate"}); accepted {
		t.Fatal("expected duplicate n1 to be suppressed")
	}
	if accepted := pipeline.Accept(Notification{ID: "n2", UserID: "u1", Priority: 10, Body: "high"}); !accepted {
		t.Fatal("expected n2 to be accepted")
	}
	if accepted := pipeline.Accept(Notification{ID: "n3", UserID: "u1", Priority: 5, Body: "overflow"}); accepted {
		t.Fatal("expected per-user limit to reject n3")
	}

	delivered := pipeline.Drain()
	if len(delivered) != 2 {
		t.Fatalf("expected 2 delivered notifications, got %d", len(delivered))
	}
	if delivered[0].ID != "n2" || delivered[1].ID != "n1" {
		t.Fatalf("expected high priority first, got %+v", delivered)
	}
}
