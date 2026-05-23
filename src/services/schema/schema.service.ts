import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  RepoSchema,
  Manifest,
  GeneralContextSchema,
  IssueAnalysisSchema,
} from './types';
import {SchemaLoader} from './schema.loader';

/**
 * VS Code-side wrapper around SchemaLoader. Adds:
 *  - workspace folder discovery (vscode.workspace.workspaceFolders)
 *  - file watchers for hot reload on .json changes
 *  - UI error reporting (vscode.window.showWarningMessage)
 *  - onChanged event for the tree view
 */
export class SchemaService implements vscode.Disposable {
  private loader: SchemaLoader;
  private repos = new Map<string, RepoSchema>();
  private watchers: vscode.FileSystemWatcher[] = [];
  private _onChanged = new vscode.EventEmitter<void>();
  readonly onChanged = this._onChanged.event;

  constructor(private readonly schemaFolderName: string = '.loganalysis') {
    this.loader = new SchemaLoader(schemaFolderName);
  }

  async initialize(): Promise<void> {
    await this.discoverAndLoad();
    this.setupWatchers();
  }

  async discoverAndLoad(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    const roots = folders?.map((f) => f.uri.fsPath) ?? [];
    const {repos, errors} = await this.loader.loadFromRoots(roots);
    this.repos = repos;
    for (const err of errors) {
      vscode.window.showWarningMessage(
          `LogLens: schema validation failed for ${err.file} in ${err.dir}. ${err.message.slice(0, 200)}`,
      );
    }
    this._onChanged.fire();
  }

  private setupWatchers(): void {
    for (const w of this.watchers) w.dispose();
    this.watchers = [];

    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;

    for (const folder of folders) {
      const pattern = new vscode.RelativePattern(folder, `**/${this.schemaFolderName}/**/*.json`);
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const reload = async () => { await this.discoverAndLoad(); };
      watcher.onDidChange(reload);
      watcher.onDidCreate(reload);
      watcher.onDidDelete(reload);
      this.watchers.push(watcher);
    }
  }

  listRepos(): RepoSchema[] {
    return Array.from(this.repos.values());
  }

  getRepo(name?: string): RepoSchema | null {
    if (name && this.repos.has(name)) return this.repos.get(name)!;
    if (!name && this.repos.size === 1) return Array.from(this.repos.values())[0];
    return null;
  }

  getIssueAnalysis(issueId: string, repoName?: string): IssueAnalysisSchema | null {
    const repo = this.getRepo(repoName);
    return repo?.issueAnalyses.get(issueId) ?? null;
  }

  workspaceRoot(): string | null {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  }

  async writeRepoSchemas(
      workspaceRoot: string,
      manifest: Manifest,
      generalContext: GeneralContextSchema,
      issues: IssueAnalysisSchema[],
  ): Promise<void> {
    const dir = path.join(workspaceRoot, this.schemaFolderName);
    await fs.mkdir(dir, {recursive: true});
    await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await fs.writeFile(path.join(dir, manifest.generalContext), JSON.stringify(generalContext, null, 2));
    for (const issue of issues) {
      const file = manifest.issueAnalyses.find((e) => e.id === issue.id)?.file
        ?? `${issue.id}-analysis-schema.json`;
      await fs.writeFile(path.join(dir, file), JSON.stringify(issue, null, 2));
    }
    await this.discoverAndLoad();
  }

  dispose(): void {
    for (const w of this.watchers) w.dispose();
    this._onChanged.dispose();
  }
}
