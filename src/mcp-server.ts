#!/usr/bin/env node
/**
 * LogLens MCP Server
 *
 * Exposes LogLens schema-driven log analysis as MCP tools that Claude Code
 * (or any MCP client) can call. The schemas in `.loganalysis/` are loaded at
 * startup; tools provide structured access to repos, issue analyses, error
 * patterns, and the guided investigation flow.
 *
 * Usage:
 *   node mcp-server.mjs --workspace /path/to/your/repo
 *
 * When registered in `.mcp.json`, Claude Code spawns this process and gets:
 *   - list_issue_analyses           (lists issues; handles monorepos by listing across all repos)
 *   - get_general_context
 *   - get_issue_analysis
 *   - start_investigation         (3-step guided flow)
 *   - analyze_logs                (pattern matching — no LLM call)
 *   - scan_codebase_for_loggers   (returns profile for AI schema generation)
 *   - get_schema_template         (returns exact required JSON shape with examples)
 *   - validate_schema             (dry-run validate a JSON string before writing to disk)
 *   - propose_schema_updates      (diff fresh scan vs current schemas + propose targeted updates)
 *   - list_module_files           (returns file list + excerpts for AI module Q&A)
 *   - reload_schemas              (force re-read of schema files from disk)
 *
 * Claude does the actual reasoning; this server only supplies the structured
 * context. No API keys needed in MCP mode.
 */
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import * as path from 'path';
import {SchemaLoader} from './services/schema/schema.loader';
import {RepoSchema, IssueAnalysisSchema} from './services/schema/types';
import {
  matchIssue,
  inferIssueFromIdType,
  detectModules,
  matchErrorPatterns,
  extractCorrelationKeys,
  suggestIssues,
  primaryIdHint,
  buildLokiQueries,
} from './services/investigation/investigation.core';

// ─── Parse CLI args ──────────────────────────────────────────────────────────
function parseArgs(): {workspace: string; schemaFolder: string} {
  const args = process.argv.slice(2);
  let workspace = process.cwd();
  let schemaFolder = '.loganalysis';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--workspace' && args[i + 1]) {
      workspace = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--schema-folder' && args[i + 1]) {
      schemaFolder = args[i + 1];
      i++;
    }
  }
  return {workspace, schemaFolder};
}

const {workspace, schemaFolder} = parseArgs();
const loader = new SchemaLoader(schemaFolder);
let repos: Map<string, RepoSchema> = new Map();
let lastLoadTime = 0;
const RELOAD_THROTTLE_MS = 200;

// Track the last load's validation errors so tools can include them in their
// responses (otherwise they only go to stderr where Claude never sees them).
let lastLoadErrors: {file: string; dir: string; message: string}[] = [];

/**
 * Re-reads schemas from disk. Throttled to avoid hammering disk on rapid
 * tool calls; schema files are tiny but every tool call invoking this would
 * otherwise re-read on every key press during testing.
 *
 * If Claude writes new schema files via its file-edit tools, calling
 * ensureFreshSchemas() on the NEXT tool invocation picks them up.
 */
async function ensureFreshSchemas(force = false): Promise<void> {
  if (!force && Date.now() - lastLoadTime < RELOAD_THROTTLE_MS) return;
  const result = await loader.loadFromRoots([workspace]);
  repos = result.repos;
  lastLoadErrors = result.errors;
  lastLoadTime = Date.now();
  if (result.errors.length > 0) {
    process.stderr.write(`LogLens MCP: ${result.errors.length} schema validation error(s):\n`);
    for (const err of result.errors) {
      process.stderr.write(`  - ${err.file} in ${err.dir}: ${err.message.slice(0, 300)}\n`);
    }
  }
}

async function describeSchemaFolderForDiagnostic(): Promise<string> {
  const {readdir, stat} = await import('fs/promises');
  const dir = path.join(workspace, schemaFolder);
  const lines: string[] = [`Schema folder path: ${dir}`];
  try {
    const entries = await readdir(dir, {withFileTypes: true});
    if (entries.length === 0) {
      lines.push('  (folder is empty)');
    } else {
      lines.push('  Contents:');
      for (const e of entries) {
        const abs = path.join(dir, e.name);
        try {
          const s = await stat(abs);
          lines.push(`    - ${e.name}${e.isDirectory() ? '/' : ''}  (${s.size} bytes)`);
        } catch {
          lines.push(`    - ${e.name}`);
        }
      }
    }
  } catch (e) {
    lines.push(`  (folder does not exist or is not readable: ${(e as Error).message})`);
  }
  return lines.join('\n');
}

await ensureFreshSchemas(true); // initial load

async function resolveRepo(name?: string): Promise<RepoSchema> {
  await ensureFreshSchemas();
  if (repos.size === 0) {
    throw new Error(
        `No schemas found in workspace "${workspace}" (looking for "${schemaFolder}/" folder). ` +
      `If you just generated schemas, ensure they were written to: ${path.join(workspace, schemaFolder)}`,
    );
  }
  if (name && repos.has(name)) return repos.get(name)!;
  if (!name && repos.size === 1) return Array.from(repos.values())[0];
  throw new Error(
      name ?
        `Repo "${name}" not found. Available: ${Array.from(repos.keys()).join(', ')}` :
        `Multiple repos available — specify one: ${Array.from(repos.keys()).join(', ')}`,
  );
}

// ─── MCP Server ──────────────────────────────────────────────────────────────
const server = new McpServer({name: 'loglens', version: '0.1.0'});

