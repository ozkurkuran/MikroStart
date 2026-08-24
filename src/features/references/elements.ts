import { REFERENCE_SOURCES } from "./sources";
import type { ChemicalElement, ElementCategory } from "./types";

type ElementRow = readonly [
  symbol: string,
  name: string,
  standardAtomicWeight: string | null,
  category: ElementCategory,
];

const n = "reactive-nonmetal";
const ng = "noble-gas";
const a = "alkali-metal";
const ae = "alkaline-earth-metal";
const tm = "transition-metal";
const pt = "post-transition-metal";
const m = "metalloid";
const h = "halogen";
const l = "lanthanide";
const ac = "actinide";

/**
 * Names and symbols follow the IUPAC table. Weights are the CIAAW 2024
 * abridged values; null means that CIAAW assigns no standard atomic weight.
 * Category is an application navigation aid, not an IUPAC classification.
 */
const ELEMENT_ROWS: readonly ElementRow[] = [
  ["H", "Hydrogen", "1.0080 ± 0.0002", n],
  ["He", "Helium", "4.0026 ± 0.0001", ng],
  ["Li", "Lithium", "6.94 ± 0.06", a],
  ["Be", "Beryllium", "9.0122 ± 0.0001", ae],
  ["B", "Boron", "10.81 ± 0.02", m],
  ["C", "Carbon", "12.011 ± 0.002", n],
  ["N", "Nitrogen", "14.007 ± 0.001", n],
  ["O", "Oxygen", "15.999 ± 0.001", n],
  ["F", "Fluorine", "18.998 ± 0.001", h],
  ["Ne", "Neon", "20.180 ± 0.001", ng],
  ["Na", "Sodium", "22.990 ± 0.001", a],
  ["Mg", "Magnesium", "24.305 ± 0.002", ae],
  ["Al", "Aluminium", "26.982 ± 0.001", pt],
  ["Si", "Silicon", "28.085 ± 0.001", m],
  ["P", "Phosphorus", "30.974 ± 0.001", n],
  ["S", "Sulfur", "32.06 ± 0.02", n],
  ["Cl", "Chlorine", "35.45 ± 0.01", h],
  ["Ar", "Argon", "39.95 ± 0.16", ng],
  ["K", "Potassium", "39.098 ± 0.001", a],
  ["Ca", "Calcium", "40.078 ± 0.004", ae],
  ["Sc", "Scandium", "44.956 ± 0.001", tm],
  ["Ti", "Titanium", "47.867 ± 0.001", tm],
  ["V", "Vanadium", "50.942 ± 0.001", tm],
  ["Cr", "Chromium", "51.996 ± 0.001", tm],
  ["Mn", "Manganese", "54.938 ± 0.001", tm],
  ["Fe", "Iron", "55.845 ± 0.002", tm],
  ["Co", "Cobalt", "58.933 ± 0.001", tm],
  ["Ni", "Nickel", "58.693 ± 0.001", tm],
  ["Cu", "Copper", "63.546 ± 0.003", tm],
  ["Zn", "Zinc", "65.38 ± 0.02", tm],
  ["Ga", "Gallium", "69.723 ± 0.001", pt],
  ["Ge", "Germanium", "72.630 ± 0.008", m],
  ["As", "Arsenic", "74.922 ± 0.001", m],
  ["Se", "Selenium", "78.971 ± 0.008", n],
  ["Br", "Bromine", "79.904 ± 0.003", h],
  ["Kr", "Krypton", "83.798 ± 0.002", ng],
  ["Rb", "Rubidium", "85.468 ± 0.001", a],
  ["Sr", "Strontium", "87.62 ± 0.01", ae],
  ["Y", "Yttrium", "88.906 ± 0.001", tm],
  ["Zr", "Zirconium", "91.222 ± 0.003", tm],
  ["Nb", "Niobium", "92.906 ± 0.001", tm],
  ["Mo", "Molybdenum", "95.95 ± 0.01", tm],
  ["Tc", "Technetium", null, tm],
  ["Ru", "Ruthenium", "101.07 ± 0.02", tm],
  ["Rh", "Rhodium", "102.91 ± 0.01", tm],
  ["Pd", "Palladium", "106.42 ± 0.01", tm],
  ["Ag", "Silver", "107.87 ± 0.01", tm],
  ["Cd", "Cadmium", "112.41 ± 0.01", tm],
  ["In", "Indium", "114.82 ± 0.01", pt],
  ["Sn", "Tin", "118.71 ± 0.01", pt],
  ["Sb", "Antimony", "121.76 ± 0.01", m],
  ["Te", "Tellurium", "127.60 ± 0.03", m],
  ["I", "Iodine", "126.90 ± 0.01", h],
  ["Xe", "Xenon", "131.29 ± 0.01", ng],
  ["Cs", "Caesium", "132.91 ± 0.01", a],
  ["Ba", "Barium", "137.33 ± 0.01", ae],
  ["La", "Lanthanum", "138.91 ± 0.01", l],
  ["Ce", "Cerium", "140.12 ± 0.01", l],
  ["Pr", "Praseodymium", "140.91 ± 0.01", l],
  ["Nd", "Neodymium", "144.24 ± 0.01", l],
  ["Pm", "Promethium", null, l],
  ["Sm", "Samarium", "150.36 ± 0.02", l],
  ["Eu", "Europium", "151.96 ± 0.01", l],
  ["Gd", "Gadolinium", "157.249 ± 0.002", l],
  ["Tb", "Terbium", "158.93 ± 0.01", l],
  ["Dy", "Dysprosium", "162.50 ± 0.01", l],
  ["Ho", "Holmium", "164.93 ± 0.01", l],
  ["Er", "Erbium", "167.26 ± 0.01", l],
  ["Tm", "Thulium", "168.93 ± 0.01", l],
  ["Yb", "Ytterbium", "173.05 ± 0.02", l],
  ["Lu", "Lutetium", "174.96669 ± 0.00005", l],
  ["Hf", "Hafnium", "178.49 ± 0.01", tm],
  ["Ta", "Tantalum", "180.95 ± 0.01", tm],
  ["W", "Tungsten", "183.84 ± 0.01", tm],
  ["Re", "Rhenium", "186.21 ± 0.01", tm],
  ["Os", "Osmium", "190.23 ± 0.03", tm],
  ["Ir", "Iridium", "192.22 ± 0.01", tm],
  ["Pt", "Platinum", "195.08 ± 0.02", tm],
  ["Au", "Gold", "196.97 ± 0.01", tm],
  ["Hg", "Mercury", "200.59 ± 0.01", tm],
  ["Tl", "Thallium", "204.38 ± 0.01", pt],
  ["Pb", "Lead", "207.2 ± 1.1", pt],
  ["Bi", "Bismuth", "208.98 ± 0.01", pt],
  ["Po", "Polonium", null, m],
  ["At", "Astatine", null, h],
  ["Rn", "Radon", null, ng],
  ["Fr", "Francium", null, a],
  ["Ra", "Radium", null, ae],
  ["Ac", "Actinium", null, ac],
  ["Th", "Thorium", "232.04 ± 0.01", ac],
  ["Pa", "Protactinium", "231.04 ± 0.01", ac],
  ["U", "Uranium", "238.03 ± 0.01", ac],
  ["Np", "Neptunium", null, ac],
  ["Pu", "Plutonium", null, ac],
  ["Am", "Americium", null, ac],
  ["Cm", "Curium", null, ac],
  ["Bk", "Berkelium", null, ac],
  ["Cf", "Californium", null, ac],
  ["Es", "Einsteinium", null, ac],
  ["Fm", "Fermium", null, ac],
  ["Md", "Mendelevium", null, ac],
  ["No", "Nobelium", null, ac],
  ["Lr", "Lawrencium", null, ac],
  ["Rf", "Rutherfordium", null, tm],
  ["Db", "Dubnium", null, tm],
  ["Sg", "Seaborgium", null, tm],
  ["Bh", "Bohrium", null, tm],
  ["Hs", "Hassium", null, tm],
  ["Mt", "Meitnerium", null, tm],
  ["Ds", "Darmstadtium", null, tm],
  ["Rg", "Roentgenium", null, tm],
  ["Cn", "Copernicium", null, tm],
  ["Nh", "Nihonium", null, pt],
  ["Fl", "Flerovium", null, pt],
  ["Mc", "Moscovium", null, pt],
  ["Lv", "Livermorium", null, pt],
  ["Ts", "Tennessine", null, h],
  ["Og", "Oganesson", null, ng],
];

const sourceId = REFERENCE_SOURCES.atomicWeights2024.id;

export const PERIODIC_ELEMENTS: readonly ChemicalElement[] = ELEMENT_ROWS.map(
  ([symbol, name, standardAtomicWeight, category], index) => ({
    atomicNumber: index + 1,
    symbol,
    name,
    standardAtomicWeight,
    category,
    sourceId,
  }),
);

export function getElement(query: number | string): ChemicalElement | undefined {
  if (typeof query === "number") {
    return PERIODIC_ELEMENTS[query - 1];
  }
  const needle = query.trim().toLocaleLowerCase("en");
  return PERIODIC_ELEMENTS.find(
    (element) =>
      element.symbol.toLocaleLowerCase("en") === needle ||
      element.name.toLocaleLowerCase("en") === needle,
  );
}

/** Returns the abridged central value; it does not remove its uncertainty. */
export function atomicWeightCentralValue(element: ChemicalElement): number | null {
  if (element.standardAtomicWeight === null) return null;
  const parsed = Number.parseFloat(element.standardAtomicWeight);
  return Number.isFinite(parsed) ? parsed : null;
}
