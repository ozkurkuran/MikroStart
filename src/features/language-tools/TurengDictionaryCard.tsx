import { useId, useMemo, useState } from "preact/hooks";

import { useTranslate } from "../../platform/i18n";

export function TurengDictionaryCard() {
  const t = useTranslate();
  const id = useId();
  const [query, setQuery] = useState("");
  const url = useMemo(
    () => query.trim()
      ? `https://tureng.com/en/turkish-english/${encodeURIComponent(query.trim().slice(0, 200))}`
      : "#",
    [query],
  );

  return (
    <article class="widget language-tools" aria-labelledby={`${id}-title`}>
      <div class="widget__heading"><span class="widget__eyebrow">{t("lang.eyebrowExternal")}</span></div>
      <h2 id={`${id}-title`}>{t("tureng.title")}</h2>
      <p class="widget__description">{t("tureng.description")}</p>
      <label class="language-tools__input">
        {t("tureng.termLabel")}
        <input
          type="search"
          maxlength={200}
          value={query}
          placeholder={t("tureng.termPlaceholder")}
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
        {t("lang.openTureng")}
      </a>
      <small class="language-tools__privacy">{t("tureng.privacy")}</small>
    </article>
  );
}