server.tool(
    'reload_schemas',
    'Force a re-read of all schema files from disk. Call this if you just wrote new schemas and need them picked up immediately. Returns diagnostic info if schemas still fail to load.',
    {},
    async () => {
      await ensureFreshSchemas(true);
      const count = repos.size;

      if (count > 0 && lastLoadErrors.length === 0) {
        return {content: [{type: 'text' as const, text:
          `Reloaded. ${count} repo schema(s) now loaded: ${Array.from(repos.keys()).join(', ')}`,
        }]};
      }

      // Failure or partial — give full diagnostic
      const lines = [
        count === 0 ?
          `Reloaded — but NO schemas were successfully loaded.` :
          `Reloaded. ${count} repo schema(s) loaded: ${Array.from(repos.keys()).join(', ')} — but with errors below.`,
        '',
        '## Folder Inspection',
        await describeSchemaFolderForDiagnostic(),
        '',
      ];

      if (lastLoadErrors.length > 0) {
        lines.push('## Validation Errors');
        for (const err of lastLoadErrors) {
          lines.push(`- **${err.file}** in \`${err.dir}\`:`);
          lines.push('  ```');
          lines.push('  ' + err.message.slice(0, 800).replace(/\n/g, '\n  '));
          lines.push('  ```');
        }
        lines.push('');
      }

      if (count === 0 && lastLoadErrors.length === 0) {
        lines.push('## Likely cause');
        lines.push(`The schema folder is missing **manifest.json** or it does not exist at all.`);
        lines.push(`Expected: \`${path.join(workspace, schemaFolder, 'manifest.json')}\``);
        lines.push(``);
        lines.push('Ensure your manifest.json has this structure:');
        lines.push('```json');
        lines.push('{');
        lines.push('  "repo": "<repo-name>",');
        lines.push('  "description": "...",');
        lines.push('  "generalContext": "general-context-schema.json",');
        lines.push('  "issueAnalyses": [{ "id": "...", "name": "...", "file": "...", "keywords": [...], "primaryCorrelationId": "..." }]');
        lines.push('}');
        lines.push('```');
      }

      return {content: [{type: 'text' as const, text: lines.join('\n')}]};
    },
);

server.tool(
    'list_issue_analyses',
    'List all issue analysis categories. ' +
  'In a single-repo workspace, lists the repo\'s issues directly. ' +
  'In a monorepo with multiple .loganalysis/ folders, lists issues grouped by repo. ' +
  'Pass `repo` to filter to one repo when multiple exist.',
    {repo: z.string().optional()},
    async ({repo}) => {
      await ensureFreshSchemas();

      if (repos.size === 0) {
        return {content: [{type: 'text' as const, text:
          `No schemas found in workspace "${workspace}" (looking for "${schemaFolder}/" folder).\n\n` +
          `Ask Claude Code: "Use LogLens scan_codebase_for_loggers to scan this repo" to generate one.`,
        }]};
      }

      // Single repo OR a specific repo requested → show that one
      if (repo || repos.size === 1) {
        const r = await resolveRepo(repo);
        const lines = [
          `## Issue Analyses for \`${r.repo}\``,
          r.generalContext.service.description,
          '',
          '| ID | Name | Primary ID | Keywords |',
          '|----|------|-----------|----------|',
          ...Array.from(r.issueAnalyses.values()).map((i) =>
            `| \`${i.id}\` | ${i.name} | \`${i.primaryCorrelationId}\` | ${i.keywords.slice(0, 5).join(', ')} |`,
          ),
        ];
        return {content: [{type: 'text' as const, text: lines.join('\n')}]};
      }

      // Multi-repo (monorepo) → group by repo
      const lines: string[] = [
        `# Issue Analyses (${repos.size} repos detected in this workspace)`,
        '',
        'Pass `repo` parameter to filter to one repo for subsequent calls.',
        '',
      ];
      for (const r of repos.values()) {
        lines.push(`## \`${r.repo}\``);
        lines.push(r.generalContext.service.description);
        lines.push('');
        lines.push('| ID | Name | Primary ID | Keywords |');
        lines.push('|----|------|-----------|----------|');
        for (const i of r.issueAnalyses.values()) {
          lines.push(`| \`${i.id}\` | ${i.name} | \`${i.primaryCorrelationId}\` | ${i.keywords.slice(0, 5).join(', ')} |`);
        }
        lines.push('');
      }
      return {content: [{type: 'text' as const, text: lines.join('\n')}]};
    },
);

server.tool(
    'get_general_context',
    'Get the general context for a repo: service overview, correlation keys, modules, noise filters, AI prompt template.',
    {repo: z.string().optional()},
    async ({repo}) => {
      const r = await resolveRepo(repo);
      const c = r.generalContext;
      return {content: [{type: 'text' as const, text: [
        `# ${c.service.name}`,
        c.service.description,
        `Stack: ${c.service.stack ?? 'n/a'} | K8s namespace: ${c.service.k8s_namespace ?? 'n/a'}`,
        '',
        '## Correlation Keys',
        c.correlationKeys.map((k) =>
          `${k.priority}. \`${k.field}\` (${k.scope}) — ${k.description}`,
        ).join('\n'),
        '',
        '## Modules',
        c.modules.map((m) => `- \`${m.id}\` (${m.name}) — loggers: ${m.loggerPatterns.join(', ')} — ${m.purpose}`).join('\n'),
        '',
        '## Noise (exclude from analysis)',
        c.noiseFilters.patterns.map((p) => `- \`${p.pattern}\` — ${p.reason}`).join('\n'),
        '',
        '## AI System Prompt Template',
        '```',
        c.aiPromptInstructions.systemPromptTemplate,
        '```',
      ].join('\n')}]};
    },
);

