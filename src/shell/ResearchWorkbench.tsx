import { useEffect, useMemo, useState } from "preact/hooks";

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
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
import {
  createTranslate,
  I18nProvider,
  localeTag,
  type Translate,
} from "../platform/i18n";
import { FeedPanel } from "./FeedPanel";
import { ModuleManager } from "./ModuleManager";
import { ModuleSlot } from "./ModuleSlot";
import {
  MODULE_CATALOG,
  MODULE_CATEGORIES,
  matchesModuleQuery,
  moduleEyebrow,
  type ModuleCategory,
} from "./moduleCatalog";
import { NotebookPanel } from "./NotebookPanel";
import { WorkbenchToolbar, type CategoryFilter } from "./WorkbenchToolbar";
import { ResearchOverview } from "../features/overview/ResearchOverview";

export type Surface = "newtab" | "dashboard" | "sidepanel";

interface ResearchWorkbenchProps {
  surface: Surface;
}

const CONSTANT_KINDS = ["constant"] as const;
const ELEMENT_KINDS = ["element"] as const;
const SERIES_KINDS = ["e-series"] as const;

function formatClock(date: Date, locale: UserPreferences["locale"]): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAiResult(
  result: AiPanelResult,
  sourceLabels: ReadonlyMap<string, string>,
  t: Translate,
): string {
  const cited = (id: string) => sourceLabels.get(id) ?? t("ai.citedSource");
  const labels = (ids: readonly string[]) => ids.map(cited).join(", ");

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
        `- ${Math.round(item.score * 100)}% · ${item.reason} — ${cited(item.sourceId)}`,
    )
    .join("\n");
}

