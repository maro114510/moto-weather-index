import type {
  Confidence,
  FactorKey,
  Rating,
  Target,
} from "../domain/TouringIndex";

export function factorLabel(_key: FactorKey): string {
  return "";
}

export function confidenceLabel(_confidence: Confidence): string {
  return "";
}

export function formatFreshness(_iso: string): string {
  return "";
}

export function formatTarget(_target: Target): string {
  return "";
}

export function ratingClasses(_color: Rating["color"]): {
  badge: string;
  bar: string;
} {
  return { badge: "", bar: "" };
}
