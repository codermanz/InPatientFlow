// intel:warm — run the REAL hero intelligence against the Anthropic API and
// write results to app/data/cache/*.json, so `npm run demo` (INTEL_MODE=cached)
// replays them deterministically.
//
// Warms ALL THREE hero keys at exactly the keys the routes use:
//   1. extractTasks   — via the SHARED buildExtractInputs (store/extractInputs),
//                       so it caches the CORRECTED extraction (same key as the
//                       extract-tasks route). (Backend-flagged reliability fix.)
//   2. suggestNextSteps — the scripted result review (results/:id/suggest).
//   3. recommendProactive — the proactive hero concern (patients/:id/recommend).
//
// intel -> store is allowed; store must NOT import from routes.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { extractTasksVerbose } from './extract.js';
import {
  suggestNextStepsVerbose,
  recommendProactiveVerbose,
  reassessAfterRecheckVerbose,
} from './suggest.js';
import { intelMode } from './cache.js';
import { buildExtractInputs, HERO_ID, HERO_CONCERN } from '../store/extractInputs.js';
import { storeChartProvider } from '../store/chartProvider.js';
import { loadScripted } from '../store/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// intel -> src -> server -> app -> repo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  console.log(`[intel:warm] INTEL_MODE=${intelMode()}  model=${process.env.INTEL_MODEL || 'claude-sonnet-5'}`);

  // Single source of truth for hero extraction inputs (same as the route).
  const inputs = buildExtractInputs(HERO_ID);
  if (!inputs) throw new Error(`[intel:warm] could not build extract inputs for hero '${HERO_ID}'`);
  const { encounter, patientContext } = inputs;

  // The scripted abnormal return, and the store-backed chart provider (same as
  // the routes) so the ReAct tools return the real hero chart.
  const resultEvent = loadScripted().resultEvent;
  const chart = storeChartProvider;

  // --- 1. Extraction (single-shot, CORRECTED key) ---
  console.log('\n[intel:warm] extractTasks …');
  const ex = await extractTasksVerbose(encounter, patientContext);
  console.log(`  cache ${ex.hit ? 'HIT' : 'WRITE'}  key=${ex.key.slice(0, 12)}…  repaired=${ex.result.repaired}`);
  console.log(`  ${ex.result.tasks.length} task(s):`);
  for (const t of ex.result.tasks) console.log(`    - [${t.category}] ${t.title}${t.timing ? ` (${t.timing})` : ''}`);
  console.log(`  tokens: in=${ex.result.usage.input_tokens} out=${ex.result.usage.output_tokens}`);

  // --- 2. Suggestion (ReAct, scripted result) ---
  console.log('\n[intel:warm] suggestNextSteps …');
  const sg = await suggestNextStepsVerbose(resultEvent, resultEvent.patientId, chart);
  console.log(`  cache ${sg.hit ? 'HIT' : 'WRITE'}  key=${sg.key.slice(0, 12)}…  iterations=${sg.result.iterations}`);
  console.log(`  tool calls: ${sg.result.trace.map((t) => t.tool).join(' → ') || '(replayed from cache)'}`);
  console.log(`  headline: ${sg.result.suggestion.headline}`);
  console.log(`  anomaly: ${sg.result.suggestion.anomaly ? `${sg.result.suggestion.anomaly.detected} — ${sg.result.suggestion.anomaly.description}` : '(none)'}`);
  console.log('  proposed actions:');
  for (const a of sg.result.suggestion.proposedActions) console.log(`    - ${a.title}  ->  ${a.workflowId}`);
  console.log(`  tokens: in=${sg.result.usage.input_tokens} out=${sg.result.usage.output_tokens}`);

  // --- 3. Proactive recommendation (ReAct, hero concern — screen 4) ---
  console.log('\n[intel:warm] recommendProactive …');
  const rc = await recommendProactiveVerbose(HERO_ID, HERO_CONCERN, chart);
  console.log(`  cache ${rc.hit ? 'HIT' : 'WRITE'}  key=${rc.key.slice(0, 12)}…  iterations=${rc.result.iterations}`);
  console.log(`  tool calls: ${rc.result.trace.map((t) => t.tool).join(' → ') || '(replayed from cache)'}`);
  console.log(`  headline: ${rc.result.suggestion.headline}`);
  console.log('  proposed actions:');
  for (const a of rc.result.suggestion.proposedActions) console.log(`    - ${a.title}  ->  ${a.workflowId}`);
  console.log(`  tokens: in=${rc.result.usage.input_tokens} out=${rc.result.usage.output_tokens}`);

  // --- 4. Closed-loop re-assessment (ReAct, scripted improved recheck) ---
  console.log('\n[intel:warm] reassessAfterRecheck …');
  const recheck = loadScripted().recheck?.resultEvent;
  if (!recheck) {
    console.log('  (no scripted recheck block found — skipping)');
  } else {
    const ra = await reassessAfterRecheckVerbose(recheck.patientId, recheck, chart);
    console.log(`  cache ${ra.hit ? 'HIT' : 'WRITE'}  key=${ra.key.slice(0, 12)}…  iterations=${ra.result.iterations}`);
    console.log(`  tool calls: ${ra.result.trace.map((t) => t.tool).join(' → ') || '(replayed from cache)'}`);
    console.log(`  headline: ${ra.result.suggestion.headline}`);
    console.log('  proposed actions:');
    for (const a of ra.result.suggestion.proposedActions) console.log(`    - ${a.title}  ->  ${a.workflowId}`);
    console.log(`  tokens: in=${ra.result.usage.input_tokens} out=${ra.result.usage.output_tokens}`);
  }

  console.log('\n[intel:warm] done. Cache dir: app/data/cache');
}

main().catch((e) => {
  console.error('[intel:warm] failed:', e);
  process.exit(1);
});