server.tool(
    'get_issue_analysis',
    'Load the full analysis schema for one issue type (voice-call, recording, etc.).',
    {issueId: z.string(), repo: z.string().optional()},
    async ({issueId, repo}) => {
      const r = await resolveRepo(repo);
      const i = r.issueAnalyses.get(issueId);
      if (!i) {
        return {content: [{type: 'text' as const, text:
          `Issue "${issueId}" not found in repo "${r.repo}".\nAvailable: ${Array.from(r.issueAnalyses.keys()).join(', ')}`,
        }]};
      }
      return {content: [{type: 'text' as const, text: renderIssue(i)}]};
    },
);

server.tool(
    'start_investigation',
    'Guided investigation flow. Start with no args to see categories. ' +
  'Provide issueDescription to auto-match. Provide correlationId to get full investigation context.',
    {
      issueDescription: z.string().optional().describe('Plain-language description e.g. "agent says mute not working"'),
      correlationId: z.string().optional().describe('The ID the previous step asked for'),
      correlationIdType: z.string().optional().describe('Type of ID provided (interactionId, sessionId, etc.)'),
      repo: z.string().optional(),
    },
    async ({issueDescription, correlationId, correlationIdType, repo}) => {
      await ensureFreshSchemas();
      if (!issueDescription && !correlationId) {
        return {content: [{type: 'text' as const, text: renderCategoryListAcrossRepos()}]};
      }

      const r = await resolveRepo(repo);
      const issue = issueDescription ? matchIssue(r, issueDescription) : null;

      if (issueDescription && !correlationId) {
        if (!issue) {
          return {content: [{type: 'text' as const, text:
            `No category matched "${issueDescription}" in repo \`${r.repo}\`.\n\nAvailable:\n` +
            Array.from(r.issueAnalyses.values()).map((i) =>
              `- ${i.name} — keywords: ${i.keywords.slice(0, 5).join(', ')}`,
            ).join('\n'),
          }]};
        }
        return {content: [{type: 'text' as const, text: renderAskForId(issue, issueDescription)}]};
      }

      if (correlationId) {
        const matched = issue || inferIssueFromIdType(r, correlationIdType);
        if (!matched) {
          return {content: [{type: 'text' as const, text:
            'Please provide issueDescription so I can match the right investigation flow.',
          }]};
        }
        return {content: [{type: 'text' as const, text: renderFullContext(r, matched, correlationId, correlationIdType)}]};
      }

      return {content: [{type: 'text' as const, text: 'Unexpected input.'}]};
    },
);

server.tool(
    'analyze_logs',
    'Run pattern-matching analysis on raw log lines. Detects modules, matches known error patterns, extracts correlation keys.',
    {
      logs: z.string().describe('Raw log lines'),
      repo: z.string().optional(),
    },
    async ({logs, repo}) => {
      const r = await resolveRepo(repo);
      const detected = detectModules(r, logs);
      const matched = matchErrorPatterns(r, logs);
      const extracted = extractCorrelationKeys(r, logs);
      const suggested = suggestIssues(r, matched);

      return {content: [{type: 'text' as const, text: [
        `# Log Analysis — ${r.repo}`,
        '',
        '## Detected Modules',
        detected.length > 0 ?
          detected.map((m) => `- ${m.name}: ${m.correlationPattern ?? ''}`).join('\n') :
          '_None detected_',
        '',
        '## Extracted Correlation Keys',
        extracted.length > 0 ?
          extracted.map((k) => `- \`${k.field}\` = \`${k.value}\``).join('\n') :
          '_None_',
        '',
        '## Matched Error Patterns',
        matched.length > 0 ?
          matched.map((p) => [
            `### [${p.id}] ${p.description}`,
            `- Root cause: ${p.rootCause}`,
            `- Investigation steps:`,
            p.investigationSteps.map((s) => `  - ${s}`).join('\n'),
          ].join('\n')).join('\n\n') :
          '_No known patterns matched_',
        '',
        '## Suggested Issue Analyses',
        suggested.length > 0 ?
          suggested.map((i) => `- \`${i.id}\` — ${i.name}`).join('\n') :
          '_None_',
      ].join('\n')}]};
    },
);

// ─── Tool: scan_codebase_for_loggers ──────────────────────────────────────────
server.tool(
    'scan_codebase_for_loggers',
    'Scan the workspace codebase for logger statements, error patterns, and correlation field candidates. ' +
  'Returns a JSON profile that you can use to generate a starter .loganalysis schema. ' +
  'After scanning: use get_schema_template to see the exact required shape, generate the files, ' +
  'optionally call validate_schema to check before writing, then write them with your file-edit tools. ' +
  'Finally call reload_schemas to make LogLens pick them up.',
    {
      maxLoggerSamples: z.number().optional().describe('Max logger call samples to return (default 80)'),
      includeCatchBlocks: z.boolean().optional().describe('Include catch-block samples (default true)'),
    },
    async ({maxLoggerSamples = 80, includeCatchBlocks = true}) => {
      const profile = await scanCodebase(workspace, maxLoggerSamples, includeCatchBlocks);
      const schemaDir = path.join(workspace, schemaFolder);
      return {content: [{type: 'text' as const, text:
        '## Codebase Profile (for schema generation)\n\n' +
        '```json\n' + JSON.stringify(profile, null, 2) + '\n```\n\n' +
        '## Required Workflow (in this exact order)\n\n' +
        '**1. Get the exact schema shape:** call `get_schema_template` to see required field names + a valid example.\n\n' +
        '**2. Generate the JSON content** based on the profile above and the template shape.\n\n' +
        `**3. Write to disk** at \`${schemaDir}\` using your file-edit tools. The folder layout MUST be:\n` +
        '```\n' +
        '.loganalysis/\n' +
        '├── manifest.json                       ← REQUIRED at this exact path\n' +
        '├── general-context-schema.json         ← REQUIRED at this exact path\n' +
        '└── <issue-id>-analysis-schema.json     ← one per issue category\n' +
        '```\n' +
        'Issue files CAN be in a subfolder (e.g. `issues/voice-call.json`) only if the manifest references them by that relative path.\n\n' +
        '**4. (Recommended) Call `validate_schema`** with each file content to catch errors BEFORE writing.\n\n' +
        '**5. After writing, call `reload_schemas`** so LogLens picks up the new files.\n\n' +
        '## Guidance for content\n' +
        '- Group logger samples by file/module → identify 3–8 issue categories\n' +
        '- Each issue category needs: `id` (kebab-case), `keywords[]` (so users can match it in chat), `primaryCorrelationId` (from `correlationFieldCandidates`), at least one entry in `errorPatterns[]`\n' +
        '- Pattern regex should match the actual error message text from the logger samples — not generic',
      }]};
    },
);

