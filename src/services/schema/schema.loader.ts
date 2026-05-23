import * as path from 'path';
import * as fs from 'fs/promises';
import {
  RepoSchema,
  Manifest,
  GeneralContextSchema,
  IssueAnalysisSchema,
} from './types';
import {
  ManifestZ,
  GeneralContextSchemaZ,
  IssueAnalysisSchemaZ,
} from './validation';

export interface SchemaLoadError {
  file: string;
  dir: string;
  message: string;
}

export interface LoadResult {
  repos: Map<string, RepoSchema>;
  errors: SchemaLoadError[];
}

/**
 * Pure-Node schema loader (no vscode imports). Used by both:
 *  - SchemaService (VS Code extension) — wraps this with watchers and UI error reporting
 *  - mcp-server.ts (standalone MCP server process) — uses this directly
 */
export class SchemaLoader {
  constructor(private readonly schemaFolderName: string = '.loganalysis') {}

  async loadFromRoots(roots: string[]): Promise<LoadResult> {
    const repos = new Map<string, RepoSchema>();
    const errors: SchemaLoadError[] = [];
    for (const root of roots) {
      await this.scanFolder(root, repos, errors);
    }
    return {repos, errors};
  }

  private async scanFolder(
      rootPath: string,
      repos: Map<string, RepoSchema>,
      errors: SchemaLoadError[],
      depth = 0,
  ): Promise<void> {
    if (depth > 4) return;

    const schemaDir = path.join(rootPath, this.schemaFolderName);
    const manifestPath = path.join(schemaDir, 'manifest.json');
    if (await this.exists(manifestPath)) {
      const repo = await this.loadRepo(schemaDir, errors);
      if (repo) repos.set(repo.repo, repo);
      return;
    }

    try {
      const entries = await fs.readdir(rootPath, {withFileTypes: true});
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        await this.scanFolder(path.join(rootPath, entry.name), repos, errors, depth + 1);
      }
    } catch {/* ignore */}
  }

  private async loadRepo(schemaDir: string, errors: SchemaLoadError[]): Promise<RepoSchema | null> {
    try {
      const manifestRaw = await fs.readFile(path.join(schemaDir, 'manifest.json'), 'utf-8');
      const manifestParsed = ManifestZ.safeParse(JSON.parse(manifestRaw));
      if (!manifestParsed.success) {
        errors.push({dir: schemaDir, file: 'manifest.json', message: manifestParsed.error.message});
        return null;
      }
      const manifest = manifestParsed.data as Manifest;

      const ctxRaw = await fs.readFile(path.join(schemaDir, manifest.generalContext), 'utf-8');
      const ctxParsed = GeneralContextSchemaZ.safeParse(JSON.parse(ctxRaw));
      if (!ctxParsed.success) {
        errors.push({dir: schemaDir, file: manifest.generalContext, message: ctxParsed.error.message});
        return null;
      }
      const generalContext = ctxParsed.data as GeneralContextSchema;

      const issueAnalyses = new Map<string, IssueAnalysisSchema>();
      for (const entry of manifest.issueAnalyses) {
        const filePath = path.join(schemaDir, entry.file);
        if (!(await this.exists(filePath))) continue;
        const issueRaw = await fs.readFile(filePath, 'utf-8');
        const issueParsed = IssueAnalysisSchemaZ.safeParse(JSON.parse(issueRaw));
        if (!issueParsed.success) {
          errors.push({dir: schemaDir, file: entry.file, message: issueParsed.error.message});
          continue;
        }
        issueAnalyses.set(issueParsed.data.id, issueParsed.data as IssueAnalysisSchema);
      }

      return {repo: manifest.repo, rootPath: schemaDir, manifest, generalContext, issueAnalyses};
    } catch (e) {
      errors.push({dir: schemaDir, file: '(unknown)', message: (e as Error).message});
      return null;
    }
  }

  private async exists(p: string): Promise<boolean> {
    try { await fs.access(p); return true; } catch { return false; }
  }
}
