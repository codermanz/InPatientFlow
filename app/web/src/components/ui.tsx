// Shared UI primitives (v2) — one card style, one button hierarchy, one status
// language, one pine-green system. Reused across all 8 screens.
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { PatientStatus } from '../types';

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        onClick && 'cursor-pointer transition-transform active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full rounded-2xl bg-brand py-4 text-center text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover active:bg-brand-hover disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3.5 text-center text-[14px] font-semibold text-ink transition-colors hover:bg-neutral-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

// Initials avatar (pale pine circle) — patients are identified by Hospital No.
export function Avatar({
  initials,
  size = 'md',
  className,
}: {
  initials: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-tint font-semibold text-brand',
        size === 'md' ? 'h-11 w-11 text-[15px]' : 'h-9 w-9 text-[13px]',
        className,
      )}
    >
      {initials}
    </span>
  );
}

// Status dot — v2: need_action→red, need_review→amber, unchanged→green.
export function StatusDot({ status }: { status: PatientStatus }) {
  const color =
    status === 'need_action'
      ? 'bg-dot-red'
      : status === 'need_review'
        ? 'bg-dot-amber'
        : 'bg-dot-green';
  return <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', color)} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 pb-2 pt-1 text-[13px] font-semibold text-ink">{children}</p>
  );
}

// Back bar (chevron) used on every detail screen. Real back stack pop.
export function BackBar({
  onBack,
  right,
}: {
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-2">
      <button
        onClick={onBack}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-neutral-100"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      {right}
    </div>
  );
}

// Patient identity header (avatar + Hospital No. + Bed) — screens 2,3,5,6,7,8.
export function PatientHeader({
  hospitalNo,
  bed,
  initials,
}: {
  hospitalNo: string;
  bed: string;
  initials: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-1">
      <Avatar initials={initials} />
      <div>
        <p className="text-[18px] font-bold leading-tight text-ink">
          Hospital No. {hospitalNo}
        </p>
        <p className="text-[13px] text-ink2">{bed}</p>
      </div>
    </div>
  );
}

export function Chevron() {
  return <ChevronRight className="h-4 w-4 text-neutral-300" />;
}
