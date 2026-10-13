package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"example.com/go-learning-api/internal/httpapi"
	"example.com/go-learning-api/internal/resource"
)

func main() {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	repo := resource.NewMemoryRepository()
	service := resource.NewService(repo, time.Now)
	handler := httpapi.NewHandler(service)

	log.Printf("go learning api listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
