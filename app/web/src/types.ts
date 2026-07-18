// WardFlow shared entity types — SOURCE OF TRUTH (CONTRACTS.md §1).
// Keep app/server/src/types.ts and app/web/src/types.ts byte-identical.
// v2 — troponin/ACS scenario, 8-screen mock, hospital-no identity.

export type TaskCategory = 'requests'|'specialty_input'|'discharge'|'monitoring'|'medication';
export type TaskStatus   = 'proposed'|'approved'|'rejected'|'requested'|'chased'|'sent'|'waiting'|'returned'|'completed';
export type PatientStatus= 'need_action'|'need_review'|'unchanged';   // → red | amber | green status dot
export type EvidenceType = 'transcript'|'note'|'lab'|'mar'|'progress_note'|'protocol'|'observation';
export type ResultStatus = 'normal'|'abnormal'|'high'|'critical';
export type TimelineType  = 'approval'|'order'|'administration'|'result'|'agent'|'notification'|'workflow';

export interface EvidenceRef { type: EvidenceType; label: string; timestamp?: string; excerpt: string; sourceRef?: string; }

// The agent's actual ReAct trace — one entry per tool call it made while reasoning.
export interface TraceStep {
  order: number;
  tool: string;          // 'search_observations' | 'get_medications' | 'get_note_section' | 'get_local_guidance' | 'search_workflows' | 'get_workflow'
  input: string;         // human-readable query/args the agent passed
  summary: string;       // short human-readable finding returned to the agent
}

// Pre-defined, operator-configured workflows the agent's actions can trigger (stubbed execution).
export interface WorkflowDef { id: string; name: string; description: string; category?: string; }
export interface WorkflowRun {
  runId: string; workflowId: string; label: string;
  status: 'triggered'|'running'|'completed';
  triggeredAt: string; actionId?: string; patientId: string;
}

// Patients are identified by hospital number + bed (no names shown). `name` is internal (initials).
export interface Patient {
  id: string; hospitalNo: string; bed: string; initials: string; ageSex: string; // "68F"
  name?: string; ward: string; specialty?: string;
  status: PatientStatus; taskCount: number;
}
export interface Encounter {
  id: string; patientId: string; date: string; visitTitle: string; visitType: string;
  summary: string; presentingComplaint: string;
  news?: string;                                   // NEWS score, e.g. "2"
  investigations?: { label: string; value: string }[];  // e.g. CXR – Normal | Bloods – Pending
  pmh?: string[];                                  // e.g. ["HTN","IHD","Scoliosis"]
  allergies?: string[];                            // e.g. ["Nuts"]
  medications?: string[];                          // e.g. ["Lisinopril","Aspirin"]
  keyInvestigations?: { label: string; value: string }[];
  assessment?: string; planText?: string;          // internal grounding for extraction
}
export interface Task {
  id: string; patientId: string; encounterId: string;
  title: string; category: TaskCategory; timing?: string; reason?: string;
  status: TaskStatus; origin: 'extracted'|'suggested';
  evidence: EvidenceRef[]; confidence?: number;
  workflowId?: string;      // the workflow this task maps to (agent matched symptoms → workflow)
  workflowLabel?: string;   // short display label for the mapped workflow
}
export interface ResultEvent {
  id: string; taskId: string; patientId: string;
  name: string; value: string; unit?: string; refRange?: string;
  status: ResultStatus; priorValue?: string; returnedAt: string;
  context: string; requiresReview: boolean;
  interpretation?: string;                         // e.g. "Markedly raised troponin I in the context of chest pain."
}
export interface SuggestedAction {
  id: string; title: string; detail?: string; selectedByDefault: boolean;
  workflowId?: string;      // maps to a WorkflowDef.id — the workflow the agent discovered for this action
  workflowLabel?: string;   // short display label for the mapped workflow
}
export interface Suggestion {
  id: string; resultEventId: string; headline: string; summary: string;
  proposedActions: SuggestedAction[]; evidence: EvidenceRef[]; guardrails: string[];
  trace?: TraceStep[];      // the agent's actual tool-call reasoning trace (evidence of what it did)
  anomaly?: { detected: boolean; description: string };  // the agent's anomaly determination
}
export interface TimelineEvent {
  id: string; patientId: string; ts: string; label: string; type: TimelineType;
  note?: string;            // right-aligned value/status, e.g. "4274 ng/L" | "Pending" | "Completed"
}
export interface Notification { id: string; patientId: string; resultEventId: string; title: string; body: string; createdAt: string; deepLink: string; urgent?: boolean; }
export interface WardSummary {
  ward: string;             // "Ward 7A"
  clinician?: string;
  date?: string;            // "Sat, 18 May 09:20"
  counts: { patients: number; tasks: number };
  patients: Patient[];
}
