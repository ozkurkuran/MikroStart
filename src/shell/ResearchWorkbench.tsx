import { useEffect, useMemo, useState } from "preact/hooks";

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  type UserPreferences,
} from "../platform/preferences";
import { BraggCalculator } from "../features/calculators/bragg-spacing";
import {
  HallCalculator,
  ScherrerCalculator,
  SheetResistanceCalculator,
  VacuumCalculator,
} from "../features/calculators/lab-pack";
import {
  AiResearchPanel,
  createOpaqueAiSourceId,
  type AiPanelResult,
  type AiResearchSource,
} from "../features/ai";
import type { NormalizedFeedItem } from "../features/feeds";
import { LanguageToolsPanel, TurengDictionaryCard } from "../features/language-tools";
import { IndexedDbNotebookRepository } from "../features/notebook";
import { REFERENCE_SOURCES, ReferenceLibrary } from "../features/references";
import {
  CountdownCard,
  QuickNoteCard,
  SampleIdCard,
  StopwatchCard,
  WorkflowProvider,
} from "../features/workflows";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  loadDashboardLayout,
  saveDashboardLayout,
  type DashboardLayout,
  type ModuleId,
} from "../platform/layoutPreferences";
import { FeedPanel } from "./FeedPanel";
import { ModuleManager } from "./ModuleManager";
import { ModuleSlot } from "./ModuleSlot";
import { NotebookPanel } from "./NotebookPanel";

export type Surface = "newtab" | "dashboard" | "sidepanel";

interface ResearchWorkbenchProps {
  surface: Surface;
}

const CONSTANT_KINDS = ["constant"] as const;
const ELEMENT_KINDS = ["element"] as const;
const SERIES_KINDS = ["e-series"] as const;

function formatClock(date: Date, locale: UserPreferences["locale"]): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAiResult(
  result: AiPanelResult,
  sourceLabels: ReadonlyMap<string, string>,
): string {
  const labels = (ids: readonly string[]) =>
    ids.map((id) => sourceLabels.get(id) ?? "[seçilmiş kaynak]").join(", ");

  if (result.mode === "summarize" || result.mode === "translate") {
    return result.value.text;
  }
  if (result.mode === "digest") {
    return result.value.items
      .map((item) => `- ${item.text} — ${labels(item.sourceIds)}`)
      .join("\n");
  }
  return result.value.items
    .map(
      (item) =>
        `- ${Math.round(item.score * 100)}% · ${item.reason} — ${sourceLabels.get(item.sourceId) ?? "[seçilmiş kaynak]"}`,
    )
    .join("\n");
}

