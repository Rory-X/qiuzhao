package gateway

type Provider struct {
	Name    string
	Healthy bool
	Weight  int
}
