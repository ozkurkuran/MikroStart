import type { WorkflowStorage } from "./persistence";
import { CountdownCard } from "./CountdownCard";
import { QuickNoteCard } from "./QuickNoteCard";
import { SampleIdCard } from "./SampleIdCard";
import { StopwatchCard } from "./StopwatchCard";
import { WorkflowProvider } from "./workflow-context";
import "./workflows-panel.css";

export interface WorkflowsPanelProps {
  storage?: WorkflowStorage;
  clock?: () => number;
}

/** Compatibility composition for hosts that want the complete workflow suite. */
export function WorkflowsPanel({ storage, clock = Date.now }: WorkflowsPanelProps) {
  return (
    <WorkflowProvider storage={storage} clock={clock}>
      <div class="workflows-panel__standalone-grid">
        <CountdownCard />
        <StopwatchCard />
        <SampleIdCard />
        <QuickNoteCard />
      </div>
    </WorkflowProvider>
  );
}
