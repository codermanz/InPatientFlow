# WardFlow — Frozen Contracts (v1)

> This is the shared interface every build agent codes against. **Do not change a type or route without updating this file and notifying the operator.** All-TypeScript. Backend serves `/api/*`; frontend is a Vite React app in an iPhone bezel.

## 0. Repo layout
```
/app
  /web            # Vite + React + TS + Tailwind (frontend, iPhone bezel, 11 screens)
    /src/api.ts   # typed API client (matches §2)
    /src/types.ts # shared entity types (copy of §1)
  /server         # Express + TS API + intelligence + storage
    /src/types.ts # shared entity types (copy of §1)  <-- source of truth, web imports/copies
    /src/routes/  # one file per resource group
    /src/intel/   # extract.ts, suggest.ts (Anthropic), prompts/, cache/
    /src/store/   # seed loader + runtime state
  /data
    seed.json         # normalized entities from the FHIR jsonl (Data agent)
    ward.json         # authored ward roster + room/bed/specialty/status
    hero.json         # authored hero encounter (note+transcript+observations, FHIR-shaped)
    scripted.json     # the scripted result-return + timeline for the hero
    /cache/*.json     # cached real LLM outputs (committed for replay)
.env                  # ANTHROPIC_API_KEY, PORT, DEMO_DELAY_MS
```
Ports: server `:8787`, web `:5173` (proxy `/api` → 8787).

