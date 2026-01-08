
export enum ScopeStatus {
  ON_TRACK = 'ON_TRACK',
  VARIANCE_DETECTED = 'VARIANCE_DETECTED',
  SCOPE_CREEP = 'SCOPE_CREEP',
  NEEDS_VALIDATION = 'NEEDS_VALIDATION'
}

export interface ProjectScopeStatement {
  description: string;
  deliverables: string[];
  exclusions: string[];
  assumptions: string[];
  constraints: string[];
}

export interface WBSItem {
  id: string;
  parentId: string | null; // Support for hierarchical decomposition (Level 1 -> WP)
  code: string;
  name: string;
  description: string;
  acceptanceCriteria: string;
  isWorkPackage: boolean;
  isApproved: boolean;
}

export interface Requirement {
  id: string;
  title: string;
  source: string;
  category: 'Functional' | 'Non-Functional' | 'Business';
  priority: 'High' | 'Medium' | 'Low';
  wbsMapping?: string; // Link to WBS ID for traceability
}

export interface WorkPerformanceData {
  id: string;
  wbsId: string;
  actualWorkDescription: string;
  progressPercentage: number;
  timestamp: string;
}

export interface InspectionItem {
  id: string;
  label: string;
  isMet: boolean;
  notes: string;
}

export interface Evidence {
  id: string;
  type: 'Text' | 'Image' | 'Link';
  content: string;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
}

export interface Deliverable {
  id: string;
  wbsId: string;
  name: string;
  status: 'Pending' | 'Verified' | 'Accepted' | 'Rejected';
  qualityReportSummary: string;
  validationNotes?: string;
  checklist: InspectionItem[];
  evidence: Evidence[];
  auditLogs: AuditLogEntry[];
  acceptedBy?: string;
}

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  type: 'Corrective Action' | 'Preventive Action' | 'Defect Repair' | 'Update';
  impactAnalysis: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
}

export interface ScopeAnalysisResult {
  variances: string[];
  scopeCreepIdentified: boolean;
  recommendations: string[];
  changeRequestSuggestions: Partial<ChangeRequest>[];
}

export interface ValidationResult {
  isAccepted: boolean;
  feedback: string;
  missingCriteria: string[];
  suggestedAction: string;
  checklistUpdate?: InspectionItem[];
}

export interface LessonsLearned {
  id: string;
  category: 'Scope' | 'Quality' | 'Stakeholders';
  description: string;
  recommendation: string;
}

export interface ScopeReport {
  timestamp: string;
  summary: string;
  healthScore: number; // 0-100
  deviationsCount: number;
  acceptanceRate: number; // %
}
