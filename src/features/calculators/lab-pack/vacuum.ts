import {
  type CalculationIssue,
  type CalculationWarning,
  finiteIssue,
  positiveIssues,
} from "./shared";
import { VACUUM_SOURCE } from "./sources";
import {
  lengthToMetres,
  molecularMassToKilograms,
  pressureToPascals,
  temperatureToKelvin,
  type LengthUnit,
  type MolecularMassUnit,
  type PressureUnit,
  type TemperatureUnit,
  type UnitValue,
} from "./units";

export interface VacuumInput {
  pressure: UnitValue<PressureUnit>;
  temperature: UnitValue<TemperatureUnit>;
  molecularDiameter: UnitValue<LengthUnit>;
  molecularMass: UnitValue<MolecularMassUnit>;
  stickingCoefficient: number;
}

export interface VacuumProvenance {
  algorithmId: "ideal-gas-vacuum-kinetics";
  algorithmVersion: "1.0.0";
  formulaId: "vacuum:mfp=kT/(sqrt(2)*pi*d^2*p);Z=p/sqrt(2*pi*m*kT);tau=N/(S*Z)";
  sourceIds: readonly ["CERN:ACC-2020-0009"];
  normalizedInputs: {
    pressurePascals: number;
    temperatureKelvin: number;
    molecularDiameterMetres: number;
    molecularMassKilograms: number;
    stickingCoefficient: number;
    assumedMonolayerDensityPerSquareMetre: number;
    boltzmannConstantJoulesPerKelvin: number;
  };
}

export type VacuumOutcome =
  | {
      ok: true;
      result: {
        meanFreePathMetres: number;
        impingementRatePerSquareMetreSecond: number;
        monolayerFormationTimeSeconds: number;
      };
      warnings: CalculationWarning[];
      provenance: VacuumProvenance;
    }
  | {
      ok: false;
      errors: CalculationIssue[];
      warnings: CalculationWarning[];
    };

export const BOLTZMANN_CONSTANT_JOULES_PER_KELVIN = 1.380_649e-23;
export const ASSUMED_MONOLAYER_DENSITY_PER_SQUARE_METRE = 1e19;

/**
 * Calculates hard-sphere mean free path and ideal-gas impingement rate in SI.
 * Monolayer time assumes 10^19 adsorption sites/m² and the supplied sticking
 * coefficient; it is an order-of-magnitude surface-contamination estimate.
 */
export function calculateVacuum(input: VacuumInput): VacuumOutcome {
  const pressurePascals = pressureToPascals(input.pressure);
  const temperatureKelvin = temperatureToKelvin(input.temperature);
  const molecularDiameterMetres = lengthToMetres(input.molecularDiameter);
  const molecularMassKilograms = molecularMassToKilograms(input.molecularMass);
  const errors: CalculationIssue[] = [
    ...positiveIssues(pressurePascals, "pressure"),
    ...positiveIssues(temperatureKelvin, "temperature"),
    ...positiveIssues(molecularDiameterMetres, "molecularDiameter"),
    ...positiveIssues(molecularMassKilograms, "molecularMass"),
    ...positiveIssues(input.stickingCoefficient, "stickingCoefficient"),
  ];
  const warnings: CalculationWarning[] = [
    {
      code: "ASSUMED_MONOLAYER_DENSITY",
      message:
        "Monolayer time assumes 10¹⁹ adsorption sites/m²; real surfaces and adsorbates can differ substantially.",
    },
  ];

  const stickingIssue = finiteIssue(
    input.stickingCoefficient,
    "stickingCoefficient",
  );
  if (!stickingIssue && input.stickingCoefficient > 1) {
    errors.push({
      code: "OUT_OF_RANGE",
      field: "stickingCoefficient",
      message: "stickingCoefficient must be greater than 0 and no greater than 1.",
    });
  }
  if (pressurePascals > 100) {
    warnings.push({
      code: "OUTSIDE_TYPICAL_VACUUM_RANGE",
      message:
        "Pressure exceeds 1 mbar; verify that a dilute ideal-gas vacuum model is appropriate.",
    });
  }
  if (temperatureKelvin < 50 || temperatureKelvin > 2_000) {
    warnings.push({
      code: "UNUSUAL_GAS_TEMPERATURE",
      message:
        "Temperature is outside 50–2000 K; confirm gas state and hard-sphere parameters.",
    });
  }
  if (input.stickingCoefficient < 0.01) {
    warnings.push({
      code: "LOW_STICKING_COEFFICIENT",
      message:
        "The sticking coefficient is below 0.01, so monolayer time is highly surface-condition dependent.",
    });
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  const meanFreePathMetres =
    (BOLTZMANN_CONSTANT_JOULES_PER_KELVIN * temperatureKelvin) /
    (Math.sqrt(2) *
      Math.PI *
      molecularDiameterMetres ** 2 *
      pressurePascals);
  const impingementRatePerSquareMetreSecond =
    pressurePascals /
    Math.sqrt(
      2 *
        Math.PI *
        molecularMassKilograms *
        BOLTZMANN_CONSTANT_JOULES_PER_KELVIN *
        temperatureKelvin,
    );
  const monolayerFormationTimeSeconds =
    ASSUMED_MONOLAYER_DENSITY_PER_SQUARE_METRE /
    (input.stickingCoefficient * impingementRatePerSquareMetreSecond);

  return {
    ok: true,
    result: {
      meanFreePathMetres,
      impingementRatePerSquareMetreSecond,
      monolayerFormationTimeSeconds,
    },
    warnings,
    provenance: {
      algorithmId: "ideal-gas-vacuum-kinetics",
      algorithmVersion: "1.0.0",
      formulaId:
        "vacuum:mfp=kT/(sqrt(2)*pi*d^2*p);Z=p/sqrt(2*pi*m*kT);tau=N/(S*Z)",
      sourceIds: [VACUUM_SOURCE.id],
      normalizedInputs: {
        pressurePascals,
        temperatureKelvin,
        molecularDiameterMetres,
        molecularMassKilograms,
        stickingCoefficient: input.stickingCoefficient,
        assumedMonolayerDensityPerSquareMetre:
          ASSUMED_MONOLAYER_DENSITY_PER_SQUARE_METRE,
        boltzmannConstantJoulesPerKelvin:
          BOLTZMANN_CONSTANT_JOULES_PER_KELVIN,
      },
    },
  };
}

