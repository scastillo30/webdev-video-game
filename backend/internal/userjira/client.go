package userjira

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrAuthFailed    = errors.New("Jira authentication failed")
	ErrUntrustedHost = errors.New("outbound URL is not on a configured Jira or Confluence host")
)

type HTTPClient struct {
	allowed map[string]struct{}
	client  *http.Client
}

func NewHTTPClient(jiraBase, confluenceBase string, transport http.RoundTripper) (*HTTPClient, error) {
	allowed := map[string]struct{}{}
	for _, raw := range []string{jiraBase, confluenceBase} {
		if strings.TrimSpace(raw) == "" {
			continue
		}
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
			return nil, fmt.Errorf("invalid configured Jira/Confluence URL %q", raw)
		}
		allowed[origin(parsed)] = struct{}{}
	}
	if transport == nil {
		transport = http.DefaultTransport
	}
	client := &http.Client{Transport: transport}
	result := &HTTPClient{allowed: allowed, client: client}
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if !result.allowedURL(req.URL) {
			return ErrUntrustedHost
		}
		if len(via) > 0 && origin(via[len(via)-1].URL) != origin(req.URL) {
			req.Header.Del("Authorization")
		}
		return nil
	}
	return result, nil
}

func origin(value *url.URL) string {
	return strings.ToLower(value.Scheme + "://" + value.Host)
}

func (c *HTTPClient) allowedURL(value *url.URL) bool {
	_, ok := c.allowed[origin(value)]
	return ok && value.User == nil && (value.Scheme == "https" || value.Scheme == "http")
}

func (c *HTTPClient) AuthedGet(ctx context.Context, rawURL, username, password string, timeout time.Duration, maxBytes int64) ([]byte, int, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || !c.allowedURL(parsed) {
		return nil, 0, ErrUntrustedHost
	}
	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestCtx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(username+":"+password)))
	request.Header.Set("Accept", "application/json, application/atom+xml, application/xml;q=0.9")
	response, err := c.client.Do(request)
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return nil, response.StatusCode, ErrAuthFailed
	}
	if maxBytes <= 0 {
		maxBytes = 4 << 20
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
	if err != nil {
		return nil, response.StatusCode, err
	}
	if int64(len(body)) > maxBytes {
		return nil, response.StatusCode, errors.New("Jira response exceeded the size limit")
	}
	return body, response.StatusCode, nil
}

func (c *HTTPClient) TestConnection(ctx context.Context, jiraBase, username, password string) (bool, string) {
	target := strings.TrimRight(jiraBase, "/") + "/rest/api/2/myself"
	_, status, err := c.AuthedGet(ctx, target, username, password, 15*time.Second, 1<<20)
	if errors.Is(err, ErrAuthFailed) {
		return false, "Authentication failed. Check username and password."
	}
	if err != nil {
		return false, "Could not reach Jira: " + err.Error()
	}
	if status < 200 || status >= 300 {
		return false, fmt.Sprintf("Jira returned an unexpected status: %d", status)
	}
	return true, "Jira connection successful."
}

func userDisplayName(body []byte) string {
	var value struct {
		DisplayName string `json:"displayName"`
		Name        string `json:"name"`
	}
	if json.Unmarshal(body, &value) != nil {
		return ""
	}
	if value.DisplayName != "" {
		return value.DisplayName
	}
	return value.Name
}
