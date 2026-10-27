package userjira

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func encodedKey(value byte) string {
	return base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{value}, 32))
}

func TestCredentialSealUnsealBindingExpiryAndRotation(t *testing.T) {
	if _, err := ParseKeyring(""); err == nil {
		t.Fatal("empty JIRA_CREDENTIAL_KEYS was accepted")
	}
	issued := time.Date(2026, 10, 26, 10, 0, 0, 0, time.UTC)
	oldRing, err := ParseKeyring(encodedKey(1))
	if err != nil {
		t.Fatal(err)
	}
	oldRing.now = func() time.Time { return issued }
	token, err := oldRing.Seal(CredentialClaims{UserID: "user-a", SID: "sid-a", Server: "https://jira.example.com", Username: "jdoe", Password: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	claims, err := oldRing.Unseal(token, "user-a", "sid-a")
	if err != nil || claims.Password != "secret" || claims.Server != "https://jira.example.com" {
		t.Fatalf("valid token failed: claims=%#v err=%v", claims, err)
	}
	for _, mismatch := range [][2]string{{"user-b", "sid-a"}, {"user-a", "sid-b"}} {
		if _, err = oldRing.Unseal(token, mismatch[0], mismatch[1]); !errors.Is(err, ErrInvalidCredential) {
			t.Fatalf("accepted mismatched binding %#v: %v", mismatch, err)
		}
	}
	oldRing.now = func() time.Time { return issued.Add(credentialMaxAge + time.Second) }
	if _, err = oldRing.Unseal(token, "user-a", "sid-a"); !errors.Is(err, ErrInvalidCredential) {
		t.Fatalf("accepted expired token: %v", err)
	}
	rotated, err := ParseKeyring(encodedKey(2) + "," + encodedKey(1))
	if err != nil {
		t.Fatal(err)
	}
	rotated.now = func() time.Time { return issued.Add(time.Hour) }
	if _, err = rotated.Unseal(token, "user-a", "sid-a"); err != nil {
		t.Fatalf("rotation did not retain old-key decryption: %v", err)
	}
}

func TestHTTPClientRejectsUntrustedHostAndDropsAuthorizationAcrossOrigin(t *testing.T) {
	var receivedAuthorization string
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuthorization = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer destination.Close()
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, destination.URL+"/final", http.StatusFound)
	}))
	defer origin.Close()
	client, err := NewHTTPClient(origin.URL, destination.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = client.AuthedGet(context.Background(), "https://untrusted.example/activity", "user", "password", time.Second, 100); !errors.Is(err, ErrUntrustedHost) {
		t.Fatalf("untrusted URL was not rejected: %v", err)
	}
	if _, status, err := client.AuthedGet(context.Background(), origin.URL+"/redirect", "user", "password", time.Second, 100); err != nil || status != http.StatusOK {
		t.Fatalf("allowed redirect failed: status=%d err=%v", status, err)
	}
	if receivedAuthorization != "" {
		t.Fatal("Authorization header crossed an origin redirect")
	}
}
