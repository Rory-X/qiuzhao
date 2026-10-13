package inference

type Request struct {
	ID     string
	Tokens int
}

type Batch struct {
	Requests []Request
}
