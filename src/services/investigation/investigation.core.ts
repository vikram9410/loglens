/**
 * Pure-Node investigation logic — used by both the VS Code InvestigationService
 * (which adds LLM integration) and the standalone MCP server (which exposes the
 * structured tools to Claude Code without needing an LLM).
 */
import {
  RepoSchema,
  IssueAnalysisSchema,
  ErrorPattern,
} from '../schema/types';

export function matchIssue(r: RepoSchema, description: string): IssueAnalysisSchema | null {
  const lower = description.toLowerCase();
  let best: {issue: IssueAnalysisSchema; score: number} | null = null;
  for (const issue of r.issueAnalyses.values()) {
    const score = issue.keywords.reduce(
        (acc, kw) => lower.includes(kw.toLowerCase()) ? acc + 1 : acc,
        0,
    );
    if (score > 0 && (!best || score > best.score)) {
      best = {issue, score};
    }
  }
  return best?.issue ?? null;
}

export function inferIssueFromIdType(r: RepoSchema, idType?: string): IssueAnalysisSchema | null {
  if (!idType) return null;
  return Array.from(r.issueAnalyses.values()).find((i) => i.primaryCorrelationId === idType) ?? null;
}

export function safeRegexTest(pattern: string, text: string): boolean {
  try { return new RegExp(pattern, 'i').test(text); } catch { return false; }
}

export function detectModules(r: RepoSchema, logs: string) {
  return r.generalContext.modules
      .filter((m) => m.loggerPatterns.some((p) => safeRegexTest(p, logs)))
      .map((m) => ({id: m.id, name: m.name, correlationPattern: m.correlationPattern}));
}

export function matchErrorPatterns(r: RepoSchema, logs: string): ErrorPattern[] {
  const matches: ErrorPattern[] = [];
  const seen = new Set<string>();
  for (const issue of r.issueAnalyses.values()) {
    for (const ep of issue.errorPatterns) {
      if (seen.has(ep.id)) continue;
      if (safeRegexTest(ep.pattern, logs)) {
        matches.push(ep);
        seen.add(ep.id);
      }
    }
  }
  return matches;
}

export function extractCorrelationKeys(r: RepoSchema, logs: string): {field: string; value: string}[] {
  const results: {field: string; value: string}[] = [];
  for (const k of r.generalContext.correlationKeys) {
    const patterns = [
      new RegExp(`"${k.field}"\\s*:\\s*"([^"]+)"`, 'i'),
      new RegExp(`"${k.field}"\\s*:\\s*([^,}\\s]+)`, 'i'),
      new RegExp(`\\b${k.field}=([^\\s,}]+)`, 'i'),
    ];
    for (const re of patterns) {
      const m = logs.match(re);
      if (m) { results.push({field: k.field, value: m[1]}); break; }
    }
  }
  return results;
}

export function suggestIssues(r: RepoSchema, matchedPatterns: ErrorPattern[]): IssueAnalysisSchema[] {
  const matchedModuleIds = new Set(matchedPatterns.map((p) => p.moduleId).filter(Boolean));
  return Array.from(r.issueAnalyses.values())
      .filter((i) => i.relevantModules.some((m) => matchedModuleIds.has(m)));
}

export function primaryIdHint(idType: string): string {
  const hints: Record<string, string> = {
    'interactionId': 'Look in the agent desktop URL/UI for the active call, or in the interaction record.',
    'conversationSysId': 'On the conversation record. Groups all legs of a call.',
    'sessionId': 'Agent\'s browser cookies, JWT payload, or session store.',
    'requestId': 'Failed API response headers (often `x-request-id`).',
    'callUUID': 'Provided by the telephony system.',
    'uniqueAgentId': 'Agent management screen / agent profile.',
  };
  return hints[idType] || `Find this ID in any log line from the affected operation.`;
}

export function buildLokiQueries(r: RepoSchema, issue: IssueAnalysisSchema, id: string): string[] {
  const k8sNs = r.generalContext.service.k8s_namespace || '<namespace>';
  const modulePatterns = issue.relevantModules.map((mId) => {
    const m = r.generalContext.modules.find((mod) => mod.id === mId);
    return m?.loggerPatterns?.[0] || mId;
  });
  return [
    `{k8s_namespace_name="${k8sNs}"} |= "${id}" | json`,
    `{k8s_namespace_name="${k8sNs}"} |= "${id}" |~ "${modulePatterns.join('|')}"`,
  ];
}
