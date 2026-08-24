import { useEffect, useMemo, useState } from "preact/hooks";

import "./ai-research-panel.css";
import { createDefaultAiProvider } from "./providers";
import type {
  AiAvailability,
  AiCapabilityId,
  AiCapabilityReport,
  AiDownloadProgress,
  AiProvider,
  AiResearchSource,
  GroundedDigestResult,
  RerankResult,
  SummarizeResult,
  TranslateResult,
} from "./types";
import { createAiUserGestureTask } from "./user-gesture";

type AiPanelMode = "summarize" | "translate" | "digest" | "rerank";

export type AiPanelResult =
  | { mode: "summarize"; value: SummarizeResult }
  | { mode: "translate"; value: TranslateResult }
  | { mode: "digest"; value: GroundedDigestResult }
  | { mode: "rerank"; value: RerankResult };

export interface AiResearchPanelProps {
  /** Records already selected from the local feed cache by the parent shell. */
  selectedSources: readonly AiResearchSource[];
  provider?: AiProvider;
  onResult?: (result: AiPanelResult) => void;
  /** Invoked only by the explicit save button after a result exists. */
  onSaveResult?: (result: AiPanelResult) => void | Promise<void>;
  onRequestSourceSelection?: () => void;
}

const MODE_CAPABILITY: Record<AiPanelMode, AiCapabilityId> = {
  summarize: "summarization",
  translate: "translation",
  digest: "language-model",
  rerank: "language-model",
};

const AVAILABILITY_LABEL: Record<AiAvailability, string> = {
  unsupported: "Desteklenmiyor",
  unavailable: "Kullanılamıyor",
  downloadable: "İndirilmeye hazır",
  downloading: "İndiriliyor",
  available: "Hazır",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Yerel AI görevi tamamlanamadı.";
}

function combinedSourceText(sources: readonly AiResearchSource[]): string {
  return sources
    .map(({ title, text }) => `${title}\n\n${text}`)
    .join("\n\n---\n\n")
    .slice(0, 48_000);
}

function resultText(result: AiPanelResult): string {
  if (result.mode === "translate" || result.mode === "summarize") {
    return result.value.text;
  }
  if (result.mode === "digest") {
    return result.value.items
      .map((item) => `• ${item.text} [${item.sourceIds.join(", ")}]`)
      .join("\n");
  }
  return result.value.items
    .map(
      (item) =>
        `${Math.round(item.score * 100)}% · ${item.reason} [${item.sourceId}]`,
    )
    .join("\n");
}

