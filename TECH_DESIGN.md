# WardFlow — Hackathon Tech Design (v1)

> Status: decisions locked (see §7d). Frozen interface lives in `CONTRACTS.md`.

## 0. Goal recap
Build **one polished, reliable end-to-end inpatient workflow** matching the 11-screen mock (`Demo_Flow.png`) and the steering file. A focused working flow beats breadth. All patient data is synthetic. The **intelligence must be real** (genuine Claude calls); everything else may be stubbed/simulated.

The closed loop we must show:
**Ward overview → patient → task extraction → clinician confirm → execute → notification → result review → suggestion → confirm/act → monitoring.**

---

## 1. High-level architecture

Four layers, all local:

```
┌─────────────────────────────────────────────────────────────┐
│  1. UI  — React + Vite + Tailwind, iPhone bezel, 11 screens  │
│     talks to backend over a frozen REST contract (/api/*)    │
└───────────────────────────┬─────────────────────────────────┘
                            │  JSON over HTTP (localhost)
┌───────────────────────────▼─────────────────────────────────┐
│  2. API  — Express + TypeScript                              │
│     • serves entities  • orchestrates the demo state machine │
│     • simulates order execution + result return + notifs     │
└─────────────┬─────────────────────────────┬─────────────────┘
              │                             │
┌─────────────▼───────────┐   ┌─────────────▼───────────────────┐
│ 3. INTELLIGENCE (REAL)  │   │ 4. STORAGE / CONTEXT             │
│   @anthropic-ai/sdk      │   │   • seed.json (entities from     │
│   • extractTasks()       │   │     the FHIR jsonl, normalized)  │
│   • suggestNextSteps()   │   │   • ward.json / hero.json (auth) │
│   structured JSON out    │   │   • runtime state (in-mem + JSON │
│   + evidence citations   │   │     snapshot)                    │
└──────────────────────────┘   └──────────────────────────────────┘
```

### What is REAL vs STUBBED
| Piece | Real / Stubbed | Notes |
|---|---|---|
| Task extraction (note A&P + transcript → tasks + evidence) | **REAL Claude** | Chart-aware, grounded, cited |
| Result review suggestion (returned result → next steps + evidence) | **REAL Claude** | Guardrailed: no dx, no rx |
| Ward / patients / documented plan | Real data (from jsonl) | Room/bed/ward/specialty augmented |
| Order placement / execution | **Stubbed** | Mark tasks "sent/waiting", fake progress |
| Result *return* (the abnormal potassium moment) | **Scripted/augmented** | Grounded in real observations in the record, but timing + the "worsening" delta is authored |
| Notification / push | **Simulated** | In-app banner after a short timer; privacy-safe copy |
| Timeline / monitoring | Mix | Real approvals/orders + scripted result events |
| Auth / permissions / real EHR | **None** (non-goal) | |

---

## 2. Data: what we have, what we must augment

**Dataset:** `synthetic-ambient-fhir-25.jsonl` — 25 synthetic patients, 1 encounter each. Every record has:
- `metadata` (date, visit_title, visit_type, resource counts)
- `patient_context.patient` (FHIR Patient: name, gender, birthDate) + `longitudinal_summary` (condition/med labels, counts)
- `encounter_fhir.encounter` + `related_resources` grouped: `Condition`, `Observation` (labs + vitals with real values/units/times), `Procedure`, `DiagnosticReport`, `MedicationRequest`
- `transcript` (speaker-labeled DR/PT/NURSE/FAMILY) — **evidence source**
- `note` (SOAP markdown; **Assessment and Plan has bulleted action items** — the core extraction input)
- `after_visit_summary` (+ provenance)

**Inpatient-flavored records available** (good candidates for the ward): COVID-19 isolation admission, 3× SNF admissions, 2× hospice admissions. Plus many "recheck labs / adjust meds" plans across the outpatient records.

**What we must AUGMENT (not in the data):**
1. **Ward/room/bed/specialty + status flag** per patient → author `ward.json` (5–6 patients).
2. **The returned abnormal result** (e.g. potassium 3.1 → 2.9 during diuresis). All dataset results are historical/final; we script one task's result to "return" abnormal during the demo, grounded in the record's real observations.
3. **Timeline event timestamps** for the monitoring screen.
4. **Status derivation** (Need Action / Need Review / Unchanged) for the ward list.

---

## 3. Data model (entities)