// ─── Tool: get_schema_template ────────────────────────────────────────────────
server.tool(
    'get_schema_template',
    'Returns the exact required JSON shape for manifest.json, general-context-schema.json, and ' +
  'an issue-analysis schema. Call this BEFORE generating schema files so you know which field names ' +
  'are required vs optional and how the files reference each other.',
    {},
    async () => {
      const exampleManifest = {
        repo: 'my-service',
        description: 'Short description of the service',
        generalContext: 'general-context-schema.json',
        issueAnalyses: [
          {
            id: 'api-errors',
            name: 'API Errors',
            file: 'api-errors-analysis-schema.json',
            keywords: ['error', '500', 'timeout'],
            primaryCorrelationId: 'requestId',
          },
        ],
      };

      const exampleGeneralContext = {
        repo: 'my-service',
        service: {
          name: 'my-service',
          description: 'HTTP API service',
          stack: 'Node.js / Express',
          k8s_namespace: 'prod',
        },
        correlationKeys: [
          {
            field: 'requestId',
            priority: 1,
            scope: 'single-http-request',
            description: 'Per-request ID across all middleware',
            presentIn: ['api'],
          },
        ],
        modules: [
          {
            id: 'api',
            name: 'API Layer',
            loggerPatterns: ['api\\..*'],
            purpose: 'HTTP request handlers',
            fields: [
              {name: 'requestId', type: 'string', required: true, description: 'Request ID'},
            ],
          },
        ],
        noiseFilters: {
          patterns: [{pattern: 'healthcheck', reason: 'High-frequency liveness probe'}],
        },
        logLevels: {
          exception: {priority: 1, description: 'Stack-traced error', action: 'always'},
          error: {priority: 2, description: 'Error without stack', action: 'always'},
          warn: {priority: 3, description: 'Recoverable issue', action: 'when-intermittent'},
          info: {priority: 4, description: 'Lifecycle event', action: 'for-timeline'},
          debug: {priority: 5, description: 'Detailed trace', action: 'dev-only'},
        },
        aiPromptInstructions: {
          systemPromptTemplate: 'You are an expert in my-service logs. Use the schema context to identify root causes.',
          outputFormat: {
            incidentSummary: 'One sentence describing the issue',
            rootCause: 'Most likely root cause',
            investigationSteps: 'Next steps to confirm',
          },
        },
      };

      const exampleIssue = {
        id: 'api-errors',
        name: 'API Errors',
        description: 'HTTP API failures (500s, timeouts)',
        keywords: ['error', '500', 'timeout', 'crash'],
        primaryCorrelationId: 'requestId',
        primaryIdPrompt: 'Please share the requestId from the failed response.',
        secondaryCorrelationIds: [
          {id: 'sessionId', useWhen: 'When you only have the user session'},
        ],
        relevantModules: ['api'],
        logQueriesToRun: [
          'Filter logs by requestId in api module',
          'Check status codes in TelephonyApi logs',
        ],
        errorPatterns: [
          {
            id: 'API-001',
            moduleId: 'api',
            moduleName: 'API Layer',
            pattern: 'status\\s*5\\d\\d',
            level: 'exception',
            description: 'Server error',
            rootCause: 'Unhandled exception in handler',
            correlationFields: ['requestId'],
            investigationSteps: [
              'Check exception logs at same requestId',
              'Find the throw site in the stack trace',
            ],
          },
        ],
        playbooks: [
          {
            id: 'PLAY-API-001',
            title: 'API returns 500',
            symptoms: ['Client sees 500 response'],
            steps: ['Find requestId', 'Search logs', 'Identify the throwing line'],
            keyFields: ['requestId'],
            modulesInvolved: ['api'],
          },
        ],
        detailedFieldsToWatch: [],
      };

      return {content: [{type: 'text' as const, text: [
        '# Schema Template — Required Shape',
        '',
        'Write three kinds of files. Field names and shape MUST match the examples below. ' +
        'Most non-`id` / non-`repo` fields are optional (they get safe defaults), but use these names exactly when you DO include them.',
        '',
        '## manifest.json (required)',
        '',
        '```json',
        JSON.stringify(exampleManifest, null, 2),
        '```',
        '',
        '**Required fields:** `repo`, `issueAnalyses[].id`, `issueAnalyses[].file`. Everything else is optional.',
        '**`file`** can be a relative path (e.g. `"issues/api-errors.json"`) — but the file must exist at that path under `.loganalysis/`.',
        '',
        '## general-context-schema.json (required)',
        '',
        '```json',
        JSON.stringify(exampleGeneralContext, null, 2),
        '```',
        '',
        '**Required fields:** `repo`, `service.name`. Everything else is optional.',
        '',
        '## <issue-id>-analysis-schema.json (one per issue)',
        '',
        '```json',
        JSON.stringify(exampleIssue, null, 2),
        '```',
        '',
        '**Required fields:** `id`, each `errorPatterns[].id`, each `errorPatterns[].pattern`. Everything else is optional.',
        '',
        '## Final Step',
        'After writing the files, ALWAYS call `reload_schemas` so LogLens picks them up immediately.',
      ].join('\n')}]};
    },
);

