export type LengthUnit = "m" | "mm" | "um" | "nm" | "angstrom";
export type AngleUnit = "radian" | "degree";
export type VoltageUnit = "V" | "mV" | "uV";
export type CurrentUnit = "A" | "mA" | "uA";
export type MagneticFieldUnit = "T" | "mT" | "gauss";
export type PressureUnit = "Pa" | "mbar" | "torr";
export type TemperatureUnit = "K" | "degC";
export type MolecularMassUnit = "kg" | "u";

export interface UnitValue<Unit extends string> {
  value: number;
  unit: Unit;
}

const LENGTH_TO_METRES: Readonly<Record<LengthUnit, number>> = {
  m: 1,
  mm: 1e-3,
  um: 1e-6,
  nm: 1e-9,
  angstrom: 1e-10,
};

const VOLTAGE_TO_VOLTS: Readonly<Record<VoltageUnit, number>> = {
  V: 1,
  mV: 1e-3,
  uV: 1e-6,
};

const CURRENT_TO_AMPERES: Readonly<Record<CurrentUnit, number>> = {
  A: 1,
  mA: 1e-3,
  uA: 1e-6,
};

const FIELD_TO_TESLA: Readonly<Record<MagneticFieldUnit, number>> = {
  T: 1,
  mT: 1e-3,
  gauss: 1e-4,
};

const PRESSURE_TO_PASCALS: Readonly<Record<PressureUnit, number>> = {
  Pa: 1,
  mbar: 100,
  torr: 133.32236842105263,
};

export const ATOMIC_MASS_CONSTANT_KG = 1.660_539_066_60e-27;

export function lengthToMetres(value: UnitValue<LengthUnit>): number {
  return value.value * LENGTH_TO_METRES[value.unit];
}

export function metresToLength(value: number, unit: LengthUnit): number {
  return value / LENGTH_TO_METRES[unit];
}

export function angleToRadians(value: UnitValue<AngleUnit>): number {
  return value.unit === "radian" ? value.value : value.value * (Math.PI / 180);
}

export function voltageToVolts(value: UnitValue<VoltageUnit>): number {
  return value.value * VOLTAGE_TO_VOLTS[value.unit];
}

export function currentToAmperes(value: UnitValue<CurrentUnit>): number {
  return value.value * CURRENT_TO_AMPERES[value.unit];
}

export function magneticFieldToTesla(
  value: UnitValue<MagneticFieldUnit>,
): number {
  return value.value * FIELD_TO_TESLA[value.unit];
}

export function pressureToPascals(value: UnitValue<PressureUnit>): number {
  return value.value * PRESSURE_TO_PASCALS[value.unit];
}

export function temperatureToKelvin(
  value: UnitValue<TemperatureUnit>,
): number {
  return value.unit === "K" ? value.value : value.value + 273.15;
}

export function molecularMassToKilograms(
  value: UnitValue<MolecularMassUnit>,
): number {
  return value.unit === "kg"
    ? value.value
    : value.value * ATOMIC_MASS_CONSTANT_KG;
}

