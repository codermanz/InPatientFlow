// WardFlow v2 demo FIXTURES — troponin / ACS scenario, patients by Hospital No.
// Every exported object matches a CONTRACTS.md §2 response shape (typed against
// ./types). api.ts falls back to these when the real /api is unavailable or
// returns a non-v2 (stale) shape, so the whole demo runs with no backend.

import type {
  WardSummary,
  Patient,
  Encounter,
  Task,
  ResultEvent,
  Suggestion,
  TimelineEvent,
  Notification,
  WorkflowDef,
  WorkflowRun,
} from './types';
import type { Execution, ActivitySummary } from './api';

// Backend's canonical hero patient id + troponin result id (v2, live-cached).
export const HERO_ID = 'pt-1234567';
export const PATIENT_ID = HERO_ID;
export const MARIA_ID = HERO_ID; // legacy alias — kept so nothing breaks
export const RESULT_ID = 'res-troponin-js';
export const ENCOUNTER_ID = 'enc-js-1234567';

// ── Patients (ward roster — Ward 7A, matches Demo_Flow.png) ────────────────
const hero: Patient = {
  id: HERO_ID,
  hospitalNo: '1234567',
  bed: 'Bed 12',
  initials: 'JS',
  ageSex: '61M',
  name: 'John Smith',
  ward: 'Ward 7A',
  specialty: 'Cardiology',
  status: 'need_action',
  taskCount: 5,
};

const patients: Patient[] = [
  hero,
  {
    id: 'pt-2345678',
    hospitalNo: '2345678',
    bed: 'Bed 8',
    initials: 'SA',
    ageSex: '74F',
    name: 'Sara Ahmed',
    ward: 'Ward 7A',
    specialty: 'Respiratory',
    status: 'need_review',
    taskCount: 2,
  },
  {
    id: 'pt-3456789',
    hospitalNo: '3456789',
    bed: 'Bed 15',
    initials: 'MJ',
    ageSex: '58M',
    name: 'Mo Jones',
    ward: 'Ward 7A',
    specialty: 'Medicine',
    status: 'unchanged',
    taskCount: 0,
  },
  {
    id: 'pt-4567890',
    hospitalNo: '4567890',
    bed: 'Bed 3',
    initials: 'DB',
    ageSex: '69F',
    name: 'Dee Brown',
    ward: 'Ward 7A',
    specialty: 'Geriatrics',
    status: 'need_review',
    taskCount: 3,
  },
];

// 1. GET /api/ward → WardSummary
export const ward: WardSummary = {
  ward: 'Ward 7A',
  clinician: 'Dr. Who',
  date: 'Sat, 18 May 09:20',
  counts: { patients: 18, tasks: 37 },
  patients,
};

// Encounter for the hero (Hospital No. 1234567)
const encounter: Encounter = {
  id: ENCOUNTER_ID,
  patientId: HERO_ID,
  date: '2026-05-18',
  visitTitle: 'Ward round — Cardiology',
  visitType: 'inpatient',
  summary:
    'Admitted with shortness of breath and central chest pain. Cardiac work-up in progress.',
  presentingComplaint: 'SOB + Chest Pain',
  news: '2',
  investigations: [
    { label: 'CXR', value: 'Normal' },
    { label: 'Bloods', value: 'Pending' },
  ],
  pmh: ['HTN', 'IHD', 'Scoliosis'],
  allergies: ['Nuts'],
  medications: ['Lisinopril', 'Aspirin'],
  assessment: 'Chest pain — rule out acute coronary syndrome.',
  planText:
    'Send COVID PCR, Chest X-Ray, FBC (U&Es) and Troponin I (chest pain). Chase ECG.',
};