// ─── Tool: validate_schema ────────────────────────────────────────────────────
server.tool(
    'validate_schema',
    'Validate a JSON object against the LogLens schema shape WITHOUT writing it to disk. ' +
  'Use this BEFORE writing schema files to catch missing required fields or wrong field names. ' +
  'Returns "valid" or a list of issues.',
    {
      kind: z.enum(['manifest', 'general-context', 'issue-analysis']).describe('Which schema to validate against'),
      json: z.string().describe('The JSON content to validate, as a string'),
    },
    async ({kind, json}) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (e) {
        return {content: [{type: 'text' as const, text:
          `❌ Invalid JSON: ${(e as Error).message}\n\nFix the JSON syntax and try again.`,
        }]};
      }

      const validators: Record<string, {parse: (v: unknown) => unknown}> = {
        'manifest': (await import('./services/schema/validation.js')).ManifestZ,
        'general-context': (await import('./services/schema/validation.js')).GeneralContextSchemaZ,
        'issue-analysis': (await import('./services/schema/validation.js')).IssueAnalysisSchemaZ,
      };

      const validator = validators[kind];
      try {
        validator.parse(parsed);
        return {content: [{type: 'text' as const, text:
          `✅ Valid ${kind} schema. Safe to write to disk.`,
        }]};
      } catch (e) {
        return {content: [{type: 'text' as const, text:
          `❌ Validation failed for ${kind} schema.\n\n\`\`\`\n${(e as Error).message}\n\`\`\`\n\n` +
          `Call \`get_schema_template\` to see the expected shape, then retry.`,
        }]};
      }
    },
);

