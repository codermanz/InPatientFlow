// seed — Data agent. Parses the synthetic FHIR jsonl into a normalized
// seed.json of 25 encounters (real grounding data + backup). See CONTRACTS.md §4.
//
// Run via: npm run seed  (tsx app/server/src/store/seed.ts)
//
// Owns ONLY: app/data/seed.json (this script writes it). The authored files
// ward.json / hero.json / scripted.json are hand-written and not generated here.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// app/server/src/store -> repo root
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const JSONL = path.join(
  REPO_ROOT,
  'synthetic-ambient-fhir-25',
  'synthetic-ambient-fhir-25.jsonl',
);
const OUT = path.join(REPO_ROOT, 'app', 'data', 'seed.json');

// ---- Normalized shape written to seed.json ------------------------------
export interface KeyObservation {
  name: string;
  value: string;
  unit?: string;
  time?: string;
}
export interface SeedEncounter {
  id: string; // encounter id
  patientId: string; // fhir patient id
  name: string;
  initials: string;
  ageSex: string; // e.g. "81F"
  gender: string;
  visitTitle: string;
  visitType: string;
  date: string;
  note: string; // full SOAP markdown
  transcript: string; // full transcript
  assessment: string; // the Assessment & Plan section text
  planBullets: string[]; // extracted "- ..." action items from A&P
  conditionLabels: string[];
  medicationLabels: string[];
  keyObservations: KeyObservation[];
}

// ---- helpers ------------------------------------------------------------
function fullName(patient: any): string {
  const n = patient?.name?.[0];
  if (!n) return 'Unknown Patient';
  const given = Array.isArray(n.given) ? n.given.join(' ') : (n.given || '');
  return [given, n.family].filter(Boolean).join(' ').trim() || 'Unknown Patient';
}

function initialsFrom(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ageFrom(birthDate: string, encounterDate: string): number {
  const b = new Date(birthDate);
  const e = new Date(encounterDate);
  let age = e.getFullYear() - b.getFullYear();
  const m = e.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && e.getDate() < b.getDate())) age--;
  return age;
}

function sexLetter(gender: string): string {
  const g = (gender || '').toLowerCase();
  if (g === 'male') return 'M';
  if (g === 'female') return 'F';
  return g ? g[0].toUpperCase() : '?';
}

// Extract the "Assessment and Plan" section text from the SOAP markdown.
function extractAssessment(note: string): string {
  const idx = note.search(/assessment\s+and\s+plan/i);
  if (idx === -1) {
    // fall back to a bare "Assessment" heading
    const alt = note.search(/\*\*assessment/i);
    if (alt === -1) return '';
    return note.slice(alt).trim();
  }
  return note.slice(idx).trim();
}

// Pull "- ..." bullet action items from the A&P section.
function extractPlanBullets(assessment: string): string[] {
  const bullets: string[] = [];
  for (const raw of assessment.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^[-*]\s+(.*)$/);
    if (m && m[1].trim()) bullets.push(m[1].trim());
  }
  return bullets;
}

// Turn a single FHIR Observation into 0..n normalized KeyObservations.
function observationToEntries(obs: any): KeyObservation[] {
  const name: string = obs?.code?.text || obs?.code?.coding?.[0]?.display || 'Observation';
  const time: string | undefined = obs?.effectiveDateTime || obs?.issued;

  // Blood pressure / panels with components -> combine into one readable entry.
  if (Array.isArray(obs.component) && obs.component.length) {
    const parts = obs.component
      .map((c: any) => {
        const cName = c?.code?.text || c?.code?.coding?.[0]?.display || '';
        const q = c?.valueQuantity;
        if (!q) return null;
        return { cName, value: q.value, unit: q.unit };
      })
      .filter(Boolean) as { cName: string; value: number; unit: string }[];
    // Systolic/Diastolic -> "120/80"
    const sys = parts.find((p) => /systolic/i.test(p.cName));
    const dia = parts.find((p) => /diastolic/i.test(p.cName));
    if (sys && dia) {
      return [
        { name: 'Blood Pressure', value: `${sys.value}/${dia.value}`, unit: sys.unit, time },
      ];
    }
    return parts.map((p) => ({ name: p.cName, value: String(p.value), unit: p.unit, time }));
  }

  if (obs.valueQuantity) {
    return [
      {
        name,
        value: String(obs.valueQuantity.value),
        unit: obs.valueQuantity.unit,
        time,
      },
    ];
  }
  if (typeof obs.valueString === 'string') {
    return [{ name, value: obs.valueString, time }];
  }
  if (obs.valueCodeableConcept) {
    const v =
      obs.valueCodeableConcept.text || obs.valueCodeableConcept.coding?.[0]?.display;
    if (v) return [{ name, value: String(v), time }];
  }
  return [];
}

