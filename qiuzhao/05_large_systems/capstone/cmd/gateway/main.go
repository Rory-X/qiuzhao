package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"example.com/capstone-ai-gateway-agent-runtime/internal/app"
	"example.com/capstone-ai-gateway-agent-runtime/internal/platform/lifecycle"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	demo := app.BuildDemo()

	server := &http.Server{
		Addr:              ":8080",
		Handler:           demo.Handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	runtime := lifecycle.App{
		Components: []lifecycle.Component{
			lifecycle.NewHTTPServer("http", server),
		},
		ShutdownTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger.Info("starting gateway", "addr", server.Addr)
	if err := runtime.Run(ctx); err != nil {
		logger.Error("gateway stopped", "err", err)
		os.Exit(1)
	}
}
