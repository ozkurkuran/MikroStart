import { useId, useMemo, useState } from "preact/hooks";

import { calculateHall } from "./hall";
import { calculateScherrer } from "./scherrer";
import { calculateSheetResistance } from "./sheet-resistance";
import type {
  CalculationIssue,
  CalculationWarning,
  CalculatorSource,
} from "./shared";
import {
  FOUR_POINT_PROBE_SOURCE,
  HALL_SOURCE,
  SCHERRER_SOURCE,
  VACUUM_SOURCE,
} from "./sources";
import type {
  AngleUnit,
  CurrentUnit,
  LengthUnit,
  MagneticFieldUnit,
  MolecularMassUnit,
  PressureUnit,
  TemperatureUnit,
  VoltageUnit,
} from "./units";
import { calculateVacuum } from "./vacuum";
import { useTranslate, type Translate } from "../../../platform/i18n";
import "./lab-calculator-pack.css";

type CalculatorKind = "scherrer" | "sheet" | "hall" | "vacuum";

const LENGTH_OPTIONS = [
  { value: "angstrom", label: "Å" },
  { value: "nm", label: "nm" },
  { value: "um", label: "µm" },
] as const;
const ANGLE_OPTIONS = [
  { value: "degree", label: "°" },
  { value: "radian", label: "rad" },
] as const;
const VOLTAGE_OPTIONS = [
  { value: "uV", label: "µV" },
  { value: "mV", label: "mV" },
  { value: "V", label: "V" },
] as const;
const CURRENT_OPTIONS = [
  { value: "uA", label: "µA" },
  { value: "mA", label: "mA" },
  { value: "A", label: "A" },
] as const;

function parseNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function formatNumber(value: number, digits = 7): string {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if ((absolute !== 0 && absolute < 1e-3) || absolute >= 1e6) {
    return value.toExponential(digits - 1);
  }
  return Number(value.toPrecision(digits)).toString();
}

interface UnitOption {
  value: string;
  label: string;
}

interface MeasurementFieldProps {
  label: string;
  value: string;
  onValue: (value: string) => void;
  unit: string;
  onUnit: (unit: string) => void;
  units: readonly UnitOption[];
  min?: string;
}

