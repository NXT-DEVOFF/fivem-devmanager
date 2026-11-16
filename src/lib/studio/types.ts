export type StudioCategoryId = "vehicules" | "mlo" | "dev" | "serveur" | "gameplay";

export interface StudioCategory {
  id: StudioCategoryId;
  label: string;
  description: string;
  icon: string;
  accent: "primary" | "success" | "warning" | "danger" | "info";
}

export type StudioFieldType = "text" | "textarea" | "number" | "select" | "switch";

export interface StudioFieldOption {
  value: string;
  label: string;
}

export interface StudioField {
  name: string;
  label: string;
  type: StudioFieldType;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: StudioFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
}

export interface StudioDiagnostic {
  level: "error" | "warning" | "info";
  message: string;
  field?: string;
}

export interface StudioStat {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

export interface StudioFile {
  path: string;
  content: string;
  language?: string;
}

export interface StudioResult {
  summary: string;
  files: StudioFile[];
  warnings?: string[];
  notes?: string[];
  diagnostics?: StudioDiagnostic[];
  stats?: StudioStat[];
  meta?: Record<string, string | number | boolean>;
}

export type StudioInputValue = string | number | boolean;
export type StudioInput = Record<string, StudioInputValue | undefined>;

export interface StudioTool {
  slug: string;
  name: string;
  category: StudioCategoryId;
  description: string;
  icon: string;
  tags: string[];
  fields: StudioField[];
  run: (input: StudioInput) => StudioResult;
}

export interface StudioToolSummary {
  slug: string;
  name: string;
  category: StudioCategoryId;
  description: string;
  icon: string;
  tags: string[];
  fields: StudioField[];
}
