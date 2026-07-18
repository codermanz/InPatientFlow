# WardFlow — Hackathon Steering File

## 1. Product in One Sentence

WardFlow is a clinician-in-the-loop inpatient workflow agent that converts documented clinical plans into verified, executable tasks and follows those tasks through to completion or result review.

## 2. The Problem

After a ward round, the plan may be documented in the EHR, but the operational work still has to be completed manually.

Clinicians must identify every actionable item, convert actions into jobs, open multiple systems, place orders and referrals, remember to chase results, recognise urgent findings, and reconnect those results to the original plan.

The core problem is not only deciding what should happen. It is ensuring that what was decided is actually carried out and closed.

## 3. Product Vision

WardFlow sits between the documented clinical plan and hospital execution systems.

It:

1. reads the clinical note and relevant FHIR context
2. extracts explicitly documented actions
3. shows each proposed task with source evidence
4. asks the clinician to approve, modify, or reject
5. maps approved tasks to constrained tools
6. executes those tools against simulated hospital systems
7. tracks task state
8. receives and links results back to the original task
9. alerts the clinician when review is required
10. maintains an audit trail

WardFlow does not replace clinical judgment. It operationalises clinician-approved intent.

## 4. Hackathon Goal

Build one polished, reliable end-to-end workflow using a single inpatient encounter.

The live demo must show:

Clinical note → task extraction → clinician verification → tool execution → result return → urgent clinician alert

A focused, working vertical slice is more important than broad feature coverage.

## 5. Core User

### Primary user
A junior doctor, resident, physician associate, advanced practitioner, or other clinician responsible for completing and chasing inpatient jobs after a ward round.

### Secondary users
Registrars and consultants, nursing staff, allied health professionals, and hospital operations or digital transformation teams.

## 6. Main User Story

> As the clinician responsible for post-ward-round jobs, I want the documented plan to be converted into a verified list of executable actions, so that I can complete and track patient care safely without manually reconstructing the plan across multiple systems.

## 7. Demo Scenario

Use the supplied synthetic Abridge inpatient encounter involving COVID-19 pneumonia, hypoxemia, renal impairment, and cardiovascular comorbidity.

### Example documented actions
- order daily CBC and metabolic panel
- request troponin monitoring
- continue and titrate oxygen therapy
- review antihypertensive medication against renal function and potassium
- monitor renal function

### Example result event
- potassium: 6.3 mmol/L
- creatinine: 3.1 mg/dL
- Troponin I: 4000 ng/L

### Expected system response
- link the result to the original patient, encounter, order, and task
- mark the result as requiring urgent review due to raised Troponin
- show relevant medication and renal context
- avoid diagnosing or prescribing
- clearly state that clinician review is required

## 8. Minimum Viable Product

### Feature 1 — Load clinical context
Display the selected synthetic patient, inpatient encounter, note, conditions, medications, and relevant observations.

### Feature 2 — Extract documented tasks
Use Claude to return strict structured JSON.

Each task must include:
- task ID
- patient ID
- encounter ID
- action
- category
- timing
- priority
- exact source evidence
- confidence
- approval requirement
- status

### Feature 3 — Clinician review
For every proposed task, allow approve, modify, or reject.

No task can execute before approval.

### Feature 4 — Tool execution
Approved tasks can trigger constrained mock hospital tools:
- `place_laboratory_order`
- `create_monitoring_task`
- `create_medication_review`
- `update_care_instruction`

Each tool must return:
- confirmation ID
- submitted status
- timestamp
- patient and encounter identifiers
- audit event

### Feature 5 — Result return
A demo control simulates a laboratory result becoming available.

The system must:
- connect the result to the correct order
- update task state
- identify urgent review requirements
- show relevant clinical context
- preserve the audit trail

### Feature 6 — Reset demo
One button restores the application to its starting state.

## 9. Non-Goals for the Hackathon

