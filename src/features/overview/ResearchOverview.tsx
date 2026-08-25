import { useEffect, useState } from "preact/hooks";

import { useTranslate } from "../../platform/i18n";
import { OverviewStatusStrip } from "./OverviewStatusStrip";
import { QuickTools } from "./QuickTools";
import { ResearchCalendar } from "./ResearchCalendar";
import { loadOverviewState, saveOverviewState, type OverviewState } from "./storage";
import { WeatherCard } from "./WeatherCard";
import "./overview.css";

export function ResearchOverview() {
  const t = useTranslate();
  const [state, setState] = useState<OverviewState>(() => loadOverviewState(window.localStorage));
  const [lastSavedAt, setLastSavedAt] = useState(state.savedAt);
  const [moduleTransferMessage, setModuleTransferMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = saveOverviewState(window.localStorage, state);
      setLastSavedAt(saved.savedAt);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [state]);

  function patch(update: Partial<OverviewState>) {
    setState((current) => ({ ...current, ...update }));
  }

  function sendToModule(value: string) {
    let armed = true;
    const accept = (event: Event) => {
      const target = event.target;
      if (!armed || !(target instanceof HTMLInputElement) || target.type !== "number" || !target.closest(".module-grid")) return;
      armed = false;
      target.value = value;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      target.focus();
      window.removeEventListener("focusin", accept, true);
      setModuleTransferMessage(t("overview.tools.sent"));
    };
    window.addEventListener("focusin", accept, true);
    window.setTimeout(() => { armed = false; window.removeEventListener("focusin", accept, true); }, 20_000);
    setModuleTransferMessage(t("overview.tools.pickField"));
    document.querySelector(".workbench-toolbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function backupOverview() {
    const lastBackupAt = new Date().toISOString();
    const body = JSON.stringify({ ...state, lastBackupAt, exportedAt: lastBackupAt }, null, 2);
    const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `benchtab-overview-${lastBackupAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    patch({ lastBackupAt });
  }

  return (
    <section class={`research-overview${state.collapsed ? " research-overview--collapsed" : ""}`} aria-label={t("overview.aria")}>
      <header class="research-overview__bar">
        <div><span class="status-dot" aria-hidden="true" /><b>{t("overview.title")}</b><small>{t("overview.local")}</small></div>
        {moduleTransferMessage && <span role="status">{moduleTransferMessage}</span>}
        <button class="text-button" type="button" aria-expanded={!state.collapsed} onClick={() => patch({ collapsed: !state.collapsed })}>{state.collapsed ? t("overview.expand") : t("overview.collapse")}</button>
      </header>
      {!state.collapsed && (
        <>
          <div class="research-overview__grid">
            <WeatherCard query={state.weatherQuery} snapshot={state.weather} onQueryChange={(weatherQuery) => patch({ weatherQuery })} onSnapshot={(weather) => patch({ weather })} />
            <ResearchCalendar events={state.events} onEventsChange={(events) => patch({ events })} />
            <QuickTools quickNote={state.quickNote} history={state.calculatorHistory} memory={state.calculatorMemory} onQuickNoteChange={(quickNote) => patch({ quickNote })} onHistoryChange={(calculatorHistory) => patch({ calculatorHistory })} onMemoryChange={(calculatorMemory) => patch({ calculatorMemory })} onSendToModule={sendToModule} />
          </div>
          <OverviewStatusStrip pomodoro={state.pomodoro} weeklyGoal={state.weeklyGoal} weeklyProgress={state.weeklyProgress} savedAt={lastSavedAt} lastBackupAt={state.lastBackupAt} onPomodoroChange={(pomodoro) => patch({ pomodoro })} onWeeklyGoalChange={(weeklyGoal) => patch({ weeklyGoal })} onWeeklyProgressChange={(weeklyProgress) => patch({ weeklyProgress })} onBackup={backupOverview} />
        </>
      )}
    </section>
  );
}

export * from "./calculator";
export * from "./calendar";
export * from "./units";
