// ChartProvider — the read-only chart surface the suggestion ReAct agent pulls
// evidence from (CONTRACTS §3.2). The live server implements this against the
// store (store/chartProvider.ts); StubChartProvider lets us run + verify the
// agent standalone, grounded in the Hospital No. 1234567 chest-pain / ACS
// scenario. NOTE: standalone convenience only — not wired into the server.

export interface ChartObservation {
  name: string;
  value: string;
  unit?: string;
  time?: string;
}
export interface ChartMedication {
  name: string;
  dose?: string;
  status?: string; // active | held | discontinued
}
export interface ChartGuidance {
  title: string;
  version: string;
  excerpt: string;
}

export type NoteSection = 'subjective' | 'objective' | 'assessment' | 'plan';

export interface ChartProvider {
  searchObservations(patientId: string, query: string, limit?: number): Promise<ChartObservation[]>;
  getMedications(patientId: string): Promise<ChartMedication[]>;
  getNoteSection(encounterId: string, section: string): Promise<string>;
  getLocalGuidance(topic: string): Promise<ChartGuidance>;
}

// --- Hospital No. 1234567 chest-pain / ACS stub -----------------------------
// Markedly raised Troponin I (4274 ng/L, ref < 14) with a 12-lead ECG finding;
// active aspirin + lisinopril; a plan section for the ACS work-up; a chest-pain
// / ACS pathway protocol snippet (v3.1).

const HERO_OBS: ChartObservation[] = [
  { name: 'Troponin I', value: '4274', unit: 'ng/L', time: '2026-05-18T11:47:00-07:00' },
  { name: '12-Lead ECG', value: 'Sinus rhythm with minor ST-T changes in the anterior leads', time: '2026-05-18T11:52:00-07:00' },
  { name: 'Heart rate', value: '92', unit: '/min', time: '2026-05-18T09:20:00-07:00' },
  { name: 'Blood Pressure', value: '148/88', unit: 'mmHg', time: '2026-05-18T09:20:00-07:00' },
  { name: 'Oxygen saturation', value: '95', unit: '%', time: '2026-05-18T09:20:00-07:00' },
];

const HERO_MEDS: ChartMedication[] = [
  { name: 'aspirin', dose: '75 mg PO daily', status: 'active' },
  { name: 'lisinopril', dose: '10 mg PO daily', status: 'active' },
  { name: 'atorvastatin', dose: '40 mg PO nightly', status: 'active' },
  { name: 'bisoprolol', dose: '2.5 mg PO daily', status: 'active' },
];

const HERO_NOTE: Record<NoteSection, string> = {
  subjective:
    '58-year-old man with a two-hour history of central, tight chest pain radiating to the left arm, with shortness of breath. Background of hypertension and ischaemic heart disease. Nut allergy. On lisinopril and aspirin at home.',
  objective:
    'NEWS 2. HR 92, BP 148/88, RR 20, SpO2 95% on room air. Chest clear. Heart sounds normal. Chest X-Ray normal. Troponin I 4274 ng/L (ref < 14). 12-lead ECG: minor ST-T changes anterior leads.',
  assessment:
    'Central chest pain with shortness of breath on a background of ischaemic heart disease and hypertension — acute coronary syndrome must be excluded. Markedly raised Troponin I consistent with myocardial injury.',
  plan:
    'Send/repeat Troponin I (3-hour repeat) and obtain a 12-lead ECG. Give aspirin 300 mg loading dose if no contraindication. Start continuous cardiac monitoring. Urgent Cardiology review. Consider anticoagulation (enoxaparin 1 mg/kg) once ACS confirmed and bleeding risk assessed.',
};

const CHEST_PAIN_PROTOCOL: ChartGuidance = {
  title: 'Acute Chest Pain / Suspected ACS Pathway',
  version: 'v3.1',
  excerpt:
    'For suspected acute coronary syndrome: obtain a 12-lead ECG within 10 minutes and a Troponin I on the initial sample, repeat at 3 hours. Give aspirin 300 mg loading dose if no contraindication. Arrange urgent Cardiology review for any raised or dynamic troponin, and consider anticoagulation (e.g. enoxaparin 1 mg/kg) once ACS is confirmed and bleeding risk assessed. Every drug and dose is confirmed by the clinician before administration.',
};

const TROPONIN_PROTOCOL: ChartGuidance = {
  title: 'Raised Troponin — Interpretation & Escalation',
  version: 'v3.1',
  excerpt:
    'A markedly raised Troponin I in the context of chest pain is a finding consistent with myocardial injury, not a standalone diagnosis. Repeat at 3 hours to establish the trend, start continuous cardiac monitoring, and escalate to Cardiology urgently.',
};

export class StubChartProvider implements ChartProvider {
  // The patient id this stub answers for; matches the fixture ResultEvent.
  constructor(public patientId = 'pt-1234567') {}

  async searchObservations(_patientId: string, query: string, limit = 20): Promise<ChartObservation[]> {
    const q = (query || '').trim().toLowerCase();
    const matches = q
      ? HERO_OBS.filter((o) => o.name.toLowerCase().includes(q) || q.includes(o.name.toLowerCase()))
      : HERO_OBS;
    // Chronological so a trend reads naturally.
    return matches.slice(0, limit).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  async getMedications(_patientId: string): Promise<ChartMedication[]> {
    return HERO_MEDS;
  }

  async getNoteSection(_encounterId: string, section: string): Promise<string> {
    const key = (section || '').trim().toLowerCase() as NoteSection;
    return HERO_NOTE[key] ?? `No '${section}' section available.`;
  }

  async getLocalGuidance(topic: string): Promise<ChartGuidance> {
    const t = (topic || '').toLowerCase();
    if (t.includes('tropon')) return TROPONIN_PROTOCOL;
    return CHEST_PAIN_PROTOCOL; // default: chest pain / ACS
  }
}
