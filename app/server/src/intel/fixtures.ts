// Bundled hero fixtures (synthetic Hospital No. 1234567) so intel:warm and
// standalone verification can run WITHOUT the Data agent's hero.json/scripted.json.
// Authored to match CONTRACTS v2 (troponin / ACS) so the REAL extraction yields
// the expected admission task list. NOTE: the live server + warm script use the
// store-backed inputs (store/extractInputs.ts, store/chartProvider.ts); these
// fixtures are a standalone convenience only.
import type { Encounter, ResultEvent } from '../types.js';
import type { PatientContext } from './prompts/extract.js';

export const HERO_PATIENT_ID = 'pt-1234567';
export const HERO_ENCOUNTER_ID = 'enc-js-1234567';

export const heroEncounter: Encounter = {
  id: HERO_ENCOUNTER_ID,
  patientId: HERO_PATIENT_ID,
  date: '2026-05-18',
  visitTitle: 'Acute admission — chest pain and shortness of breath',
  visitType: 'Acute medical admission',
  summary:
    '58M with central chest pain and shortness of breath on a background of HTN and IHD. Admission bloods and imaging requested; troponin pending on arrival.',
  presentingComplaint: 'SOB + Chest Pain',
  news: '2',
  pmh: ['HTN', 'IHD', 'Scoliosis'],
  allergies: ['Nuts'],
  medications: ['Lisinopril', 'Aspirin'],
  investigations: [
    { label: 'CXR', value: 'Normal' },
    { label: 'Bloods', value: 'Pending' },
  ],
  assessment:
    'Central chest pain with shortness of breath on a background of ischaemic heart disease and hypertension — acute coronary syndrome must be excluded. NEWS 2, haemodynamically stable.',
  planText: [
    '- Send a Troponin I on the initial sample (reason: chest pain).',
    '- Obtain a 12-lead ECG now to look for ischaemic changes.',
    '- Order a Full Blood Count with U&Es for baseline haematology and renal function.',
    '- Order a COVID PCR swab as part of the acute admission screen.',
    '- Order a Chest X-Ray to exclude an acute respiratory cause.',
  ].join('\n'),
};

export const heroPatientContext: PatientContext = {
  patientId: HERO_PATIENT_ID,
  name: 'Hospital No. 1234567',
  ageSex: '58M',
  conditionLabels: [
    'Chest pain — suspected acute coronary syndrome',
    'Ischaemic heart disease',
    'Hypertension',
  ],
  medicationLabels: ['Aspirin 75 mg PO daily', 'Lisinopril 10 mg PO daily'],
  keyObservations: [
    { name: 'Troponin I', value: '4274', unit: 'ng/L', time: '2026-05-18T11:47:00-07:00' },
    { name: 'Heart rate', value: '92', unit: '/min', time: '2026-05-18T09:20:00-07:00' },
    { name: 'Blood Pressure', value: '148/88', unit: 'mm[Hg]', time: '2026-05-18T09:20:00-07:00' },
  ],
  transcriptExcerpts: [
    'DR: Given the chest pain and cardiac history we need to rule out a heart attack — send a Troponin I on this first sample, reason chest pain, and get a 12-lead ECG now.',
    'DR: Also send a Full Blood Count with U&Es so we have baseline bloods and kidney function.',
    'DR: And as part of the admission screen, please add a COVID PCR swab and a Chest X-Ray.',
  ],
};

// Scripted raised return for the hero (CONTRACTS v2 scripted.json).
export const heroResultEvent: ResultEvent = {
  id: 'res-troponin-js',
  taskId: 'task-troponin-i',
  patientId: HERO_PATIENT_ID,
  name: 'Troponin I',
  value: '4274',
  unit: 'ng/L',
  refRange: '< 14 ng/L',
  status: 'high',
  returnedAt: '2026-05-18T11:47:00-07:00',
  context: 'Initial Troponin I markedly elevated in a patient presenting with central chest pain.',
  requiresReview: true,
  interpretation: 'Markedly raised troponin I in the context of chest pain.',
};
