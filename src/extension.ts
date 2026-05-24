import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {parse as parseJsonc, ParseError, printParseErrorCode} from 'jsonc-parser';
import {SchemaService} from './services/schema/schema.service';
import {SchemaExplorerTreeProvider} from './views/schema.explorer.tree';

let schemaService: SchemaService;

const FIRST_RUN_NOTIFIED_KEY = 'loglens.firstRunNotified';
const LAST_NOTIFIED_VERSION_KEY = 'loglens.lastNotifiedVersion';

/**
 * Each supported MCP-aware AI client expects its config in a different file.
 * On Setup, we write the same `loglens` entry to all three so users get LogLens
 * working regardless of which client they have (or install later).
 */
const MCP_CONFIG_TARGETS: {readonly relPath: string; readonly client: string}[] = [
  {relPath: '.mcp.json', client: 'Claude Code'},
  {relPath: path.join('.vscode', 'mcp.json'), client: 'GitHub Copilot Chat'},
  {relPath: path.join('.cursor', 'mcp.json'), client: 'Cursor'},
];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('loglens');
  const schemaFolder = config.get<string>('schemaFolder', '.loganalysis');

  schemaService = new SchemaService(schemaFolder);
  await schemaService.initialize();

  const treeProvider = new SchemaExplorerTreeProvider(schemaService);
  context.subscriptions.push(
      vscode.window.registerTreeDataProvider('loglens.schemaExplorer', treeProvider),
      schemaService,
  );

  context.subscriptions.push(
      vscode.commands.registerCommand('loglens.setupMcp', () => setupMcpIntegration(context)),
      vscode.commands.registerCommand('loglens.validateSchemas', () => validateSchemas()),
      vscode.commands.registerCommand('loglens.listCategories', () => listCategories()),
      vscode.commands.registerCommand('loglens.openInClaudeCode', () => openInClaudeCode()),
      vscode.commands.registerCommand('loglens.copyExplainPrompt', (uri: vscode.Uri) => copyExplainPrompt(uri)),
  );

  // Status bar — opens Claude Code chat
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(search) LogLens';
  statusBarItem.tooltip = 'Open Claude Code chat to use LogLens';
  statusBarItem.command = 'loglens.openInClaudeCode';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Self-heal stale .mcp.json paths after an extension upgrade.
  // Runs BEFORE the first-run prompt so existing installs don't see a setup pitch.
  await selfHealMcpJsonOnUpgrade(context);

  // First-run check: offer MCP setup if not yet configured for this workspace
  await maybeOfferMcpSetup(context);
}

export function deactivate(): void {
  schemaService?.dispose();
}

/* ─── First-run setup prompt ────────────────────────────────────────────────── */

async function maybeOfferMcpSetup(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;

  const root = folders[0].uri.fsPath;

  // Consider "configured" if any of the supported clients already has a loglens entry
  let alreadyConfigured = false;
  for (const target of MCP_CONFIG_TARGETS) {
    const entry = await readLoglensEntry(path.join(root, target.relPath));
    if (entry) { alreadyConfigured = true; break; }
  }
  if (alreadyConfigured) return;

  // Avoid re-prompting on every activation in the same workspace
  const workspaceKey = `${FIRST_RUN_NOTIFIED_KEY}:${root}`;
  if (context.workspaceState.get<boolean>(workspaceKey)) return;
  await context.workspaceState.update(workspaceKey, true);

  const hasSchemas = schemaService.listRepos().length > 0;
  const msg = hasSchemas ?
    'LogLens detected an existing .loganalysis/ folder. Set up MCP integration for Claude Code / Copilot / Cursor?' :
    'LogLens is installed. Set up MCP integration (Claude Code / Copilot / Cursor) so you can generate or use log-analysis schemas in chat?';

  const choice = await vscode.window.showInformationMessage(
      msg,
      'Setup',
      'Later',
  );
  if (choice === 'Setup') {
    await setupMcpIntegration(context);
  }
}

/* ─── Commands ─────────────────────────────────────────────────────────────── */