```
Ward            { id, name, patientIds[] }
Patient         { id, name, initials, ageSex, room, ward, specialty,
                  status: 'need_action'|'need_review'|'unchanged',
                  fhirPatientId }
Encounter       { id, patientId, date, visitTitle, visitType,
                  summary, presentingComplaint, keyInvestigations[],
                  assessment, planText }          // summary fields from the note
Task            { id, patientId, encounterId, title, category,
                  timing, reason, status, evidence: EvidenceRef[],
                  origin: 'extracted'|'suggested', confidence? }
                  // category ∈ requests | specialty_input | discharge |
                  //            monitoring | medication
                  // status   ∈ proposed|approved|rejected|sent|waiting|
                  //            returned|completed
EvidenceRef     { type, label, timestamp, excerpt, sourceRef }
                  // type ∈ transcript|note|lab|mar|progress_note|
                  //        protocol|observation
ResultEvent     { id, taskId, patientId, name, value, unit, refRange,
                  status: 'normal'|'abnormal'|'critical',
                  priorValue?, returnedAt, context, requiresReview }
Suggestion      { id, resultEventId, summary, headline,
                  proposedActions: SuggestedAction[], evidence: EvidenceRef[],
                  guardrails: string[] }
SuggestedAction { id, title, detail, selectedByDefault }
TimelineEvent   { id, patientId, ts, label, type }
                  // type ∈ approval|order|administration|result|agent|notification
Notification    { id, patientId, resultEventId, title, body, createdAt,
                  deepLink }   // body is privacy-safe (no values/names)
```

**Separation of concerns (safety principle):** every `Task`/`Suggestion` carries `origin` and every action carries `evidence[]`, so the UI can always distinguish *documented fact* vs *documented intent* vs *WardFlow suggestion* vs *clinician decision*.

---

## 4. API contract (frozen before swarm build)

Base: `http://localhost:PORT/api`

| Method | Path | Purpose | Intelligence |
|---|---|---|---|
| GET | `/ward` | Ward summary + patient rows (counts, statuses) | — |
| GET | `/patients/:id` | Patient detail + encounter summary + documented plan | — |
| POST | `/patients/:id/extract-tasks` | Note A&P + transcript → tasks + evidence | **REAL** |
| POST | `/patients/:id/tasks/confirm` | body: approvals/edits/rejections → persist statuses | — |
| POST | `/patients/:id/execute` | mark approved tasks sent/waiting; start sim; return exec state | — |
| GET | `/patients/:id/execution` | progress (x/y, per-task status) | — |
| GET | `/notifications` | pending notifications (UI polls) | — |
| POST | `/sim/advance` (or auto-timer) | trigger the scripted result return + notification | — |
| GET | `/results/:id` | result detail reconnected to originating task | — |
| POST | `/results/:id/suggest` | returned result + context → suggestion + evidence | **REAL** |
| POST | `/results/:id/act` | confirm selected actions → timeline events | — |
| GET | `/patients/:id/timeline` | monitoring timeline | — |
| GET | `/activity` | "while you were away" summary | — |

**Two real-intelligence endpoints** (`extract-tasks`, `suggest`) return strict JSON matching the entity schemas above. For demo reliability, responses are **cached to disk after the first real call** and replayed (see [DECISION 3]).

---

## 5. Intelligence design (the real part) — HYBRID

**The product is agentic (dispatch → wait → reconnect result → pull clinician back); that loop lives in the backend state machine.** The LLM is invoked at two decision points. Extraction is a single-shot structured call; suggestion is a real ReAct tool-using agent. Both cache to disk and replay for a deterministic stage demo.

### 5.1 `extractTasks(encounter)` — single-shot, structured output
- **Pattern:** one Claude call. Full context in; forced JSON out via an `emit_tasks` tool whose input schema *is* the `Task[]` type. No loop.
- **Input:** note Assessment & Plan (verbatim) + transcript excerpts + active condition/med labels + key observations.
- **Output:** `Task[]`, each classified (requests|specialty_input|discharge|monitoring|medication) with `timing`, `reason`, and **≥1 verbatim `EvidenceRef`**.
- **Guardrails (prompt):** extract only *documented* actions; never invent orders; every task cites evidence; separate documented fact vs intent; no diagnosis/prescribing; respond only via `emit_tasks`.

### 5.2 `suggestNextSteps(resultEvent, patientId)` — ReAct agent with chart tools
- **Pattern:** a bounded ReAct loop. The agent reasons, calls read-only chart tools to *pull the evidence it decides it needs*, observes, and terminates by calling `emit_suggestion`. Iteration cap (≈6 tool calls) for latency/safety. Full tool transcript cached for replay.
- **Read-only tools exposed:**
  - `search_observations(patientId, query, limit)` → lab/vital trends (e.g. prior K⁺ values, creatinine)
  - `get_medications(patientId)` → active meds (e.g. loop diuretic, lisinopril)
  - `get_note_section(encounterId, section)` → note A&P / Objective / etc.
  - `get_local_guidance(topic)` → stubbed hospital escalation protocol snippet ("v4.2")
  - `emit_suggestion(suggestion)` → **terminal** tool; ends the loop with the `Suggestion` payload.
