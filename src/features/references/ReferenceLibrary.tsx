import { useId, useMemo, useState } from "preact/hooks";

import { REFERENCE_SOURCES } from "./sources";
import { searchReferences } from "./search";
import type { DatasetSource, ReferenceSearchResult } from "./types";
import { useTranslate, type Translate } from "../../platform/i18n";
import "./reference-library.css";

const sourcesById = new Map<string, DatasetSource>(
  Object.values(REFERENCE_SOURCES).map((source) => [source.id, source]),
);

function ResultSource({ sourceId }: { sourceId: string }) {
  const source = sourcesById.get(sourceId);
  if (!source) return null;
  return (
    <a href={source.url} target="_blank" rel="noreferrer">
      {source.publisher}, {source.version}
    </a>
  );
}

function SearchResult({ result, t }: { result: ReferenceSearchResult; t: Translate }) {
  if (result.kind === "constant") {
    return (
      <article class="reference-library__result">
        <header>
          <strong>{result.item.name}</strong>
          <span aria-label={t("ref.symbolAria", { symbol: result.item.symbol })}>{result.item.symbol}</span>
        </header>
        <p class="reference-library__value">
          {result.item.displayValue} {result.item.unit}
        </p>
        <small>
          {t("ref.uncertainty", { value: result.item.relativeStandardUncertainty })}{" "}
          <ResultSource sourceId={result.item.sourceId} />
        </small>
      </article>
    );
  }

  if (result.kind === "element") {
    return (
      <article class="reference-library__result">
        <header>
          <strong>
            {result.item.atomicNumber}. {result.item.name}
          </strong>
          <span aria-label={t("ref.symbolAria", { symbol: result.item.symbol })}>{result.item.symbol}</span>
        </header>
        <p class="reference-library__value">
          {result.item.standardAtomicWeight ?? t("ref.noAtomicWeight")}
        </p>
        <small>
          {result.item.category.replaceAll("-", " ")}.{" "}
          <ResultSource sourceId={result.item.sourceId} />
        </small>
      </article>
    );
  }

  return (
    <article class="reference-library__result">
      <header>
        <strong>{t("ref.preferredValues", { name: result.item.name })}</strong>
        <span>±{result.item.nominalTolerancePercent}%</span>
      </header>
      <p class="reference-library__series">{result.item.values.join(" · ")}</p>
      <small>
        {t("ref.normalized")} <ResultSource sourceId={result.item.sourceId} />
      </small>
    </article>
  );
}

export interface ReferenceLibraryProps {
  kinds?: readonly ReferenceSearchResult["kind"][];
  title?: string;
  description?: string;
  placeholder?: string;
  initialQuery?: string;
  sourceIds?: readonly string[];
}

export function ReferenceLibrary({
  kinds,
  title,
  description,
  placeholder,
  initialQuery = "",
  sourceIds,
}: ReferenceLibraryProps = {}) {
  const t = useTranslate();
  const inputId = useId();
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => searchReferences(query, { limit: 24, kinds }), [query, kinds]);
  const heading = title ?? t("ref.defaultTitle");
  const intro = description ?? t("ref.defaultDescription");
  const hint = placeholder ?? t("ref.defaultPlaceholder");
  const visibleSources = sourceIds
    ? Object.values(REFERENCE_SOURCES).filter((source) => sourceIds.includes(source.id))
    : Object.values(REFERENCE_SOURCES);

  return (
    <section class="reference-library" aria-labelledby={`${inputId}-title`}>
      <header>
        <h2 id={`${inputId}-title`}>{heading}</h2>
        <p>{intro}</p>
      </header>

      <label class="reference-library__search" for={inputId}>
        <span>{t("ref.searchLabel")}</span>
        <input
          id={inputId}
          type="search"
          value={query}
          placeholder={hint}
          autocomplete="off"
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      <div class="reference-library__status" role="status" aria-live="polite">
        {query.trim() === ""
          ? t("ref.bundled")
          : t("ref.resultCount", { count: results.length })}
      </div>

      {query.trim() !== "" && results.length === 0 ? (
        <p class="reference-library__empty">{t("ref.noMatch")}</p>
      ) : (
        <div class="reference-library__results">
          {results.map((result) => (
            <SearchResult
              key={`${result.kind}:${
                result.kind === "constant"
                  ? result.item.id
                  : result.kind === "element"
                    ? result.item.atomicNumber
                    : result.item.name
              }`}
              result={result}
              t={t}
            />
          ))}
        </div>
      )}

      <details class="reference-library__provenance">
        <summary>{t("ref.provenance")}</summary>
        <ul>
          {visibleSources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>{" "}
              — {source.version}. {source.licenseNote}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