async function setupMcpIntegration(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage('LogLens: open a folder/workspace first.');
    return;
  }

  const root = folders[0].uri.fsPath;
  const mcpServerPath = path.join(context.extensionPath, 'dist', 'mcp-server.mjs');

  const config = vscode.workspace.getConfiguration('loglens');
  const schemaFolder = config.get<string>('schemaFolder', '.loganalysis');

  const loglensEntry = {
    command: 'node',
    args: [mcpServerPath, '--workspace', root, '--schema-folder', schemaFolder],
    type: 'stdio',
  };

  // Check whether any target already has a loglens entry; if so, ask once before overwriting all
  const existingTargets = await detectExistingLoglensTargets(root);
  if (existingTargets.length > 0) {
    const choice = await vscode.window.showWarningMessage(
        `Existing LogLens MCP config found in: ${existingTargets.map((t) => t.client).join(', ')}. ` +
      `Overwrite (also writes config for the other clients)?`,
        'Overwrite', 'Cancel',
    );
    if (choice !== 'Overwrite') return;
  }

  // Write to all three client config locations
  const written: {client: string; path: string}[] = [];
  const failed: {client: string; path: string; error: string}[] = [];
  for (const target of MCP_CONFIG_TARGETS) {
    const targetPath = path.join(root, target.relPath);
    try {
      await mergeLoglensEntryIntoFile(targetPath, loglensEntry);
      written.push({client: target.client, path: targetPath});
    } catch (e) {
      failed.push({client: target.client, path: targetPath, error: (e as Error).message});
    }
  }

  const successList = written.map((w) => w.client).join(', ');

  if (failed.length > 0) {
    // Show failures in a separate, more prominent dialog so users see WHY a config was skipped
    const failureLines = failed.map((f) => `• ${f.client}: ${f.error}`).join('\n');
    await vscode.window.showWarningMessage(
        `LogLens skipped some configs:\n${failureLines}`,
        {modal: true},
    );
  }

  if (written.length === 0) {
    vscode.window.showErrorMessage('LogLens MCP setup failed — no client configs were written. See previous warnings.');
    return;
  }

  const action = await vscode.window.showInformationMessage(
      `LogLens MCP configured for ${successList}. ` +
    `Reload VS Code so your AI client picks up the new server, then ask in chat: ` +
    `"Use LogLens to investigate..." or "Use LogLens to generate a schema for this repo"`,
      'Reload Window',
      'OK',
  );
  if (action === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

/* ─── Helpers for MCP config file management ──────────────────────────────
 *
 * Two safety properties enforced here:
 *  1. **JSONC support** — `.vscode/mcp.json` and `.cursor/mcp.json` are JSONC
 *     (JSON with comments + trailing commas). We use `jsonc-parser` so user
 *     comments don't cause us to think the file is empty.
 *  2. **Error discrimination** — file-missing (safe to create) is treated
 *     differently from parse-failure (refuse to write, surface the error).
 *     We never overwrite a file we couldn't parse.
 */

type ReadResult =
  | {status: 'missing'}                                      // file doesn't exist — safe to create
  | {status: 'unreadable'; error: string}                    // file exists but can't be read (perms, etc.)
  | {status: 'parse-failed'; raw: string; error: string}     // file exists but isn't valid JSON/JSONC
  | {status: 'ok'; data: any; raw: string};                  // file parsed successfully

/**
 * Read and parse a JSON or JSONC file, distinguishing missing-file from
 * parse-failure so callers can decide what to do.
 */
async function readJsoncFile(filePath: string): Promise<ReadResult> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return {status: 'missing'};
    return {status: 'unreadable', error: (e as Error).message};
  }

  const errors: ParseError[] = [];
  const data = parseJsonc(raw, errors, {allowTrailingComma: true, disallowComments: false});

  if (errors.length > 0) {
    const summary = errors.map((e) =>
      `${printParseErrorCode(e.error)} at offset ${e.offset}`,
    ).join('; ');
    return {status: 'parse-failed', raw, error: summary};
  }
  return {status: 'ok', data, raw};
}

