package router

import (
	"sort"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type Candidate struct {
	Route        core.Route
	Healthy      bool
	CostMicros   int64
	LatencyMS    int64
	ErrorRatePPM int64
	Supports     map[core.ModelName]bool
}

type Score struct {
	Value int64
	Why   []string
}

func ScoreCandidate(req core.ChatRequest, candidate Candidate) Score {
	if !candidate.Healthy {
		return Score{Value: -1, Why: []string{"unhealthy"}}
	}
	if len(candidate.Supports) > 0 && !candidate.Supports[req.Model] {
		return Score{Value: -1, Why: []string{"model_not_supported"}}
	}

	score := int64(1000)
	why := []string{"base"}

	score -= candidate.CostMicros / 100
	why = append(why, "cost")

	score -= candidate.LatencyMS
	why = append(why, "latency")

	score -= candidate.ErrorRatePPM / 1000
	why = append(why, "error_rate")

	return Score{Value: score, Why: why}
}

func BuildScoredPlan(req core.ChatRequest, candidates []Candidate, limit int) core.RoutePlan {
	type ranked struct {
		route core.Route
		score Score
	}

	rankedCandidates := make([]ranked, 0, len(candidates))
	for _, candidate := range candidates {
		score := ScoreCandidate(req, candidate)
		if score.Value < 0 {
			continue
		}
		rankedCandidates = append(rankedCandidates, ranked{
			route: candidate.Route,
			score: score,
		})
	}

	sort.SliceStable(rankedCandidates, func(i, j int) bool {
		return rankedCandidates[i].score.Value > rankedCandidates[j].score.Value
	})

	if limit <= 0 || limit > len(rankedCandidates) {
		limit = len(rankedCandidates)
	}
	attempts := make([]core.Route, 0, limit)
	for _, candidate := range rankedCandidates[:limit] {
		attempts = append(attempts, candidate.route)
	}
	return core.RoutePlan{Attempts: attempts}
}