// ── Shared evidence excerpts ───────────────────────────────────────────────
const evNote = {
  type: 'note' as const,
  label: 'Ward-round note (A&P)',
  timestamp: '09:20',
  excerpt:
    'Chest pain — rule out ACS. Send troponin I, FBC/U&Es, COVID PCR, CXR. Chase ECG.',
  sourceRef: 'A&P — ward round 09:20',
};
const evLab = {
  type: 'lab' as const,
  label: 'Troponin I result',
  timestamp: '11:47',
  excerpt: 'Troponin I 4274 ng/L (ref < 14 ng/L). Markedly elevated.',
  sourceRef: 'Troponin I 11:47',
};
const evObs = {
  type: 'observation' as const,
  label: 'Vital signs',
  timestamp: '09:15',
  excerpt: 'HR 96, BP 148/88, SpO2 96% RA, NEWS 2. Ongoing chest discomfort.',
  sourceRef: 'Obs 09:15',
};
const evMar = {
  type: 'mar' as const,
  label: 'Medication record',
  timestamp: 'Active',
  excerpt: 'Regular Aspirin 75 mg OD, Lisinopril 10 mg OD. No anticoagulant charted.',
  sourceRef: 'MAR',
};
const evProtocol = {
  type: 'protocol' as const,
  label: 'ACS / chest-pain pathway',
  timestamp: 'v3.1',
  excerpt:
    'Raised troponin with chest pain: repeat troponin at 3 h, 12-lead ECG, cardiology review, loading Aspirin 300 mg if no contraindication.',
  sourceRef: 'Chest-pain pathway v3.1',
};

// 2. GET /api/patients/:id → { patient, encounter, tasks }
// FLAT extracted task list (requested / chased) — matches screen 3.
const tasks: Task[] = [
  {
    id: 't-covid',
    patientId: HERO_ID,
    encounterId: encounter.id,
    title: 'COVID PCR',
    category: 'requests',
    workflowId: 'order-lab',
    workflowLabel: 'Order lab / panel',
    status: 'requested',
    origin: 'extracted',
    confidence: 0.93,
    evidence: [evNote],
  },
  {
    id: 't-cxr',
    patientId: HERO_ID,
    encounterId: encounter.id,
    title: 'Chest X-Ray',
    category: 'requests',
    workflowId: 'order-lab',
    workflowLabel: 'Order imaging',
    status: 'requested',
    origin: 'extracted',
    confidence: 0.95,
    evidence: [evNote],
  },
  {
    id: 't-fbc',
    patientId: HERO_ID,
    encounterId: encounter.id,
    title: 'Full Blood Count (FBC, U&Es)',
    category: 'requests',
    workflowId: 'order-lab',
    workflowLabel: 'Order lab / panel',
    status: 'requested',
    origin: 'extracted',
    confidence: 0.94,
    evidence: [evNote],
  },
  {
    id: 't-troponin',
    patientId: HERO_ID,
    encounterId: encounter.id,
    title: 'Troponin I',
    category: 'requests',
    reason: 'Chest pain',
    workflowId: 'order-lab',
    workflowLabel: 'Order troponin',
    status: 'requested',
    origin: 'extracted',
    confidence: 0.97,
    evidence: [evNote, evObs],
  },
  {
    id: 't-ecg',
    patientId: HERO_ID,
    encounterId: encounter.id,
    title: 'ECG',
    category: 'requests',
    workflowId: 'ecg',
    workflowLabel: '12-lead ECG',
    status: 'chased',
    origin: 'extracted',
    confidence: 0.92,
    evidence: [evNote],
  },
];

export const patientDetail: {
  patient: Patient;
  encounter: Encounter;
  tasks: Task[];
} = { patient: hero, encounter, tasks };

// 9. GET /api/results/:id → { result, task, patient }
export const result: ResultEvent = {
  id: RESULT_ID,
  taskId: 't-troponin',
  patientId: HERO_ID,
  name: 'Troponin I',
  value: '4274',
  unit: 'ng/L',
  refRange: '< 14 ng/L',
  status: 'high',
  priorValue: undefined,
  returnedAt: 'Today, 11:47',
  context: 'First troponin drawn on admission for chest pain.',
  requiresReview: true,
  interpretation: 'Markedly raised troponin I in the context of chest pain.',
};

export const resultDetail: {
  result: ResultEvent;
  task: Task;
  patient: Patient;
} = { result, task: tasks[3], patient: hero };