export function ResearchWorkbench({ surface }: ResearchWorkbenchProps) {
  const [now, setNow] = useState(() => new Date());
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [layout, setLayout] = useState(DEFAULT_DASHBOARD_LAYOUT);
  const [manageModules, setManageModules] = useState(false);
  const [aiSources, setAiSources] = useState<AiResearchSource[]>([]);
  const [selectedFeedItems, setSelectedFeedItems] = useState<NormalizedFeedItem[]>([]);

  useEffect(() => {
    void loadPreferences().then(setPreferences);
    void loadDashboardLayout().then(setLayout);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  function updateLayout(next: DashboardLayout) {
    setLayout(next);
    void saveDashboardLayout(next);
  }

  function selectAiSources(items: NormalizedFeedItem[]) {
    setSelectedFeedItems(items);
    setAiSources(
      items.map((item) => ({
        sourceId: createOpaqueAiSourceId(item.id),
        title: item.title,
        text: item.sourceDescription?.trim() || item.title,
        language: item.language,
      })),
    );
  }

  async function saveAiResult(result: AiPanelResult) {
    const repository = new IndexedDbNotebookRepository();
    const sourceLabels = new Map(
      aiSources.map((source, index) => [source.sourceId, `[${index + 1}]`]),
    );
    const sourceList = selectedFeedItems
      .map((item, index) =>
        item.canonicalUrl
          ? `${index + 1}. ${item.title}\n   <${item.canonicalUrl}>`
          : `${index + 1}. ${item.title}`,
      )
      .join("\n");
    const markdown = [
      "> AI-generated on this device. Verify every claim against the linked sources.",
      "",
      formatAiResult(result, sourceLabels),
      "",
      "## Sources",
      "",
      sourceList,
    ].join("\n");

    try {
      const note = await repository.createNote({
        type: "literature",
        title: `On-device AI ${result.mode} · ${new Date().toLocaleDateString("tr-TR")}`,
        markdown,
        tags: ["ai-generated", result.mode],
      });
      for (const item of selectedFeedItems) {
        if (!item.canonicalUrl) continue;
        await repository.saveFeedItemToNote({
          noteId: note.id,
          item: {
            id: item.id,
            sourceId: item.sourceId,
            connectorId: item.connectorId,
            canonicalUrl: item.canonicalUrl,
            title: item.title,
            authors: item.authors.map((author) => ({ literal: author.name })),
            publishedAt: item.publishedAt,
            retrievedAt: item.retrievedAt,
            doi: item.identifiers.doi,
            publisherOrInstitution: item.sourceId,
            contentHash: item.contentHash,
            referenceType: item.identifiers.arxiv ? "preprint" : "article",
          },
        });
      }
      window.dispatchEvent(new Event("benchtab:notebook-changed"));
    } finally {
      repository.close();
    }
  }

  function moduleContent(id: ModuleId) {
    switch (id) {
      case "bragg-spacing":
        return (
          <article class="widget widget--cyan widget--calculator">
            <div class="widget__heading">
              <span class="widget__eyebrow">CALCULATE · DETERMINISTIC</span>
            </div>
            <BraggCalculator />
          </article>
        );
      case "scherrer-size":
        return (
          <article class="widget widget--cyan lab-pack">
            <div class="widget__heading"><span class="widget__eyebrow">XRD · CALCULATE</span></div>
            <ScherrerCalculator />
          </article>
        );
      case "sheet-resistance":
        return (
          <article class="widget widget--cyan lab-pack">
            <div class="widget__heading"><span class="widget__eyebrow">ELECTRICAL · CALCULATE</span></div>
            <SheetResistanceCalculator />
          </article>
        );
      case "hall-measurement":
        return (
          <article class="widget widget--cyan lab-pack">
            <div class="widget__heading"><span class="widget__eyebrow">TRANSPORT · CALCULATE</span></div>
            <HallCalculator />
          </article>
        );
      case "vacuum-kinetics":
        return (
          <article class="widget widget--cyan lab-pack">
            <div class="widget__heading"><span class="widget__eyebrow">VACUUM · CALCULATE</span></div>
            <VacuumCalculator />
          </article>
        );
      case "research-feed":
        return <FeedPanel onSelectionChange={selectAiSources} />;
      case "on-device-ai":
        return (
          <AiResearchPanel
            selectedSources={aiSources}
            onSaveResult={saveAiResult}
            onRequestSourceSelection={() =>
              document.querySelector(".feed-panel")?.scrollIntoView({ behavior: "smooth" })
            }
          />
        );
      case "translation-tools":
        return <LanguageToolsPanel showTureng={false} />;
      case "tureng-dictionary":
        return <TurengDictionaryCard />;
      case "codata-constants":
        return (
          <article class="widget widget--amber widget--embedded">
            <div class="widget__heading"><span class="widget__eyebrow">CONSTANTS · OFFLINE</span></div>
            <ReferenceLibrary
              kinds={CONSTANT_KINDS}
              title="CODATA sabitleri"
              description="Temel fizik sabitlerini cihazda arayın."
              placeholder="Boltzmann, Planck veya c"
              sourceIds={[REFERENCE_SOURCES.codata2022.id]}
            />
          </article>
        );
      case "periodic-table":
        return (
          <article class="widget widget--amber widget--embedded">
            <div class="widget__heading"><span class="widget__eyebrow">ELEMENTS · OFFLINE</span></div>
            <ReferenceLibrary
              kinds={ELEMENT_KINDS}
              title="Periyodik tablo"
              description="118 elementi ad, sembol veya atom numarasıyla arayın."
              placeholder="Fe, gold veya 79"
              sourceIds={[REFERENCE_SOURCES.atomicWeights2024.id, REFERENCE_SOURCES.periodicTable2022.id]}
            />
          </article>
        );
      case "component-series":
        return (
          <article class="widget widget--amber widget--embedded">
            <div class="widget__heading"><span class="widget__eyebrow">COMPONENTS · OFFLINE</span></div>
            <ReferenceLibrary
              kinds={SERIES_KINDS}
              title="Standart bileşen serileri"
              description="IEC E6, E12 ve E24 tercih edilen değerleri."
              placeholder="E6, E12 veya E24"
              initialQuery="E12"
              sourceIds={[REFERENCE_SOURCES.eSeries2015.id]}
            />
          </article>
        );
      case "countdown-timers":
        return <CountdownCard />;
      case "stopwatch":
        return <StopwatchCard />;
      case "sample-id":
        return <SampleIdCard />;
      case "quick-note":
        return <QuickNoteCard />;
      case "lab-notebook":
        return <NotebookPanel />;
    }
  }

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(preferences.locale === "tr" ? "tr-TR" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(now),
    [now, preferences.locale],
  );

  return (
    <main class={`workbench workbench--${surface}${preferences.compactCards ? " workbench--compact" : ""}`}>
      <header class="topbar">
        <a class="brand" href="/pages/dashboard.html" aria-label="BenchTab dashboard">
          <span class="brand__mark" aria-hidden="true">B</span>
          <span>
            <strong>BenchTab</strong>
            <small>research workbench</small>
          </span>
        </a>
        <div class="topbar__center">
          <span class="status-dot" aria-hidden="true" />
          Local workspace
        </div>
        <nav class="topbar__actions" aria-label="Workspace actions">
          <a class="button button--quiet" href="/pages/options.html">Settings</a>
          <time dateTime={now.toISOString()}>{formatClock(now, preferences.locale)}</time>
        </nav>
      </header>

      <section class="workspace-intro">
        <div>
          <p class="overline">{dateLabel}</p>
          <h1>Araştırma çalışma alanı</h1>
        </div>
        <button class="button button--primary" type="button" onClick={() => setManageModules(true)}>
          Manage modules
        </button>
      </section>

      <WorkflowProvider storage={window.localStorage}>
        <section class="module-grid" aria-label="Research modules">
          {layout.order
            .filter((id) => !layout.hidden.includes(id))
            .map((id) => <ModuleSlot id={id} key={id}>{moduleContent(id)}</ModuleSlot>)}
        </section>
      </WorkflowProvider>

      {manageModules && (
        <ModuleManager
          layout={layout}
          onChange={updateLayout}
          onClose={() => setManageModules(false)}
        />
      )}

      <footer class="privacy-strip">
        <span class="status-dot" aria-hidden="true" />
        No BenchTab account · No telemetry · External sources require your permission
      </footer>
    </main>
  );
}
