package resource

import (
	"context"
	"fmt"
	"sync"
)

type Repository interface {
	Create(ctx context.Context, item Resource) (Resource, error)
	List(ctx context.Context) ([]Resource, error)
	Get(ctx context.Context, id string) (Resource, bool, error)
	Update(ctx context.Context, item Resource) (Resource, error)
}

type MemoryRepository struct {
	mu    sync.Mutex
	next  int
	order []string
	items map[string]Resource
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		next:  1,
		items: make(map[string]Resource),
	}
}

func (r *MemoryRepository) Create(ctx context.Context, item Resource) (Resource, error) {
	if err := ctx.Err(); err != nil {
		return Resource{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	item.ID = fmt.Sprintf("res-%d", r.next)
	r.next++
	r.items[item.ID] = item
	r.order = append(r.order, item.ID)

	return item, nil
}

func (r *MemoryRepository) List(ctx context.Context) ([]Resource, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	items := make([]Resource, 0, len(r.order))
	for _, id := range r.order {
		items = append(items, r.items[id])
	}

	return items, nil
}

func (r *MemoryRepository) Get(ctx context.Context, id string) (Resource, bool, error) {
	if err := ctx.Err(); err != nil {
		return Resource{}, false, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	item, ok := r.items[id]
	return item, ok, nil
}

func (r *MemoryRepository) Update(ctx context.Context, item Resource) (Resource, error) {
	if err := ctx.Err(); err != nil {
		return Resource{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.items[item.ID] = item
	return item, nil
}
