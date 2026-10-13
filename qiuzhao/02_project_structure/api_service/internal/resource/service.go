package resource

import (
	"context"
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidTitle = errors.New("title is required")
	ErrNotFound     = errors.New("resource not found")
)

type Clock func() time.Time

type Service struct {
	repo Repository
	now  Clock
}

func NewService(repo Repository, now Clock) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{repo: repo, now: now}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (Resource, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return Resource{}, ErrInvalidTitle
	}

	item := Resource{
		Title:     title,
		URL:       strings.TrimSpace(input.URL),
		Category:  strings.TrimSpace(input.Category),
		Completed: false,
		CreatedAt: s.now().UTC(),
	}

	return s.repo.Create(ctx, item)
}

func (s *Service) List(ctx context.Context) ([]Resource, error) {
	return s.repo.List(ctx)
}

func (s *Service) Complete(ctx context.Context, id string) (Resource, error) {
	item, ok, err := s.repo.Get(ctx, id)
	if err != nil {
		return Resource{}, err
	}
	if !ok {
		return Resource{}, ErrNotFound
	}

	item.Completed = true
	return s.repo.Update(ctx, item)
}

func (s *Service) Progress(ctx context.Context) (Progress, error) {
	items, err := s.repo.List(ctx)
	if err != nil {
		return Progress{}, err
	}

	progress := Progress{Total: len(items)}
	for _, item := range items {
		if item.Completed {
			progress.Completed++
		}
	}
	if progress.Total > 0 {
		progress.Percent = progress.Completed * 100 / progress.Total
	}

	return progress, nil
}