// 7. GET /api/notifications → urgent troponin alert (screen 4)
export const notification: Notification = {
  id: 'notif-trop-1234567',
  patientId: HERO_ID,
  resultEventId: RESULT_ID,
  title: 'Needs urgent attention – Troponin',
  body: 'Hospital No. 1234567',
  createdAt: '2026-05-18T11:47:00+01:00',
  deepLink: `/results/${RESULT_ID}`,
  urgent: true,
};

// 10. POST /api/results/:id/suggest → { suggestion } (screen 6, REAL ReAct)
export const suggestion: Suggestion = {
  id: 'sug-trop-1234567',
  resultEventId: RESULT_ID,
  headline: 'Markedly raised troponin I with chest pain — treat as suspected ACS.',
  summary:
    'Troponin I returned 4274 ng/L (ref < 14 ng/L) in a patient with SOB and chest pain and a history of IHD. Consistent with an acute coronary concern; follow the chest-pain pathway. Decision support only — clinician confirms every action.',
  proposedActions: [
    {
      id: 's-aspirin',
      title: 'Aspirin 300 mg loading dose',
      detail: 'if no contraindication',
      selectedByDefault: true,
      workflowId: 'medication-administer',
      workflowLabel: 'Administer Aspirin 300 mg loading',
    },
    {
      id: 's-enoxaparin',
      title: 'Enoxaparin 1 mg/kg',
      detail: 'Anticoagulation per ACS pathway, if no contraindication.',
      selectedByDefault: true,
      workflowId: 'medication-administer',
      workflowLabel: 'Administer Enoxaparin 1 mg/kg',
    },
    {
      id: 's-ecg',
      title: 'Repeat 12-Lead ECG',
      detail: 'Assess for ischaemic changes.',
      selectedByDefault: true,
      workflowId: 'ecg',
      workflowLabel: '12-lead ECG',
    },
    {
      id: 's-monitoring',
      title: 'Continuous cardiac monitoring',
      detail: 'Telemetry for arrhythmia risk.',
      selectedByDefault: true,
      workflowId: 'cardiac-monitoring',
      workflowLabel: 'Cardiac monitoring',
    },
    {
      id: 's-repeat-trop',
      title: 'Repeat Troponin I at 3 hours',
      detail: 'Confirm rise/fall pattern per ACS pathway.',
      selectedByDefault: true,
      workflowId: 'order-lab',
      workflowLabel: 'Order repeat troponin',
    },
    {
      id: 's-cards',
      title: 'Urgent Cardiology review',
      detail: 'Specialty input for suspected ACS.',
      selectedByDefault: true,
      workflowId: 'specialty-consult',
      workflowLabel: 'Cardiology review',
    },
    {
      id: 's-reassess',
      title: 'Schedule reassessment',
      detail: 'Re-evaluate once the repeat troponin returns.',
      selectedByDefault: true,
      workflowId: 'reassess-recheck',
      workflowLabel: 'Reassess after repeat troponin',
    },
  ],
  anomaly: {
    detected: true,
    description:
      'Troponin I 4274 ng/L is > 300× the upper reference limit (< 14 ng/L) — a critical anomaly that triggered these recommendations.',
  },
  trace: [
    { order: 1, tool: 'search_observations', input: 'query "troponin"', summary: 'Troponin I 4274 ng/L (ref < 14) — markedly raised.' },
    { order: 2, tool: 'search_observations', input: 'query "vitals / chest pain"', summary: 'HR 96, BP 148/88, NEWS 2, ongoing chest discomfort.' },
    { order: 3, tool: 'get_medications', input: 'active medication list', summary: 'Aspirin 75 mg OD, Lisinopril 10 mg OD; no anticoagulant charted.' },
    { order: 4, tool: 'get_note_section', input: 'note section "assessment"', summary: 'Chest pain — rule out ACS; PMH HTN/IHD.' },
    { order: 5, tool: 'get_local_guidance', input: 'topic "chest pain / ACS"', summary: 'Pathway v3.1: repeat troponin 3 h, 12-lead ECG, cardiology, Aspirin 300 mg loading.' },
    { order: 6, tool: 'search_workflows', input: 'query "repeat troponin / ECG / cardiology / aspirin"', summary: 'Matched order-lab, ecg, specialty-consult, medication-administer.' },
  ],
  evidence: [evLab, evObs, evMar, evNote, evProtocol],
  guardrails: [
    'WardFlow explains why review matters — it does not make a diagnosis.',
    'Drug and dose are decision support only; nothing is prescribed until you confirm.',
    'The clinician confirms every action before it is added to the plan.',
  ],
};