Do not spend time on:
- real EHR integration
- real laboratory or radiology integration
- autonomous diagnosis
- autonomous prescribing
- real patient data
- voice transcription
- authentication
- role-based access control
- production hosting
- complex multi-agent orchestration
- a fully conformant FHIR server
- MCP unless the core demo is already complete
- broad support for every possible task type
- analytics dashboards as the main product

These may be described as future extensions, not current functionality.

## 10. Safety Principles

### 10.1 Evidence before action
Every extracted task must include exact source text from the clinical note.

### 10.2 No silent inference
The model must not create tasks solely because they appear clinically sensible.

### 10.3 Human approval
No action can execute without explicit clinician approval.

### 10.4 Separate extraction from clinical reasoning
Documented tasks and AI-generated clinical considerations must never be mixed.

### 10.5 Bounded tools
Claude may only call predefined, typed tools with validated arguments.

### 10.6 No autonomous medication changes
The agent may create a medication review task but must not start, stop, or alter medication.

### 10.7 No autonomous diagnosis
Result summaries may explain why review is important but must not present a final diagnosis.

### 10.8 Auditability
Every extraction, edit, rejection, approval, tool call, result, and status change must be recorded.

### 10.9 Synthetic data only
The demo must clearly state that all patient data and hospital integrations are simulated.

## 11. Technical Architecture

### Frontend
React + Vite

Responsibilities:
- display patient and encounter
- show source note
- display proposed tasks
- support approve, edit, and reject actions
- show execution state
- show returned results and alerts
- display audit history
- reset demo

### Backend
Node.js + Express

Responsibilities:
- load the selected Abridge record
- reduce FHIR data to relevant context
- call the Anthropic API
- validate structured extraction output
- enforce approval rules
- expose typed tool definitions
- execute deterministic mock tools
- maintain workflow state
- create simulated result events
- generate grounded result summaries

### Model
Anthropic Claude API

Use Claude for:
- documented task extraction
- mapping approved tasks to typed tools
- concise result-review summaries

Do not use Claude for:
- state storage
- permission enforcement
- tool validation
- critical thresholds
- deterministic audit logging

### Data
Abridge synthetic ambient FHIR dataset.

Use:
- `Patient`
- `Encounter`
- clinical note
- conditions
- medications
- observations
- diagnostic reports where relevant

### State model
Recommended task statuses:
- `proposed`
- `approved`
- `edited`
- `rejected`
- `executing`
- `ordered`
- `awaiting_result`
- `result_available`
- `result_needs_review`
- `reviewed`
- `failed`

## 12. Extraction Contract

```json
{
  "tasks": [
    {
      "id": "task-001",
      "patient_id": "patient-id",
      "encounter_id": "encounter-id",
      "action": "Order daily CBC and comprehensive metabolic panel",
      "category": "laboratory",
      "timing": "daily",
      "priority": "routine",
      "source_evidence": "Daily monitoring labs: CBC with automated differential, comprehensive metabolic panel",
      "confidence": 0.98,
      "requires_approval": true,
      "status": "proposed"
    }
  ],
  "ambiguities": []
}
```

### Extraction rules
- extract only explicit actions
- exclude historical or completed actions
- exclude descriptive statements
- preserve timing
- preserve uncertainty
- include verbatim evidence
- place unclear items in `ambiguities`
- never create an executable action from AI-generated reasoning

## 13. Tool Contract

### Example: `place_laboratory_order`

Input:

```json
{
  "patient_id": "string",
  "encounter_id": "string",
  "tests": ["CBC", "CMP"],
  "frequency": "daily",
  "priority": "routine"
}
```

Output:

```json
{
  "confirmation_id": "LAB-1842",
  "status": "submitted",
  "timestamp": "ISO-8601",
  "system": "mock-laboratory"
}
```

### Tool rules
- validate required fields
- reject unapproved tasks
- reject unknown patients or encounters
- never call external clinical systems
- always return a traceable confirmation
- always write an audit event

## 14. Product Experience

The product should feel like a workflow, not a dashboard.

### Main sequence

#### Step 1 — Source
Show the documented EHR plan.

Primary action: **Extract documented actions**

#### Step 2 — Verify
Show proposed tasks with exact evidence.

