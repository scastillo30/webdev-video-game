package userjira

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"webdev-mmorpg/backend/internal/store"
)

type atomFeed struct {
	Updated string      `xml:"updated"`
	Entries []atomEntry `xml:"entry"`
}

type atomEntry struct {
	ID         string         `xml:"id"`
	Published  string         `xml:"published"`
	Updated    string         `xml:"updated"`
	Title      atomText       `xml:"title"`
	Summary    atomText       `xml:"summary"`
	Content    atomText       `xml:"content"`
	Author     atomAuthor     `xml:"author"`
	Verb       string         `xml:"verb"`
	Categories []atomCategory `xml:"category"`
	Links      []atomLink     `xml:"link"`
}

type atomText struct {
	Type string `xml:"type,attr"`
	Text string `xml:",chardata"`
	HTML string `xml:",innerxml"`
}

type atomAuthor struct {
	Name string `xml:"name"`
	URI  string `xml:"uri"`
}

type atomCategory struct {
	Term string `xml:"term,attr"`
}

type atomLink struct {
	Rel  string `xml:"rel,attr" json:"rel"`
	Href string `xml:"href,attr" json:"href"`
}

type cachedFeed struct {
	Updated string        `json:"updated"`
	Entries []cachedEntry `json:"entries"`
}

type cachedEntry struct {
	ID            string     `json:"id"`
	Published     string     `json:"published"`
	Badge         string     `json:"badge"`
	IssueKey      string     `json:"issue_key"`
	IssueSummary  string     `json:"issue_summary"`
	IssueURL      string     `json:"issue_url"`
	TitleHTML     string     `json:"title_html"`
	ContentHTML   *string    `json:"content_html"`
	Author        string     `json:"author"`
	Categories    []string   `json:"categories"`
	LoggedSeconds int64      `json:"logged_seconds"`
	TitleText     string     `json:"title_text"`
	SummaryText   string     `json:"summary_text"`
	ContentText   string     `json:"content_text"`
	Verb          string     `json:"verb"`
	Links         []atomLink `json:"links"`
}

type ActivityEntry struct {
	ID            string   `json:"id"`
	OccurredAt    string   `json:"occurred_at"`
	Time          string   `json:"time"`
	Badge         string   `json:"badge"`
	IssueKey      string   `json:"issue_key"`
	IssueSummary  string   `json:"issue_summary"`
	IssueURL      string   `json:"issue_url"`
	TitleHTML     string   `json:"title_html"`
	ContentHTML   *string  `json:"content_html"`
	Categories    []string `json:"categories"`
	LoggedSeconds int64    `json:"logged_seconds"`
}

type ActivityDay struct {
	Date    string          `json:"date"`
	Label   string          `json:"label"`
	Entries []ActivityEntry `json:"entries"`
}

type WorklogRollup struct {
	IssueKey string `json:"issue_key"`
	IssueURL string `json:"issue_url"`
	Seconds  int64  `json:"seconds"`
	Display  string `json:"display"`
}

type ActivityResponse struct {
	Available          bool            `json:"available"`
	Reason             string          `json:"reason,omitempty"`
	Message            string          `json:"message,omitempty"`
	ActivityCount      int             `json:"activity_count,omitempty"`
	Updated            string          `json:"updated,omitempty"`
	Days               []ActivityDay   `json:"days,omitempty"`
	LoggedByIssue      []WorklogRollup `json:"logged_by_issue,omitempty"`
	LoggedTotalSeconds int64           `json:"logged_total_seconds,omitempty"`
	Stale              bool            `json:"stale,omitempty"`
}

func (r ActivityResponse) MarshalJSON() ([]byte, error) {
	if !r.Available {
		value := map[string]any{"available": false, "reason": r.Reason}
		if r.Message != "" {
			value["message"] = r.Message
		}
		return json.Marshal(value)
	}
	value := map[string]any{
		"available": true, "activity_count": r.ActivityCount, "updated": r.Updated,
		"days": r.Days, "logged_by_issue": r.LoggedByIssue, "logged_total_seconds": r.LoggedTotalSeconds,
	}
	if r.Stale {
		value["stale"] = true
	}
	if r.Message != "" {
		value["message"] = r.Message
	}
	return json.Marshal(value)
}

