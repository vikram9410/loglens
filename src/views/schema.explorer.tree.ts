import * as vscode from 'vscode';
import {SchemaService} from '../services/schema/schema.service';

type Node =
  | {type: 'repo'; repoName: string}
  | {type: 'issue'; repoName: string; issueId: string; issueName: string; filePath: string};

export class SchemaExplorerTreeProvider implements vscode.TreeDataProvider<Node> {
  private _onDidChange = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly schemaService: SchemaService) {
    schemaService.onChanged(() => this._onDidChange.fire());
  }

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.type === 'repo') {
      const item = new vscode.TreeItem(node.repoName, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('repo');
      item.contextValue = 'loglens.repo';
      return item;
    }
    const item = new vscode.TreeItem(node.issueName, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('symbol-event');
    item.contextValue = 'loglens.issue';
    item.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [vscode.Uri.file(node.filePath)],
    };
    item.tooltip = `${node.issueId}\n${node.filePath}`;
    return item;
  }

  async getChildren(parent?: Node): Promise<Node[]> {
    if (!parent) {
      return this.schemaService.listRepos().map((r) => ({type: 'repo' as const, repoName: r.repo}));
    }
    if (parent.type === 'repo') {
      const repo = this.schemaService.getRepo(parent.repoName);
      if (!repo) return [];
      return repo.manifest.issueAnalyses.map((entry) => ({
        type: 'issue' as const,
        repoName: parent.repoName,
        issueId: entry.id,
        issueName: entry.name,
        filePath: `${repo.rootPath}/${entry.file}`,
      }));
    }
    return [];
  }
}
