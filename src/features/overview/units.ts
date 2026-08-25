export interface UnitDefinition {
  id: string;
  label: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
}

export interface UnitCategory {
  id: string;
  units: readonly UnitDefinition[];
}

const linear = (id: string, label: string, factor: number): UnitDefinition => ({
  id,
  label,
  toBase: (value) => value * factor,
  fromBase: (value) => value / factor,
});

export const UNIT_CATEGORIES: readonly UnitCategory[] = [
  { id: "length", units: [linear("m", "m", 1), linear("cm", "cm", 1e-2), linear("mm", "mm", 1e-3), linear("um", "µm", 1e-6), linear("nm", "nm", 1e-9), linear("angstrom", "Å", 1e-10)] },
  { id: "mass", units: [linear("kg", "kg", 1), linear("g", "g", 1e-3), linear("mg", "mg", 1e-6), linear("ug", "µg", 1e-9)] },
  { id: "temperature", units: [
    { id: "c", label: "°C", toBase: (value) => value + 273.15, fromBase: (value) => value - 273.15 },
    linear("k", "K", 1),
    { id: "f", label: "°F", toBase: (value) => ((value - 32) * 5) / 9 + 273.15, fromBase: (value) => ((value - 273.15) * 9) / 5 + 32 },
  ] },
  { id: "pressure", units: [linear("pa", "Pa", 1), linear("kpa", "kPa", 1e3), linear("bar", "bar", 1e5), linear("mbar", "mbar", 100), linear("torr", "Torr", 133.322368), linear("atm", "atm", 101325)] },
  { id: "energy", units: [linear("j", "J", 1), linear("ev", "eV", 1.602176634e-19), linear("kev", "keV", 1.602176634e-16), linear("kwh", "kWh", 3.6e6)] },
  { id: "time", units: [linear("s", "s", 1), linear("min", "min", 60), linear("h", "h", 3600), linear("day", "day", 86400)] },
  { id: "area", units: [linear("m2", "m²", 1), linear("cm2", "cm²", 1e-4), linear("mm2", "mm²", 1e-6)] },
  { id: "resistance", units: [linear("ohm", "Ω", 1), linear("kohm", "kΩ", 1e3), linear("mohm", "MΩ", 1e6)] },
  { id: "angle", units: [linear("rad", "rad", 1), linear("deg", "°", Math.PI / 180)] },
] as const;

export function convertUnit(value: number, categoryId: string, fromId: string, toId: string): number {
  const category = UNIT_CATEGORIES.find((item) => item.id === categoryId);
  const from = category?.units.find((unit) => unit.id === fromId);
  const to = category?.units.find((unit) => unit.id === toId);
  if (!from || !to || !Number.isFinite(value)) throw new Error("Invalid unit conversion");
  return to.fromBase(from.toBase(value));
}