type ActivityService struct {
	store     *store.Store
	client    *HTTPClient
	baseURL   string
	host      string
	directory string
	now       func() time.Time
}

func NewActivityService(database *store.Store, client *HTTPClient, baseURL, directory string) (*ActivityService, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Host == "" {
		return nil, errors.New("JIRA_BASE_URL must be configured for per-user Jira activity")
	}
	if directory == "" {
		directory = "data/jira-activity"
	}
	return &ActivityService{store: database, client: client, baseURL: strings.TrimRight(baseURL, "/"), host: strings.ToLower(parsed.Host), directory: directory, now: time.Now}, nil
}

var issueKeyPattern = regexp.MustCompile(`\b[A-Z][A-Z0-9_]+-[0-9]+\b`)
var dangerousBlockPattern = regexp.MustCompile(`(?is)<(?:script|style|iframe|object|embed|form)[^>]*>.*?</(?:script|style|iframe|object|embed|form)\s*>`)
var tagPattern = regexp.MustCompile(`(?is)</?([a-z0-9]+)([^>]*)>`)
var hrefPattern = regexp.MustCompile(`(?is)\bhref\s*=\s*["']([^"']+)["']`)
var durationPattern = regexp.MustCompile(`(?i)\b([0-9]+)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b`)

func (s *ActivityService) Fetch(ctx context.Context, session Session, claims CredentialClaims, character store.Character, limit int) (ActivityResponse, error) {
	if character.JiraActivityURL == nil || strings.TrimSpace(*character.JiraActivityURL) == "" {
		return ActivityResponse{Available: false, Reason: "not_configured"}, nil
	}
	if limit < 1 || limit > 500 {
		return ActivityResponse{}, fmt.Errorf("limit must be between 1 and 500")
	}
	target, err := url.Parse(*character.JiraActivityURL)
	if err != nil {
		return s.cachedFailure(session.UserID, character, "fetch_failed", "The Jira Activity URL is invalid.")
	}
	query := target.Query()
	query.Set("maxResults", strconv.Itoa(limit))
	target.RawQuery = query.Encode()
	body, status, fetchErr := s.client.AuthedGet(ctx, target.String(), claims.Username, claims.Password, 15*time.Second, 6<<20)
	if errors.Is(fetchErr, ErrAuthFailed) {
		return s.cachedFailure(session.UserID, character, "auth_failed", "Jira authentication failed.")
	}
	if fetchErr != nil {
		return s.cachedFailure(session.UserID, character, "fetch_failed", "Could not reach Jira: "+fetchErr.Error())
	}
	if status < 200 || status >= 300 {
		return s.cachedFailure(session.UserID, character, "fetch_failed", fmt.Sprintf("Jira returned an unexpected status: %d", status))
	}
	feed, err := s.parseFeed(ctx, session.UserID, claims, body)
	if err != nil {
		return s.cachedFailure(session.UserID, character, "fetch_failed", "Could not parse Jira activity: "+err.Error())
	}
	if err = s.writeCache(session.UserID, character, feed); err != nil {
		return ActivityResponse{}, err
	}
	syncHost := s.host
	if claims.Server != "" {
		syncHost = jiraHost(claims.Server)
	}
	_ = s.store.RecordUserJiraSync(ctx, session.UserID, syncHost, s.now().UTC())
	return renderFeed(feed, false, ""), nil
}

