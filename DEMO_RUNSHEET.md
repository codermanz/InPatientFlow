# WardFlow — Demo Run-Sheet (v2, Troponin/ACS)

Synthetic data only. The intelligence (task extraction + AI suggestions) is **real Claude**, cached for a deterministic stage demo.

## Start it

```bash
cd /Users/saad/Documents/Projects/InPatientFlow
# Deterministic demo (recommended) — real intelligence, replayed from cache
INTEL_MODE=cached ANTHROPIC_API_KEY=sk-anything PORT=8787 node --import tsx app/server/src/index.ts &   # backend
npm --prefix app/web run dev                                                                            # web → http://localhost:5173
```
Or one command: `npm run dev` (both together; `.env` INTEL_MODE default `auto` = replay from cache, no API calls unless inputs change).

- **Prove it's real (optional, needs network + real key):** `npm run intel:cold` → clears cache, makes genuine Claude calls (extract + suggest + recommend + reassess), re-caches. Then run the demo from cache.
- Open **http://localhost:5173** (project in the phone bezel). `--host` is on for a real iPhone on the same wifi.

## Rehearsal shortcuts
- Backtick `` ` `` → hidden jump-to-screen menu. `←/→` step the walk. Key **`a`** fires the notification (`/sim/advance`) on cue.

## The 3-minute path (8 screens)
1. **Overview** — “After a ward round, the plan is documented — but the work has just begun.” Ward 7A, 18 patients / 37 tasks. Tap the red-dot patient **Hospital No. 1234567**.
2. **Patient Summary** — SOB + Chest Pain, NEWS 2, PMH HTN/IHD/Scoliosis, allergy Nuts. Tap **Tasks**.
3. **Tasks Requested** — the plan **extracted by real Claude** into a flat task list (COVID PCR, CXR, FBC/U&Es, Troponin I, ECG *chased*), each with source evidence.
4. **Critical Alert** — leave the app → lock screen. After ~5s (or press `a`) a **red urgent alert**: “Needs urgent attention – Troponin.” Tap it.
5. **Raised Troponin Result** — **Troponin I 4274 ng/L (High)**, ref < 14. Interpretation: markedly raised in the context of chest pain. → View Full Results → **Suggested Next Steps**.
6. **AI Suggestions** — real ReAct agent: it **detected the anomaly**, **queried the chart + the workflow catalog** (tap **Evidence** to show the agent’s actual trace — clinical lookups + workflow discovery), and proposes actions (Aspirin 300 mg, Repeat Troponin 3 h, 12-Lead ECG, Cardiology review, …), each bound to a real workflow. Nothing prescribed autonomously — clinician confirms. **Add to Plan**.
7. **Confirm Next Steps** — review the checklist → **Confirm & Execute** → triggers the workflows.
8. **Monitoring** — timeline (Troponin 4274 → repeat pending → ECG/Cardiology completed) + **Actions Taken** (Aspirin 300 mg, Enoxaparin). The repeat troponin returns and the agent **re-assesses** — the closed loop: plan → workflow → result → review → next action.

**Close:** “WardFlow closes the gap between the plan in the note and the care actually delivered — with a human in the loop at every step.”

## Reset between runs
Restart the backend (in-memory state resets) or reload the web app. Cache persists (deterministic).

## Backup / troubleshooting
- Slowness/network wobble → ensure `INTEL_MODE=cached` (pure replay; works even with a bogus key).
- Empty screen → backend isn’t up; the app falls back to fixtures (still demoable), but start the backend for real live data.
- Tabs Overview / Alerts / More all route; Back always returns; every row opens its own detail.