/**
 * Read the `mcpServers.loglens` entry from a config file, if present.
 * Returns null when the file is missing, unreadable, fails to parse, or has no loglens entry.
 * (Callers that need to distinguish these cases should use `readJsoncFile` directly.)
 */
async function readLoglensEntry(filePath: string): Promise<any | null> {
  const result = await readJsoncFile(filePath);
  if (result.status !== 'ok') return null;
  return result.data?.mcpServers?.loglens ?? null;
}

/**
 * Merge a `loglens` entry into the file at `filePath`. Preserves any other
 * `mcpServers.*` entries and any other top-level keys.
 *
 * Safety: if the file exists but cannot be parsed, this function **refuses
 * to write** and throws — that way we never destroy a malformed-but-recoverable
 * file. Caller surfaces the error in the UI.
 *
 * Note: JSONC comments and exact formatting are NOT preserved on save. We
 * parse with jsonc-parser (so we read comments without erroring) but write
 * normalized JSON. This is acceptable since `mcp.json` is a generated config,
 * not hand-curated documentation.
 */
async function mergeLoglensEntryIntoFile(filePath: string, loglensEntry: any): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});

  const result = await readJsoncFile(filePath);
  let existing: any = {};

  switch (result.status) {
    case 'missing':
      existing = {}; // safe to create
      break;
    case 'ok':
      existing = result.data ?? {};
      break;
    case 'parse-failed':
      throw new Error(
          `Refusing to overwrite ${path.basename(filePath)}: file exists but is not valid JSON/JSONC ` +
        `(${result.error}). Fix or remove the file, then re-run Setup.`,
      );
    case 'unreadable':
      throw new Error(
          `Cannot read ${path.basename(filePath)}: ${result.error}`,
      );
  }

  const merged = {
    ...existing,
    mcpServers: {
      ...(existing?.mcpServers ?? {}),
      loglens: loglensEntry,
    },
  };
  await fs.writeFile(filePath, JSON.stringify(merged, null, 2));
}

/**
 * Inspect all client config files and return which ones already contain a loglens entry.
 */
async function detectExistingLoglensTargets(
    workspaceRoot: string,
): Promise<{client: string; relPath: string}[]> {
  const found: {client: string; relPath: string}[] = [];
  for (const target of MCP_CONFIG_TARGETS) {
    const entry = await readLoglensEntry(path.join(workspaceRoot, target.relPath));
    if (entry) found.push({client: target.client, relPath: target.relPath});
  }
  return found;
}

async function validateSchemas(): Promise<void> {
  await schemaService.discoverAndLoad();
  const count = schemaService.listRepos().length;
  vscode.window.showInformationMessage(
      count === 0 ?
        'LogLens: no schemas found. Ask Claude Code in chat to generate one — "Use LogLens to scan this codebase and generate a starter schema".' :
        `LogLens: ${count} repo schema(s) loaded successfully.`,
  );
}

async function listCategories(): Promise<void> {
  const repos = schemaService.listRepos();
  if (repos.length === 0) {
    vscode.window.showWarningMessage(
        'LogLens: no schemas loaded. Ask Claude Code in chat to generate one.',
    );
    return;
  }
  const items: vscode.QuickPickItem[] = [];
  for (const r of repos) {
    items.push({label: `$(repo) ${r.repo}`, kind: vscode.QuickPickItemKind.Separator});
    for (const i of r.issueAnalyses.values()) {
      items.push({
        label: i.name,
        description: i.primaryCorrelationId,
        detail: i.keywords.slice(0, 6).join(', '),
      });
    }
  }
  await vscode.window.showQuickPick(items, {placeHolder: 'All available issue categories'});
}

/**
 * Open Claude Code chat with a helpful starter message copied to clipboard.
 * VS Code doesn't expose a public API to inject text into Claude Code, but
 * focusing its view is enough — users paste / type from there.
 */
