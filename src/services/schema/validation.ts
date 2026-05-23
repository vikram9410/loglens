import {z} from 'zod';

/**
 * Validation schemas — intentionally LENIENT.
 *
 * Most fields are optional because:
 *  - AI-generated schemas iterate (Claude writes a draft, user refines)
 *  - Users hand-author minimal schemas that still need to load
 *  - Strict validation would silently drop partial schemas
 *
 * Only the bare-minimum fields needed to identify a schema and run
 * pattern matching are required. Everything else falls back to safe defaults
 * at the call site.
 */

export const CorrelationKeyZ = z.object({
  field: z.string(),
  priority: z.number().optional().default(99),
  scope: z.string().optional().default(''),
  description: z.string().optional().default(''),
  presentIn: z.array(z.string()).optional().default([]),
});

export const ModuleFieldZ = z.object({
  name: z.string(),
  type: z.string().optional().default('string'),
  required: z.boolean().optional(),
  description: z.string().optional().default(''),
});

export const ModuleSchemaZ = z.object({
  id: z.string(),
  name: z.string().optional().default(''),
  loggerPatterns: z.array(z.string()).optional().default([]),
  purpose: z.string().optional().default(''),
  fields: z.array(ModuleFieldZ).optional().default([]),
  correlationPattern: z.string().optional(),
  noisePatterns: z.array(z.string()).optional(),
});

export const NoiseFilterZ = z.object({
  pattern: z.string(),
  reason: z.string().optional().default(''),
});

export const GeneralContextSchemaZ = z.object({
  repo: z.string(),
  service: z.object({
    name: z.string(),
    description: z.string().optional().default(''),
    stack: z.string().optional(),
    containers: z.array(z.string()).optional(),
    k8s_namespace: z.string().optional(),
  }),
  correlationKeys: z.array(CorrelationKeyZ).optional().default([]),
  modules: z.array(ModuleSchemaZ).optional().default([]),
  noiseFilters: z.object({
    description: z.string().optional(),
    patterns: z.array(NoiseFilterZ).optional().default([]),
  }).optional().default({patterns: []}),
  logLevels: z.record(z.string(), z.object({
    priority: z.number().optional().default(99),
    description: z.string().optional().default(''),
    action: z.string().optional().default(''),
  })).optional().default({}),
  aiPromptInstructions: z.object({
    description: z.string().optional(),
    systemPromptTemplate: z.string().optional().default(''),
    inputFormat: z.string().optional(),
    outputFormat: z.record(z.string(), z.string()).optional().default({}),
  }).optional().default({systemPromptTemplate: '', outputFormat: {}}),
});

export const ErrorPatternZ = z.object({
  id: z.string(),
  moduleId: z.string().optional(),
  moduleName: z.string().optional(),
  pattern: z.string(),
  level: z.enum(['exception', 'error', 'warn', 'info', 'debug']).optional().default('error'),
  description: z.string().optional().default(''),
  rootCause: z.string().optional().default(''),
  correlationFields: z.array(z.string()).optional().default([]),
  investigationSteps: z.array(z.string()).optional().default([]),
});

export const PlaybookZ = z.object({
  id: z.string(),
  title: z.string().optional().default(''),
  symptoms: z.array(z.string()).optional().default([]),
  steps: z.array(z.string()).optional().default([]),
  keyFields: z.array(z.string()).optional().default([]),
  modulesInvolved: z.array(z.string()).optional().default([]),
});

export const IssueAnalysisSchemaZ = z.object({
  id: z.string(),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  keywords: z.array(z.string()).optional().default([]),
  primaryCorrelationId: z.string().optional().default(''),
  primaryIdPrompt: z.string().optional().default('Please provide a correlation ID for this investigation.'),
  secondaryCorrelationIds: z.array(z.object({
    id: z.string(),
    useWhen: z.string().optional().default(''),
  })).optional().default([]),
  relevantModules: z.array(z.string()).optional().default([]),
  logQueriesToRun: z.array(z.string()).optional().default([]),
  errorPatterns: z.array(ErrorPatternZ).optional().default([]),
  playbooks: z.array(PlaybookZ).optional().default([]),
  detailedFieldsToWatch: z.array(ModuleFieldZ.extend({module: z.string().optional().default('')})).optional().default([]),
});

export const ManifestZ = z.object({
  repo: z.string(),
  description: z.string().optional().default(''),
  generalContext: z.string().optional().default('general-context-schema.json'),
  issueAnalyses: z.array(z.object({
    id: z.string(),
    name: z.string().optional().default(''),
    file: z.string(),
    keywords: z.array(z.string()).optional().default([]),
    primaryCorrelationId: z.string().optional().default(''),
  })).optional().default([]),
});
