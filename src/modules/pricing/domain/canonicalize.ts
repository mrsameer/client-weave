import { createHash } from "node:crypto";

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
    .join(",")}}`;
}

export function canonicalJson(value: unknown): string {
  return stable(value);
}

export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

/** Rounds a fractional minor-unit value with midpoint values away from zero. */
export function roundHalfAwayFromZero(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new TypeError(
      "Money rounding requires integer numerator and positive integer denominator"
    );
  }
  const sign = numerator < 0 ? -1 : 1;
  const absolute = Math.abs(numerator);
  return sign * Math.floor((absolute * 2 + denominator) / (denominator * 2));
}
