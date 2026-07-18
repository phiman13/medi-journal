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

export interface EventMarker {
  x: number;
  title: string;
}

// Positioniert Events als vertikale Chart-Marker (SPEC.md §3.4: "Events
// werden in allen Charts als vertikale Markierungslinien gerendert"). Nutzt
// dieselbe stepX-Formel wie toPolylinePoints(), damit Marker und Kurve exakt
// zueinander ausgerichtet sind. Events außerhalb des angezeigten Zeitraums
// (Datum nicht in `dates`) werden übersprungen statt verzerrt reingequetscht.
export function eventMarkerPositions(
  dates: string[],
  events: { date: string; title: string }[],
  width: number,
): EventMarker[] {
  const stepX = dates.length > 1 ? width / (dates.length - 1) : 0;
  const markers: EventMarker[] = [];

  for (const event of events) {
    const index = dates.indexOf(event.date);
    if (index === -1) continue;
    markers.push({ x: index * stepX, title: event.title });
  }

  return markers;
}