- **Why ReAct here:** "what evidence matters for this result" is genuinely open-ended, and the tools the agent chooses to call map 1:1 to the evidence chips in the mock (Lab result, MAR, Progress note, Hospital protocol) — a strong, honest "the agent decided what to check" demo beat.
- **Output:** `Suggestion` — `headline` (why review is needed), `summary`, `proposedActions[]` (each cites the tool result it came from), `evidence[]` (the tool calls it made), `guardrails[]`.
- **Guardrails (prompt, hard):** explain why review matters; **no diagnosis, no autonomous prescribing** (say "medication review needed", never a drug/dose); every action cites evidence; clinician confirms.

Model: `claude-sonnet-5` default (speed/cost), `claude-opus-4-8` overridable via `INTEL_MODEL`. Exact SDK params confirmed against the claude-api skill at build time.

---

## 6. Build plan — the swarm

With decisions locked and the contract frozen (`CONTRACTS.md`), I fan out parallel subagents against that shared spec. Operator (you) stays in the loop: each agent reports back, I integrate, you review checkpoints.

| Agent | Owns | Depends on |
|---|---|---|
| **A — Data/Seed** | Parse jsonl → `seed.json`; author `ward.json`; script hero result-return | contract §3 |
| **B — Backend/API** | Routes, state machine, execution/notification sim, storage | contract §4, A's schemas |
| **C — Intelligence** | Prompts + Anthropic adapter for extract + suggest; fixtures/cache | contract §5, A's sample records |
| **D — Frontend** | Vite React app, iPhone frame, 11 screens, API client | contract §4 |
| **E — Integration/QA** | Wire, seed, smoke-test full loop, demo script | A–D |

Orchestration: parallel background subagents (or a Workflow) with frozen contracts; I checkpoint with you between phases. C runs against real Claude early to de-risk the only "real" piece; B/D can develop against fixtures until C lands.

---

## 7b. Demo presentation (how we actually show it)
- **Not a native iOS app.** We build a **responsive React web app rendered inside a CSS iPhone bezel** → primary demo surface on laptop/projector, zero extra tooling, fully reliable.
- Same app runs **on a real iPhone** via `vite --host` (same wifi), optionally screen-mirrored to the projector — nice-to-have, not load-bearing.
- The **lock screen + push notification** (screens 6/7) is a **full-bleed rendered screen inside the app**, not a real iOS push. Part of the simulation.

## 7c. Simulation & pseudo-timer (dispatch → result → notification)
This is the core demo-reliability mechanism.
1. `POST /execute` → approved tasks flip `sent → waiting`; backend arms a timer.
2. After delay, the **scripted `ResultEvent`** (potassium 3.1 → 2.9) is created + a privacy-safe `Notification` queued.
3. UI polls `/notifications` (or SSE) → renders lock-screen banner → tap deep-links to result.
4. **Operator control:** both an auto-timer AND a manual trigger (`POST /sim/advance`, bound to a hidden keypress) so the "result came back" moment fires exactly on cue on stage. Never a live countdown dependency.
5. Timeline (screen 9) shows real timestamps: dispatch → orders → administration → result → notified.

## 7d. Decisions locked
- API key: **operator will export `ANTHROPIC_API_KEY`** before build.
- Demo intelligence mode: **real calls, cached & replayable** (deterministic on stage).
- Hero case: **author synthetic hero patient matching the mock** (Maria Reyes, K+ 3.1→2.9 on diuresis).
- Stack: **all-TypeScript** — Vite React frontend + Express API + `@anthropic-ai/sdk`. One dependency tree.
- Presentation: **web app in iPhone bezel** (primary); `vite --host` enabled as fallback only.
- Ward roster + hero authored to match the mock exactly (Maria Reyes, James Patel, John Smith, Sarah Johnson, Michael Brown). Only the hero is fully fleshed (synthetic note+transcript+FHIR-shaped observations) so the REAL extraction/suggestion run on grounded input; other rows are list-only.

## 8. Environment (checked)
- Node v25.6.1 / npm 11.9.0 ✓  · Python 3.14.3 ✓ (no `uv`) · no `jq` · **no `ANTHROPIC_API_KEY`**
- jsonl is ~2 MB, 25 records — trivial to load fully.
