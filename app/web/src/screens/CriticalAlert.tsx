// Screen 4 — Critical Alert (lock screen). Dark green gradient, big clock, and
// a RED urgent banner that appears after ~5s (polls GET /api/notifications; a
// dev key 'a' fires POST /api/sim/advance to reveal it immediately). Tapping the
// banner deep-links to screen 5 (the raised troponin result).
import { useEffect, useState } from 'react';
import { Lock, AlertTriangle, Camera, Flashlight } from 'lucide-react';
import { useNav } from '../nav';
import * as api from '../api';
import * as fx from '../fixtures';
import type { Notification } from '../types';

export default function CriticalAlert() {
  const { go } = useNav();
  const [notif, setNotif] = useState<Notification | null>(null);

  useEffect(() => {
    let alive = true;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    // Fire the scripted result on the backend (no-op / fixture offline), then
    // poll notifications. Reveal after a short delay for the lock-screen beat.
    api.simAdvance(fx.HERO_ID).catch(() => {});

    const poll = async () => {
      const { notifications } = await api
        .getNotifications()
        .catch(() => ({ notifications: [] as Notification[] }));
      const urgent = notifications.find((n) => n.urgent) ?? notifications[0];
      if (alive && urgent) setNotif(urgent);
    };

    const delay = setTimeout(() => {
      poll();
      // Ensure the banner shows even if the backend has no notification yet.
      if (alive) setNotif((prev) => prev ?? fx.notification);
      pollTimer = setInterval(poll, 1000);
    }, 5000);

    // Dev key: 'a' → advance immediately.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'a') {
        api.simAdvance(fx.HERO_ID).catch(() => {});
        poll();
        if (alive) setNotif((prev) => prev ?? fx.notification);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      alive = false;
      clearTimeout(delay);
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openResult = () =>
    notif && go('result', { patientId: notif.patientId, resultId: notif.resultEventId });

  return (
    <div className="relative flex h-full flex-col items-center px-5 text-white">
      <Lock className="mt-6 h-6 w-6 opacity-90" />
      <div className="mt-10 text-center">
        <p className="text-[76px] font-bold leading-none tracking-tight tabular-nums">11:47</p>
        <p className="mt-2 text-[20px] font-medium text-white/90">Saturday 18 May</p>
      </div>

      {notif && (
        <button
          onClick={openResult}
          className="animate-banner-drop mt-10 w-full rounded-3xl bg-critical px-5 py-4 text-left shadow-2xl"
        >
          <div className="mb-1 flex items-center justify-between text-[12px] font-medium text-white/85">
            <span>WardFlow</span>
            <span>now</span>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0" strokeWidth={2.2} />
            <div>
              <p className="text-[16px] font-bold leading-snug">{notif.title}</p>
              <p className="text-[14px] text-white/90">{notif.body}</p>
            </div>
          </div>
        </button>
      )}

      <div className="mt-auto mb-8 flex w-full items-center justify-between px-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
          <Flashlight className="h-5 w-5" />
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
          <Camera className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
