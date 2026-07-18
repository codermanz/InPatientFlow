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
| 14| `POST /api/patients/:id/recommend` | `{ concern?: string }` | `{ suggestion: Suggestion }` **REAL Claude (ReAct)** — proactive recommendation powering screen 4 (Agent Recommendation) |
| 15| `GET /api/workflows` | — | `{ workflows: WorkflowDef[] }` — the 6 pre-defined stubbed workflows |
| 16| `POST /api/workflows/run` | `{ workflowId: string; actionId?: string; patientId: string }` | `{ run: WorkflowRun }` — kicks off a (stubbed) workflow; also appends a `workflow` TimelineEvent |
| 17| `GET /api/patients/:id/workflow-runs` | — | `{ runs: WorkflowRun[] }` — workflows triggered for this patient |

**Workflow catalog (data/workflows.json, 6):** `order-lab`, `electrolyte-replacement`, `medication-hold`, `cardiac-monitoring`, `specialty-consult`, `reassess-recheck`. Each `SuggestedAction` the agent emits (screens 4 & 9) carries a `workflowId` chosen from this catalog; the UI shows a "Trigger" affordance that POSTs `/workflows/run`. Stubbed: a run returns `{runId, status:'triggered'}` and shows in the timeline.

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
- Prompt rules (**safety, hard**): explain why review matters; **NO final diagnosis presented as fact, NO autonomous prescribing / order placement**; clinician confirms every action.
- **Assertiveness = BALANCED (locked).** The agent SHOULD be clinically specific at the *action* level: recommend concrete therapeutic actions (e.g. "replace potassium per protocol", "hold furosemide pending review", "recheck K⁺ in 2–4h", "consider ECG monitoring"), and may cite the hospital protocol/guidance for dosing. It frames the clinical picture as a *concern* ("consistent with / concern for hypokalemia"), not a stamped final diagnosis, and never emits a specific drug+dose prescription or auto-places an order. This matches mock screens 4 & 9.

### 3.4 Trace, anomaly, workflows, brevity (applies to 3.1–3.3)
- **Trace = evidence.** Both ReAct calls (3.2, 3.3) must capture the agent's actual tool-call trace as `Suggestion.trace: TraceStep[]` (order, tool, human-readable input, short finding). `evidence[]` is derived from the trace. The UI displays the trace as "what the agent checked".
- **Anomaly (screen 9 / suggestNextSteps):** set `Suggestion.anomaly = { detected:true, description }` — the agent explicitly determines the returned result is an anomaly, and that determination is why it produced recommendations.
- **Workflows via DISCOVERY TOOLS (locked architecture).** The ReAct agent is given `search_workflows(query)` and `get_workflow(id)` tools and QUERIES the catalog to bind each action to a real `workflowId` itself (these discovery calls are recorded in `trace`). Keyword-map is a backend fallback only. Single reasoning agent (no second agent). The agent may DISCOVER + RECOMMEND workflows but NEVER triggers them — execution is gated on clinician approval and run by the deterministic backend orchestrator.
- **Closed loop (locked).** After the clinician approves + triggers workflows, a `reassess-recheck`/`order-lab` workflow returns a SCRIPTED improved recheck (K⁺ 2.9 → 3.3, improving); the agent is re-invoked for a brief re-assessment ("K improving, continue monitoring, no further action") appended to the monitoring timeline (screens 10/11). Endpoint: `POST /api/workflows/:runId/complete` (or auto after delay) → produces the recheck result + agent re-assessment.
- **No fluff:** drop generic filler actions (e.g. "escalate to senior", "document plan", vague "assess"). Keep concrete, workflow-backed clinical actions only.
- **Brevity:** extraction (3.1) task `title`s must be concise (≤ ~6 words, imperative); recommendation/suggestion `headline` must be ONE short line; detail lives in `summary`/`detail`.

### 3.3 `recommendProactive(patientId, concern) → Suggestion` — ReAct AGENT (screen 4)
- Same ReAct engine + tools + guardrails as 3.2, but the seed trigger is a *concern* (declining-K trend during diuresis, "no corrective order found") instead of a returned `ResultEvent`. Powers endpoint 14 / screen 4's "Agent Recommendation".
- Proposed actions should align with the mock: start electrolyte replacement (per protocol), order a repeat metabolic panel, re-evaluate when the result is finalized — each evidence-cited. Cached like the others.
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

---

# v2 — TROPONIN / ACS SCENARIO (supersedes scenario-specific details above)

The mock (`Demo_Flow.png`) was redesigned: **8 screens**, chest-pain / raised-troponin scenario, patients by **Hospital No.** (no names). Endpoints (§2), the ReAct engine + discovery tools + closed loop (§3), cache, and sim all carry over. Only scenario data, prompts, and the frontend change.

## Hero scenario
- Patient: **Hospital No. 1234567**, **Bed 12**, initials **JS**, presenting **SOB + Chest Pain**, NEWS 2, PMH HTN/IHD/Scoliosis, allergy Nuts, meds Lisinopril/Aspirin.
- Result: **Troponin I 4274 ng/L (High)**, ref `< 14 ng/L`, at 11:47. Interpretation: "Markedly raised troponin I in the context of chest pain." (a finding interpretation, NOT a diagnosis).
- Closed loop: **Repeat Troponin I** (pending → returns) drives monitoring.

