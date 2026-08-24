import { REFERENCE_SOURCES } from "./sources";
import type { ESeries, ESeriesName } from "./types";

const sourceId = REFERENCE_SOURCES.eSeries2015.id;

export const E_SERIES: Readonly<Record<ESeriesName, ESeries>> = {
  E6: {
    name: "E6",
    nominalTolerancePercent: 20,
    values: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
    sourceId,
  },
  E12: {
    name: "E12",
    nominalTolerancePercent: 10,
    values: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
    sourceId,
  },
  E24: {
    name: "E24",
    nominalTolerancePercent: 5,
    values: [
      1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
      3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
    ],
    sourceId,
  },
} as const;

export function valuesForDecade(
  seriesName: ESeriesName,
  decadeExponent: number,
): number[] {
  if (!Number.isInteger(decadeExponent) || decadeExponent < -12 || decadeExponent > 12) {
    throw new RangeError("Decade exponent must be an integer from -12 through 12.");
  }
  const multiplier = 10 ** decadeExponent;
  return E_SERIES[seriesName].values.map((value) => value * multiplier);
}

export function nearestESeriesValue(
  requested: number,
  seriesName: ESeriesName,
): number {
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new RangeError("Requested value must be a positive finite number.");
  }

  const exponent = Math.floor(Math.log10(requested));
  const candidates = [exponent - 1, exponent, exponent + 1].flatMap((candidate) =>
    valuesForDecade(seriesName, candidate),
  );
  return candidates.reduce((nearest, candidate) =>
    Math.abs(candidate - requested) < Math.abs(nearest - requested) ? candidate : nearest,
  );
}
