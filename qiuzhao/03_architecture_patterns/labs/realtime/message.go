package realtime

type Message struct {
	ClientID string
	Seq      int64
	Body     string
}
