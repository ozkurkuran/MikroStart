import { useEffect, useMemo, useState } from "preact/hooks";

import { useTranslate } from "../../platform/i18n";
import { evaluateExpression, formatCalculation, type AngleMode } from "./calculator";
import type { CalculatorHistoryItem } from "./storage";
import { convertUnit, UNIT_CATEGORIES } from "./units";

type Tool = "basic" | "scientific" | "converter" | "note";

interface QuickToolsProps {
  quickNote: string;
  history: CalculatorHistoryItem[];
  memory: number;
  onQuickNoteChange: (value: string) => void;
  onHistoryChange: (history: CalculatorHistoryItem[]) => void;
  onMemoryChange: (value: number) => void;
  onSendToModule: (value: string) => void;
}

const BASIC_KEYS = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "%", "+"];
const SCIENTIFIC_KEYS = ["sin(", "cos(", "tan(", "log(", "ln(", "sqrt(", "(", ")", "pi", "e", "^", "!"];
const UNIT_LABEL_KEYS = {
  length: "overview.units.length",
  mass: "overview.units.mass",
  temperature: "overview.units.temperature",
  pressure: "overview.units.pressure",
  energy: "overview.units.energy",
  time: "overview.units.time",
  area: "overview.units.area",
  resistance: "overview.units.resistance",
  angle: "overview.units.angle",
} as const;