export function AiResearchPanel({
  selectedSources,
  provider: suppliedProvider,
  onResult,
  onSaveResult,
  onRequestSourceSelection,
}: AiResearchPanelProps) {
  const provider = useMemo(
    () => suppliedProvider ?? createDefaultAiProvider(),
    [suppliedProvider],
  );
  const [mode, setMode] = useState<AiPanelMode>("summarize");
  const [capabilities, setCapabilities] = useState<AiCapabilityReport>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<AiDownloadProgress>();
  const [message, setMessage] = useState<string>();
  const [result, setResult] = useState<AiPanelResult>();
  const [focus, setFocus] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("tr");

  useEffect(() => {
    let active = true;
    void provider
      .getCapabilities({
        sourceLanguage,
        targetLanguage,
        inputLanguages: ["en"],
        outputLanguage: "en",
      })
      .then((report) => {
        if (active) setCapabilities(report);
      })
      .catch((error: unknown) => {
        if (active) setMessage(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [provider, sourceLanguage, targetLanguage]);

  const capability = capabilities?.capabilities[MODE_CAPABILITY[mode]];
  const canRun =
    selectedSources.length > 0 &&
    Boolean(capability) &&
    capability!.availability !== "unsupported" &&
    capability!.availability !== "unavailable";

  async function runTask() {
    if (selectedSources.length === 0) {
      setMessage("Önce yerel feed’den en az bir yayın seçin.");
      onRequestSourceSelection?.();
      return;
    }
    if (mode === "rerank" && focus.trim().length === 0) {
      setMessage("Sıralama için bir araştırma sorusu girin.");
      return;
    }

    setBusy(true);
    setMessage(undefined);
    setProgress(undefined);
    setResult(undefined);
    try {
      // Must remain synchronous with this button's trusted activation.
      const userGesture = createAiUserGestureTask();
      const common = {
        userGesture,
        onProgress: setProgress,
      };
      let nextResult: AiPanelResult;
      if (mode === "translate") {
        nextResult = {
          mode,
          value: await provider.translate({
            ...common,
            text: combinedSourceText(selectedSources),
            sourceLanguage,
            targetLanguage,
            sourceIds: selectedSources.map(({ sourceId }) => sourceId),
          }),
        };
      } else if (mode === "summarize") {
        nextResult = {
          mode,
          value: await provider.summarize({
            ...common,
            sources: selectedSources,
            type: "key-points",
            length: "medium",
            inputLanguages: ["en"],
            outputLanguage: "en",
          }),
        };
      } else if (mode === "digest") {
        nextResult = {
          mode,
          value: await provider.createGroundedDigest({
            ...common,
            sources: selectedSources,
            focus: focus.trim() || undefined,
            inputLanguages: ["en"],
            outputLanguage: "en",
          }),
        };
      } else {
        nextResult = {
          mode,
          value: await provider.rerank({
            ...common,
            sources: selectedSources,
            query: focus,
            inputLanguages: ["en"],
            outputLanguage: "en",
          }),
        };
      }
      setResult(nextResult);
      onResult?.(nextResult);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveResult() {
    if (!result || !onSaveResult) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await onSaveResult(result);
      setMessage("AI sonucu, açık etiketi ve kaynak bağlantılarıyla not defterine kaydedildi.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article class="widget widget--violet ai-research-panel" aria-labelledby="ai-panel-title">
      <div class="widget__heading">
        <span class="widget__eyebrow">AI · ON-DEVICE</span>
        <span class="module-count">{selectedSources.length} selected</span>
      </div>
      <h2 id="ai-panel-title">Research assistant</h2>
      <p class="widget__description">
        Chrome’un yerel modelleri; bulut aktarımı veya otomatik geri dönüş yok.
      </p>

      <fieldset class="ai-mode-picker">
        <legend>AI görevi</legend>
        {(["summarize", "translate", "digest", "rerank"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="ai-mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {value === "summarize"
              ? "Özet"
              : value === "translate"
                ? "Çeviri"
                : value === "digest"
                  ? "Digest"
                  : "Sırala"}
          </label>
        ))}
      </fieldset>

      {mode === "translate" && (
        <div class="ai-language-row">
          <label>
            Kaynak dili
            <input
              value={sourceLanguage}
              maxlength={35}
              onInput={(event) => setSourceLanguage(event.currentTarget.value)}
            />
          </label>
          <span aria-hidden="true">→</span>
          <label>
            Hedef dili
            <input
              value={targetLanguage}
              maxlength={35}
              onInput={(event) => setTargetLanguage(event.currentTarget.value)}
            />
          </label>
        </div>
      )}

      {(mode === "digest" || mode === "rerank") && (
        <label class="ai-focus-field">
          {mode === "rerank" ? "Araştırma sorusu" : "İsteğe bağlı odak"}
          <input
            value={focus}
            maxlength={1_000}
            placeholder={mode === "rerank" ? "Örn. Hangi çalışma ince film büyütmeyle ilgili?" : "Örn. yöntem ve sonuçlar"}
            onInput={(event) => setFocus(event.currentTarget.value)}
          />
        </label>
      )}

      <div class="ai-source-summary">
        {selectedSources.length === 0 ? (
          <button type="button" class="text-button" onClick={onRequestSourceSelection}>
            Feed’den yayın seç
          </button>
        ) : (
          <ul aria-label="AI için seçilmiş yerel kaynaklar">
            {selectedSources.slice(0, 4).map((source) => (
              <li key={source.sourceId}>{source.title}</li>
            ))}
          </ul>
        )}
      </div>

      <div class="ai-action-row">
        <button
          type="button"
          class="button button--primary"
          disabled={busy || !canRun}
          onClick={() => void runTask()}
        >
          {busy ? "Çalışıyor…" : "Yerel AI ile çalıştır"}
        </button>
        <span class={`ai-readiness ai-readiness--${capability?.availability ?? "checking"}`}>
          {capability
            ? AVAILABILITY_LABEL[capability.availability]
            : "Kontrol ediliyor"}
        </span>
      </div>

      {progress && (
        <div class="ai-progress" role="status" aria-live="polite">
          {progress.loaded !== undefined && (
            <progress value={progress.loaded} max={1} aria-label="Model indirme ilerlemesi" />
          )}
          <span>{progress.message}</span>
        </div>
      )}
      {message && <p class="inline-status" role="alert">{message}</p>}
      {result && (
        <section class="ai-result" aria-live="polite" aria-label="AI sonucu">
          <h3>Yerel AI sonucu</h3>
          <pre>{resultText(result)}</pre>
          <small>Kaynak kimlikleri yalnızca seçilmiş yerel kayıtlardan eklendi.</small>
          {onSaveResult && (
            <button
              type="button"
              class="button button--small ai-result__save"
              disabled={saving}
              onClick={() => void saveResult()}
            >
              {saving ? "Kaydediliyor…" : "Etiketli sonucu not defterine kaydet"}
            </button>
          )}
        </section>
      )}
    </article>
  );
}
