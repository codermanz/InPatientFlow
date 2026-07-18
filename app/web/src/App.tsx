import type { ComponentType } from 'react';
import PhoneFrame, { type FrameVariant } from './components/PhoneFrame';
import { NavProvider, useNav, type ScreenId } from './nav';
import { DataProvider } from './data';
import { EvidenceProvider } from './components/EvidenceSheet';
import { USE_FIXTURES } from './api';

import Overview from './screens/Overview';
import PatientSummary from './screens/PatientSummary';
import TasksRequested from './screens/TasksRequested';
import TaskDetail from './screens/TaskDetail';
import CriticalAlert from './screens/CriticalAlert';
import TroponinResult from './screens/TroponinResult';
import FullResults from './screens/FullResults';
import AISuggestions from './screens/AISuggestions';
import ActionDetail from './screens/ActionDetail';
import ModifyPlan from './screens/ModifyPlan';
import ConfirmNextSteps from './screens/ConfirmNextSteps';
import Monitoring from './screens/Monitoring';
import AlertsTab from './screens/AlertsTab';
import MoreTab from './screens/MoreTab';

const SCREEN_COMPONENTS: Record<ScreenId, ComponentType> = {
  overview: Overview,
  patient: PatientSummary,
  tasks: TasksRequested,
  taskdetail: TaskDetail,
  alert: CriticalAlert,
  result: TroponinResult,
  fullresults: FullResults,
  suggestions: AISuggestions,
  actiondetail: ActionDetail,
  modify: ModifyPlan,
  confirm: ConfirmNextSteps,
  monitoring: Monitoring,
  alerts: AlertsTab,
  more: MoreTab,
};

// Per-screen device chrome. The critical alert is a dark green lock screen.
const FRAME: Partial<Record<ScreenId, { variant: FrameVariant; time?: string }>> = {
  alert: { variant: 'lock', time: '11:47' },
};

function Stage() {
  const { screen } = useNav();
  const Screen = SCREEN_COMPONENTS[screen];
  const frame = FRAME[screen] ?? { variant: 'light' as FrameVariant };

  return (
    <PhoneFrame variant={frame.variant} time={frame.time}>
      <EvidenceProvider>
        <Screen />
      </EvidenceProvider>
    </PhoneFrame>
  );
}

export default function App() {
  return (
    <NavProvider>
      <DataProvider>
        <Stage />
        {/* Persistent, unobtrusive synthetic-data affordance */}
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900/70 px-3 py-1 text-[10px] font-medium tracking-wide text-white/90">
          Synthetic data — simulated{USE_FIXTURES ? ' · fixtures' : ''}
        </div>
      </DataProvider>
    </NavProvider>
  );
}
