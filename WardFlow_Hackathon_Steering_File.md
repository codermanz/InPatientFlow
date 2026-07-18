# WardFlow — Product Steering File

## 1. Product in One Sentence

WardFlow is a clinician-supervised inpatient workflow agent that converts documented ward-round plans into clear, reviewable tasks, follows those tasks through completion, and returns to the clinician when attention is required.

---

## 2. The Problem

After a ward round, the clinical plan may be documented, but the operational work has only just begun.

Clinicians still need to:

- identify every actionable item
- turn the plan into tasks
- complete requests and referrals
- remember to chase results
- recognise important findings
- reconnect returned results to the original plan
- decide which outcomes require immediate attention

The problem is not only deciding what should happen. It is ensuring that what was decided is carried out, tracked, reviewed, and closed.

---

## 3. Product Vision

WardFlow sits between the documented clinical plan and the work required to deliver it.

It:

1. identifies the actions documented during the ward round
2. presents them as a clear patient-specific task list
3. shows the source evidence behind each action
4. asks the clinician to approve, modify, or reject the plan
5. follows approved tasks after they are initiated
6. reconnects returned results to the original task
7. alerts the clinician when review is required
8. records routine completions without creating unnecessary interruptions

WardFlow does not replace clinical judgment. It helps ensure that clinician-approved intent becomes completed and reviewed work.

---

## 4. Hackathon Goal

Build one polished and reliable end-to-end inpatient workflow.

The live demo should show:

**Ward overview → patient selection → task extraction → clinician confirmation → task execution → notification → result review → suggested next steps → clinician action → ongoing monitoring**

A focused, working flow is more important than broad feature coverage.

---

## 5. Primary User

The primary user is the clinician responsible for completing and chasing inpatient jobs after a ward round.

This may include:

- junior doctors
- residents
- physician associates
- advanced practitioners
- other clinicians managing ward-round actions

---

## 6. Main User Story

> As the clinician responsible for post-ward-round jobs, I want the documented plan converted into a verified list of actions, so that I can complete and track patient care without manually reconstructing the plan across multiple systems.

---

## 7. Demo Scenario

Use one synthetic inpatient encounter with a documented ward-round plan.

Example actions may include:

- laboratory testing
- imaging
- monitoring
- specialty review
- medication review
- discharge-related work

A returned result should require clinician review and reconnect to the original action.

The product should:

- show the result clearly
- show why it requires attention
- show the relevant source evidence and context
- avoid presenting a diagnosis
- avoid prescribing treatment autonomously
- ask the clinician to review and decide what happens next

---

## 8. Product Experience

The product should feel like a calm, focused mobile workflow.

It should not feel like:

- a dashboard full of analytics
- a chatbot
- a miniature electronic health record
- a generic task manager

The interface should be:

- clean
- highly legible
- restrained
- easy to understand at a glance
- consistent across every step
- familiar to an iPhone user

---

## 9. Demo Workflow

### Step 1 — Ward Overview

The opening screen shows the ward and its patients at a glance.

It may include:

- ward name
- number of patients
- total tasks
- number of urgent items
- a compact patient list

Each patient row should remain simple.

Show only the information needed to choose the patient:

- name
- bed or location
- task count
- small status indicator

### Step 2 — Select Patient

Opening a patient shows the ward-round plan for that patient.

The screen should remain focused on the documented actions.

The clinician should be able to quickly understand:

- who the patient is
- where they are
- what has been planned today

### Step 3 — Extracted Tasks

WardFlow converts the documented plan into a clear set of proposed tasks.

Each task should be understandable without opening additional pages.

The clinician should be able to see:

- the task
- relevant timing or reason
- the source evidence behind the extraction

Evidence should be shown through a small, expandable element rather than a large permanent section.

Examples:

- “View source”
- an evidence icon
- a compact evidence drawer
- a short source excerpt beneath the task

### Step 4 — Confirm Plan

The clinician reviews the extracted tasks before anything proceeds.

They can:

- approve
- modify
- reject

The screen should make it clear that the clinician remains in control.

### Step 5 — Execute Tasks

WardFlow begins following the approved plan.

The execution screen should show:

- which tasks were sent
- which are waiting
- which have returned
- overall progress

The screen should end with a clear message that follow-up is active.

Suggested message:

> Tasks submitted. WardFlow will notify you if a result requires review.

At this point, the clinician leaves the app.

### Step 6 — Notification

After a short simulated delay, a privacy-safe notification appears.

Suggested notification:

> **Clinical follow-up needs review**  
> A new result requires your attention.

Do not include patient details or clinical values on the lock screen.

Tapping the notification should open the relevant patient and result directly.

### Step 7 — Results Back

The app opens to the returned result.

Show:

- result name
- result value
- reference range or status
- time returned
- brief context
- the task the result came from

The result should be connected visibly to the original plan.

### Step 8 — Needs Action

WardFlow clearly states that clinician attention is required.

The screen should answer:

- what happened
- why the clinician is seeing it
- what original task this relates to

The primary action may be:

> View Suggestions

A secondary action may allow the clinician to take another route.

### Step 9 — AI Suggestion

WardFlow presents concise, context-aware next steps.

The suggestion screen should include:

- suggested actions
- relevant context
- evidence behind the suggestion

Evidence should remain compact and optional.

Examples:

- source note
- returned result
- prior observation
- documented plan
- applicable local guidance used in the demo

The product must distinguish clearly between:

