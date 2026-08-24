import { useEffect, useMemo, useState } from "preact/hooks";

import {
  createAiUserGestureTask,
  createDefaultAiProvider,
  type AiAvailability,
  type AiDownloadProgress,
} from "../ai";
import "./language-tools.css";

const LANGUAGES = [
  { code: "tr", label: "Türkçe" },
  { code: "en", label: "İngilizce" },
  { code: "de", label: "Almanca" },
  { code: "fr", label: "Fransızca" },
  { code: "es", label: "İspanyolca" },
  { code: "it", label: "İtalyanca" },
] as const;

const AVAILABILITY: Record<AiAvailability | "checking", string> = {
  checking: "Kontrol ediliyor",
  unsupported: "Bu Chrome sürümünde yok",
  unavailable: "Bu dil çifti kullanılamıyor",
  downloadable: "Dil modeli indirilebilir",
  downloading: "Dil modeli indiriliyor",
  available: "Cihazda hazır",
};

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Çeviri tamamlanamadı.";
}

export interface LanguageToolsPanelProps {
  showTureng?: boolean;
}

export function LanguageToolsPanel({ showTureng = true }: LanguageToolsPanelProps) {
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
          setMessage(errorMessage(error));
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
      setMessage("Çeviri cihazdaki Chrome modeliyle tamamlandı.");
    } catch (error) {
      setMessage(errorMessage(error));
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
      setMessage("Çeviri panoya kopyalandı.");
    } catch {
      setMessage("Panoya kopyalama izni verilmedi.");
    }
  }

  return (
    <article class="widget widget--violet language-tools" aria-labelledby="language-tools-title">
      <div class="widget__heading">
        <span class="widget__eyebrow">LANGUAGE · LOCAL FIRST</span>
        <span class={`language-tools__status language-tools__status--${availability}`}>
          {AVAILABILITY[availability]}
        </span>
      </div>
      <h2 id="language-tools-title">Çeviri ve sözlük</h2>
      <p class="widget__description">
        Önce cihazdaki Chrome modelini kullanın; dış servisler yalnızca siz bağlantıya bastığınızda açılır.
      </p>

      <div class="language-tools__languages">
        <label>
          Kaynak
          <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.currentTarget.value)}>
            {LANGUAGES.map((language) => <option value={language.code}>{language.label}</option>)}
          </select>
        </label>
        <button type="button" class="language-tools__swap" onClick={swapLanguages} aria-label="Dilleri değiştir">
          ⇄
        </button>
        <label>
          Hedef
          <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.currentTarget.value)}>
            {LANGUAGES.map((language) => <option value={language.code}>{language.label}</option>)}
          </select>
        </label>
      </div>

      <label class="language-tools__input">
        Çevrilecek metin
        <textarea
          rows={5}
          maxlength={5_000}
          value={input}
          placeholder="Makale özeti, teknik ifade veya tek bir terim…"
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
          {busy ? "Çevriliyor…" : "Cihazda çevir"}
        </button>
        <a
          class={`button button--quiet${googleUrl === "#" ? " is-disabled" : ""}`}
          href={googleUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={googleUrl === "#"}
          onClick={(event) => googleUrl === "#" && event.preventDefault()}
        >
          Google Translate’te aç ↗
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
            Tureng’de ara ↗
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
          <div><strong>Çeviri</strong><button type="button" class="text-button" onClick={() => void copyResult()}>Kopyala</button></div>
          <p>{result}</p>
        </section>
      )}
      {message && <p class="inline-status" role="status">{message}</p>}
      <small class="language-tools__privacy">
        Google Translate{showTureng ? " ve Tureng" : ""} harici bir servistir; bağlantıya bastığınızda yazdığınız metin ilgili servise gider.
      </small>
    </article>
  );
}
