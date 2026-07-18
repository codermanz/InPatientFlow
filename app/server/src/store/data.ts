// data — typed loaders for the authored + seeded JSON in app/data.
// Backs the API (ward/patient/hero/scripted) and the intel ChartProvider
// tools (search_observations / get_medications / get_note_section /
// get_local_guidance). Reads from disk on each call — no caching needed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  WardSummary,
  Patient,
  Encounter,
  ResultEvent,
  Notification,
  TimelineEvent,
} from '../types.js';
import type { SeedEncounter, KeyObservation } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// app/server/src/store -> repo root -> app/data
const DATA_DIR = path.resolve(__dirname, '../../../..', 'app', 'data');

function readJson<T>(file: string): T {
  const full = path.join(DATA_DIR, file);
  return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
}

// ---- Authored file shapes ------------------------------------------------
export interface ChartObservation {
  name: string;
  loinc?: string;
  value: string;
  unit?: string;
  time: string;
  status?: string;
}
export interface ChartMedication {
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  class?: string;
  status: 'active' | 'completed' | 'stopped' | 'on-hold' | string;
}
export interface NoteSections {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}
export interface GuidanceEntry {
  title: string;
  version: string;
  excerpt: string;
}
export interface HeroChart {
  observations: ChartObservation[];
  medications: ChartMedication[];
  noteSections: NoteSections;
  guidance: Record<string, GuidanceEntry>;
}
export interface Hero {
  patient: Patient;
  encounter: Encounter;
  note: string;
  transcript: string;
  chart: HeroChart;
}
export interface Scripted {
  resultEvent: ResultEvent;
  notification: Notification;
  timeline: TimelineEvent[];
  // Screen 8 "Actions Taken" list (e.g. "Aspirin loading dose of 300 mg prescribed").
  actionsTaken?: string[];
  activity: { completedQuietly: number; needsAttention: number; resultPending: number };
  // Closed-loop recheck (CONTRACTS §3.4): the repeat result after the clinician
  // triggered the corrective/recheck workflow (drives the monitoring re-assessment).
  recheck?: { resultEvent: ResultEvent };
}

// ---- Loaders -------------------------------------------------------------
export function loadSeed(): SeedEncounter[] {
  return readJson<SeedEncounter[]>('seed.json');
}
export function loadWard(): WardSummary {
  return readJson<WardSummary>('ward.json');
}
export function loadHero(): Hero {
  return readJson<Hero>('hero.json');
}
export function loadScripted(): Scripted {
  return readJson<Scripted>('scripted.json');
}

// The hero (Hospital No. 1234567) is the only fully-charted patient. These
// helpers back the intel read-only tools; they resolve against hero.json.
const HERO_ID = 'pt-1234567';

function heroIfMatch(patientId: string): Hero | null {
  const hero = loadHero();
  if (patientId === hero.patient.id || patientId === HERO_ID) return hero;
  return null;
}

/**
 * search_observations(patientId, query, limit?) → {name,value,unit,time}[]
 * Case-insensitive substring match on observation name, chronological order.
 */
export function getObservations(
  patientId: string,
  query = '',
  limit = 20,
): KeyObservation[] {
  const hero = heroIfMatch(patientId);
  if (!hero) return [];
  const q = query.trim().toLowerCase();
  const matched = hero.chart.observations.filter(
    (o) => !q || o.name.toLowerCase().includes(q),
  );
  matched.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return matched
    .slice(0, limit)
    .map((o) => ({ name: o.name, value: o.value, unit: o.unit, time: o.time }));
}

/** get_medications(patientId) → {name,dose,route?,status}[] */
export function getMedications(patientId: string): ChartMedication[] {
  const hero = heroIfMatch(patientId);
  if (!hero) return [];
  return hero.chart.medications;
}

/** get_note_section(encounterId, section) → string */
export function getNoteSection(
  encounterId: string,
  section: keyof NoteSections,
): string {
  const hero = loadHero();
  if (encounterId !== hero.encounter.id) return '';
  return hero.chart.noteSections[section] ?? '';
}

/** get_local_guidance(topic) → {title, version, excerpt} | null */
export function getGuidance(topic: string): GuidanceEntry | null {
  const hero = loadHero();
  const key = topic.trim().toLowerCase();
  return hero.chart.guidance[key] ?? null;
}
