package userjira

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const credentialMaxAge = 30 * 24 * time.Hour

var ErrInvalidCredential = errors.New("credential cookie is invalid")

type CredentialClaims struct {
	UserID   string `json:"uid"`
	SID      string `json:"sid"`
	Server   string `json:"server,omitempty"`
	Username string `json:"username"`
	Password string `json:"password"`
	IssuedAt int64  `json:"iat"`
}

type Keyring struct {
	keys [][]byte
	now  func() time.Time
}

func ParseKeyring(value string) (*Keyring, error) {
	parts := strings.Split(value, ",")
	keys := make([][]byte, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		decoded, err := decodeKey(part)
		if err != nil || len(decoded) != 32 {
			return nil, fmt.Errorf("JIRA_CREDENTIAL_KEYS contains a key that is not URL-safe base64 for exactly 32 bytes")
		}
		keys = append(keys, decoded)
	}
	if len(keys) == 0 {
		return nil, errors.New("JIRA_CREDENTIAL_KEYS is required")
	}
	return &Keyring{keys: keys, now: time.Now}, nil
}

func decodeKey(value string) ([]byte, error) {
	if decoded, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(value, "=")); err == nil {
		return decoded, nil
	}
	return base64.URLEncoding.DecodeString(value)
}

func (k *Keyring) Seal(claims CredentialClaims) (string, error) {
	if claims.IssuedAt == 0 {
		claims.IssuedAt = k.now().UTC().Unix()
	}
	plain, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(k.keys[0])
	if err != nil {
		return "", err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := aead.Seal(nonce, nonce, plain, []byte("webdev-jira-credential-v1"))
	return "v1." + base64.RawURLEncoding.EncodeToString(sealed), nil
}

func (k *Keyring) Unseal(token, userID, sid string) (CredentialClaims, error) {
	var claims CredentialClaims
	if !strings.HasPrefix(token, "v1.") {
		return claims, ErrInvalidCredential
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(token, "v1."))
	if err != nil {
		return claims, ErrInvalidCredential
	}
	for _, key := range k.keys {
		block, blockErr := aes.NewCipher(key)
		if blockErr != nil {
			continue
		}
		aead, aeadErr := cipher.NewGCM(block)
		if aeadErr != nil || len(payload) < aead.NonceSize() {
			continue
		}
		nonce, ciphertext := payload[:aead.NonceSize()], payload[aead.NonceSize():]
		plain, openErr := aead.Open(nil, nonce, ciphertext, []byte("webdev-jira-credential-v1"))
		if openErr != nil || json.Unmarshal(plain, &claims) != nil {
			continue
		}
		validUser := subtle.ConstantTimeCompare([]byte(claims.UserID), []byte(userID)) == 1
		validSID := subtle.ConstantTimeCompare([]byte(claims.SID), []byte(sid)) == 1
		issued := time.Unix(claims.IssuedAt, 0)
		age := k.now().UTC().Sub(issued)
		if !validUser || !validSID || claims.Username == "" || claims.Password == "" || age < 0 || age > credentialMaxAge {
			return CredentialClaims{}, ErrInvalidCredential
		}
		return claims, nil
	}
	return CredentialClaims{}, ErrInvalidCredential
}

func (k *Keyring) ExpiresAt(claims CredentialClaims) time.Time {
	return time.Unix(claims.IssuedAt, 0).UTC().Add(credentialMaxAge)
}
