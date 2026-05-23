export interface CorrelationKey {
  field: string;
  priority: number;
  scope: string;
  description: string;
  presentIn: string[];
}

export interface ModuleField {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface ModuleSchema {
  id: string;
  name: string;
  loggerPatterns: string[];
  purpose: string;
  fields: ModuleField[];
  correlationPattern?: string;
  noisePatterns?: string[];
}

export interface NoiseFilter {
  pattern: string;
  reason: string;
}

export interface GeneralContextSchema {
  repo: string;
  service: {
    name: string;
    description: string;
    stack?: string;
    containers?: string[];
    k8s_namespace?: string;
  };
  correlationKeys: CorrelationKey[];
  modules: ModuleSchema[];
  noiseFilters: { description?: string; patterns: NoiseFilter[] };
  logLevels: Record<string, { priority: number; description: string; action: string }>;
  aiPromptInstructions: {
    description?: string;
    systemPromptTemplate: string;
    inputFormat?: string;
    outputFormat: Record<string, string>;
  };
}

export interface ErrorPattern {
  id: string;
  moduleId?: string;
  moduleName?: string;
  pattern: string;
  level: 'exception' | 'error' | 'warn' | 'info' | 'debug';
  description: string;
  rootCause: string;
  correlationFields: string[];
  investigationSteps: string[];
}

export interface Playbook {
  id: string;
  title: string;
  symptoms: string[];
  steps: string[];
  keyFields: string[];
  modulesInvolved: string[];
}

export interface IssueAnalysisSchema {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  primaryCorrelationId: string;
  primaryIdPrompt: string;
  secondaryCorrelationIds: { id: string; useWhen: string }[];
  relevantModules: string[];
  logQueriesToRun: string[];
  errorPatterns: ErrorPattern[];
  playbooks: Playbook[];
  detailedFieldsToWatch: (ModuleField & { module: string })[];
}

export interface Manifest {
  repo: string;
  description: string;
  generalContext: string;
  issueAnalyses: {
    id: string;
    name: string;
    file: string;
    keywords: string[];
    primaryCorrelationId: string;
  }[];
}

export interface RepoSchema {
  repo: string;
  rootPath: string;
  manifest: Manifest;
  generalContext: GeneralContextSchema;
  issueAnalyses: Map<string, IssueAnalysisSchema>;
}