export function ResearchWorkbench({ surface }: ResearchWorkbenchProps) {
  const [now, setNow] = useState(() => new Date());
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [layout, setLayout] = useState(DEFAULT_DASHBOARD_LAYOUT);
  const [manageModules, setManageModules] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [aiSources, setAiSources] = useState<AiResearchSource[]>([]);
  const [selectedFeedItems, setSelectedFeedItems] = useState<NormalizedFeedItem[]>([]);

  useEffect(() => {
    void loadPreferences().then(setPreferences);
    void loadDashboardLayout().then(setLayout);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const t = useMemo(() => createTranslate(preferences.locale), [preferences.locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.lang = preferences.locale;
  }, [preferences.locale]);

  function updateLayout(next: DashboardLayout) {
    setLayout(next);
    void saveDashboardLayout(next);
  }

  function setCompactCards(compactCards: boolean) {
    const next = { ...preferences, compactCards };
    setPreferences(next);
    void savePreferences(next);
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
      `> ${t("ai.disclaimer")}`,
      "",
      formatAiResult(result, sourceLabels, t),
      "",
      `## ${t("ai.sourcesHeading")}`,
      "",
      sourceList,
    ].join("\n");

    try {
      const note = await repository.createNote({
        type: "literature",
        title: t("ai.noteTitle", {
          mode: t(`ai.mode.${result.mode}`),
          date: new Date().toLocaleDateString(localeTag(preferences.locale)),
        }),
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
          <article class="widget widget--calculator">
            <div class="widget__heading">
              <span class="widget__eyebrow">{moduleEyebrow(t, "bragg-spacing")}</span>
            </div>
            <BraggCalculator />
          </article>
        );
      case "scherrer-size":
        return (
          <article class="widget lab-pack">
            <div class="widget__heading"><span class="widget__eyebrow">{moduleEyebrow(t, "scherrer-size")}</span></div>
            <ScherrerCalculator />
          </article>
        );
      case "sheet-resistance":
        return (
          <article class="widget lab-pack">
            <div class="widget__heading"><span class="widget__eyebrow">{moduleEyebrow(t, "sheet-resistance")}</span></div>
            <SheetResistanceCalculator />
          </article>
        );
      case "hall-measurement":
        return (
          <article class="widget lab-pack">
            <div class="widget__heading"><span class="widget__eyebrow">{moduleEyebrow(t, "hall-measurement")}</span></div>
            <HallCalculator />
          </article>
        );
      case "vacuum-kinetics":
        return (
          <article class="widget lab-pack">
            <div class="widget__heading"><span class="widget__eyebrow">{moduleEyebrow(t, "vacuum-kinetics")}</span></div>
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
          <article class="widget widget--embedded">
            <div class="widget__heading"><span class="widget__eyebrow">{moduleEyebrow(t, "codata-constants")}</span></div>
            <ReferenceLibrary
              kinds={CONSTANT_KINDS}
              title={t("ref.constants.title")}
              description={t("ref.constants.description")}
              placeholder={t("ref.constants.placeholder")}
              sourceIds={[REFERENCE_SOURCES.codata2022.id]}
            />
          </article>
        );
      case "periodic-table":
        return (
          <article class="widget widget--embedded">
            <div class="widget__heading"><span class="widget__eyebrow">{moduleEyebrow(t, "periodic-table")}</span></div>
            <ReferenceLibrary
              kinds={ELEMENT_KINDS}
              title={t("ref.elements.title")}
              description={t("ref.elements.description")}
              placeholder={t("ref.elements.placeholder")}
              sourceIds={[REFERENCE_SOURCES.atomicWeights2024.id, REFERENCE_SOURCES.periodicTable2022.id]}
            />
          </article>
        );
      case "component-series":
        return (
          <article class="widget widget--embedded">
            <div class="widget__heading"><span class="widget__eyebrow">{moduleEyebrow(t, "component-series")}</span></div>
            <ReferenceLibrary
              kinds={SERIES_KINDS}
              title={t("ref.series.title")}
              description={t("ref.series.description")}
              placeholder={t("ref.series.placeholder")}
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
      new Intl.DateTimeFormat(localeTag(preferences.locale), {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(now),
    [now, preferences.locale],
  );

  /** Modules the user has kept on the board, in their chosen order. */
  const enabledIds = useMemo(
    () => layout.order.filter((id) => !layout.hidden.includes(id)),
    [layout],
  );

  /** Search narrows the board; the category chips then narrow it further. */
  const searchMatchedIds = useMemo(
    () => enabledIds.filter((id) => matchesModuleQuery(t, id, query)),
    [enabledIds, query, t],
  );

  const visibleIds = useMemo(
    () =>
      category === "all"
        ? searchMatchedIds
        : searchMatchedIds.filter((id) => MODULE_CATALOG[id].category === category),
    [searchMatchedIds, category],
  );

  /** Chip counts reflect the search, so a chip never promises an empty board. */
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      MODULE_CATEGORIES.map((id) => [id, 0]),
    ) as Record<ModuleCategory, number>;
    for (const id of searchMatchedIds) counts[MODULE_CATALOG[id].category] += 1;
    return counts;
  }, [searchMatchedIds]);

  const isFiltered = query.trim().length > 0 || category !== "all";

  return (
    <I18nProvider locale={preferences.locale}>
    <main class={`workbench workbench--${surface}${preferences.compactCards ? " workbench--compact" : ""}`}>
      <header class="topbar">
        <a class="brand" href="/pages/dashboard.html" aria-label={t("app.dashboardAria")}>
          <span class="brand__mark" aria-hidden="true">B</span>
          <span>
            <strong>{t("app.name")}</strong>
            <small>{t("app.tagline")}</small>
          </span>
        </a>
        <div class="topbar__center">
          <span class="status-dot" aria-hidden="true" />
          {t("topbar.localWorkspace")}
        </div>
        <nav class="topbar__actions" aria-label={t("topbar.actionsAria")}>
          <a class="button button--quiet" href="/pages/options.html">{t("topbar.settings")}</a>
          <time dateTime={now.toISOString()}>{formatClock(now, preferences.locale)}</time>
        </nav>
      </header>

      <section class="workspace-intro">
        <div>
          <p class="overline">{dateLabel}</p>
          <h1>{t("workspace.title")}</h1>
          <p class="workspace-intro__lede">{t("workspace.lede")}</p>
        </div>
        {surface !== "sidepanel" && <ResearchOverview />}
      </section>

      <WorkbenchToolbar
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        counts={categoryCounts}
        matchedCount={searchMatchedIds.length}
        totalCount={enabledIds.length}
        shownCount={visibleIds.length}
        compact={preferences.compactCards}
        onCompactChange={setCompactCards}
        onManage={() => setManageModules(true)}
      />

      <WorkflowProvider storage={window.localStorage}>
        <section class="module-grid" aria-label={t("board.aria")}>
          {visibleIds.map((id) => (
            <ModuleSlot id={id} key={id}>
              {moduleContent(id)}
            </ModuleSlot>
          ))}

          {visibleIds.length === 0 && (
            <div class="board-empty">
              <h2>{isFiltered ? t("board.noMatchTitle") : t("board.emptyTitle")}</h2>
              <p>{isFiltered ? t("board.noMatchBody") : t("board.emptyBody")}</p>
              {isFiltered ? (
                <button
                  class="button"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                  }}
                >
                  {t("board.clearFilters")}
                </button>
              ) : (
                <button class="button" type="button" onClick={() => setManageModules(true)}>
                  {t("toolbar.manage")}
                </button>
              )}
            </div>
          )}
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
        {t("privacy.strip")}
      </footer>
    </main>
    </I18nProvider>
  );
}
