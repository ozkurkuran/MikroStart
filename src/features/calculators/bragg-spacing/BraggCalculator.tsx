import { useId, useMemo, useState } from "preact/hooks";

import {
  BRAGG_SOURCE,
  CU_K_ALPHA_WAVELENGTH,
  calculateBragg,
  type BraggCalculationOutcome,
  type BraggSolveFor,
  type LengthUnit,
} from "./engine";
import { useTranslate } from "../../../platform/i18n";
import "./bragg-calculator.css";

function parseNumericInput(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function formatResult(value: number): string {
  return Number(value.toPrecision(8)).toString();
}

export function BraggCalculator() {
  const t = useTranslate();
  const instanceId = useId();
  const titleId = `${instanceId}-title`;
  const wavelengthHelpId = `${instanceId}-wavelength-help`;
  const solveForName = `${instanceId}-solve-for`;
  const [solveFor, setSolveFor] = useState<BraggSolveFor>("dSpacing");
  const [wavelength, setWavelength] = useState(
    CU_K_ALPHA_WAVELENGTH.value.toString(),
  );
  const [unit, setUnit] = useState<LengthUnit>("angstrom");
  const [twoTheta, setTwoTheta] = useState("20");
  const [dSpacing, setDSpacing] = useState("2");

  const outcome = useMemo<BraggCalculationOutcome>(() => {
    const wavelengthValue = {
      value: parseNumericInput(wavelength),
      unit,
    };

    return solveFor === "dSpacing"
      ? calculateBragg({
          solveFor,
          wavelength: wavelengthValue,
          twoThetaDegrees: parseNumericInput(twoTheta),
        })
      : calculateBragg({
          solveFor,
          wavelength: wavelengthValue,
          dSpacing: {
            value: parseNumericInput(dSpacing),
            unit,
          },
        });
  }, [dSpacing, solveFor, twoTheta, unit, wavelength]);

  const resetToCopper = () => {
    setWavelength(CU_K_ALPHA_WAVELENGTH.value.toString());
    setUnit(CU_K_ALPHA_WAVELENGTH.unit);
  };

  return (
    <section class="bragg-calculator" aria-labelledby={titleId}>
      <header class="bragg-calculator__header">
        <div>
          <h2 id={titleId}>{t("bragg.title")}</h2>
          <p>{t("bragg.description")}</p>
        </div>
        <button type="button" class="bragg-calculator__preset" onClick={resetToCopper}>
          {t("bragg.preset")}
        </button>
      </header>

      <fieldset class="bragg-calculator__mode">
        <legend>{t("bragg.solveFor")}</legend>
        <label>
          <input
            type="radio"
            name={solveForName}
            value="dSpacing"
            checked={solveFor === "dSpacing"}
            onChange={() => setSolveFor("dSpacing")}
          />
          {t("bragg.dSpacing")}
        </label>
        <label>
          <input
            type="radio"
            name={solveForName}
            value="twoTheta"
            checked={solveFor === "twoTheta"}
            onChange={() => setSolveFor("twoTheta")}
          />
          {t("bragg.twoTheta")}
        </label>
      </fieldset>

      <div class="bragg-calculator__grid">
        <label>
          {t("bragg.wavelength")}
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={wavelength}
            onInput={(event) => setWavelength(event.currentTarget.value)}
            aria-describedby={wavelengthHelpId}
          />
        </label>

        <label>
          {t("bragg.lengthUnit")}
          <select
            value={unit}
            onChange={(event) =>
              setUnit(event.currentTarget.value as LengthUnit)
            }
          >
            <option value="angstrom">{t("bragg.angstrom")}</option>
            <option value="nm">nm</option>
          </select>
        </label>

        {solveFor === "dSpacing" ? (
          <label>
            {t("bragg.twoThetaDegrees")}
            <input
              type="number"
              min="0"
              max="180"
              step="any"
              inputMode="decimal"
              value={twoTheta}
              onInput={(event) => setTwoTheta(event.currentTarget.value)}
            />
          </label>
        ) : (
          <label>
            {t("bragg.dSpacingUnit", { unit: unit === "angstrom" ? "Å" : "nm" })}
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={dSpacing}
              onInput={(event) => setDSpacing(event.currentTarget.value)}
            />
          </label>
        )}
      </div>

      <p id={wavelengthHelpId} class="bragg-calculator__help">
        {t("bragg.help")}
      </p>

      <div class="bragg-calculator__output" aria-live="polite" aria-atomic="true">
        {outcome.ok ? (
          <output>
            <span>
              {outcome.result.quantity === "dSpacing" ? "d" : "2θ"}
            </span>
            <strong>
              {formatResult(outcome.result.value)} {outcome.result.unit === "angstrom"
                ? "Å"
                : outcome.result.unit === "degree"
                  ? "°"
                  : "nm"}
            </strong>
          </output>
        ) : (
          <div role="alert">
            {outcome.errors.map((error) => (
              <p key={`${error.field}:${error.code}`}>
                {t.optional(`diag.${error.code}`, error.message, { field: error.field })}
              </p>
            ))}
          </div>
        )}
      </div>

      {outcome.warnings.length > 0 && (
        <ul class="bragg-calculator__warnings" aria-label={t("lab.warningsAria")}>
          {outcome.warnings.map((warning) => (
            <li key={warning.code}>{t.optional(`diag.${warning.code}`, warning.message)}</li>
          ))}
        </ul>
      )}

      {outcome.ok && (
        <details class="bragg-calculator__details">
          <summary>{t("lab.method")}</summary>
          <dl>
            <div>
              <dt>{t("lab.algorithm")}</dt>
              <dd>
                {outcome.provenance.algorithmId} v
                {outcome.provenance.algorithmVersion}
              </dd>
            </div>
            <div>
              <dt>{t("lab.formula")}</dt>
              <dd>{outcome.provenance.formulaId}</dd>
            </div>
            <div>
              <dt>{t("lab.reference")}</dt>
              <dd>
                <a href={BRAGG_SOURCE.url} target="_blank" rel="noreferrer">
                  {BRAGG_SOURCE.publisher}: {BRAGG_SOURCE.title}
                </a>
              </dd>
            </div>
          </dl>
        </details>
      )}
    </section>
  );
}
