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
          {props.label} unit
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

function Issues({ errors }: { errors: CalculationIssue[] }) {
  return (
    <div class="lab-pack__errors" role="alert">
      {errors.map((error) => (
        <p key={`${error.field}:${error.code}`}>{error.message}</p>
      ))}
    </div>
  );
}

function Warnings({ warnings }: { warnings: CalculationWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul class="lab-pack__warnings" aria-label="Calculation warnings">
      {warnings.map((warning) => (
        <li key={warning.code}>{warning.message}</li>
      ))}
    </ul>
  );
}

interface MethodDetailsProps {
  algorithmId: string;
  algorithmVersion: string;
  formulaId: string;
  source: CalculatorSource;
}

function MethodDetails(props: MethodDetailsProps) {
  return (
    <details class="lab-pack__method">
      <summary>Method and provenance</summary>
      <dl>
        <div>
          <dt>Algorithm</dt>
          <dd>
            {props.algorithmId} v{props.algorithmVersion}
          </dd>
        </div>
        <div>
          <dt>Formula</dt>
          <dd>{props.formulaId}</dd>
        </div>
        <div>
          <dt>Reference</dt>
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
      <h3 id="lab-scherrer-title">Scherrer crystallite size</h3>
      <p class="lab-pack__intro">D = Kλ / (β cos θ); β is the 2θ peak width.</p>
      <div class="lab-pack__grid">
        <MeasurementField
          label="Wavelength"
          value={wavelength}
          onValue={setWavelength}
          unit={wavelengthUnit}
          onUnit={(value) => setWavelengthUnit(value as LengthUnit)}
          units={LENGTH_OPTIONS}
          min="0"
        />
        <MeasurementField
          label="Observed FWHM"
          value={fwhm}
          onValue={setFwhm}
          unit={fwhmUnit}
          onUnit={(value) => setFwhmUnit(value as AngleUnit)}
          units={ANGLE_OPTIONS}
          min="0"
        />
        <label>
          2θ (degrees)
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
          Shape factor K
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
        Correct instrumental broadening by quadrature
      </label>
      {correctInstrument && (
        <MeasurementField
          label="Instrument FWHM"
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
            <span>Crystallite size</span>
            <strong>{formatNumber(outcome.result.crystalliteSizeNanometres)} nm</strong>
          </output>
        ) : (
          <Issues errors={outcome.errors} />
        )}
      </div>
      <Warnings warnings={outcome.warnings} />
      {outcome.ok && (
        <MethodDetails {...outcome.provenance} source={SCHERRER_SOURCE} />
      )}
    </section>
  );
}

export function SheetResistanceCalculator() {
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
      <h3 id="lab-sheet-title">Four-point-probe sheet resistance</h3>
      <p class="lab-pack__intro">Equal-spacing infinite-sheet approximation, Rs = (π/ln 2)|V/I|.</p>
      <div class="lab-pack__grid">
        <MeasurementField
          label="Probe voltage"
          value={voltage}
          onValue={setVoltage}
          unit={voltageUnit}
          onUnit={(value) => setVoltageUnit(value as VoltageUnit)}
          units={VOLTAGE_OPTIONS}
        />
        <MeasurementField
          label="Source current"
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
        Calculate bulk resistivity from film thickness
      </label>
      {includeThickness && (
        <MeasurementField
          label="Film thickness"
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
              <span>Sheet resistance</span>
              <strong>{formatNumber(outcome.result.sheetResistanceOhmsPerSquare)} Ω/□</strong>
            </output>
            {outcome.result.resistivityOhmMetres !== undefined && (
              <output>
                <span>Bulk resistivity</span>
                <strong>{formatNumber(outcome.result.resistivityOhmMetres)} Ω·m</strong>
              </output>
            )}
          </div>
        ) : (
          <Issues errors={outcome.errors} />
        )}
      </div>
      <Warnings warnings={outcome.warnings} />
      {outcome.ok && (
        <MethodDetails {...outcome.provenance} source={FOUR_POINT_PROBE_SOURCE} />
      )}
    </section>
  );
}