### npm scripts (root `package.json`, Backend agent owns)
| script | does |
|---|---|
| `npm run seed` | build `seed.json`/`ward.json`/`hero.json`/`scripted.json` from the jsonl + authored data |
| `npm run intel:clear` | **delete `app/data/cache/*.json`** — wipes cached LLM outputs |
| `npm run intel:warm` | run `extractTasks` + `suggestNextSteps` for the hero against the **real API**, write cache |
| `npm run intel:cold` | `intel:clear` **then** `intel:warm` — the fresh, real, first-time run (proves it's real + repopulates cache) |
| `npm run dev` | run server + web concurrently (dev) |
| `npm run demo` | `seed` + start server/web in `INTEL_MODE=cached` (pure replay, safest on stage) |

**Cold-run guarantee (operator requirement):** `npm run intel:cold` clears the cache and forces genuine Claude calls, so we can always demonstrate the intelligence is real and not a fixture. After a cold run the outputs are cached; `npm run demo` then replays them deterministically. `INTEL_MODE=live` (in `.env`) is the always-fresh override.

## 1. Entity types (TypeScript — source of truth)
```ts
export type TaskCategory = 'requests'|'specialty_input'|'discharge'|'monitoring'|'medication';
export type TaskStatus   = 'proposed'|'approved'|'rejected'|'sent'|'waiting'|'returned'|'completed';
export type PatientStatus= 'need_action'|'need_review'|'unchanged';
export type EvidenceType = 'transcript'|'note'|'lab'|'mar'|'progress_note'|'protocol'|'observation';
export type ResultStatus = 'normal'|'abnormal'|'critical';
export type TimelineType  = 'approval'|'order'|'administration'|'result'|'agent'|'notification';

export interface EvidenceRef { type: EvidenceType; label: string; timestamp?: string; excerpt: string; sourceRef?: string; }

export interface Patient {
  id: string; name: string; initials: string; ageSex: string; // "68F"
  room: string; ward: string; specialty: string;
  status: PatientStatus; taskCount: number;
}
export interface Encounter {
  id: string; patientId: string; date: string; visitTitle: string; visitType: string;
  summary: string; presentingComplaint: string;
  keyInvestigations: { label: string; value: string }[];
  assessment: string; planText: string;
}
export interface Task {
  id: string; patientId: string; encounterId: string;
  title: string; category: TaskCategory; timing?: string; reason?: string;
  status: TaskStatus; origin: 'extracted'|'suggested';
  evidence: EvidenceRef[]; confidence?: number;
}
export interface ResultEvent {
  id: string; taskId: string; patientId: string;
  name: string; value: string; unit?: string; refRange?: string;
  status: ResultStatus; priorValue?: string; returnedAt: string;
  context: string; requiresReview: boolean;
}
export interface SuggestedAction { id: string; title: string; detail?: string; selectedByDefault: boolean; }
export interface Suggestion {
  id: string; resultEventId: string; headline: string; summary: string;
  proposedActions: SuggestedAction[]; evidence: EvidenceRef[]; guardrails: string[];
}
export interface TimelineEvent { id: string; patientId: string; ts: string; label: string; type: TimelineType; }
export interface Notification { id: string; patientId: string; resultEventId: string; title: string; body: string; createdAt: string; deepLink: string; }
export interface WardSummary {
  ward: string; clinician: string;
  counts: { patients: number; needAction: number; needReview: number; unchanged: number };
  patients: Patient[];
}
```

## 2. REST endpoints (request → response)
All responses `application/json`. Errors: `{ error: string }` with proper status.

| # | Method & Path | Request body | Response |
|---|---|---|---|
| 1 | `GET /api/ward` | — | `WardSummary` |
| 2 | `GET /api/patients/:id` | — | `{ patient: Patient; encounter: Encounter; tasks: Task[] }` (tasks empty until extracted) |
| 3 | `POST /api/patients/:id/extract-tasks` | — | `{ tasks: Task[] }` **REAL Claude** (cached) |
| 4 | `POST /api/patients/:id/tasks/confirm` | `{ decisions: { taskId: string; action:'approve'|'reject'; edits?: Partial<Task> }[] }` | `{ tasks: Task[] }` |
| 5 | `POST /api/patients/:id/execute` | — | `{ execution: { total:number; done:number; tasks: {id:string;title:string;status:TaskStatus}[] } }` (arms timer) |
| 6 | `GET /api/patients/:id/execution` | — | same `execution` shape |
| 7 | `GET /api/notifications` | — | `{ notifications: Notification[] }` (UI polls ~1s) |
| 8 | `POST /api/sim/advance` | `{ patientId?: string }` | `{ ok:true; resultEventId:string }` — fires scripted result+notif NOW (operator override) |
| 9 | `GET /api/results/:id` | — | `{ result: ResultEvent; task: Task; patient: Patient }` |
| 10| `POST /api/results/:id/suggest` | — | `{ suggestion: Suggestion }` **REAL Claude** (cached) |
| 11| `POST /api/results/:id/act` | `{ actionIds: string[] }` | `{ timeline: TimelineEvent[] }` |
| 12| `GET /api/patients/:id/timeline` | — | `{ timeline: TimelineEvent[] }` |
| 13| `GET /api/activity` | — | `{ completedQuietly:number; needsAttention:number; resultPending:number }` |

## 3. Intelligence contract (the REAL part) — HYBRID
Two functions in `/server/src/intel`. Both **cache to `/data/cache/<key>.json`** keyed by a hash of the input; on cache hit, replay (deterministic demo). `INTEL_MODE=live|cached|auto` (default `auto`: use cache if present else call + write). Model: default `claude-sonnet-5`, overridable via `INTEL_MODEL=claude-opus-4-8`. Confirm exact SDK params (`tools`, `tool_choice`, agent loop) against the **claude-api skill** at build time.

### 3.1 `extractTasks(encounter, patientContext) → Task[]` — SINGLE-SHOT structured
- Pattern: one Claude call; forced tool-use `emit_tasks(tasks: Task[])` (schema = §1 Task). No loop.
- Input: `encounter.planText` + `encounter.assessment` (note A&P), transcript excerpts, condition/med labels, key observations.
- Output: `Task[]` — each `origin:'extracted'`, categorized per §1, with `timing`, `reason`, and **≥1 `EvidenceRef` with a verbatim excerpt**.
- Prompt rules: extract only *documented* actions; never invent; every task cites evidence.

### 3.2 `suggestNextSteps(resultEventId, patientId) → Suggestion` — ReAct AGENT
- Pattern: bounded ReAct loop (≤6 tool calls). Agent pulls evidence via read-only tools, then terminates with `emit_suggestion`. Full tool transcript cached for replay.
- **Tools (read-only, backed by store/intel helpers):**
  - `search_observations(patientId, query, limit?) → {name,value,unit,time}[]`
  - `get_medications(patientId) → {name,dose,status}[]`
  - `get_note_section(encounterId, section) → string`   // section ∈ subjective|objective|assessment|plan
  - `get_local_guidance(topic) → {title, version, excerpt}`   // stubbed protocol (e.g. "v4.2")
  - `emit_suggestion(suggestion: Suggestion) → done`   // TERMINAL, schema = §1 Suggestion
- Seed input handed to the agent up front: the `ResultEvent` (value/prior/range/status) + originating `Task` + patient one-liner. Everything else it must fetch via tools.
- Output: `Suggestion` — `headline` (why review needed), `summary`, `proposedActions[]` (each cites the tool result it came from), `evidence[]` (populated from the tool calls the agent made), `guardrails[]`.
- Prompt rules (**safety, hard**): explain why review matters; **NO diagnosis, NO autonomous prescribing** (say "medication review needed", never a specific new drug/dose); every action carries evidence; clinician confirms.
- **Note for Data agent:** `hero.json`/`scripted.json` must expose enough that the tools return meaningful data for Maria — a K⁺ observation trend, an active loop diuretic in meds, an assessment section mentioning diuresis, and a `get_local_guidance('hypokalemia'|'escalation')` protocol snippet.

## 4. Seed / data spec (Data agent)
- `seed.json`: parse all 25 jsonl records → light `Patient`-shaped index + full detail for any we surface. Used for realism/backup.
- `ward.json`: authored roster matching the mock exactly:
  - Maria Reyes — 68F, Room 614, Cardiology, `need_action` (HERO)
  - James Patel — 72M, Room 688, Oncology, `need_review`
  - John Smith — 54M, Room 532, Medicine, `unchanged`
  - Sarah Johnson — 81F, Room 421, Geriatrics, `unchanged`
  - Michael Brown — 63M, Room 775, Neurology, `unchanged`
  - Ward "WardFlow", clinician "Dr. Khan". counts: 12 patients / 2 need action / 1 need review / 9 unchanged (mock numbers; extra patients can be ghost rows).
- `hero.json`: authored **synthetic** encounter for Maria Reyes in dataset shape:
  - Presenting: "Shortness of breath, edema"; Summary: "Heart failure exacerbation on active diuresis. Potassium declined overnight. No corrective order found."
  - Assessment: "Hypokalemia in setting of loop diuretic therapy". Plan (proposed): "Replace potassium and recheck labs."
  - Key investigations: K 3.8 → 3.1 mmol/L; Cr 1.0 (stable).
  - **A&P must be authored so REAL `extractTasks` yields** ~: Daily metabolic panel (today), Troponin monitoring (today) [Requests]; Cardiology review (routine) [Specialty Input]; Discharge (0). Plus evidence excerpts embedded in note/transcript.
- `scripted.json`: the demo's scripted return + timeline for Maria:
  - `ResultEvent`: name "Potassium", value "2.9", unit "mmol/L", refRange "3.5–5.1", priorValue "3.1", status "critical", requiresReview true, context "Result worsened after the approved intervention." linked to the metabolic-panel task.
  - Timeline (mock screen 9): 07:12 approved action · 07:15 orders placed · 13:46 replacement administered · 14:04 repeat result finalized · 14:04 agent resumed · 14:05 you were notified.

## 5. Definition of done (Integration agent)
Full loop runs on one machine, deterministic, matching the 11 mock screens:
ward → Maria → extract (real) → confirm → execute → (timer or /sim/advance) → notification → result → suggest (real) → act → timeline. Cached LLM outputs committed so it never fails on stage.