func (s *ActivityService) parseFeed(ctx context.Context, userID string, claims CredentialClaims, body []byte) (cachedFeed, error) {
	var source atomFeed
	if err := xml.Unmarshal(body, &source); err != nil {
		return cachedFeed{}, err
	}
	feed := cachedFeed{Updated: normalizeTime(source.Updated, s.now().UTC()).Format(time.RFC3339Nano), Entries: make([]cachedEntry, 0, len(source.Entries))}
	for _, item := range source.Entries {
		published := parseTime(item.Published)
		if published.IsZero() {
			published = parseTime(item.Updated)
		}
		if published.IsZero() {
			published = s.now().UTC()
		}
		titleRaw := firstNonEmpty(item.Title.Text, item.Title.HTML, item.Summary.Text, item.Summary.HTML)
		contentRaw := strings.TrimSpace(firstNonEmpty(item.Content.Text, item.Content.HTML))
		badge := badgeFor(item.Verb, titleRaw)
		issueKey := issueKeyPattern.FindString(strings.ToUpper(stripTags(titleRaw + " " + contentRaw)))
		issueURL := linkForIssue(item.Links, issueKey)
		if parsed, parseErr := url.Parse(issueURL); issueURL != "" && (parseErr != nil || !s.client.allowedURL(parsed)) {
			issueURL = ""
		}
		issueSummary := summaryFor(titleRaw, issueKey)
		categories := make([]string, 0, len(item.Categories))
		for _, category := range item.Categories {
			if value := strings.TrimSpace(category.Term); value != "" {
				categories = append(categories, value)
			}
		}
		author := strings.TrimSpace(item.Author.Name)
		if author != "" && !strings.Contains(author, " ") {
			author = s.resolveUser(ctx, userID, claims, author)
		}
		titleHTML := s.sanitize(titleRaw)
		if author != "" && item.Author.Name != "" && author != item.Author.Name {
			titleHTML = strings.ReplaceAll(titleHTML, html.EscapeString(item.Author.Name), html.EscapeString(author))
		}
		var contentHTML *string
		if contentRaw != "" {
			value := s.sanitize(contentRaw)
			contentHTML = &value
		}
		logged := int64(0)
		if badge == "Logged work" {
			logged = parseDurationSeconds(stripTags(titleRaw + " " + contentRaw))
		}
		feed.Entries = append(feed.Entries, cachedEntry{ID: item.ID, Published: published.UTC().Format(time.RFC3339Nano), Badge: badge,
			IssueKey: issueKey, IssueSummary: issueSummary, IssueURL: issueURL, TitleHTML: titleHTML, ContentHTML: contentHTML,
			Author: author, Categories: categories, LoggedSeconds: logged, TitleText: stripTags(titleRaw), SummaryText: stripTags(firstNonEmpty(item.Summary.Text, item.Summary.HTML)),
			ContentText: stripTags(contentRaw), Verb: item.Verb, Links: item.Links})
	}
	sort.SliceStable(feed.Entries, func(i, j int) bool { return feed.Entries[i].Published > feed.Entries[j].Published })
	return feed, nil
}

func (s *ActivityService) resolveUser(ctx context.Context, userID string, claims CredentialClaims, accountKey string) string {
	if employee, err := s.store.EmployeeByJiraAccount(ctx, accountKey); err == nil && employee != nil {
		return employee.Name
	}
	if cached, ok, err := s.store.JiraUserDisplayName(ctx, userID, s.host, accountKey); err == nil && ok {
		return cached
	}
	server := s.baseURL
	if claims.Server != "" {
		server = strings.TrimRight(claims.Server, "/")
	}
	target := server + "/rest/api/2/user?key=" + url.QueryEscape(accountKey)
	body, status, err := s.client.AuthedGet(ctx, target, claims.Username, claims.Password, 15*time.Second, 1<<20)
	if err != nil || status < 200 || status >= 300 {
		return accountKey
	}
	name := userDisplayName(body)
	if name == "" {
		return accountKey
	}
	_ = s.store.SaveJiraUserDisplayName(ctx, userID, s.host, accountKey, name)
	return name
}