// 8/12. GET /api/patients/:id/timeline → { timeline, actionsTaken } (screen 8)
export const timeline: TimelineEvent[] = [
  { id: 'tl-trop-initial', patientId: HERO_ID, ts: '11:47', label: 'Troponin I (initial)', type: 'result', note: '4274 ng/L' },
  { id: 'tl-trop-repeat', patientId: HERO_ID, ts: '14:45', label: 'Repeat Troponin I', type: 'result', note: 'Pending' },
  { id: 'tl-ecg', patientId: HERO_ID, ts: '11:52', label: '12-Lead ECG', type: 'order', note: 'Completed' },
  { id: 'tl-cards', patientId: HERO_ID, ts: '12:10', label: 'Cardiology Review', type: 'agent', note: 'Completed' },
];

export const actionsTaken: string[] = [
  'Aspirin loading dose of 300 mg prescribed',
  'Enoxaparin 1 mg/Kg prescribed',
];

// 5/6. Execution (legacy shape — kept for contract completeness)
export const execution: Execution = {
  total: 4,
  done: 3,
  tasks: [
    { id: 's-repeat-trop', title: 'Repeat Troponin I in 3 hours', status: 'sent' },
    { id: 's-ecg', title: '12-Lead ECG', status: 'completed' },
    { id: 's-cards', title: 'Cardiology Review', status: 'completed' },
    { id: 's-aspirin', title: 'Aspirin 300 mg loading', status: 'sent' },
  ],
};

// 13. GET /api/activity → ActivitySummary
export const activity: ActivitySummary = {
  completedQuietly: 3,
  needsAttention: 1,
  resultPending: 1,
};

// 15. GET /api/workflows → { workflows } (ACS catalog)
export const workflows: WorkflowDef[] = [
  { id: 'order-lab', name: 'Order repeat troponin', description: 'Place an order for a repeat troponin / bloods.', category: 'orders' },
  { id: 'ecg', name: '12-lead ECG', description: 'Request a 12-lead ECG.', category: 'monitoring' },
  { id: 'cardiac-monitoring', name: 'Cardiac monitoring', description: 'Start continuous cardiac (telemetry) monitoring.', category: 'monitoring' },
  { id: 'specialty-consult', name: 'Cardiology review', description: 'Request a Cardiology specialty review.', category: 'specialty_input' },
  { id: 'medication-administer', name: 'Administer Aspirin 300 mg loading', description: 'Clinician-gated medication administration (drug + dose).', category: 'medication' },
  { id: 'reassess-recheck', name: 'Reassess after repeat troponin', description: 'Re-evaluate once the repeat troponin returns.', category: 'monitoring' },
];

const workflowLabel = (id: string) =>
  workflows.find((w) => w.id === id)?.name ?? 'Workflow';

// 16. POST /api/workflows/run → { run } (offline fallback factory)
export function makeWorkflowRun(
  workflowId: string,
  actionId: string | undefined,
  patientId: string,
): WorkflowRun {
  return {
    runId: `wfr-fx-${workflowId}-${Math.random().toString(36).slice(2, 8)}`,
    workflowId,
    label: workflowLabel(workflowId),
    status: 'triggered',
    triggeredAt: new Date().toISOString(),
    actionId,
    patientId,
  };
}