export function HallCalculator() {
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
      <h3 id="lab-hall-title">Single-carrier Hall measurement</h3>
      <p class="lab-pack__intro">Signed RH, bulk carrier density and Hall mobility.</p>
      <div class="lab-pack__grid">
        <MeasurementField
          label="Source current"
          value={current}
          onValue={setCurrent}
          unit={currentUnit}
          onUnit={(value) => setCurrentUnit(value as CurrentUnit)}
          units={CURRENT_OPTIONS}
        />
        <MeasurementField
          label="Magnetic field"
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
          label="Conducting thickness"
          value={thickness}
          onValue={setThickness}
          unit={thicknessUnit}
          onUnit={(value) => setThicknessUnit(value as LengthUnit)}
          units={LENGTH_OPTIONS}
          min="0"
        />
        <MeasurementField
          label="Hall voltage"
          value={hallVoltage}
          onValue={setHallVoltage}
          unit={voltageUnit}
          onUnit={(value) => setVoltageUnit(value as VoltageUnit)}
          units={VOLTAGE_OPTIONS}
        />
        <label>
          Sheet resistance (Ω/□)
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
              <span>Hall coefficient</span>
              <strong>{formatNumber(outcome.result.hallCoefficientCubicCentimetresPerCoulomb)} cm³/C</strong>
            </output>
            <output>
              <span>Carrier density</span>
              <strong>{formatNumber(outcome.result.carrierDensityPerCubicCentimetre)} cm⁻³</strong>
            </output>
            <output>
              <span>Hall mobility</span>
              <strong>{formatNumber(outcome.result.mobilitySquareCentimetresPerVoltSecond)} cm²/(V·s)</strong>
            </output>
            <output>
              <span>Conventional polarity</span>
              <strong>{outcome.result.conventionalDominantCarrier}</strong>
            </output>
          </div>
        ) : (
          <Issues errors={outcome.errors} />
        )}
      </div>
      <Warnings warnings={outcome.warnings} />
      {outcome.ok && <MethodDetails {...outcome.provenance} source={HALL_SOURCE} />}
    </section>
  );
}

export function VacuumCalculator() {
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
      <h3 id="lab-vacuum-title">Vacuum gas kinetics</h3>
      <p class="lab-pack__intro">Hard-sphere mean free path and monolayer formation estimate.</p>
      <div class="lab-pack__grid">
        <MeasurementField
          label="Pressure"
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
          label="Gas temperature"
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
          label="Molecular diameter"
          value={diameter}
          onValue={setDiameter}
          unit={diameterUnit}
          onUnit={(value) => setDiameterUnit(value as LengthUnit)}
          units={LENGTH_OPTIONS}
          min="0"
        />
        <MeasurementField
          label="Molecular mass"
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
          Sticking coefficient (0–1)
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
              <span>Mean free path</span>
              <strong>{formatNumber(outcome.result.meanFreePathMetres)} m</strong>
            </output>
            <output>
              <span>Impingement rate</span>
              <strong>{formatNumber(outcome.result.impingementRatePerSquareMetreSecond)} m⁻²·s⁻¹</strong>
            </output>
            <output>
              <span>Monolayer time</span>
              <strong>{formatNumber(outcome.result.monolayerFormationTimeSeconds)} s</strong>
            </output>
          </div>
        ) : (
          <Issues errors={outcome.errors} />
        )}
      </div>
      <Warnings warnings={outcome.warnings} />
      {outcome.ok && <MethodDetails {...outcome.provenance} source={VACUUM_SOURCE} />}
    </section>
  );
}

export function LabCalculatorPack() {
  const [calculator, setCalculator] = useState<CalculatorKind>("scherrer");
  const selectId = useId();

  return (
    <article class="lab-pack">
      <header class="lab-pack__header">
        <div>
          <h2>Lab calculator pack</h2>
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
            <option value="scherrer">Scherrer size</option>
            <option value="sheet">Sheet resistance</option>
            <option value="hall">Hall measurement</option>
            <option value="vacuum">Vacuum kinetics</option>
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