// ─── Tool: propose_schema_updates ─────────────────────────────────────────────
server.tool(
    'propose_schema_updates',
    'Propose updates to the existing .loganalysis/ schemas. Two modes:\n' +
  '  (1) "drift check" — call with no args to scan the whole codebase and report which logger ' +
  'namespaces and error messages aren\'t covered by current schemas (good after a release or quarterly).\n' +
  '  (2) "targeted update" — pass description (and optionally targetPath) to focus the scan on a ' +
  'specific new feature/module. Returns a concrete proposal: which issues to add, which to extend.',
    {
      description: z.string().optional().describe(
          'Optional: what is new or changed. Examples: "we added a payment webhook module", ' +
        '"we now use Stripe SDK and need to track timeout/rate-limit errors". ' +
        'Omit for a generic drift check.',
      ),
      targetPath: z.string().optional().describe(
          'Optional: focus the scan on this folder (relative or absolute path). ' +
        'If omitted, scans the entire workspace.',
      ),
      maxLoggerSamples: z.number().optional().describe('Max logger samples to consider (default 60)'),
    },
    async ({description, targetPath, maxLoggerSamples = 60}) => {
      const effectiveDescription = description ||
        '(no description provided — running a drift check over the whole codebase to find logger namespaces and error messages not covered by current schemas)';
      const isDriftCheck = !description;
      const scanRoot = targetPath ?
        (path.isAbsolute(targetPath) ? targetPath : path.join(workspace, targetPath)) :
        workspace;

      const profile = await scanCodebase(scanRoot, maxLoggerSamples, true);

      // Load current schemas (fresh)
      await ensureFreshSchemas();
      const currentRepo = repos.size === 1 ? Array.from(repos.values())[0] : null;

      // Compute what's "new" by comparing scan against current schemas
      const newLoggerNamespaces: string[] = [];
      const newErrorMessages: typeof profile.loggerCallSamples = [];

      if (currentRepo) {
        const existingPatterns = Array.from(currentRepo.issueAnalyses.values())
            .flatMap((i) => i.errorPatterns.map((ep) => ep.pattern));
        const existingLoggerPatterns = currentRepo.generalContext.modules
            .flatMap((m) => m.loggerPatterns || []);

        for (const sample of profile.loggerCallSamples) {
          // Does this message already match a known pattern?
          const matched = existingPatterns.some((p) => {
            try { return new RegExp(p, 'i').test(sample.messagePreview); } catch { return false; }
          });
          if (!matched && (sample.level === 'error' || sample.level === 'exception' || sample.level === 'warn')) {
            newErrorMessages.push(sample);
          }
        }

        // Does this file's logger namespace match any existing module pattern?
        const filesSeen = new Set<string>();
        for (const sample of profile.loggerCallSamples) {
          if (filesSeen.has(sample.file)) continue;
          filesSeen.add(sample.file);
          const matched = existingLoggerPatterns.some((p) => {
            try { return new RegExp(p, 'i').test(sample.file); } catch { return false; }
          });
          if (!matched) newLoggerNamespaces.push(sample.file);
        }
      }

      const proposalSection: string[] = [];
      const currentIssueIds = currentRepo ?
        Array.from(currentRepo.issueAnalyses.keys()) :
        [];

      proposalSection.push('## Proposal Summary');
      if (!currentRepo) {
        proposalSection.push('⚠️ No existing schemas found. This is a first-time generation, not an update.');
        proposalSection.push('Call `get_schema_template` and proceed with a full schema generation.');
      } else {
        proposalSection.push(`Current repo: \`${currentRepo.repo}\` with ${currentRepo.issueAnalyses.size} existing issue(s): ${currentIssueIds.join(', ')}`);
        proposalSection.push('');
        proposalSection.push(`**New logger namespaces detected** (not covered by any current module): ${newLoggerNamespaces.slice(0, 10).join(', ') || '(none)'}`);
        proposalSection.push(`**Error/warn messages not matched by any current pattern:** ${newErrorMessages.length} found.`);
      }

      return {content: [{type: 'text' as const, text: [
        isDriftCheck ? '# Schema Drift Check' : '# Proposed Schema Updates',
        '',
        `**Description:** ${effectiveDescription}`,
        `**Scan root:** ${scanRoot}`,
        '',
        ...proposalSection,
        '',
        '## Unmatched Error/Warn Samples (highest-value additions)',
        newErrorMessages.length > 0 ?
          newErrorMessages.slice(0, 30).map((s) =>
            `- [${s.level}] \`${s.file}:${s.line}\` — "${s.messagePreview}"`,
          ).join('\n') :
          '_All recent error/warn samples are already covered by existing patterns._',
        '',
        '## Full Scan Profile (for context)',
        '```json',
        JSON.stringify({
          loggerLibraries: profile.loggerLibraries,
          topLevelModules: profile.topLevelModules.slice(0, 10),
          correlationFieldCandidates: profile.correlationFieldCandidates.slice(0, 15),
          totalSamples: profile.loggerCallSamples.length,
        }, null, 2),
        '```',
        '',
        '## Recommended Action',
        currentRepo ? [
          isDriftCheck ?
            'No specific description given — review the unmatched samples above. If any cluster around a particular module or feature, suggest a focused follow-up by re-calling `propose_schema_updates` with a `description` and optional `targetPath`. Then choose ONE of these patterns:' :
            'Based on the user description **"' + description + '"** and the unmatched samples above, choose ONE:',
          '',
          '### Option A — Extend an existing issue analysis',
          'If the new module is conceptually similar to an existing issue category:',
          '1. Pick the closest matching issue from: ' + currentIssueIds.join(', '),
          '2. Call `get_issue_analysis` for that ID to see its current `errorPatterns[]`',
          '3. Append new entries to `errorPatterns[]` for the unmatched samples',
          '4. (Recommended) Call `validate_schema` with the updated JSON',
          '5. Write the updated file with your file-edit tools',
          '6. Call `reload_schemas`',
          '',
          '### Option B — Create a new issue analysis',
          'If the new module is a distinct concern (e.g. a new payments feature):',
          '1. Call `get_schema_template` if you need a refresher on the shape',
          '2. Create `<new-id>-analysis-schema.json` in `.loganalysis/` (or in a subfolder if the manifest references it that way)',
          `3. Update \`manifest.json\` to add the new issue under \`issueAnalyses[]\` with file = "<new-id>-analysis-schema.json"`,
          '4. (Recommended) Call `validate_schema` on both the new file and the updated manifest',
          '5. Write both files',
          '6. Call `reload_schemas`',
          '',
          '### Option C — Add a new module (if the new code is its own logical layer)',
          'If the user introduced a whole new code module (e.g. a `webhook` layer):',
          '1. Call `get_general_context` to see existing `modules[]`',
          '2. Add a new entry under `modules[]` with: id, loggerPatterns (regex matching the new namespaces above), purpose',
          '3. Write the updated general-context-schema.json',
          '4. Then proceed with Option A or B to cover the actual error patterns',
          '5. Validate + reload',
        ].join('\n') : 'No existing schemas — start fresh per the proposal summary above.',
      ].join('\n')}]};
    },
);

// ─── Tool: list_module_files ──────────────────────────────────────────────────
server.tool(
    'list_module_files',
    'For a given module folder, return file list + structural excerpts (exports, classes, top-level functions). ' +
  'Use this when the user asks Claude Code to explain a specific module or folder in the codebase.',
    {
      modulePath: z.string().describe('Absolute or workspace-relative path to the module folder'),
      maxFiles: z.number().optional().describe('Max files to sample (default 40)'),
    },
    async ({modulePath, maxFiles = 40}) => {
      const abs = path.isAbsolute(modulePath) ? modulePath : path.join(workspace, modulePath);
      const result = await scanModuleFiles(abs, maxFiles);
      return {content: [{type: 'text' as const, text:
        `## Module: ${abs}\n\n` +
        `File count (sampled): ${result.files.length} (of ${result.totalFiles} total code files)\n` +
        `Total bytes sampled: ${result.totalBytes}${result.truncated ? ' (truncated)' : ''}\n\n` +
        '### Files (sorted by size)\n' +
        result.files.map((f) => `- ${path.relative(abs, f.absolutePath)} (${f.bytes} bytes)`).join('\n') +
        '\n\n### Structural Excerpts\n' +
        result.excerpts,
      }]};
    },
);

// ─── Codebase scanning helpers (no LLM, pure Node) ────────────────────────────
interface CodebaseProfile {
  rootPath: string;
  rootPackageInfo: {name?: string; description?: string; main?: string};
  loggerLibraries: string[];
  loggerCallSamples: {file: string; line: number; level: string; messagePreview: string}[];
  catchBlockSamples: {file: string; line: number; messagePreview: string}[];
  correlationFieldCandidates: string[];
  topLevelModules: {name: string; path: string; fileCount: number}[];
}