function categoryOf(obs: any): string {
  return obs?.category?.[0]?.coding?.[0]?.code || '';
}

// Pick a useful subset: all vital-signs plus laboratory results, capped.
function selectKeyObservations(observations: any[]): KeyObservation[] {
  const vitals: KeyObservation[] = [];
  const labs: KeyObservation[] = [];
  const other: KeyObservation[] = [];
  for (const obs of observations || []) {
    const cat = categoryOf(obs);
    const entries = observationToEntries(obs);
    if (cat === 'vital-signs') vitals.push(...entries);
    else if (cat === 'laboratory') labs.push(...entries);
    else other.push(...entries);
  }
  // Prefer vitals + labs; cap total to keep seed.json lean.
  const chosen = [...vitals, ...labs, ...other];
  return chosen.slice(0, 14);
}

function normalize(rec: any): SeedEncounter {
  const patient = rec.patient_context?.patient || {};
  const meta = rec.metadata || {};
  const long = rec.patient_context?.longitudinal_summary || {};
  const related = rec.encounter_fhir?.related_resources || {};

  const name = fullName(patient);
  const date: string = meta.date || rec.encounter_fhir?.encounter?.period?.start || '';
  const age = patient.birthDate && date ? ageFrom(patient.birthDate, date) : NaN;
  const sex = sexLetter(patient.gender);
  const assessment = extractAssessment(rec.note || '');

  return {
    id: meta.encounter_id || rec.encounter_fhir?.encounter?.id || rec.id,
    patientId: meta.patient_id || patient.id || '',
    name,
    initials: initialsFrom(name),
    ageSex: `${Number.isNaN(age) ? '?' : age}${sex}`,
    gender: patient.gender || '',
    visitTitle: meta.visit_title || '',
    visitType: meta.visit_type || '',
    date,
    note: rec.note || '',
    transcript: rec.transcript || '',
    assessment,
    planBullets: extractPlanBullets(assessment),
    conditionLabels: Array.isArray(long.condition_labels) ? long.condition_labels : [],
    medicationLabels: Array.isArray(long.medication_labels) ? long.medication_labels : [],
    keyObservations: selectKeyObservations(related.Observation || []),
  };
}

function main() {
  if (!fs.existsSync(JSONL)) {
    console.error(`[seed] dataset not found at ${JSONL}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(JSONL, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const encounters: SeedEncounter[] = lines.map((line, i) => {
    try {
      return normalize(JSON.parse(line));
    } catch (e) {
      throw new Error(`[seed] failed to parse line ${i + 1}: ${(e as Error).message}`);
    }
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(encounters, null, 2) + '\n', 'utf8');

  const bytes = fs.statSync(OUT).size;
  console.log(`[seed] wrote ${encounters.length} encounters -> ${OUT} (${bytes} bytes)`);

  // Print one trimmed sample for acceptance.
  const s = encounters[0];
  const sample = {
    id: s.id,
    patientId: s.patientId,
    name: s.name,
    initials: s.initials,
    ageSex: s.ageSex,
    gender: s.gender,
    visitTitle: s.visitTitle,
    visitType: s.visitType,
    date: s.date,
    note: s.note.slice(0, 120) + '…',
    transcript: s.transcript.slice(0, 120) + '…',
    assessment: s.assessment.slice(0, 120) + '…',
    planBullets: s.planBullets.slice(0, 3),
    conditionLabels: s.conditionLabels.slice(0, 3),
    medicationLabels: s.medicationLabels,
    keyObservations: s.keyObservations.slice(0, 4),
  };
  console.log('[seed] sample entry (trimmed):');
  console.log(JSON.stringify(sample, null, 2));
}

main();
