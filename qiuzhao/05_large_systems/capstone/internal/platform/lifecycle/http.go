package lifecycle

import (
	"context"
	"errors"
	"net/http"
)

type HTTPServer struct {
	name   string
	server *http.Server
}

func NewHTTPServer(name string, server *http.Server) HTTPServer {
	return HTTPServer{name: name, server: server}
}

func (s HTTPServer) Name() string {
	return s.name
}

func (s HTTPServer) Start(ctx context.Context) error {
	err := s.server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s HTTPServer) Shutdown(ctx context.Context) error {
	return s.server.Shutdown(ctx)
}