const SCAN_EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.git',
  '.next', '__pycache__', '.venv', 'target', 'out',
]);
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java',
  '.rs', '.rb', '.cs', '.kt', '.swift', '.php', '.cpp', '.c',
]);
const LOGGER_LIBRARY_HINTS: {hint: string; library: string}[] = [
  {hint: '@tsed/logger', library: '@tsed/logger'},
  {hint: 'winston', library: 'winston'},
  {hint: 'pino', library: 'pino'},
  {hint: 'log4js', library: 'log4js'},
  {hint: 'bunyan', library: 'bunyan'},
  {hint: 'logback', library: 'logback (Java)'},
  {hint: 'slf4j', library: 'slf4j (Java)'},
  {hint: 'logging.Logger', library: 'Python logging'},
  {hint: 'zap.', library: 'go.uber.org/zap'},
  {hint: 'logrus', library: 'sirupsen/logrus'},
];
const LOGGER_CALL_REGEX = /\blogger\.(error|exception|warn|info|debug|fatal)\(['"`]([^'"`]+)['"`]/g;
const CATCH_BLOCK_REGEX = /catch\s*\(\s*\w+(?:\s*:\s*\w+)?\s*\)\s*\{/g;

async function scanCodebase(
    root: string,
    maxLoggerSamples: number,
    includeCatchBlocks: boolean,
): Promise<CodebaseProfile> {
  const {readFile, readdir} = await import('fs/promises');
  const libs = new Set<string>();
  const calls: CodebaseProfile['loggerCallSamples'] = [];
  const catches: CodebaseProfile['catchBlockSamples'] = [];
  const fields = new Set<string>();
  const moduleMap = new Map<string, {path: string; fileCount: number}>();
  const rootPackageInfo = await readPackageInfo(root);

  const fieldRegexes = [
    /\b(\w*[Ii]d)\b/g,
    /\b(\w*[Uu]uid)\b/g,
    /\b(requestId|reqId|traceId|sessionId|correlationId|callUUID|tenantId|userId)\b/g,
  ];

  async function walk(dir: string, depth = 0): Promise<void> {
    if (depth > 6) return;
    let entries: import('fs').Dirent[];
    try {
      entries = await readdir(dir, {withFileTypes: true});
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SCAN_EXCLUDE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        await walk(abs, depth + 1);
        continue;
      }
      if (!entry.isFile() || !CODE_EXTENSIONS.has(path.extname(entry.name))) continue;

      let content: string;
      try {
        content = await readFile(abs, 'utf-8');
      } catch {
        continue;
      }

      for (const h of LOGGER_LIBRARY_HINTS) {
        if (content.includes(h.hint)) libs.add(h.library);
      }

      const rel = path.relative(root, abs);
      const topLevel = rel.split(path.sep)[0];
      if (topLevel && topLevel !== 'src') {
        const e = moduleMap.get(topLevel) || {path: topLevel, fileCount: 0};
        e.fileCount++;
        moduleMap.set(topLevel, e);
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        LOGGER_CALL_REGEX.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LOGGER_CALL_REGEX.exec(line)) !== null) {
          if (calls.length < maxLoggerSamples * 2) {
            calls.push({file: rel, line: i + 1, level: m[1], messagePreview: m[2].slice(0, 120)});
          }
        }
        if (includeCatchBlocks) {
          CATCH_BLOCK_REGEX.lastIndex = 0;
          if (CATCH_BLOCK_REGEX.test(line)) {
            const next = lines.slice(i, i + 3).join(' ').trim();
            if (catches.length < 50) catches.push({file: rel, line: i + 1, messagePreview: next.slice(0, 150)});
          }
        }
      }

      for (const re of fieldRegexes) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
          const field = m[1];
          if (field.length >= 3 && field.length <= 30) fields.add(field);
        }
      }
    }
  }

  await walk(root);

  // Prioritize: error/exception samples first, then warn, then debug/info
  const levelPriority: Record<string, number> = {exception: 0, error: 1, warn: 2, info: 3, debug: 4, fatal: 0};
  calls.sort((a, b) => (levelPriority[a.level] ?? 5) - (levelPriority[b.level] ?? 5));

  return {
    rootPath: root,
    rootPackageInfo,
    loggerLibraries: Array.from(libs),
    loggerCallSamples: calls.slice(0, maxLoggerSamples),
    catchBlockSamples: catches,
    correlationFieldCandidates: Array.from(fields).slice(0, 20),
    topLevelModules: Array.from(moduleMap.entries()).map(([name, v]) => ({name, ...v})),
  };
}

async function readPackageInfo(root: string): Promise<CodebaseProfile['rootPackageInfo']> {
  try {
    const {readFile} = await import('fs/promises');
    const txt = await readFile(path.join(root, 'package.json'), 'utf-8');
    const j = JSON.parse(txt);
    return {name: j.name, description: j.description, main: j.main};
  } catch {
    return {};
  }
}

async function scanModuleFiles(modulePath: string, maxFiles: number): Promise<{
  files: {absolutePath: string; bytes: number}[];
  totalFiles: number;
  excerpts: string;
  totalBytes: number;
  truncated: boolean;
}> {
  const {readFile, readdir, stat} = await import('fs/promises');
  const collected: {absolutePath: string; bytes: number}[] = [];

  async function walk(dir: string, depth = 0): Promise<void> {
    if (depth > 6) return;
    let entries: import('fs').Dirent[];
    try {
      entries = await readdir(dir, {withFileTypes: true});
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SCAN_EXCLUDE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        await walk(abs, depth + 1);
      } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name))) {
        try {
          const s = await stat(abs);
          collected.push({absolutePath: abs, bytes: s.size});
        } catch {/* ignore */}
      }
    }
  }
  await walk(modulePath);

  const totalFiles = collected.length;
  collected.sort((a, b) => b.bytes - a.bytes);
  const files = collected.slice(0, maxFiles);

  const MAX_TOTAL_BYTES = 120_000;
  const MAX_PER_FILE = 6_000;
  let total = 0;
  let truncated = false;
  const parts: string[] = [];

  for (const f of files) {
    if (total >= MAX_TOTAL_BYTES) {
      truncated = true;
      break;
    }
    try {
      const content = await readFile(f.absolutePath, 'utf-8');
      const excerpt = extractStructuralExcerpt(content, MAX_PER_FILE);
      parts.push(`\n#### \`${f.absolutePath}\`\n\`\`\`\n${excerpt}\n\`\`\``);
      total += excerpt.length;
    } catch {/* skip */}
  }

  return {files, totalFiles, excerpts: parts.join('\n'), totalBytes: total, truncated};
}