## 8 screens
1. **Overview** — Ward 7A, "Sat, 18 May 09:20", 2 stats (18 Patients / 37 Tasks), patient rows (Hospital No + N tasks + red/amber/green dot), tabs: **Overview / Alerts / More**.
2. **Patient Summary** — flattened cards: Presenting complaint, NEWS, Investigations, PMH, Allergies, Medications, Tasks(→).
3. **Tasks Requested** — FLAT list (no categories), each with status chip (Requested / Chased): COVID PCR, Chest X-Ray, FBC(U&Es), Troponin I (Reason: Chest pain), ECG (Chased). "Next update ~10 min". **REAL extraction.**
4. **Critical Alert** — dark lock screen, 11:47, RED urgent banner "Needs urgent attention – Troponin / Hospital No. 1234567". (poll /notifications; manual /sim/advance override.)
5. **Raised Troponin Result** — pink card: Troponin I **4274 ng/L** (red) + High badge + ref + time; Interpretation card; "View Full Results".
6. **AI Suggestions** — Suggested Next Steps (each icon+row→detail): Repeat Troponin I in 3h, 12-Lead ECG, Cardiology Review, **Aspirin 300 mg (if no contraindication)**; buttons Evidence | Modify; "Add to Plan"; footer "based on trust guidelines and clinical context". **REAL ReAct** (trace = evidence; workflow-discovery; anomaly).
7. **Confirm Next Steps** — checklist of the above; **Confirm & Execute** → triggers workflows.
8. **Monitoring** — Timeline (Troponin I initial 4274/11:47 [red]; Repeat Troponin I Pending 14:45; 12-Lead ECG Completed 11:52; Cardiology Review Completed 12:10) + **Actions Taken** (Aspirin loading 300 mg prescribed; Enoxaparin 1 mg/kg prescribed). Closed loop surfaces the repeat-troponin re-assessment here.

## Data to re-author
- `ward.json`: ward "Ward 7A", date "Sat, 18 May 09:20", counts {patients:18, tasks:37}, roster (hospitalNo/bed/initials/taskCount/status): JS 1234567/Bed 12/5/need_action(HERO); SA 2345678/2/need_review; MJ 3456789/0/unchanged; DB 4567890/3/need_review.
- `hero.json`: JS chest-pain admission — encounter (presentingComplaint, news "2", investigations, pmh, allergies, medications), a note whose A&P documents the requested tasks (COVID PCR, CXR, FBC/U&Es, Troponin I [reason chest pain], ECG), transcript, chart (troponin trend incl 4274, ECG, vitals, meds, guidance for ACS/chest-pain), so REAL extraction yields the flat task list.
- `scripted.json`: resultEvent Troponin I 4274 High + interpretation; notification urgent "Needs urgent attention – Troponin"; monitoring timeline (with `note` values/statuses); actionsTaken[]; recheck = repeat troponin (e.g. still elevated / trend) for the closed loop.
- `workflows.json`: ACS catalog, e.g. `order-lab` (repeat troponin / bloods), `ecg` (12-lead ECG), `cardiac-monitoring`, `specialty-consult` (Cardiology), `medication-administer` (aspirin/enoxaparin — drug+dose, clinician-gated), `reassess-recheck`.

## Entity notes
- Patient by hospitalNo+bed+initials (name internal). Status dot: need_action→red, need_review→amber, unchanged→green.
- Tasks FLAT; status chips `requested`/`chased`.
- Encounter carries news/pmh/allergies/medications/investigations.
- ResultEvent.interpretation shown on screen 5.
- TimelineEvent.note carries the right-aligned value/status.
- `GET /patients/:id/timeline` response adds `actionsTaken: string[]`.

## Assertiveness — DRUG+DOSE ALLOWED, clinician-gated (locked, supersedes earlier "balanced")
The agent MAY suggest specific drugs+doses (e.g. "Aspirin 300 mg (if no contraindication)"); it still frames the picture as a finding/concern (no final diagnosis), and NOTHING is "prescribed"/executed until the clinician taps **Confirm & Execute**. Guardrails now read as decision-support + human-in-the-loop (clinician confirms every drug/dose). Add a subtle "Clinician-confirmed · decision support · synthetic" framing in the UI.

## Palette (match Demo_Flow.png — frontend: Read the PNG and refine)
- Primary deep pine green (buttons, active tab, logo): ~`#1E4635` (buttons), logo ~`#2E6E4E`.
- Critical red (alert banner, high value, High badge): ~`#C43B2E`; result card pink bg ~`#FCEBEA`.
- Status dots: red `#DB4A3D`, amber `#E0A33A`, green `#3E8E5A`. "Chased" row bg light green ~`#EAF3EC`.
- Neutrals: page bg `#F5F6F5`, cards `#FFFFFF`, border `#ECEEEC`, text `#1A1A1A`, secondary `#7A8377`.
- Lock/critical screen: dark green gradient ~`#12291F → #0C1E17`.