func (s *ActivityService) sanitize(raw string) string {
	raw = html.UnescapeString(strings.TrimSpace(raw))
	raw = dangerousBlockPattern.ReplaceAllString(raw, "")
	return tagPattern.ReplaceAllStringFunc(raw, func(tag string) string {
		parts := tagPattern.FindStringSubmatch(tag)
		if len(parts) < 2 {
			return ""
		}
		name := strings.ToLower(parts[1])
		closing := strings.HasPrefix(strings.TrimSpace(tag), "</")
		switch name {
		case "p", "strong", "em", "ul", "ol", "li", "br", "code":
			if closing {
				return "</" + name + ">"
			}
			if name == "br" {
				return "<br>"
			}
			return "<" + name + ">"
		case "a":
			if closing {
				return "</a>"
			}
			href := hrefPattern.FindStringSubmatch(tag)
			if len(href) != 2 {
				return ""
			}
			parsed, err := url.Parse(html.UnescapeString(href[1]))
			if err != nil || !s.client.allowedURL(parsed) {
				return ""
			}
			return `<a href="` + html.EscapeString(parsed.String()) + `" target="_blank" rel="noopener noreferrer">`
		default:
			return ""
		}
	})
}

func (s *ActivityService) cachePath(userID string, character store.Character) string {
	parts := strings.Fields(strings.ToLower(character.Name))
	first, last := character.ID, character.ID
	if len(parts) > 0 {
		first, last = slug(parts[0]), slug(parts[len(parts)-1])
	}
	return filepath.Join(s.directory, "users", slug(userID), "activity-"+first+"-"+last+".json")
}

func slug(value string) string {
	var out strings.Builder
	for _, char := range strings.ToLower(value) {
		if char >= 'a' && char <= 'z' || char >= '0' && char <= '9' || char == '-' {
			out.WriteRune(char)
		}
	}
	if out.Len() == 0 {
		return "unknown"
	}
	return out.String()
}

func (s *ActivityService) writeCache(userID string, character store.Character, feed cachedFeed) error {
	path := s.cachePath(userID, character)
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	body, err := json.Marshal(feed)
	if err != nil {
		return err
	}
	temporary := path + ".tmp"
	if err = os.WriteFile(temporary, body, 0600); err != nil {
		return err
	}
	return os.Rename(temporary, path)
}

func (s *ActivityService) readCache(userID string, character store.Character) (cachedFeed, error) {
	var feed cachedFeed
	body, err := os.ReadFile(s.cachePath(userID, character))
	if err != nil {
		return feed, err
	}
	err = json.Unmarshal(body, &feed)
	return feed, err
}

func (s *ActivityService) cachedFailure(userID string, character store.Character, reason, message string) (ActivityResponse, error) {
	feed, err := s.readCache(userID, character)
	if err == nil {
		return renderFeed(feed, true, message), nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return ActivityResponse{}, err
	}
	return ActivityResponse{Available: false, Reason: reason, Message: message}, nil
}

func (s *ActivityService) RefreshAll(session Session, claims CredentialClaims, characters []store.Character) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	semaphore := make(chan struct{}, 5)
	var wait sync.WaitGroup
	for _, character := range characters {
		if character.JiraActivityURL == nil || s.cacheFresh(session.UserID, character) {
			continue
		}
		character := character
		wait.Add(1)
		go func() {
			defer wait.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()
			_, _ = s.Fetch(ctx, session, claims, character, 50)
		}()
	}
	wait.Wait()
}

func (s *ActivityService) cacheFresh(userID string, character store.Character) bool {
	info, err := os.Stat(s.cachePath(userID, character))
	return err == nil && s.now().Sub(info.ModTime()) < time.Hour
}