Controls: Approve, Edit, Reject

#### Step 3 — Execute
Show the selected tool, important arguments, confirmation, and timestamp.

#### Step 4 — Close the loop
Show returned results, linked context, and review status.

### Suggested headline

**WardFlow**  
*From documented plan to completed clinical action.*

## 15. Success Criteria

The build is successful when:
- the correct inpatient encounter loads
- Claude extracts useful tasks from the note
- every task includes valid source evidence
- clinician approval, editing, and rejection work
- unapproved tasks cannot execute
- at least one genuine Claude tool call works
- the mock tool returns a confirmation
- a simulated result links to the original order
- an urgent result creates a review alert
- the entire demo can be reset
- the full workflow runs reliably multiple times
- no secret or API key is committed to GitHub
- the public repository clearly identifies hackathon work

## 16. Judging Alignment

### Impact
WardFlow addresses a common, high-volume clinical failure point: converting plans into completed and reviewed work.

### Execution
The demo should be polished, deterministic, and easy to understand in under three minutes.

### Technical complexity
The system combines unstructured notes, structured FHIR context, evidence-grounded extraction, human approval, typed tool use, workflow state, asynchronous result handling, and auditability.

### Creativity and originality
Ambient systems often stop at producing documentation. WardFlow begins where the note ends and closes the loop between clinical intent and action.

## 17. Team Working Agreement

### Clinical lead
Owns:
- problem definition
- clinical workflow
- safety rules
- extraction quality review
- demo narrative
- judge Q&A
- acceptance testing

### Technical lead
Owns:
- repository
- application architecture
- API integration
- frontend and backend
- tool execution
- workflow state
- testing
- deployment or local demo environment

### Shared decisions
Both team members approve:
- scope changes
- safety-critical behaviour
- demo flow
- final feature freeze
- presentation claims

### Rule
No new feature is added until the existing end-to-end workflow works.

## 18. Build Order

1. create public repository
2. load one Abridge inpatient encounter
3. display patient, note, and relevant context
4. connect Claude extraction
5. validate structured output
6. build clinician review controls
7. implement one tool successfully
8. expand to four constrained tools
9. simulate result return
10. link result to original task
11. add urgent review state
12. add audit trail
13. add reset demo
14. test the complete workflow repeatedly
15. freeze features
16. polish the UI and demo

## 19. Feature Freeze Rule

Once the complete workflow works, do not add additional patients, extra agents, voice features, real integrations, new pages, or complex analytics.

Use remaining time for reliability, clarity, speed, visual polish, README, demo rehearsal, and a backup recording.

## 20. Three-Minute Demo Narrative

### Opening
“After a ward round, the clinical plan is documented, but the operational work has only just begun.”

### Extract
“This synthetic Abridge inpatient record contains the note and structured FHIR context. WardFlow extracts only documented actions and attaches the exact evidence for each one.”

### Verify
“Nothing executes without clinician approval. The clinician can approve, edit, or reject every action.”

### Execute
“Approved actions are mapped by Claude to tightly constrained tools, validated by the backend, and returned with traceable confirmations.”

### Close
“WardFlow does not stop when the order is placed. When a result returns, it links it back to the original plan and task, identifies the need for urgent review, and brings the relevant context back to the clinician.”

### Final line
“WardFlow closes the gap between the plan in the note and the care actually delivered.”

## 21. Claims We Can Make

- built during the hackathon
- uses synthetic Abridge data
- uses Anthropic Claude for extraction and tool selection
- uses clinician approval before execution
- uses simulated hospital tools
- maintains an auditable workflow state
- demonstrates closed-loop result handling

## 22. Claims We Must Not Make

- integrated with a real EHR
- placed a real clinical order
- safe for clinical deployment
- clinically validated
- diagnoses patients
- prescribes treatment
- replaces clinicians
- monitors real patients

## 23. Final Product Definition

WardFlow is not a chatbot and not a task dashboard.

It is a bounded, clinician-supervised workflow agent that translates documented clinical intent into traceable action and follows that action until it is completed or returned for review.
