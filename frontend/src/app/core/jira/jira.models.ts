export type JiraConnectionState = 'connecting' | 'live' | 'reconnecting' | 'stale' | 'disconnected';

export interface JiraConnection {
  state: JiraConnectionState;
  configured: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  message: string;
}

export interface JiraIssueSnapshot {
  issueKey: string;
  summary: string;
  issueType: string;
  status: string;
  statusCategory: string;
  assigneeId: string | null;
  assigneeName: string | null;
  priority: string | null;
  projectKey: string;
  updatedAt: string;
  dueDate: string | null;
  issueUrl: string;
}

export interface JiraActivityEvent {
  eventId: string;
  issueKey: string;
  authorId: string | null;
  authorName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  currentStatus: string | null;
  occurredAt: string;
  issueSummary: string;
  issueUrl: string;
}

export interface JiraSnapshot {
  issues: JiraIssueSnapshot[];
  events: JiraActivityEvent[];
  connection: JiraConnection;
}

export const emptyJiraSnapshot = (): JiraSnapshot => ({
  issues: [],
  events: [],
  connection: {state: 'connecting', configured: false, lastAttemptAt: null, lastSuccessAt: null, message: 'Connecting to shared Jira stream'}
});