export function QuickTools({ quickNote, history, memory, onQuickNoteChange, onHistoryChange, onMemoryChange, onSendToModule }: QuickToolsProps) {
  const t = useTranslate();
  const [tool, setTool] = useState<Tool>("basic");
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [angleMode, setAngleMode] = useState<AngleMode>("deg");
  const [categoryId, setCategoryId] = useState("length");
  const category = UNIT_CATEGORIES.find((item) => item.id === categoryId) ?? UNIT_CATEGORIES[0];
  const [fromUnit, setFromUnit] = useState(category.units[0].id);
  const [toUnit, setToUnit] = useState(category.units[1].id);
  const [conversionValue, setConversionValue] = useState("1");
  const conversion = useMemo(() => {
    try { return formatCalculation(convertUnit(Number(conversionValue), category.id, fromUnit, toUnit)); }
    catch { return "—"; }
  }, [category, conversionValue, fromUnit, toUnit]);

  useEffect(() => {
    const receive = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      setExpression(value);
      setTool("basic");
    };
    window.addEventListener("benchtab:clipboard-number", receive);
    return () => window.removeEventListener("benchtab:clipboard-number", receive);
  }, []);

  function calculate() {
    try {
      const value = evaluateExpression(expression, { angleMode, memory, answer: Number(result) || 0 });
      const formatted = formatCalculation(value);
      setResult(formatted);
      setError("");
      onHistoryChange([{ expression, result: formatted }, ...history].slice(0, 20));
    } catch {
      setError(t("overview.tools.invalidExpression"));
    }
  }

  function insert(value: string) {
    setExpression((current) => `${current}${value}`);
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setError(t("overview.tools.copied")); }
    catch { setError(t("overview.tools.copyFailed")); }
  }

  function chooseCategory(id: string) {
    const next = UNIT_CATEGORIES.find((item) => item.id === id) ?? UNIT_CATEGORIES[0];
    setCategoryId(next.id);
    setFromUnit(next.units[0].id);
    setToUnit(next.units[1].id);
  }

  return (
    <section class="overview-card tools-card" aria-labelledby="tools-title">
      <header class="overview-card__header">
        <div><p class="overview-card__eyebrow">{t("overview.tools.eyebrow")}</p><h2 id="tools-title">{t("overview.tools.title")}</h2></div>
      </header>
      <div class="tool-tabs" role="tablist" aria-label={t("overview.tools.title")}>
        {(["basic", "scientific", "converter", "note"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tool === id} onClick={() => setTool(id)}>{t(`overview.tools.${id}`)}</button>
        ))}
      </div>

      {(tool === "basic" || tool === "scientific") && (
        <div class="quick-calculator">
          <div class="calculator-display">
            <input value={expression} onInput={(event) => setExpression(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") calculate(); }} aria-label={t("overview.tools.expression")} placeholder="(12.5 * 4) / 2" />
            <output class="numeric" aria-live="polite">{result || "0"}</output>
          </div>
          {tool === "scientific" && (
            <div class="calculator-mode">
              <button type="button" aria-pressed={angleMode === "deg"} onClick={() => setAngleMode("deg")}>DEG</button>
              <button type="button" aria-pressed={angleMode === "rad"} onClick={() => setAngleMode("rad")}>RAD</button>
              <span>M: <b class="numeric">{formatCalculation(memory)}</b></span>
            </div>
          )}
          <div class="calculator-keys">
            {tool === "scientific" && SCIENTIFIC_KEYS.map((key) => <button type="button" key={key} onClick={() => insert(key)}>{key}</button>)}
            {BASIC_KEYS.map((key) => <button type="button" key={key} onClick={() => insert(key)}>{key}</button>)}
            <button type="button" onClick={() => setExpression("")}>C</button>
            <button type="button" onClick={() => setExpression((value) => value.slice(0, -1))}>⌫</button>
            <button class="calculator-keys__equals" type="button" onClick={calculate}>=</button>
          </div>
          <div class="calculator-actions">
            <button class="text-button" type="button" onClick={() => onMemoryChange(Number(result) || 0)}>MS</button>
            <button class="text-button" type="button" onClick={() => setExpression((current) => `${current}${formatCalculation(memory)}`)}>MR</button>
            <button class="text-button" type="button" onClick={() => onMemoryChange(0)}>MC</button>
            <span />
            <button class="text-button" type="button" disabled={!result} onClick={() => void copy(result)}>{t("overview.tools.copy")}</button>
            <button class="text-button" type="button" disabled={!result} onClick={() => onSendToModule(result)}>{t("overview.tools.send")}</button>
          </div>
          {history.length > 0 && <details class="calculator-history"><summary>{t("overview.tools.history")}</summary>{history.slice(0, 6).map((item, index) => <button type="button" key={`${item.expression}-${index}`} onClick={() => { setExpression(item.expression); setResult(item.result); }}><span>{item.expression}</span><b class="numeric">{item.result}</b></button>)}</details>}
          {error && <p class="overview-message" role="status">{error}</p>}
        </div>
      )}

      {tool === "converter" && (
        <div class="unit-converter">
          <label>{t("overview.tools.category")}<select value={categoryId} onChange={(event) => chooseCategory(event.currentTarget.value)}>{UNIT_CATEGORIES.map((item) => <option value={item.id} key={item.id}>{t(UNIT_LABEL_KEYS[item.id as keyof typeof UNIT_LABEL_KEYS])}</option>)}</select></label>
          <div>
            <label>{t("overview.tools.from")}<input type="number" step="any" value={conversionValue} onInput={(event) => setConversionValue(event.currentTarget.value)} /><select value={fromUnit} onChange={(event) => setFromUnit(event.currentTarget.value)}>{category.units.map((unit) => <option value={unit.id} key={unit.id}>{unit.label}</option>)}</select></label>
            <button class="icon-button" type="button" aria-label={t("overview.tools.swap")} onClick={() => { const previous = fromUnit; setFromUnit(toUnit); setToUnit(previous); }}>⇄</button>
            <label>{t("overview.tools.to")}<output class="numeric">{conversion}</output><select value={toUnit} onChange={(event) => setToUnit(event.currentTarget.value)}>{category.units.map((unit) => <option value={unit.id} key={unit.id}>{unit.label}</option>)}</select></label>
          </div>
          <button class="text-button" type="button" onClick={() => void copy(conversion)}>{t("overview.tools.copyResult")}</button>
        </div>
      )}

      {tool === "note" && (
        <div class="overview-quick-note">
          <textarea value={quickNote} onInput={(event) => onQuickNoteChange(event.currentTarget.value.slice(0, 4000))} placeholder={t("overview.tools.notePlaceholder")} aria-label={t("overview.tools.note")} />
          <small>{t("overview.tools.autoSaved")} · {quickNote.length}/4000</small>
        </div>
      )}
    </section>
  );
}