func renderFeed(feed cachedFeed, stale bool, message string) ActivityResponse {
	response := ActivityResponse{Available: true, ActivityCount: len(feed.Entries), Updated: feed.Updated, Days: []ActivityDay{}, LoggedByIssue: []WorklogRollup{}, Stale: stale, Message: message}
	dayIndex := map[string]int{}
	rollups := map[string]*WorklogRollup{}
	for _, item := range feed.Entries {
		published := parseTime(item.Published).Local()
		date := published.Format("2006-01-02")
		index, exists := dayIndex[date]
		if !exists {
			index = len(response.Days)
			dayIndex[date] = index
			response.Days = append(response.Days, ActivityDay{Date: date, Label: published.Format("Jan 2, 2006"), Entries: []ActivityEntry{}})
		}
		entry := ActivityEntry{ID: item.ID, OccurredAt: published.UTC().Format(time.RFC3339Nano), Time: published.Format("15:04"), Badge: item.Badge, IssueKey: item.IssueKey, IssueSummary: item.IssueSummary,
			IssueURL: item.IssueURL, TitleHTML: item.TitleHTML, ContentHTML: item.ContentHTML, Categories: item.Categories, LoggedSeconds: item.LoggedSeconds}
		response.Days[index].Entries = append(response.Days[index].Entries, entry)
		if item.LoggedSeconds > 0 && item.IssueKey != "" {
			rollup := rollups[item.IssueKey]
			if rollup == nil {
				rollup = &WorklogRollup{IssueKey: item.IssueKey, IssueURL: item.IssueURL}
				rollups[item.IssueKey] = rollup
			}
			rollup.Seconds += item.LoggedSeconds
			response.LoggedTotalSeconds += item.LoggedSeconds
		}
	}
	keys := make([]string, 0, len(rollups))
	for key := range rollups {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		value := *rollups[key]
		value.Display = formatDuration(value.Seconds)
		response.LoggedByIssue = append(response.LoggedByIssue, value)
	}
	return response
}

func parseTime(value string) time.Time {
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05.000-0700"} {
		if parsed, err := time.Parse(layout, strings.TrimSpace(value)); err == nil {
			return parsed
		}
	}
	return time.Time{}
}

func normalizeTime(value string, fallback time.Time) time.Time {
	if parsed := parseTime(value); !parsed.IsZero() {
		return parsed.UTC()
	}
	return fallback.UTC()
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func stripTags(value string) string {
	return strings.Join(strings.Fields(html.UnescapeString(tagPattern.ReplaceAllString(value, " "))), " ")
}

func badgeFor(verb, title string) string {
	value := strings.ToLower(verb + " " + stripTags(title))
	switch {
	case strings.Contains(value, "worklog"), strings.Contains(value, "logged work"), strings.Contains(value, "logged time"):
		return "Logged work"
	case strings.Contains(value, "comment"):
		return "Commented"
	case strings.Contains(value, "transition"), strings.Contains(value, "changed the status"), strings.Contains(value, "moved"):
		return "Transitioned"
	case strings.Contains(value, "create"):
		return "Created"
	default:
		return "Updated"
	}
}

func linkForIssue(links []atomLink, key string) string {
	for _, link := range links {
		if strings.EqualFold(link.Rel, "alternate") && (key == "" || strings.Contains(strings.ToUpper(link.Href), key)) {
			return link.Href
		}
	}
	for _, link := range links {
		if key != "" && strings.Contains(strings.ToUpper(link.Href), key) {
			return link.Href
		}
	}
	return ""
}

func summaryFor(title, key string) string {
	plain := stripTags(title)
	if key == "" {
		return plain
	}
	index := strings.Index(strings.ToUpper(plain), key)
	if index < 0 {
		return plain
	}
	value := strings.TrimSpace(plain[index+len(key):])
	value = strings.TrimLeft(value, " :-–—")
	return value
}

func parseDurationSeconds(value string) int64 {
	var total int64
	for _, match := range durationPattern.FindAllStringSubmatch(value, -1) {
		amount, _ := strconv.ParseInt(match[1], 10, 64)
		switch strings.ToLower(match[2])[0] {
		case 'h':
			total += amount * 3600
		case 'm':
			total += amount * 60
		case 's':
			total += amount
		}
	}
	return total
}

func formatDuration(seconds int64) string {
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	if hours > 0 {
		return fmt.Sprintf("%dh %02dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
}
