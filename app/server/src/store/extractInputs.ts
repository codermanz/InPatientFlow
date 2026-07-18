// Shared source of truth for the (encounter, patientContext) the REAL
// extractor sees — used by BOTH the extract-tasks route (routes/_shared.ts) and
// the cold-warm script (intel/warm.ts), so they cache the extraction at the
// SAME key. Lives in store/ (not routes/) so intel/ may import it without
// pulling in the HTTP layer. (intel -> store is fine; store must NOT import
// from routes.)
import type { Encounter } from '../types.js';
import type { PatientContext } from '../intel/prompts/extract.js';
import { loadHero, loadWard, loadSeed } from './data.js';
import type { SeedEncounter } from './seed.js';

export const HERO_ID = 'pt-1234567';

// The proactive concern that seeds screen 4's recommendation (endpoint 14).
// Shared so the route default and the warm script produce the SAME cache key.
export const HERO_CONCERN =
  'Central chest pain with shortness of breath on a background of IHD and hypertension; Troponin I pending on the initial sample and no ACS treatment order placed yet.';

export function isHero(id: string): boolean {
  return id === HERO_ID || id === loadHero().patient.id;
}

/** Map a non-hero ward patient to a seed encounter deterministically. */
export function seedForPatient(id: string): SeedEncounter | null {
  const seed = loadSeed();
  const direct = seed.find((s) => s.id === id || s.patientId === id);
  if (direct) return direct;
  const nonHero = loadWard().patients.filter((p) => p.id !== HERO_ID);
  const idx = nonHero.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  return seed[idx % seed.length] ?? null;
}

export function encounterFromSeed(patientId: string, s: SeedEncounter): Encounter {
  const summary = (s.assessment || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  const planText =
    s.planBullets && s.planBullets.length
      ? s.planBullets.map((b) => `- ${b}`).join('\n')
      : s.assessment || '';
  return {
    id: s.id,
    patientId,
    date: s.date,
    visitTitle: s.visitTitle || 'Inpatient encounter',
    visitType: s.visitType || '',
    summary,
    presentingComplaint: '',
    keyInvestigations: (s.keyObservations || [])
      .slice(0, 3)
      .map((o) => ({ label: o.name, value: `${o.value}${o.unit ? ' ' + o.unit : ''}` })),
    assessment: s.assessment || '',
    planText,
  };
}

/**
 * Extract from the hero note the full "Assessment and Plan" block (which
 * contains the documented action bullets), up to the Return-precautions footer.
 * hero.encounter.assessment/planText are lean one-liners; the rich plan lives
 * in the note, so extraction must be fed the note's A&P (CRITICAL HERO FIX).
 */
export function parseHeroAssessmentPlan(note: string): string {
  const start = note.match(/\*\*\s*Assessment and Plan\s*:?\s*\*\*/i);
  if (!start || start.index === undefined) return '';
  let rest = note.slice(start.index + start[0].length);
  const end = rest.match(/\*\*\s*Return precautions\s*:?\s*\*\*/i);
  if (end && end.index !== undefined) rest = rest.slice(0, end.index);
  return rest.trim();
}

export interface ExtractInputs {
  encounter: Encounter;
  patientContext: PatientContext;
}

/**
 * Build the (encounter, patientContext) the REAL extractor sees.
 * Hero: assessment = note's structured assessment section, planText = the full
 * note A&P block (with bullets) + transcript excerpts + meds/observations, so
 * extraction legitimately yields the documented tasks. Deterministic so the
 * cache key is stable across the route AND the warm script.
 */
export function buildExtractInputs(id: string): ExtractInputs | null {
  if (isHero(id)) {
    const hero = loadHero();
    const apBlock = parseHeroAssessmentPlan(hero.note);
    const encounter: Encounter = {
      ...hero.encounter,
      assessment: hero.chart.noteSections.assessment,
      planText: apBlock || hero.chart.noteSections.plan,
    };
    const transcriptExcerpts = hero.transcript
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const patientContext: PatientContext = {
      patientId: hero.patient.id,
      name: hero.patient.name,
      ageSex: hero.patient.ageSex,
      conditionLabels: [
        'Chest pain — suspected acute coronary syndrome',
        'Ischaemic heart disease',
        'Hypertension',
      ],
      medicationLabels: hero.chart.medications.map((m) =>
        [m.name, m.dose, m.route, m.frequency].filter(Boolean).join(' '),
      ),
      keyObservations: hero.chart.observations
        .filter((o) => /troponin|ecg|heart rate|blood pressure|oxygen/i.test(o.name))
        .map((o) => ({
          name: o.name,
          value: o.value,
          ...(o.unit ? { unit: o.unit } : {}),
          ...(o.time ? { time: o.time } : {}),
        })),
      transcriptExcerpts,
    };
    return { encounter, patientContext };
  }

  const s = seedForPatient(id);
  if (!s) return null;
  const encounter = encounterFromSeed(id, s);
  const patientContext: PatientContext = {
    patientId: id,
    name: s.name,
    ageSex: s.ageSex,
    conditionLabels: s.conditionLabels ?? [],
    medicationLabels: s.medicationLabels ?? [],
    keyObservations: s.keyObservations ?? [],
    transcriptExcerpts: (s.transcript || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 14),
  };
  return { encounter, patientContext };
}
