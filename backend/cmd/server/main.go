package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"webdev-mmorpg/backend/internal/jira"
	"webdev-mmorpg/backend/internal/store"
)

var (
	buildVersion = "dev"
	buildCommit  = "unknown"
	buildTime    = "unknown"
	buildTarget  = "development"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serverStartedAt := time.Now().UTC()
	dbPath := env("DB_PATH", "data/game.db")
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)
	db, err := store.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	gameConfigValue, err := db.GetGameConfig(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	jiraSource := jira.NewCloudSource(jira.CloudConfig{
		BaseURL: env("JIRA_BASE_URL", ""), Email: env("JIRA_EMAIL", ""), APIToken: env("JIRA_API_TOKEN", ""), JQL: env("JIRA_JQL", ""),
	}, nil)
	jiraService := jira.NewService(jiraSource, db, time.Duration(gameConfigValue.Settings.RefreshIntervalSeconds)*time.Second)
	jiraService.Start(ctx)
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", health())
	mux.HandleFunc("/api/ready", readiness(db))
	mux.HandleFunc("/api/version", versionInfo())
	mux.HandleFunc("/api/operations/status", operationsStatus(db, jiraService, serverStartedAt))
	mux.HandleFunc("/api/characters", collection(db))
	mux.HandleFunc("/api/characters/", member(db))
	mux.HandleFunc("/api/game/config", gameConfig(db, jiraService))
	mux.HandleFunc("/api/game/profiles", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		profiles, err := db.ListGameProfiles()
		respond(w, profiles, err)
	})
	mux.HandleFunc("/api/jira/snapshot", jiraService.SnapshotHandler)
	mux.HandleFunc("/api/jira/events", jiraService.EventsHandler)
	mux.HandleFunc("/api/jira/refresh", jiraService.RefreshHandler)
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
	server := &http.Server{
		Addr: addr, Handler: securityHeaders(cors(mux, env("CORS_ALLOWED_ORIGINS", ""))),
		// WriteTimeout remains disabled because the Jira SSE response is intentionally long-lived.
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second,
		IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20,
	}
	errChannel := make(chan error, 1)
	go func() { errChannel <- server.ListenAndServe() }()
	select {
	case err = <-errChannel:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err = server.Shutdown(shutdownCtx); err != nil {
			log.Printf("graceful shutdown: %v", err)
		}
	}
}

func health() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		write(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

type readinessResponse struct {
	Status    string `json:"status"`
	Database  string `json:"database"`
	JiraState string `json:"jiraState"`
	CheckedAt string `json:"checkedAt"`
}

type buildInfoResponse struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
	BuiltAt string `json:"builtAt"`
	Target  string `json:"target"`
}

func currentBuildInfo() buildInfoResponse {
	return buildInfoResponse{Version: buildVersion, Commit: buildCommit, BuiltAt: buildTime, Target: buildTarget}
}

func versionInfo() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		write(w, http.StatusOK, currentBuildInfo())
	}
}

func readiness(db *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		response := readinessResponse{Status: "ready", Database: "ready", CheckedAt: time.Now().UTC().Format(time.RFC3339Nano)}
		if err := db.Ping(r.Context()); err != nil {
			response.Status = "not_ready"
			response.Database = "unavailable"
			write(w, http.StatusServiceUnavailable, response)
			return
		}
		if snapshot, err := db.JiraSnapshot(r.Context(), 1); err == nil {
			response.JiraState = snapshot.Connection.State
		}
		write(w, http.StatusOK, response)
	}
}

type operationsResponse struct {
	Status        string            `json:"status"`
	ServerStarted string            `json:"serverStartedAt"`
	UptimeSeconds int64             `json:"uptimeSeconds"`
	Jira          jira.Diagnostics  `json:"jira"`
	Connection    jira.Connection   `json:"connection"`
	IssueCount    int               `json:"issueCount"`
	EventCount    int               `json:"eventCount"`
	Database      string            `json:"database"`
	Build         buildInfoResponse `json:"build"`
	TargetFPS     int               `json:"targetFps"`
	TVModeEnabled bool              `json:"tvModeEnabled"`
}

func operationsStatus(db *store.Store, jiraService *jira.Service, startedAt time.Time) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		snapshot, err := db.JiraSnapshot(r.Context(), 100)
		if err != nil {
			write(w, http.StatusInternalServerError, map[string]string{"error": "Jira snapshot unavailable"})
			return
		}
		config, err := db.GetGameConfig(r.Context())
		if err != nil {
			write(w, http.StatusInternalServerError, map[string]string{"error": "game configuration unavailable"})
			return
		}
		status := "ok"
		if snapshot.Connection.Configured && snapshot.Connection.State != "live" {
			status = "degraded"
		}
		write(w, http.StatusOK, operationsResponse{
			Status: status, ServerStarted: startedAt.Format(time.RFC3339Nano), UptimeSeconds: int64(time.Since(startedAt).Seconds()),
			Jira: jiraService.Diagnostics(), Connection: snapshot.Connection, IssueCount: len(snapshot.Issues), EventCount: len(snapshot.Events),
			Database: "ready", Build: currentBuildInfo(), TargetFPS: config.Settings.TargetFPS, TVModeEnabled: config.Settings.TVModeEnabled,
		})
	}
}

func gameConfig(db *store.Store, jiraService *jira.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			value, err := db.GetGameConfig(r.Context())
			respond(w, value, err)
		case http.MethodPut:
			var config store.GameConfig
			if decode(w, r, &config) {
				value, err := db.SaveGameConfig(r.Context(), config)
				if err == nil {
					jiraService.SetPollInterval(time.Duration(value.Settings.RefreshIntervalSeconds) * time.Second)
				}
				respond(w, value, err)
			}
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}
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

func cors(next http.Handler, allowedOrigins string) http.Handler {
	allowed := map[string]struct{}{}
	for _, origin := range strings.Split(allowedOrigins, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			allowed[origin] = struct{}{}
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		_, originAllowed := allowed[origin]
		if origin != "" {
			w.Header().Add("Vary", "Origin")
		}
		if originAllowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			if origin != "" && !originAllowed {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
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
