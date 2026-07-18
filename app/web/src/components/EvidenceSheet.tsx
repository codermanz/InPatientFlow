// ONE consistent evidence pattern (steering §10): a small "View source" icon
// opens a bottom sheet showing source type + time + short excerpt. Reused on
// screens 4 (Agent Recommendation) and 9 (Action Plan).
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import {
  FlaskConical,
  Pill,
  FileText,
  ShieldCheck,
  Activity,
  MessageSquareText,
  BookOpen,
  X,
} from 'lucide-react';
import type { EvidenceRef, EvidenceType } from '../types';

const ICONS: Record<EvidenceType, typeof FlaskConical> = {
  lab: FlaskConical,
  mar: Pill,
  progress_note: FileText,
  protocol: ShieldCheck,
  observation: Activity,
  transcript: MessageSquareText,
  note: BookOpen,
};

export function evidenceIcon(type: EvidenceType) {
  return ICONS[type] ?? FileText;
}

interface EvidenceCtx {
  open: (ref: EvidenceRef) => void;
}
const Ctx = createContext<EvidenceCtx | null>(null);

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [ref, setRef] = useState<EvidenceRef | null>(null);
  const open = useCallback((r: EvidenceRef) => setRef(r), []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {ref && <EvidenceSheet refItem={ref} onClose={() => setRef(null)} />}
    </Ctx.Provider>
  );
}

export function useEvidence() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEvidence must be used inside EvidenceProvider');
  return c;
}

// Small "View source" chip used inline next to a task or action.
export function EvidenceChip({ refItem }: { refItem: EvidenceRef }) {
  const { open } = useEvidence();
  const Icon = evidenceIcon(refItem.type);
  return (
    <button
      onClick={() => open(refItem)}
      className="flex w-full items-center gap-2.5 py-2 text-left"
    >
      <Icon className="h-4 w-4 shrink-0 text-brand" />
      <span className="flex-1 text-[14px] text-neutral-700">
        {refItem.label}
      </span>
      <span className="text-[13px] tabular-nums text-neutral-400">
        {refItem.timestamp}
      </span>
    </button>
  );
}

// A subtle standalone "View source" link (used beneath a suggested action).
export function ViewSource({ refItem }: { refItem: EvidenceRef }) {
  const { open } = useEvidence();
  return (
    <button
      onClick={() => open(refItem)}
      className="text-[12px] font-medium text-brand underline-offset-2 hover:underline"
    >
      View source
    </button>
  );
}

function EvidenceSheet({
  refItem,
  onClose,
}: {
  refItem: EvidenceRef;
  onClose: () => void;
}) {
  const Icon = evidenceIcon(refItem.type);
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      {/* scrim */}
      <div
        className="absolute inset-0 bg-black/30 animate-fade-in"
        onClick={onClose}
      />
      {/* sheet */}
      <div className="animate-sheet-up relative rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-neutral-300" />
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint">
              <Icon className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-neutral-900">
                {refItem.label}
              </p>
              <p className="text-[12px] text-neutral-400">
                Source · {refItem.timestamp ?? '—'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="rounded-xl bg-neutral-50 p-4">
          <p className="text-[14px] leading-relaxed text-neutral-700">
            “{refItem.excerpt}”
          </p>
          {refItem.sourceRef && (
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {refItem.sourceRef}
            </p>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-neutral-400">
          Synthetic source — for demonstration only
        </p>
      </div>
    </div>
  );
}
