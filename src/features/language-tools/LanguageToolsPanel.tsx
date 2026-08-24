import { useEffect, useMemo, useState } from "preact/hooks";

import {
  createAiUserGestureTask,
  createDefaultAiProvider,
  type AiAvailability,
  type AiDownloadProgress,
} from "../ai";
import { useTranslate, type Translate } from "../../platform/i18n";
import "./language-tools.css";

const LANGUAGE_CODES = ["tr", "en", "de", "fr", "es", "it"] as const;



function externalUrl(
  service: "google" | "tureng",
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): string {
  if (!text.trim()) return "#";
  if (service === "tureng") {
    return `https://tureng.com/en/turkish-english/${encodeURIComponent(text.trim().slice(0, 200))}`;
  }
  const url = new URL("https://translate.google.com/");
  url.searchParams.set("sl", sourceLanguage);
  url.searchParams.set("tl", targetLanguage);
  url.searchParams.set("text", text.slice(0, 5_000));
  url.searchParams.set("op", "translate");
  return url.href;
}

function errorMessage(error: unknown, t: Translate): string {
  return error instanceof Error ? error.message : t("lang.msg.failed");
}

export interface LanguageToolsPanelProps {
  showTureng?: boolean;
}

export function LanguageToolsPanel({ showTureng = true }: LanguageToolsPanelProps) {
  const t = useTranslate();
  const provider = useMemo(() => createDefaultAiProvider(), []);
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("tr");
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [availability, setAvailability] = useState<AiAvailability | "checking">("checking");
  const [progress, setProgress] = useState<AiDownloadProgress>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setAvailability("checking");
    void provider
      .getCapabilities({ sourceLanguage, targetLanguage })
      .then((report) => {
        if (active) setAvailability(report.capabilities.translation.availability);
      })
      .catch((error: unknown) => {
        if (active) {
          setAvailability("unavailable");
          setMessage(errorMessage(error, t));
        }
      });
    return () => {
      active = false;
    };
  }, [provider, sourceLanguage, targetLanguage]);

  const canTranslateLocally =
    input.trim().length > 0 &&
    sourceLanguage !== targetLanguage &&
    availability !== "checking" &&
    availability !== "unsupported" &&
    availability !== "unavailable";
  const googleUrl = externalUrl("google", input, sourceLanguage, targetLanguage);
  const turengUrl = externalUrl("tureng", input, sourceLanguage, targetLanguage);

  async function translateLocally() {
    setBusy(true);
    setMessage("");
    setProgress(undefined);
    try {
      const userGesture = createAiUserGestureTask();
      const translated = await provider.translate({
        text: input.trim(),
        sourceLanguage,
        targetLanguage,
        userGesture,
        onProgress: setProgress,
      });
      setResult(translated.text);
      setMessage(t("lang.msg.done"));
    } catch (error) {
      setMessage(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  function swapLanguages() {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    setInput(result || input);
    setResult("");
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result);
      setMessage(t("lang.msg.copied"));
    } catch {
      setMessage(t("lang.msg.copyDenied"));
    }
  }

  return (
    <article class="widget language-tools" aria-labelledby="language-tools-title">
      <div class="widget__heading">
        <span class="widget__eyebrow">{t("lang.eyebrow")}</span>
        <span class={`language-tools__status language-tools__status--${availability}`}>
          {t(`lang.availability.${availability}`)}
        </span>
      </div>
      <h2 id="language-tools-title">{t("lang.title")}</h2>
      <p class="widget__description">{t("lang.description")}</p>

      <div class="language-tools__languages">
        <label>
          {t("lang.source")}
          <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.currentTarget.value)}>
            {LANGUAGE_CODES.map((code) => <option key={code} value={code}>{t(`lang.name.${code}`)}</option>)}
          </select>
        </label>
        <button type="button" class="language-tools__swap" onClick={swapLanguages} aria-label={t("lang.swap")}>
          ⇄
        </button>
        <label>
          {t("lang.target")}
          <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.currentTarget.value)}>
            {LANGUAGE_CODES.map((code) => <option key={code} value={code}>{t(`lang.name.${code}`)}</option>)}
          </select>
        </label>
      </div>

      <label class="language-tools__input">
        {t("lang.inputLabel")}
        <textarea
          rows={5}
          maxlength={5_000}
          value={input}
          placeholder={t("lang.inputPlaceholder")}
          onInput={(event) => setInput(event.currentTarget.value)}
        />
      </label>

      <div class="language-tools__actions">
        <button
          type="button"
          class="button button--primary"
          disabled={busy || !canTranslateLocally}
          onClick={() => void translateLocally()}
        >
          {t(busy ? "lang.translating" : "lang.translateLocally")}
        </button>
        <a
          class={`button button--quiet${googleUrl === "#" ? " is-disabled" : ""}`}
          href={googleUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={googleUrl === "#"}
          onClick={(event) => googleUrl === "#" && event.preventDefault()}
        >
          {t("lang.openGoogle")}
        </a>
        {showTureng && (
          <a
            class={`button button--quiet${turengUrl === "#" ? " is-disabled" : ""}`}
            href={turengUrl}
            target="_blank"
            rel="noreferrer"
            aria-disabled={turengUrl === "#"}
            onClick={(event) => turengUrl === "#" && event.preventDefault()}
          >
            {t("lang.openTureng")}
          </a>
        )}
      </div>

      {progress && (
        <div class="language-tools__progress" role="status">
          {progress.loaded !== undefined && <progress value={progress.loaded} max={1} />}
          <span>{progress.message}</span>
        </div>
      )}

      {result && (
        <section class="language-tools__result" aria-live="polite">
          <div><strong>{t("lang.resultTitle")}</strong><button type="button" class="text-button" onClick={() => void copyResult()}>{t("lang.copy")}</button></div>
          <p>{result}</p>
        </section>
      )}
      {message && <p class="inline-status" role="status">{message}</p>}
      <small class="language-tools__privacy">
        {t(showTureng ? "lang.privacyBoth" : "lang.privacyGoogle")}
      </small>
    </article>
  );
}