- documented facts
- documented clinician intent
- WardFlow suggestions

### Step 10 — Confirm and Act

The clinician selects the actions they want to add to the plan.

They can:

- approve suggested actions
- remove individual actions
- modify the plan
- choose another action

Nothing should appear to happen without clinician confirmation.

### Step 11 — Monitoring

WardFlow shows the ongoing state of the patient-specific plan.

The timeline may include:

- repeat test
- investigation result
- specialty review
- current monitoring status

The experience should make the closed loop visible:

**plan → task → result → review → next action**

---

## 10. Evidence Experience

Evidence is an important part of WardFlow, but it should not make the interface feel crowded.

Evidence should be:

- attached to the task or suggestion it supports
- available through progressive disclosure
- brief and readable
- clearly labelled by source
- visually secondary to the action itself

Do not add a large evidence panel to every screen.

Use one consistent evidence pattern throughout the product.

Recommended pattern:

- small evidence icon or “View source” label
- tap to open a bottom sheet
- show source type, time, and short excerpt
- close to return to the workflow

---

## 11. Safety Principles

### Evidence Before Action

Every extracted task and suggestion should be connected to supporting evidence.

### No Silent Inference

WardFlow should not present an inferred action as though it was documented by the clinical team.

### Human Approval

The clinician approves, modifies, or rejects actions before they proceed.

### Clear Separation

The product must distinguish between:

- source information
- documented plan
- WardFlow interpretation
- WardFlow suggestion
- clinician decision

### No Autonomous Diagnosis

WardFlow may explain why review is important, but it should not present a final diagnosis.

### No Autonomous Prescribing

WardFlow may suggest that medication review is needed, but it should not independently prescribe or alter medication.

### Synthetic Data Only

The demo must clearly state that all patient data and hospital activity are simulated.

---

## 12. Non-Goals

Do not spend hackathon time on:

- real hospital integrations
- real patient data
- autonomous diagnosis
- autonomous prescribing
- voice transcription
- authentication
- permissions
- production deployment
- a large number of patients
- broad support for every task type
- analytics dashboards
- complex secondary workflows

These may be discussed as future opportunities.

---

## 13. Success Criteria

The build is successful when:

- the ward overview is immediately understandable
- a patient can be selected
- the documented plan is visible
- WardFlow produces a useful task list
- evidence can be viewed without cluttering the screen
- the clinician can approve, modify, or reject the plan
- execution progress is visible
- the clinician can leave the app
- a simulated notification appears
- the notification opens the correct result
- the result is linked to the original task
- WardFlow explains why review is required
- suggestions include supporting evidence
- the clinician confirms the next action
- the final timeline shows ongoing monitoring
- the complete workflow can be demonstrated reliably

---

## 14. Design Principles

### Calm Over Dense

Do not add information merely because it is available.

### One Decision Per Screen

Each screen should have one primary purpose and one obvious next action.

### Progressive Disclosure

Keep secondary details, evidence, and history behind taps or expandable elements.

### Consistency

Use the same:

- navigation pattern
- card style
- spacing
- colour system
- button hierarchy
- evidence treatment
- status language

### Clinician Control

The clinician should always understand:

- what WardFlow found
- where it came from
- what WardFlow is suggesting
- what will happen after confirmation

---

## 15. Three-Minute Demo Narrative

### Opening

> “After a ward round, the plan is documented, but the operational work has only just begun.”

### Ward Overview

> “WardFlow gives the clinician a simple view of the ward, the current patients, and the work that needs attention.”

### Patient Plan

> “Opening a patient shows today’s documented plan.”

### Extraction

> “WardFlow converts the plan into a clear set of tasks and keeps the source evidence attached.”

### Confirmation

> “Nothing proceeds without clinician review. Every action can be approved, modified, or rejected.”

### Execution

> “Once confirmed, WardFlow begins following the plan and tracks each task.”

### Leave the App

> “The clinician does not need to keep watching the screen. WardFlow continues following the task.”

### Notification

> “When a returned result requires attention, WardFlow brings the clinician back to the exact issue.”

### Review

> “The result is reconnected to the original task, and WardFlow explains why review is required.”

### Suggestion

> “WardFlow provides context-aware next steps with supporting evidence, while the clinician remains in control.”

### Close

> “The updated plan is confirmed and WardFlow continues monitoring the workflow.”

### Final Line

> “WardFlow closes the gap between the plan in the note and the care actually delivered.”

---

## 16. Claims We Can Make

- built during the hackathon
- uses synthetic inpatient data
- extracts documented tasks
- provides supporting evidence
- requires clinician review
- follows tasks through returned results
- demonstrates a simulated notification
- demonstrates a closed-loop clinical workflow

---

## 17. Claims We Must Not Make

- integrated with a real hospital
- integrated with a real EHR
- placed a real clinical order
- monitors real patients
- safe for clinical deployment
- clinically validated
- diagnoses patients
- prescribes treatment
- replaces clinicians

---

## 18. Feature Freeze Rule

Once the complete end-to-end workflow works, do not add new product areas.

Use remaining time for:

- reliability
- clarity
- visual consistency
- evidence presentation
- transitions
- demo timing
- rehearsal
- backup recording

---

## 19. Final Product Definition

WardFlow is not a chatbot and not a task dashboard.

It is a bounded, clinician-supervised inpatient workflow agent that turns documented plans into clear actions, follows those actions through returned results, and brings the clinician back when review is required.