function extractStructuralExcerpt(content: string, maxBytes: number): string {
  if (content.length <= maxBytes) return content;
  const lines = content.split('\n');
  const keepers: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const keep =
      /^(import|export|class|interface|type|function|const\s+\w+\s*=|enum|async\s+function|public|protected|private|@)/.test(trimmed) ||
      /^\/\*|^\*|^\/\//.test(trimmed) ||
      /^(\}|\{|\)|\(|,)$/.test(trimmed);
    if (keep) keepers.push(line);
  }
  let result = keepers.join('\n');
  if (result.length > maxBytes) {
    result = result.slice(0, maxBytes) + '\n... [truncated]';
  }
  return result;
}

// ─── Renderers ────────────────────────────────────────────────────────────────
function renderCategoryListAcrossRepos(): string {
  if (repos.size === 0) return 'No repos with schemas found in this workspace.';
  return Array.from(repos.values()).map((r) => [
    `## ${r.repo}`,
    r.generalContext.service.description,
    '',
    '| Issue ID | Name | Primary ID |',
    '|----------|------|-----------|',
    ...Array.from(r.issueAnalyses.values()).map((i) =>
      `| \`${i.id}\` | ${i.name} | \`${i.primaryCorrelationId}\` |`,
    ),
  ].join('\n')).join('\n\n');
}

function renderAskForId(issue: IssueAnalysisSchema, originalDesc: string): string {
  return [
    `## Matched: **${issue.name}**`,
    `Issue: "${originalDesc}"`,
    '',
    '### What I need',
    issue.primaryIdPrompt,
    '',
    `**Where to find ${issue.primaryCorrelationId}:** ${primaryIdHint(issue.primaryCorrelationId)}`,
    '',
    '### Alternative IDs',
    issue.secondaryCorrelationIds.length > 0 ?
      issue.secondaryCorrelationIds.map((s) => `- \`${s.id}\` — ${s.useWhen}`).join('\n') :
      '_None_',
    '',
    `Next: call \`start_investigation\` with \`issueDescription\`, \`correlationId\`, and \`correlationIdType="${issue.primaryCorrelationId}"\`.`,
  ].join('\n');
}

function renderFullContext(r: RepoSchema, issue: IssueAnalysisSchema, id: string, idType?: string): string {
  return [
    `# Investigation: ${issue.name} (${r.repo})`,
    `**ID:** \`${idType || issue.primaryCorrelationId}\` = \`${id}\``,
    '',
    '## Loki / Grafana Queries',
    '```logql',
    ...buildLokiQueries(r, issue, id),
    '```',
    '',
    '## Investigation Steps',
    issue.logQueriesToRun.map((q, i) => `${i + 1}. ${q}`).join('\n'),
    '',
    '## Known Error Patterns',
    issue.errorPatterns.map((ep) => [
      `### [${ep.id}] ${ep.description}`,
      `- Match: \`${ep.pattern}\` (${ep.level})`,
      `- Root cause: ${ep.rootCause}`,
      `- Investigation:`,
      ep.investigationSteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n'),
    ].join('\n')).join('\n\n') || '_No specific patterns_',
    '',
    '## Playbooks',
    issue.playbooks.map((p) => [
      `### [${p.id}] ${p.title}`,
      p.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    ].join('\n')).join('\n\n') || '_No playbooks_',
    '',
    '## Secondary IDs',
    issue.secondaryCorrelationIds.map((s) => `- \`${s.id}\` — ${s.useWhen}`).join('\n') || '_None_',
  ].join('\n');
}

function renderIssue(i: IssueAnalysisSchema): string {
  return [
    `# ${i.name}`,
    i.description,
    `Keywords: ${i.keywords.join(', ')}`,
    `Primary ID: \`${i.primaryCorrelationId}\``,
    '',
    '## Error Patterns',
    i.errorPatterns.map((ep) => [
      `### [${ep.id}] ${ep.description}`,
      `- Match: \`${ep.pattern}\` (${ep.level})`,
      `- Root cause: ${ep.rootCause}`,
      `- Steps: ${ep.investigationSteps.join('; ')}`,
    ].join('\n')).join('\n\n') || '_None_',
    '',
    '## Playbooks',
    i.playbooks.map((p) => `- [${p.id}] ${p.title}: ${p.steps.length} steps`).join('\n') || '_None_',
  ].join('\n');
}

// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
