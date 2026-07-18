// Shared route helpers: patient/encounter resolution. The extraction-input
// builders now live in store/extractInputs.ts (single source of truth shared
// with intel/warm.ts); we re-export them so existing route imports keep working.
import type { Patient, Encounter } from '../types.js';
import { loadHero, loadWard } from '../store/data.js';
import {
  HERO_ID,
  isHero,
  seedForPatient,
  encounterFromSeed,
  buildExtractInputs,
  parseHeroAssessmentPlan,
  type ExtractInputs,
} from '../store/extractInputs.js';

export {
  HERO_ID,
  isHero,
  buildExtractInputs,
  parseHeroAssessmentPlan,
  type ExtractInputs,
};

export function resolvePatient(id: string): Patient | null {
  if (isHero(id)) return loadHero().patient;
  const fromWard = loadWard().patients.find((p) => p.id === id);
  if (fromWard) return fromWard;
  const s = seedForPatient(id);
  if (s) {
    return {
      id,
      hospitalNo: id.replace(/^pt-/, ''),
      bed: 'Bed —',
      initials: s.initials,
      ageSex: s.ageSex,
      name: s.name,
      ward: loadWard().ward,
      status: 'unchanged',
      taskCount: 0,
    };
  }
  return null;
}

/** Encounter for display (GET /api/patients/:id). Hero uses the lean authored one. */
export function resolveDisplayEncounter(id: string): Encounter | null {
  if (isHero(id)) return loadHero().encounter;
  const s = seedForPatient(id);
  if (!s) return null;
  return encounterFromSeed(id, s);
}
