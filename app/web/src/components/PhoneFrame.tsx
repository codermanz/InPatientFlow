import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Wifi, BatteryFull } from 'lucide-react';

export type FrameVariant = 'light' | 'dark' | 'lock';

/**
 * Reusable iPhone bezel shell (~390x844) with a status bar.
 * The content area is `relative` so overlays (evidence sheet, notification
 * banner) can be absolutely positioned within the phone.
 */
export default function PhoneFrame({
  children,
  time = '9:41',
  variant = 'light',
  showStatusBar = true,
}: {
  children?: ReactNode;
  time?: string;
  variant?: FrameVariant;
  showStatusBar?: boolean;
}) {
  const darkText = variant === 'light';
  const bg =
    variant === 'dark'
      ? 'bg-brand-dark'
      : variant === 'lock'
        ? 'bg-lock'
        : 'bg-page';

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-200 p-6">
      <div
        className={clsx(
          'relative h-[844px] w-[390px] overflow-hidden rounded-[3.25rem] border-[14px] border-black shadow-2xl',
          bg,
        )}
      >
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-40 h-7 w-40 -translate-x-1/2 rounded-b-3xl bg-black" />
        {/* Status bar */}
        {showStatusBar && (
          <div
            className={clsx(
              'relative z-30 flex h-11 items-center justify-between px-7 pt-1 text-[15px] font-semibold',
              darkText ? 'text-black' : 'text-white',
            )}
          >
            <span className="tabular-nums">{time}</span>
            <div className="flex items-center gap-1.5">
              <SignalBars />
              <Wifi className="h-4 w-4" strokeWidth={2.5} />
              <BatteryFull className="h-5 w-5" strokeWidth={2} />
            </div>
          </div>
        )}
        {/* Screen content (relative anchor for overlays) */}
        <div
          className={clsx(
            'no-scrollbar relative overflow-y-auto',
            showStatusBar ? 'h-[calc(844px-2.75rem)]' : 'h-full',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SignalBars() {
  return (
    <div className="flex items-end gap-[2px]">
      {[3, 5, 7, 9].map((h) => (
        <span
          key={h}
          className="w-[3px] rounded-sm bg-current"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
