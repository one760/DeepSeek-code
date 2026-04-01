import type { ResumeQueryResult, SessionSummary } from "../core/types.js";
import { listSessionSummaries } from "./storage.js";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function filterSessionSummaries(
  sessions: SessionSummary[],
  query: string
): SessionSummary[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return sessions;
  }

  return sessions.filter((session) => {
    return [session.title, session.workspaceRoot, session.lastPrompt]
      .map(normalize)
      .some((value) => value.includes(normalizedQuery));
  });
}

export async function resolveResumeQuery(query = ""): Promise<ResumeQueryResult> {
  const sessions = await listSessionSummaries();
  const matches = filterSessionSummaries(sessions, query);

  if (matches.length === 0) {
    return {
      type: "none",
      query,
      matches
    };
  }

  if (matches.length === 1) {
    return {
      type: "single",
      query,
      matches: [matches[0]!]
    };
  }

  return {
    type: "multiple",
    query,
    matches
  };
}
