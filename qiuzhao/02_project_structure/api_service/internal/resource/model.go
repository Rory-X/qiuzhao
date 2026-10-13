package resource

import "time"

// Resource is one learning item tracked by the API.
type Resource struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	URL       string    `json:"url,omitempty"`
	Category  string    `json:"category,omitempty"`
	Completed bool      `json:"completed"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateInput struct {
	Title    string `json:"title"`
	URL      string `json:"url"`
	Category string `json:"category"`
}

type Progress struct {
	Total     int `json:"total"`
	Completed int `json:"completed"`
	Percent   int `json:"percent"`
}
