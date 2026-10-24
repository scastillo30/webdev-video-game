package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"webdev-mmorpg/backend/internal/jira"
	"webdev-mmorpg/backend/internal/store"
)

func main() {
	dbPath := env("DB_PATH", "data/game.db")
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)
	db, err := store.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) { write(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("/api/characters", collection(db))
	mux.HandleFunc("/api/characters/", member(db))
	mux.HandleFunc("/api/game/profiles", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		profiles, err := db.ListGameProfiles()
		respond(w, profiles, err)
	})
	jiraSource := jira.NewCloudSource(jira.CloudConfig{
		BaseURL: env("JIRA_BASE_URL", ""), Email: env("JIRA_EMAIL", ""), APIToken: env("JIRA_API_TOKEN", ""), JQL: env("JIRA_JQL", ""),
	}, nil)
	jiraService := jira.NewService(jiraSource, db, envDuration("JIRA_POLL_INTERVAL", 60*time.Second))
	jiraService.Start(context.Background())
	mux.HandleFunc("/api/jira/snapshot", jiraService.SnapshotHandler)
	mux.HandleFunc("/api/jira/events", jiraService.EventsHandler)
	legacy := env("LEGACY_GAME_DIR", "..")
	mux.Handle("/legacy-game/", http.StripPrefix("/legacy-game/", http.FileServer(http.Dir(legacy))))
	mux.HandleFunc("/game/index.html", func(w http.ResponseWriter, r *http.Request) {
		target := "/legacy-game/index.html"
		if r.URL.RawQuery != "" {
			target += "?" + r.URL.RawQuery
		}
		http.Redirect(w, r, target, http.StatusTemporaryRedirect)
	})
	dist := env("ANGULAR_DIST", "../frontend/dist/webdev-mmorpg/browser")
	mux.Handle("/", spa(dist))
	addr := env("ADDR", ":8080")
	log.Printf("WEBDEV MMORPG API listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, cors(mux)))
}
func collection(db *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			v, e := db.List()
			respond(w, v, e)
		case http.MethodPost:
			var c store.Character
			if decode(w, r, &c) {
				v, e := db.Create(c)
				respondStatus(w, v, e, 201)
			}
		default:
			w.WriteHeader(405)
		}
	}
}
func member(db *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/characters/")
		if id == "" {
			write(w, 400, map[string]string{"error": "character id required"})
			return
		}
		switch r.Method {
		case http.MethodGet:
			v, e := db.Get(id)
			respond(w, v, e)
		case http.MethodPut:
			var c store.Character
			if decode(w, r, &c) {
				v, e := db.Update(id, c)
				respond(w, v, e)
			}
		case http.MethodDelete:
			e := db.Delete(id)
			if e == nil {
				w.WriteHeader(204)
			} else {
				respond(w, nil, e)
			}
		default:
			w.WriteHeader(405)
		}
	}
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if json.NewDecoder(r.Body).Decode(v) != nil {
		write(w, 400, map[string]string{"error": "invalid JSON body"})
		return false
	}
	return true
}
func respond(w http.ResponseWriter, v any, e error) { respondStatus(w, v, e, 200) }
func respondStatus(w http.ResponseWriter, v any, e error, ok int) {
	if e == nil {
		write(w, ok, v)
		return
	}
	if e == sql.ErrNoRows {
		write(w, 404, map[string]string{"error": "character not found"})
		return
	}
	write(w, 400, map[string]string{"error": e.Error()})
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func envDuration(k string, fallback time.Duration) time.Duration {
	value := env(k, "")
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		log.Printf("invalid %s=%q; using %s", k, value, fallback)
		return fallback
	}
	return parsed
}
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:4200")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func spa(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if info, e := os.Stat(path); e == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}
