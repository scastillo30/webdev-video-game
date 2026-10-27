package userjira

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"sync"
	"time"
)

const sessionCookieName = "webdev_session"

type Session struct {
	UserID    string
	SID       string
	ExpiresAt time.Time
}

type SessionManager struct {
	mu     sync.Mutex
	values map[[32]byte]Session
	secure bool
	now    func() time.Time
}

func NewSessionManager(secure bool) *SessionManager {
	return &SessionManager{values: map[[32]byte]Session{}, secure: secure, now: time.Now}
}

func randomToken(bytes int) string {
	value := make([]byte, bytes)
	if _, err := rand.Read(value); err != nil {
		panic("secure random source unavailable")
	}
	return base64.RawURLEncoding.EncodeToString(value)
}

func (m *SessionManager) Ensure(w http.ResponseWriter, r *http.Request) Session {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now().UTC()
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		hash := sha256.Sum256([]byte(cookie.Value))
		if session, exists := m.values[hash]; exists && now.Before(session.ExpiresAt) {
			return session
		}
	}
	token := randomToken(32)
	session := Session{UserID: "local-" + randomToken(12), SID: randomToken(24), ExpiresAt: now.Add(credentialMaxAge)}
	m.values[sha256.Sum256([]byte(token))] = session
	http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: token, Path: "/api", HttpOnly: true, Secure: m.secure, SameSite: http.SameSiteStrictMode, MaxAge: int(credentialMaxAge.Seconds()), Expires: session.ExpiresAt})
	return session
}

func (m *SessionManager) Reset(w http.ResponseWriter, r *http.Request) Session {
	m.mu.Lock()
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		delete(m.values, sha256.Sum256([]byte(cookie.Value)))
	}
	m.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: "", Path: "/api", HttpOnly: true, Secure: m.secure, SameSite: http.SameSiteStrictMode, MaxAge: -1, Expires: time.Unix(1, 0)})
	return m.Ensure(w, r.Clone(r.Context()))
}
