// Content-hash cache for real LLM outputs (CONTRACTS §3).
// Key = sha256 of a canonical JSON of {namespace, input}.
// Files live at app/data/cache/<key>.json and are committed for replay.
//
// INTEL_MODE:
//   'auto'   (default) — return cache if present, else call API + write.
//   'live'            — always call API + overwrite the cache file.
//   'cached'          — replay only; throw a clear error if no cache exists.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// app/server/src/intel -> app/data/cache
export const CACHE_DIR = path.resolve(__dirname, '../../../data/cache');

export type IntelMode = 'auto' | 'live' | 'cached';

export function intelMode(): IntelMode {
  const m = (process.env.INTEL_MODE?.trim() as IntelMode) || 'auto';
  if (m !== 'auto' && m !== 'live' && m !== 'cached') return 'auto';
  return m;
}

/** Deterministic JSON: object keys sorted recursively so the hash is stable. */
export function canonicalize(value: unknown): string {
  const seen = new WeakSet();
  const norm = (v: any): any => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) throw new Error('cache: cannot canonicalize a circular structure');
    seen.add(v);
    if (Array.isArray(v)) return v.map(norm);
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) {
      if (v[k] === undefined) continue; // drop undefined for stability
      out[k] = norm(v[k]);
    }
    return out;
  };
  return JSON.stringify(norm(value));
}

export function cacheKey(namespace: string, input: unknown): string {
  return createHash('sha256').update(canonicalize({ namespace, input })).digest('hex');
}

function fileFor(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

interface CacheEnvelope<T> {
  namespace: string;
  key: string;
  createdAt: string;
  model: string;
  output: T;
}

/** Read a cached value, or null if absent. */
export function get<T>(namespace: string, input: unknown): T | null {
  const key = cacheKey(namespace, input);
  const file = fileFor(key);
  if (!fs.existsSync(file)) return null;
  const env = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheEnvelope<T>;
  return env.output;
}

/** Write a value to the cache, returning the key. */
export function set<T>(namespace: string, input: unknown, output: T, model = ''): string {
  const key = cacheKey(namespace, input);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const env: CacheEnvelope<T> = { namespace, key, createdAt: new Date().toISOString(), model, output };
  fs.writeFileSync(fileFor(key), JSON.stringify(env, null, 2));
  return key;
}

export interface WithCacheResult<T> {
  output: T;
  key: string;
  hit: boolean;
  mode: IntelMode;
}

/**
 * Run `producer` under the cache policy for the current INTEL_MODE.
 * `producer` receives no args and returns the value to cache.
 */
export async function withCache<T>(
  namespace: string,
  input: unknown,
  producer: () => Promise<{ output: T; model?: string }>,
): Promise<WithCacheResult<T>> {
  const mode = intelMode();
  const key = cacheKey(namespace, input);
  const file = fileFor(key);
  const exists = fs.existsSync(file);

  if (mode === 'cached') {
    if (!exists) {
      throw new Error(
        `[intel] INTEL_MODE=cached but no cache for '${namespace}' (key ${key}). ` +
          `Run 'npm run intel:warm' (or set INTEL_MODE=auto/live) to populate it. Expected file: ${file}`,
      );
    }
    return { output: get<T>(namespace, input) as T, key, hit: true, mode };
  }

  if (mode === 'auto' && exists) {
    return { output: get<T>(namespace, input) as T, key, hit: true, mode };
  }

  // 'live' (always) or 'auto' with no cache: call the producer and write.
  const { output, model } = await producer();
  set(namespace, input, output, model ?? '');
  return { output, key, hit: false, mode };
}