function MeasurementField(props: MeasurementFieldProps) {
  const t = useTranslate();
  const id = useId();
  return (
    <div class="lab-pack__measurement">
      <label for={`${id}-value`}>{props.label}</label>
      <div>
        <input
          id={`${id}-value`}
          type="number"
          step="any"
          min={props.min}
          inputMode="decimal"
          value={props.value}
          onInput={(event) => props.onValue(event.currentTarget.value)}
        />
        <label class="lab-pack__sr-only" for={`${id}-unit`}>
          {t("lab.unitLabel", { name: props.label })}
        </label>
        <select
          id={`${id}-unit`}
          value={props.unit}
          onChange={(event) => props.onUnit(event.currentTarget.value)}
        >
          {props.units.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Issues({ errors, t }: { errors: CalculationIssue[]; t: Translate }) {
  return (
    <div class="lab-pack__errors" role="alert">
      {errors.map((error) => (
        <p key={`${error.field}:${error.code}`}>
          {t.optional(`diag.${error.code}`, error.message, { field: error.field })}
        </p>
      ))}
    </div>
  );
}

function Warnings({ warnings, t }: { warnings: CalculationWarning[]; t: Translate }) {
  if (warnings.length === 0) return null;
  return (
    <ul class="lab-pack__warnings" aria-label={t("lab.warningsAria")}>
      {warnings.map((warning) => (
        <li key={warning.code}>{t.optional(`diag.${warning.code}`, warning.message)}</li>
      ))}
    </ul>
  );
}

interface MethodDetailsProps {
  algorithmId: string;
  algorithmVersion: string;
  formulaId: string;
  source: CalculatorSource;
  t: Translate;
}

function MethodDetails(props: MethodDetailsProps) {
  return (
    <details class="lab-pack__method">
      <summary>{props.t("lab.method")}</summary>
      <dl>
        <div>
          <dt>{props.t("lab.algorithm")}</dt>
          <dd>
            {props.algorithmId} v{props.algorithmVersion}
          </dd>
        </div>
        <div>
          <dt>{props.t("lab.formula")}</dt>
          <dd>{props.formulaId}</dd>
        </div>
        <div>
          <dt>{props.t("lab.reference")}</dt>
          <dd>
            <a href={props.source.url} target="_blank" rel="noreferrer">
              {props.source.publisher}: {props.source.title}
            </a>
          </dd>
        </div>
      </dl>
    </details>
  );
}

export function ScherrerCalculator() {
  const t = useTranslate();
  const [wavelength, setWavelength] = useState("1.5406");
  const [wavelengthUnit, setWavelengthUnit] =
    useState<LengthUnit>("angstrom");
  const [fwhm, setFwhm] = useState("0.2");
  const [fwhmUnit, setFwhmUnit] = useState<AngleUnit>("degree");
  const [twoTheta, setTwoTheta] = useState("40");
  const [shapeFactor, setShapeFactor] = useState("0.9");
  const [correctInstrument, setCorrectInstrument] = useState(false);
  const [instrumentFwhm, setInstrumentFwhm] = useState("0.05");

  const outcome = useMemo(
    () =>
      calculateScherrer({
        wavelength: { value: parseNumber(wavelength), unit: wavelengthUnit },
        fwhm: { value: parseNumber(fwhm), unit: fwhmUnit },
        twoThetaDegrees: parseNumber(twoTheta),
        shapeFactor: parseNumber(shapeFactor),
        ...(correctInstrument
          ? {
              instrumentalFwhm: {
                value: parseNumber(instrumentFwhm),
                unit: fwhmUnit,
              },
            }
          : {}),
      }),
    [
      correctInstrument,
      fwhm,
      fwhmUnit,
      instrumentFwhm,
      shapeFactor,
      twoTheta,
      wavelength,
      wavelengthUnit,
    ],
  );

  return (
    <section aria-labelledby="lab-scherrer-title">
      <h3 id="lab-scherrer-title">{t("lab.scherrer.title")}</h3>
      <p class="lab-pack__intro">{t("lab.scherrer.intro")}</p>
      <div class="lab-pack__grid">
        <MeasurementField
          label={t("lab.scherrer.wavelength")}
          value={wavelength}
          onValue={setWavelength}
          unit={wavelengthUnit}
          onUnit={(value) => setWavelengthUnit(value as LengthUnit)}
          units={LENGTH_OPTIONS}
          min="0"
        />
        <MeasurementField
          label={t("lab.scherrer.fwhm")}
          value={fwhm}
          onValue={setFwhm}
          unit={fwhmUnit}
          onUnit={(value) => setFwhmUnit(value as AngleUnit)}
          units={ANGLE_OPTIONS}
          min="0"
        />
        <label>
          {t("lab.scherrer.twoTheta")}
          <input
            type="number"
            min="0"
            max="180"
            step="any"
            value={twoTheta}
            onInput={(event) => setTwoTheta(event.currentTarget.value)}
          />
        </label>
        <label>
          {t("lab.scherrer.shapeFactor")}
          <input
            type="number"
            min="0"
            step="any"
            value={shapeFactor}
            onInput={(event) => setShapeFactor(event.currentTarget.value)}
          />
        </label>
      </div>
      <label class="lab-pack__toggle">
        <input
          type="checkbox"
          checked={correctInstrument}
          onChange={(event) => setCorrectInstrument(event.currentTarget.checked)}
        />
        {t("lab.scherrer.correct")}
      </label>
      {correctInstrument && (
        <MeasurementField
          label={t("lab.scherrer.instrumentFwhm")}
          value={instrumentFwhm}
          onValue={setInstrumentFwhm}
          unit={fwhmUnit}
          onUnit={(value) => setFwhmUnit(value as AngleUnit)}
          units={ANGLE_OPTIONS}
          min="0"
        />
      )}
      <div class="lab-pack__output" aria-live="polite" aria-atomic="true">
        {outcome.ok ? (
          <output>
            <span>{t("lab.scherrer.result")}</span>
            <strong>{formatNumber(outcome.result.crystalliteSizeNanometres)} nm</strong>
          </output>
        ) : (
          <Issues errors={outcome.errors} t={t} />
        )}
      </div>
      <Warnings warnings={outcome.warnings} t={t} />
      {outcome.ok && (
        <MethodDetails {...outcome.provenance} source={SCHERRER_SOURCE} t={t} />
      )}
    </section>
  );
}

export function SheetResistanceCalculator() {
  const t = useTranslate();
  const [voltage, setVoltage] = useState("1");
  const [voltageUnit, setVoltageUnit] = useState<VoltageUnit>("mV");
  const [current, setCurrent] = useState("1");
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit>("mA");
  const [includeThickness, setIncludeThickness] = useState(false);
  const [thickness, setThickness] = useState("100");
  const [thicknessUnit, setThicknessUnit] = useState<LengthUnit>("nm");

  const outcome = useMemo(
    () =>
      calculateSheetResistance({
        voltage: { value: parseNumber(voltage), unit: voltageUnit },
        current: { value: parseNumber(current), unit: currentUnit },
        ...(includeThickness
          ? {
              thickness: {
                value: parseNumber(thickness),
                unit: thicknessUnit,
              },
            }
          : {}),
      }),
    [
      current,
      currentUnit,
      includeThickness,
      thickness,
      thicknessUnit,
      voltage,
      voltageUnit,
    ],
  );

  return (
    <section aria-labelledby="lab-sheet-title">
      <h3 id="lab-sheet-title">{t("lab.sheet.title")}</h3>
      <p class="lab-pack__intro">{t("lab.sheet.intro")}</p>
      <div class="lab-pack__grid">
        <MeasurementField
          label={t("lab.sheet.voltage")}
          value={voltage}
          onValue={setVoltage}
          unit={voltageUnit}
          onUnit={(value) => setVoltageUnit(value as VoltageUnit)}
          units={VOLTAGE_OPTIONS}
        />
        <MeasurementField
          label={t("lab.sheet.current")}
          value={current}
          onValue={setCurrent}
          unit={currentUnit}
          onUnit={(value) => setCurrentUnit(value as CurrentUnit)}
          units={CURRENT_OPTIONS}
        />
      </div>
      <label class="lab-pack__toggle">
        <input
          type="checkbox"
          checked={includeThickness}
          onChange={(event) => setIncludeThickness(event.currentTarget.checked)}
        />
        {t("lab.sheet.useThickness")}
      </label>
      {includeThickness && (
        <MeasurementField
          label={t("lab.sheet.thickness")}
          value={thickness}
          onValue={setThickness}
          unit={thicknessUnit}
          onUnit={(value) => setThicknessUnit(value as LengthUnit)}
          units={LENGTH_OPTIONS}
          min="0"
        />
      )}
      <div class="lab-pack__output" aria-live="polite" aria-atomic="true">
        {outcome.ok ? (
          <div>
            <output>
              <span>{t("lab.sheet.result")}</span>
              <strong>{formatNumber(outcome.result.sheetResistanceOhmsPerSquare)} Ω/□</strong>
            </output>
            {outcome.result.resistivityOhmMetres !== undefined && (
              <output>
                <span>{t("lab.sheet.resistivity")}</span>
                <strong>{formatNumber(outcome.result.resistivityOhmMetres)} Ω·m</strong>
              </output>
            )}
          </div>
        ) : (
          <Issues errors={outcome.errors} t={t} />
        )}
      </div>
      <Warnings warnings={outcome.warnings} t={t} />
      {outcome.ok && (
        <MethodDetails {...outcome.provenance} source={FOUR_POINT_PROBE_SOURCE} t={t} />
      )}
    </section>
  );
}

export function HallCalculator() {
  const t = useTranslate();
  const [current, setCurrent] = useState("10");
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit>("mA");
  const [field, setField] = useState("500");
  const [fieldUnit, setFieldUnit] = useState<MagneticFieldUnit>("mT");
  const [thickness, setThickness] = useState("100");
  const [thicknessUnit, setThicknessUnit] = useState<LengthUnit>("nm");
  const [hallVoltage, setHallVoltage] = useState("-2");
  const [voltageUnit, setVoltageUnit] = useState<VoltageUnit>("mV");
  const [sheetResistance, setSheetResistance] = useState("100");

  const outcome = useMemo(
    () =>
      calculateHall({
        current: { value: parseNumber(current), unit: currentUnit },
        magneticField: { value: parseNumber(field), unit: fieldUnit },
        thickness: { value: parseNumber(thickness), unit: thicknessUnit },
        hallVoltage: { value: parseNumber(hallVoltage), unit: voltageUnit },
        sheetResistanceOhmsPerSquare: parseNumber(sheetResistance),
      }),
    [
      current,
      currentUnit,
      field,
      fieldUnit,
      hallVoltage,
      sheetResistance,
      thickness,
      thicknessUnit,
      voltageUnit,
    ],
  );

  return (
    <section aria-labelledby="lab-hall-title">
      <h3 id="lab-hall-title">{t("lab.hall.title")}</h3>
      <p class="lab-pack__intro">{t("lab.hall.intro")}</p>
      <div class="lab-pack__grid">
        <MeasurementField
          label={t("lab.hall.current")}
          value={current}
          onValue={setCurrent}
          unit={currentUnit}
          onUnit={(value) => setCurrentUnit(value as CurrentUnit)}
          units={CURRENT_OPTIONS}
        />
        <MeasurementField
          label={t("lab.hall.field")}
          value={field}
          onValue={setField}
          unit={fieldUnit}
          onUnit={(value) => setFieldUnit(value as MagneticFieldUnit)}
          units={[
            { value: "mT", label: "mT" },
            { value: "T", label: "T" },
            { value: "gauss", label: "G" },
          ]}
        />
        <MeasurementField
          label={t("lab.hall.thickness")}
          value={thickness}
          onValue={setThickness}
          unit={thicknessUnit}
          onUnit={(value) => setThicknessUnit(value as LengthUnit)}
          units={LENGTH_OPTIONS}
          min="0"
        />
        <MeasurementField
          label={t("lab.hall.voltage")}
          value={hallVoltage}
          onValue={setHallVoltage}
          unit={voltageUnit}
          onUnit={(value) => setVoltageUnit(value as VoltageUnit)}
          units={VOLTAGE_OPTIONS}
        />
        <label>
          {t("lab.hall.sheetResistance")}
          <input
            type="number"
            min="0"
            step="any"
            value={sheetResistance}
            onInput={(event) => setSheetResistance(event.currentTarget.value)}
          />
        </label>
      </div>
      <div class="lab-pack__output" aria-live="polite" aria-atomic="true">
        {outcome.ok ? (
          <div class="lab-pack__result-grid">
            <output>
              <span>{t("lab.hall.coefficient")}</span>
              <strong>{formatNumber(outcome.result.hallCoefficientCubicCentimetresPerCoulomb)} cm³/C</strong>
            </output>
            <output>
              <span>{t("lab.hall.density")}</span>
              <strong>{formatNumber(outcome.result.carrierDensityPerCubicCentimetre)} cm⁻³</strong>
            </output>
            <output>
              <span>{t("lab.hall.mobility")}</span>
              <strong>{formatNumber(outcome.result.mobilitySquareCentimetresPerVoltSecond)} cm²/(V·s)</strong>
            </output>
            <output>
              <span>{t("lab.hall.polarity")}</span>
              <strong>{outcome.result.conventionalDominantCarrier}</strong>
            </output>
          </div>
        ) : (
          <Issues errors={outcome.errors} t={t} />
        )}
      </div>
      <Warnings warnings={outcome.warnings} t={t} />
      {outcome.ok && <MethodDetails {...outcome.provenance} source={HALL_SOURCE} t={t} />}
    </section>
  );
}

export function VacuumCalculator() {
  const t = useTranslate();
  const [pressure, setPressure] = useState("1e-6");
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>("mbar");
  const [temperature, setTemperature] = useState("300");
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("K");
  const [diameter, setDiameter] = useState("0.37");
  const [diameterUnit, setDiameterUnit] = useState<LengthUnit>("nm");
  const [mass, setMass] = useState("28.0134");
  const [massUnit, setMassUnit] = useState<MolecularMassUnit>("u");
  const [sticking, setSticking] = useState("1");

  const outcome = useMemo(
    () =>
      calculateVacuum({
        pressure: { value: parseNumber(pressure), unit: pressureUnit },
        temperature: {
          value: parseNumber(temperature),
          unit: temperatureUnit,
        },
        molecularDiameter: { value: parseNumber(diameter), unit: diameterUnit },
        molecularMass: { value: parseNumber(mass), unit: massUnit },
        stickingCoefficient: parseNumber(sticking),
      }),
    [
      diameter,
      diameterUnit,
      mass,
      massUnit,
      pressure,
      pressureUnit,
      sticking,
      temperature,
      temperatureUnit,
    ],
  );

  return (
    <section aria-labelledby="lab-vacuum-title">
      <h3 id="lab-vacuum-title">{t("lab.vacuum.title")}</h3>
      <p class="lab-pack__intro">{t("lab.vacuum.intro")}</p>
      <div class="lab-pack__grid">
        <MeasurementField
          label={t("lab.vacuum.pressure")}
          value={pressure}
          onValue={setPressure}
          unit={pressureUnit}
          onUnit={(value) => setPressureUnit(value as PressureUnit)}
          units={[
            { value: "mbar", label: "mbar" },
            { value: "Pa", label: "Pa" },
            { value: "torr", label: "Torr" },
          ]}
          min="0"
        />
        <MeasurementField
          label={t("lab.vacuum.temperature")}
          value={temperature}
          onValue={setTemperature}
          unit={temperatureUnit}
          onUnit={(value) => setTemperatureUnit(value as TemperatureUnit)}
          units={[
            { value: "K", label: "K" },
            { value: "degC", label: "°C" },
          ]}
        />
        <MeasurementField
          label={t("lab.vacuum.diameter")}
          value={diameter}
          onValue={setDiameter}
          unit={diameterUnit}
          onUnit={(value) => setDiameterUnit(value as LengthUnit)}
          units={LENGTH_OPTIONS}
          min="0"
        />
        <MeasurementField
          label={t("lab.vacuum.mass")}
          value={mass}
          onValue={setMass}
          unit={massUnit}
          onUnit={(value) => setMassUnit(value as MolecularMassUnit)}
          units={[
            { value: "u", label: "u / Da" },
            { value: "kg", label: "kg/molecule" },
          ]}
          min="0"
        />
        <label>
          {t("lab.vacuum.sticking")}
          <input
            type="number"
            min="0"
            max="1"
            step="any"
            value={sticking}
            onInput={(event) => setSticking(event.currentTarget.value)}
          />
        </label>
      </div>
      <div class="lab-pack__output" aria-live="polite" aria-atomic="true">
        {outcome.ok ? (
          <div class="lab-pack__result-grid">
            <output>
              <span>{t("lab.vacuum.meanFreePath")}</span>
              <strong>{formatNumber(outcome.result.meanFreePathMetres)} m</strong>
            </output>
            <output>
              <span>{t("lab.vacuum.impingement")}</span>
              <strong>{formatNumber(outcome.result.impingementRatePerSquareMetreSecond)} m⁻²·s⁻¹</strong>
            </output>
            <output>
              <span>{t("lab.vacuum.monolayer")}</span>
              <strong>{formatNumber(outcome.result.monolayerFormationTimeSeconds)} s</strong>
            </output>
          </div>
        ) : (
          <Issues errors={outcome.errors} t={t} />
        )}
      </div>
      <Warnings warnings={outcome.warnings} t={t} />
      {outcome.ok && <MethodDetails {...outcome.provenance} source={VACUUM_SOURCE} t={t} />}
    </section>
  );
}

export function LabCalculatorPack() {
  const t = useTranslate();
  const [calculator, setCalculator] = useState<CalculatorKind>("scherrer");
  const selectId = useId();

  return (
    <article class="lab-pack">
      <header class="lab-pack__header">
        <div>
          <h2>{t("module.scherrer-size.kind")}</h2>
          <p>Local, unit-aware models with recorded assumptions and references.</p>
        </div>
        <label for={selectId}>
          Calculator
          <select
            id={selectId}
            value={calculator}
            onChange={(event) =>
              setCalculator(event.currentTarget.value as CalculatorKind)
            }
          >
            <option value="scherrer">{t("module.scherrer-size.title")}</option>
            <option value="sheet">{t("module.sheet-resistance.title")}</option>
            <option value="hall">{t("module.hall-measurement.title")}</option>
            <option value="vacuum">{t("module.vacuum-kinetics.title")}</option>
          </select>
        </label>
      </header>

      {calculator === "scherrer" && <ScherrerCalculator />}
      {calculator === "sheet" && <SheetResistanceCalculator />}
      {calculator === "hall" && <HallCalculator />}
      {calculator === "vacuum" && <VacuumCalculator />}
    </article>
  );
}
