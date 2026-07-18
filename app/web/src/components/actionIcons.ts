// Icon per suggested action — first by the workflow the agent discovered, then
// by keyword on the title/label (so real backend actions still get sensible
// icons even if their workflowId differs).
import { FileText, Camera, Activity, Pill, HeartPulse } from 'lucide-react';
import type { SuggestedAction } from '../types';

type Icon = typeof FileText;

const BY_WORKFLOW: Record<string, Icon> = {
  'order-lab': FileText,
  ecg: Camera,
  'specialty-consult': Activity,
  'medication-administer': Pill,
  'cardiac-monitoring': HeartPulse,
  'reassess-recheck': FileText,
};

export function actionIcon(a: SuggestedAction): Icon {
  if (a.workflowId && BY_WORKFLOW[a.workflowId]) return BY_WORKFLOW[a.workflowId];
  const s = `${a.title} ${a.workflowLabel ?? ''}`.toLowerCase();
  if (/ecg/.test(s)) return Camera;
  if (/aspirin|enoxaparin|heparin|mg|dose|medication|drug/.test(s)) return Pill;
  if (/monitor|telemetry/.test(s)) return HeartPulse;
  if (/cardiolog|review|consult|specialty/.test(s)) return Activity;
  if (/troponin|lab|blood|panel|repeat|order/.test(s)) return FileText;
  return FileText;
}