async function openInClaudeCode(): Promise<void> {
  const tip = 'Tip: ask Claude Code in chat — "Use LogLens to investigate: <describe your issue>"';
  // Try a couple of known view IDs for Claude Code's panel
  const candidates = [
    'workbench.view.extension.claude-code',
    'claude-code.chat',
    'workbench.view.extension.claudeCode',
  ];
  let opened = false;
  for (const id of candidates) {
    try {
      await vscode.commands.executeCommand(`workbench.action.openView`, id);
      opened = true;
      break;
    } catch {/* try next */}
  }
  if (!opened) {
    try { await vscode.commands.executeCommand('workbench.view.explorer'); } catch {/* ignore */}
  }
  vscode.window.showInformationMessage(tip);
}

/**
 * For the explorer right-click "LogLens: Copy 'Explain this module' prompt".
 * Copies a ready-to-paste prompt to the clipboard. User pastes it into
 * Claude Code chat; Claude calls `list_module_files` via MCP.
 */
async function copyExplainPrompt(uri?: vscode.Uri): Promise<void> {
  if (!uri) {
    vscode.window.showWarningMessage('LogLens: right-click a folder in the Explorer to use this.');
    return;
  }
  const prompt = `Use LogLens \`list_module_files\` to explain this module: ${uri.fsPath}`;
  await vscode.env.clipboard.writeText(prompt);
  vscode.window.showInformationMessage(
      'LogLens: prompt copied to clipboard. Paste into Claude Code chat.',
  );
}

/* ─── Self-heal: keep MCP config paths current after extension upgrades ─────
 *
 * Problem: setupMcpIntegration writes an absolute path containing the
 * extension version into the MCP config files (e.g.
 * `...\LogLensAI.loglens-0.1.0\dist\mcp-server.mjs`). After a Marketplace
 * auto-update, that folder is replaced with a new-versioned one, and the AI
 * client (Claude Code / Copilot / Cursor) can no longer spawn the MCP server.
 *
 * This helper runs on every activation. For each workspace folder, it checks
 * all three known MCP config locations — if a `loglens` entry exists with a
 * stale path, we silently rewrite it. The user sees a single
 * "LogLens upgraded — reload to use the new version" notification per new
 * version (tracked via globalState).
 */
async function selfHealMcpJsonOnUpgrade(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;

  const currentServerPath = path.join(context.extensionPath, 'dist', 'mcp-server.mjs');
  let anyHealed = false;

  for (const folder of folders) {
    for (const target of MCP_CONFIG_TARGETS) {
      const filePath = path.join(folder.uri.fsPath, target.relPath);
      const result = await readJsoncFile(filePath);
      // Skip if file missing or we couldn't parse it — don't destroy data we don't understand
      if (result.status !== 'ok') continue;

      const parsed = result.data;
      const loglensEntry = parsed?.mcpServers?.loglens;
      if (!loglensEntry || !Array.isArray(loglensEntry.args) || loglensEntry.args.length === 0) {
        continue; // no loglens entry — nothing to heal here
      }

      const currentArgPath = String(loglensEntry.args[0]);
      if (currentArgPath === currentServerPath) continue;

      // Stale path detected → rewrite. Preserve any user-customized args after the path.
      loglensEntry.args[0] = currentServerPath;
      try {
        await fs.writeFile(filePath, JSON.stringify(parsed, null, 2));
        anyHealed = true;
      } catch (e) {
        console.warn(`LogLens: failed to update ${filePath}: ${(e as Error).message}`);
      }
    }
  }

  if (!anyHealed) return;

  const currentVersion = context.extension.packageJSON.version as string;
  const lastNotified = context.globalState.get<string>(LAST_NOTIFIED_VERSION_KEY);
  if (lastNotified === currentVersion) return;
  await context.globalState.update(LAST_NOTIFIED_VERSION_KEY, currentVersion);

  const choice = await vscode.window.showInformationMessage(
      `LogLens upgraded to v${currentVersion}. Reload VS Code so your AI client picks up the new MCP server.`,
      'Reload Window',
      'Later',
  );
  if (choice === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
