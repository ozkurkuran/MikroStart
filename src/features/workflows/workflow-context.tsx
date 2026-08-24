import { createContext, type ComponentChildren } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";

import { cancelCountdownAlarm, playAlarmPreview, scheduleCountdownAlarm } from "./alarm-client";
import { countdownSnapshot } from "./countdown";
import {
  EMPTY_WORKFLOW_STATE,
  loadWorkflowState,
  saveWorkflowState,
  type WorkflowState,
  type WorkflowStorage,
} from "./persistence";
import "./workflows-panel.css";

type WorkflowStateUpdate = WorkflowState | ((current: WorkflowState) => WorkflowState);

interface WorkflowController {
  state: WorkflowState;
  setState: (update: WorkflowStateUpdate) => void;
  nowMs: number;
  clock: () => number;
}

const WorkflowContext = createContext<WorkflowController | undefined>(undefined);

interface WorkflowProviderProps {
  children: ComponentChildren;
  storage?: WorkflowStorage;
  clock?: () => number;
}

export function WorkflowProvider({ children, storage, clock = Date.now }: WorkflowProviderProps) {
  const [state, setState] = useState<WorkflowState>(() =>
    storage
      ? loadWorkflowState(storage)
      : { ...EMPTY_WORKFLOW_STATE, stopwatch: { ...EMPTY_WORKFLOW_STATE.stopwatch, laps: [] } },
  );
  const [nowMs, setNowMs] = useState(() => clock());
  const announcedCountdowns = useRef(
    new Set(
      state.countdowns
        .filter((countdown) => countdownSnapshot(countdown, clock()).expired)
        .map((countdown) => countdown.id),
    ),
  );

  useEffect(() => {
    const refreshMs = state.stopwatch.running ? 100 : 1_000;
    const timer = globalThis.setInterval(() => setNowMs(clock()), refreshMs);
    return () => globalThis.clearInterval(timer);
  }, [clock, state.stopwatch.running]);

  useEffect(() => {
    if (storage) saveWorkflowState(storage, state);
  }, [state, storage]);

  useEffect(() => {
    if (!state.soundEnabled) return;
    for (const countdown of state.countdowns) {
      const snapshot = countdownSnapshot(countdown, nowMs);
      if (!snapshot.expired) {
        announcedCountdowns.current.delete(countdown.id);
        continue;
      }
      if (announcedCountdowns.current.has(countdown.id)) continue;
      announcedCountdowns.current.add(countdown.id);
      void cancelCountdownAlarm(countdown.id).then(playAlarmPreview).catch(() => undefined);
    }
  }, [nowMs, state.countdowns, state.soundEnabled]);

  useEffect(() => {
    if (!state.soundEnabled) return;
    for (const countdown of state.countdowns) {
      if (!countdownSnapshot(countdown, clock()).expired) {
        void scheduleCountdownAlarm(countdown).catch(() => undefined);
      }
    }
  }, []);

  return (
    <WorkflowContext.Provider value={{ state, setState, nowMs, clock }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow(): WorkflowController {
  const controller = useContext(WorkflowContext);
  if (!controller) throw new Error("Workflow cards must be rendered inside WorkflowProvider.");
  return controller;
}