// Closed-loop re-assessment (offline fallback for /workflows/:runId/complete).
export const reassessment: Suggestion = {
  id: 'reassess-trop-1234567',
  resultEventId: 'res-trop-1234567-repeat',
  headline: 'Repeat troponin resulted — trend confirms myocardial injury; cardiology aware.',
  summary:
    'Repeat Troponin I at 3 h returned 5120 ng/L (initial 4274 ng/L), confirming a rising pattern consistent with acute myocardial injury. Cardiology has reviewed; Aspirin loading given. Continue ACS pathway and monitor — no new autonomous action taken.',
  proposedActions: [
    {
      id: 'reassess-1',
      title: 'Continue cardiac monitoring',
      detail: 'Rising troponin trend; keep on telemetry pending cardiology plan.',
      selectedByDefault: true,
      workflowId: 'cardiac-monitoring',
      workflowLabel: 'Cardiac monitoring',
    },
  ],
  evidence: [
    { type: 'lab', label: 'Repeat troponin', excerpt: 'Repeat Troponin I 5120 ng/L (was 4274 ng/L) — rising.' },
    evProtocol,
  ],
  guardrails: [
    'No new diagnosis is asserted; findings are described as a trend.',
    'No new drug or dose is prescribed; further steps remain at clinician discretion.',
  ],
  trace: [
    { order: 1, tool: 'search_observations', input: 'query "troponin"', summary: 'Troponin I 4274 → 5120 ng/L (rising).' },
    { order: 2, tool: 'get_local_guidance', input: 'topic "ACS"', summary: 'Pathway v3.1: rising troponin confirms myocardial injury; continue monitoring.' },
  ],
};

// POST /api/workflows/:runId/complete → { run, reassessment, timeline }
export function workflowCompletion(runId: string) {
  const now = new Date().toISOString();
  const completedTimeline: TimelineEvent[] = [
    { id: 'tl-trop-initial', patientId: HERO_ID, ts: '11:47', label: 'Troponin I (initial)', type: 'result', note: '4274 ng/L' },
    { id: 'tl-ecg', patientId: HERO_ID, ts: '11:52', label: '12-Lead ECG', type: 'order', note: 'Completed' },
    { id: 'tl-cards', patientId: HERO_ID, ts: '12:10', label: 'Cardiology Review', type: 'agent', note: 'Completed' },
    { id: 'tl-trop-repeat', patientId: HERO_ID, ts: '14:45', label: 'Repeat Troponin I', type: 'result', note: '5120 ng/L' },
    { id: `tl-reassess-${runId}`, patientId: HERO_ID, ts: '14:47', label: 'Agent re-assessed', type: 'agent', note: 'Completed' },
  ];
  return {
    run: {
      runId,
      workflowId: 'reassess-recheck',
      label: 'Reassess after repeat troponin',
      status: 'completed' as const,
      triggeredAt: now,
      patientId: HERO_ID,
    },
    reassessment,
    timeline: completedTimeline,
  };
}

// ── Frontend-only view helpers ─────────────────────────────────────────────

// Synthetic output for a *chased* task (a request that was followed up).
// Requested-but-not-chased tasks have no output yet. Clearly synthetic.
export function chasedOutput(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('ecg')) {
    return 'Performed — sinus tachycardia (~96 bpm), no acute ST-segment elevation. Formal cardiology over-read pending.';
  }
  if (t.includes('x-ray') || t.includes('cxr') || t.includes('chest')) {
    return 'Reported — clear lung fields, no acute cardiopulmonary abnormality.';
  }
  return 'Result returned — available for review.';
}


// Offline detail for a roster patient by id. Hero → full detail; others → an
// honest minimal detail (their own row + empty tasks), never the hero's data.
export function patientDetailFor(id: string): {
  patient: Patient;
  encounter: Encounter;
  tasks: Task[];
} {
  if (id === HERO_ID) return patientDetail;
  const p = patients.find((x) => x.id === id) ?? hero;
  return {
    patient: p,
    encounter: {
      id: `enc-${id}`,
      patientId: id,
      date: '2026-05-18',
      visitTitle: `${p.specialty} — inpatient`,
      visitType: 'inpatient',
      summary: 'No new ward-round actions today. Continue current plan.',
      presentingComplaint: '—',
      news: '1',
      investigations: [],
      pmh: [],
      allergies: [],
      medications: [],
      assessment: 'Stable — no change since last review.',
      planText: 'Continue current management.',
    },
    tasks: [],
  };
}
