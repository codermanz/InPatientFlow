// StoreChartProvider — the real ChartProvider backing the suggestion ReAct
// agent (CONTRACTS §3.2). Implements the intel/chart.ts interface against the
// Data agent's typed loaders in data.ts.
//
// Key behavior (task #11): search_observations(patientId,'troponin') MUST
// return the trend INCLUDING the scripted raised Troponin I (4274 ng/L), so the
// agent sees the returned result in context. We merge scripted.resultEvent into
// the observation trend. get_note_section resolves against the hero encounter,
// and get_local_guidance falls back to the chest-pain / ACS pathway.
import type {
  ChartProvider,
  ChartObservation,
  ChartMedication,
  ChartGuidance,
} from '../intel/chart.js';
import {
  getObservations,
  getMedications,
  getNoteSection,
  getGuidance,
  loadHero,
  loadScripted,
  type NoteSections,
} from './data.js';

export class StoreChartProvider implements ChartProvider {
  async searchObservations(
    patientId: string,
    query: string,
    limit = 20,
  ): Promise<ChartObservation[]> {
    const q = (query || '').trim().toLowerCase();
    const obs: ChartObservation[] = getObservations(patientId, query, 100).map((o) => ({
      name: o.name,
      value: o.value,
      ...(o.unit ? { unit: o.unit } : {}),
      ...(o.time ? { time: o.time } : {}),
    }));

    // Merge the scripted critical result into the trend so the agent sees the
    // full story (e.g. the returned K 2.9).
    try {
      const re = loadScripted().resultEvent;
      const nameLc = re.name.toLowerCase();
      const relevant = !q || nameLc.includes(q) || q.includes(nameLc);
      if (re.patientId === patientId && relevant) {
        const dup = obs.some(
          (o) => o.name === re.name && o.value === re.value && o.time === re.returnedAt,
        );
        if (!dup) {
          obs.push({
            name: re.name,
            value: re.value,
            ...(re.unit ? { unit: re.unit } : {}),
            time: re.returnedAt,
          });
        }
      }
    } catch {
      /* scripted.json unavailable — return chart obs only */
    }

    obs.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    return obs.slice(0, limit);
  }

  async getMedications(patientId: string): Promise<ChartMedication[]> {
    return getMedications(patientId).map((m) => ({
      name: m.name,
      ...(m.dose ? { dose: m.dose } : {}),
      ...(m.status ? { status: m.status } : {}),
    }));
  }

  async getNoteSection(encounterId: string, section: string): Promise<string> {
    const key = (section || '').trim().toLowerCase() as keyof NoteSections;
    const direct = getNoteSection(encounterId, key);
    if (direct) return direct;
    // The agent may omit encounterId; resolve against the hero encounter.
    try {
      const hero = loadHero();
      return hero.chart.noteSections[key] ?? `No '${section}' section available.`;
    } catch {
      return `No '${section}' section available.`;
    }
  }

  async getLocalGuidance(topic: string): Promise<ChartGuidance> {
    const g =
      getGuidance(topic) ??
      getGuidance('chest pain') ??
      getGuidance('acs') ??
      getGuidance('troponin');
    if (g) return { title: g.title, version: g.version, excerpt: g.excerpt };
    return {
      title: 'Local guidance',
      version: 'n/a',
      excerpt: 'No local guidance snippet available for this topic.',
    };
  }
}

export const storeChartProvider = new StoreChartProvider();
