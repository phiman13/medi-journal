export interface PolylineOptions {
  width: number;
  height: number;
  min: number;
  max: number;
}

// SVG-Punkte für eine einzelne Kurve (Dashboard-Minimalversion, SPEC.md §5.3:
// "eine Kurve"). Kein Chart-Framework nötig - self-hosted per Spec-Vorgabe
// (keine externen Assets zur Laufzeit).
export function toPolylinePoints(
  values: number[],
  { width, height, min, max }: PolylineOptions,
): string {
  if (values.length === 0) return "";

  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const clamped = Math.max(min, Math.min(max, value));
      const y = height - ((clamped - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
