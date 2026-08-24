import { useId, useMemo, useState } from "preact/hooks";

export function TurengDictionaryCard() {
  const id = useId();
  const [query, setQuery] = useState("");
  const url = useMemo(
    () => query.trim()
      ? `https://tureng.com/en/turkish-english/${encodeURIComponent(query.trim().slice(0, 200))}`
      : "#",
    [query],
  );

  return (
    <article class="widget widget--amber language-tools" aria-labelledby={`${id}-title`}>
      <div class="widget__heading"><span class="widget__eyebrow">DICTIONARY · EXTERNAL</span></div>
      <h2 id={`${id}-title`}>Tureng sözlük</h2>
      <p class="widget__description">Teknik bir Türkçe veya İngilizce terimi Tureng’de arayın.</p>
      <label class="language-tools__input">
        Terim
        <input
          type="search"
          maxlength={200}
          value={query}
          placeholder="Örn. sheet resistance"
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <a
        class={`button button--primary${url === "#" ? " is-disabled" : ""}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-disabled={url === "#"}
        onClick={(event) => url === "#" && event.preventDefault()}
      >
        Tureng’de ara ↗
      </a>
      <small class="language-tools__privacy">Sorgu yalnızca bu bağlantıya bastığınızda Tureng’e gönderilir.</small>
    </article>
  );
}
