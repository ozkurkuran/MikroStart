import { useId, useMemo, useState } from "preact/hooks";

import { REFERENCE_SOURCES } from "./sources";
import { searchReferences } from "./search";
import type { DatasetSource, ReferenceSearchResult } from "./types";
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

function SearchResult({ result }: { result: ReferenceSearchResult }) {
  if (result.kind === "constant") {
    return (
      <article class="reference-library__result">
        <header>
          <strong>{result.item.name}</strong>
          <span aria-label={`Symbol ${result.item.symbol}`}>{result.item.symbol}</span>
        </header>
        <p class="reference-library__value">
          {result.item.displayValue} {result.item.unit}
        </p>
        <small>
          Relative standard uncertainty: {result.item.relativeStandardUncertainty}.{" "}
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
          <span aria-label={`Symbol ${result.item.symbol}`}>{result.item.symbol}</span>
        </header>
        <p class="reference-library__value">
          {result.item.standardAtomicWeight ?? "No standard atomic weight"}
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
        <strong>{result.item.name} preferred values</strong>
        <span>±{result.item.nominalTolerancePercent}%</span>
      </header>
      <p class="reference-library__series">{result.item.values.join(" · ")}</p>
      <small>
        Normalized to one decade. <ResultSource sourceId={result.item.sourceId} />
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
  title = "Offline reference library",
  description = "CODATA constants, all 118 elements, and IEC E-series values.",
  placeholder = "Try Boltzmann, Fe, 79, or E12",
  initialQuery = "",
  sourceIds,
}: ReferenceLibraryProps = {}) {
  const inputId = useId();
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => searchReferences(query, { limit: 24, kinds }), [query, kinds]);
  const visibleSources = sourceIds
    ? Object.values(REFERENCE_SOURCES).filter((source) => sourceIds.includes(source.id))
    : Object.values(REFERENCE_SOURCES);

  return (
    <section class="reference-library" aria-labelledby={`${inputId}-title`}>
      <header>
        <h2 id={`${inputId}-title`}>{title}</h2>
        <p>{description}</p>
      </header>

      <label class="reference-library__search" for={inputId}>
        <span>Search name, symbol, atomic number, or series</span>
        <input
          id={inputId}
          type="search"
          value={query}
          placeholder={placeholder}
          autocomplete="off"
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      <div class="reference-library__status" role="status" aria-live="polite">
        {query.trim() === ""
          ? "The library is bundled and works without a network connection."
          : `${results.length} result${results.length === 1 ? "" : "s"}`}
      </div>

      {query.trim() !== "" && results.length === 0 ? (
        <p class="reference-library__empty">No bundled reference matched this search.</p>
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
            />
          ))}
        </div>
      )}

      <details class="reference-library__provenance">
        <summary>Dataset versions and reuse notes</summary>
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
