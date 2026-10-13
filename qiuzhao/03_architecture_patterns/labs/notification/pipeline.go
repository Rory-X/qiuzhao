package notification

import "sort"

type Pipeline struct {
	perUserLimit int
	seen         map[string]struct{}
	userCounts   map[string]int
	queue        []Notification
}

func NewPipeline(perUserLimit int) *Pipeline {
	if perUserLimit < 1 {
		perUserLimit = 1
	}
	return &Pipeline{
		perUserLimit: perUserLimit,
		seen:         make(map[string]struct{}),
		userCounts:   make(map[string]int),
	}
}

func (p *Pipeline) Accept(notification Notification) bool {
	if _, ok := p.seen[notification.ID]; ok {
		return false
	}
	if p.userCounts[notification.UserID] >= p.perUserLimit {
		return false
	}

	p.seen[notification.ID] = struct{}{}
	p.userCounts[notification.UserID]++
	p.queue = append(p.queue, notification)
	return true
}

func (p *Pipeline) Drain() []Notification {
	delivered := make([]Notification, len(p.queue))
	copy(delivered, p.queue)
	sort.SliceStable(delivered, func(i, j int) bool {
		return delivered[i].Priority > delivered[j].Priority
	})
	p.queue = p.queue[:0]
	return delivered
}
