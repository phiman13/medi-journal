<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/db";
  import { toPolylinePoints, eventMarkerPositions } from "../lib/chart";
  import { averageBetween, weekOverWeekDelta, frequencyOfLists, frequencyOfValues } from "../lib/dashboardStats";
  import { todayInBerlin, addDays } from "../lib/dailyEntry";
  import type { DailyEntry } from "../lib/dailyEntry";
  import type { WeeklyCheck } from "../lib/weeklyCheck";
  import type { Phq9Check } from "../lib/phq9";
  import type { JournalEvent } from "../lib/event";

  const CHART_WIDTH = 600;
  const CHART_HEIGHT = 130;
  const SMALL_CHART_HEIGHT = 80;
  const LIMIT = 30;
  const CHECK_LIMIT = 12;

  // SPEC.md §5.3: "wählbare Serien, Default Fokus/Stimmung/Tagesfunktion".
  // Alle 6 Kernskalen sind einheitlich int 1-10 (§3.1) - ein gemeinsamer
  // Wertebereich für toPolylinePoints() reicht, keine zweite Achse nötig.
  // Farben aus der eigenen --serie-N-Reihe (app.css), nicht Ruhe/Dosis/
  // Achtung - die sind semantisch belegt (s. dortiger Kommentar).
  const SCALES = [
    { key: "focus", label: "Fokus", color: "var(--serie-1)", defaultOn: true },
    { key: "task_initiation", label: "Ins Tun kommen", color: "var(--serie-2)", defaultOn: false },
    { key: "inner_calm", label: "Innere Ruhe", color: "var(--serie-3)", defaultOn: false },
    { key: "emotional_stability", label: "Emot. Ausgeglichenheit", color: "var(--serie-4)", defaultOn: false },
    { key: "mood", label: "Stimmung", color: "var(--serie-5)", defaultOn: true },
    { key: "day_function", label: "Tagesfunktion", color: "var(--serie-6)", defaultOn: true },
  ] as const satisfies { key: keyof DailyEntry; label: string; color: string; defaultOn: boolean }[];

  const today = todayInBerlin();
  const windowStart = addDays(today, -(LIMIT - 1));

  let entries = $state<DailyEntry[]>([]);
  let weeklyChecks = $state<WeeklyCheck[]>([]);
  let phq9Checks = $state<Phq9Check[]>([]);
  let events = $state<JournalEvent[]>([]);
  let selectedScales = $state<Set<string>>(new Set(SCALES.filter((s) => s.defaultOn).map((s) => s.key)));

  async function load(): Promise<void> {
    const allEntries = await db.daily_entries.orderBy("date").toArray();
    entries = allEntries.filter((entry) => !entry.deleted_at).slice(-LIMIT);

    const allWeekly = await db.weekly_checks.orderBy("week_start").toArray();
    weeklyChecks = allWeekly.filter((check) => !check.deleted_at).slice(-CHECK_LIMIT);

    const allPhq9 = await db.phq9_checks.orderBy("date").toArray();
    phq9Checks = allPhq9.filter((check) => !check.deleted_at).slice(-CHECK_LIMIT);

    const allEvents = await db.events.toArray();
    events = allEvents.filter((event) => !event.deleted_at);
  }

  onMount(load);

  function toggleScale(key: string): void {
    const next = new Set(selectedScales);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selectedScales = next;
  }

  const dates = $derived(entries.map((entry) => entry.date));
  const markers = $derived(eventMarkerPositions(dates, events, CHART_WIDTH));
  const scaleSeries = $derived(
    SCALES.filter((scale) => selectedScales.has(scale.key)).map((scale) => ({
      ...scale,
      points: toPolylinePoints(
        entries.map((entry) => entry[scale.key] as number),
        { width: CHART_WIDTH, height: CHART_HEIGHT, min: 1, max: 10 },
      ),
    })),
  );

  const weekDeltas = $derived(SCALES.map((scale) => ({ ...scale, ...weekOverWeekDelta(entries, scale.key, today) })));

  const weeklyDates = $derived(weeklyChecks.map((check) => check.week_start));
  const weeklyMarkers = $derived(eventMarkerPositions(weeklyDates, events, CHART_WIDTH));
  const asrsPoints = $derived(
    toPolylinePoints(
      weeklyChecks.map((check) => check.asrs_score),
      { width: CHART_WIDTH, height: SMALL_CHART_HEIGHT, min: 0, max: 24 },
    ),
  );

  const phq9Dates = $derived(phq9Checks.map((check) => check.date));
  const phq9Markers = $derived(eventMarkerPositions(phq9Dates, events, CHART_WIDTH));
  const phq9Points = $derived(
    toPolylinePoints(
      phq9Checks.map((check) => check.score),
      { width: CHART_WIDTH, height: SMALL_CHART_HEIGHT, min: 0, max: 27 },
    ),
  );

  // "Übersicht" (nicht "Verlauf") laut SPEC.md §5.3 für Schlaf/Appetit -
  // Mittelwert/Häufigkeit statt Liniendiagramm, da sleep_hours/appetite oft
  // Lücken haben (optionale Felder) und ein Chart mit 0-aufgefüllten Lücken
  // irreführend wäre (s. averageBetween()-Kommentar in dashboardStats.ts).
  const avgSleepHours = $derived(averageBetween(entries, "sleep_hours", windowStart, today));
  const avgSleepQuality = $derived(averageBetween(entries, "sleep_quality", windowStart, today));
  const appetiteCounts = $derived(frequencyOfValues(entries.map((entry) => entry.appetite)));
  const sideEffectCounts = $derived(frequencyOfLists(entries.map((entry) => entry.side_effects)));

  const recentFirst = $derived([...entries].reverse());

  function formatDelta(delta: number | null): string {
    if (delta === null) return "";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}`;
  }
</script>

<div class="karte">
  <h2>7-Tage-Mittel <span class="eyebrow">vs. Vorwoche</span></h2>
  <ul class="delta-liste">
    {#each weekDeltas as scale (scale.key)}
      <li>
        <span>{scale.label}</span>
        <span class="zahl delta-wert">
          {scale.current !== null ? scale.current.toFixed(1) : "–"}
          {#if scale.delta !== null}
            <span class:positiv={scale.delta > 0} class:negativ={scale.delta < 0}>({formatDelta(scale.delta)})</span>
          {/if}
        </span>
      </li>
    {/each}
  </ul>
</div>

<div class="karte">
  <h2>Verlauf <span class="eyebrow">letzte {LIMIT} Einträge</span></h2>
  <div class="chip-liste serien-wahl">
    {#each SCALES as scale (scale.key)}
      <label class="chip" class:aktiv={selectedScales.has(scale.key)} style:--chip-farbe={scale.color}>
        <input type="checkbox" checked={selectedScales.has(scale.key)} onchange={() => toggleScale(scale.key)} />
        <i></i>{scale.label}
      </label>
    {/each}
  </div>
  {#if entries.length === 0}
    <p class="leer">Noch keine Einträge.</p>
  {:else}
    <svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" role="img" aria-label="Verlauf der ausgewählten Kernskalen">
      <line x1="0" y1={CHART_HEIGHT * 0.25} x2={CHART_WIDTH} y2={CHART_HEIGHT * 0.25} class="gitter" />
      <line x1="0" y1={CHART_HEIGHT * 0.5} x2={CHART_WIDTH} y2={CHART_HEIGHT * 0.5} class="gitter" />
      <line x1="0" y1={CHART_HEIGHT * 0.75} x2={CHART_WIDTH} y2={CHART_HEIGHT * 0.75} class="gitter" />
      {#each markers as marker (marker.x + marker.title)}
        <line x1={marker.x} y1={0} x2={marker.x} y2={CHART_HEIGHT} class="marker">
          <title>{marker.title}</title>
        </line>
      {/each}
      {#each scaleSeries as series (series.key)}
        <polyline points={series.points} fill="none" stroke={series.color} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      {/each}
    </svg>
    {#if markers.length > 0}
      <ul class="marker-liste">
        {#each markers as marker (marker.x + marker.title)}
          <li>{marker.title}</li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<div class="karte">
  <h2>ASRS-Verlauf <span class="eyebrow">letzte {CHECK_LIMIT} Wochen-Checks</span></h2>
  {#if weeklyChecks.length === 0}
    <p class="leer">Noch keine Wochen-Checks.</p>
  {:else}
    <svg viewBox="0 0 {CHART_WIDTH} {SMALL_CHART_HEIGHT}" role="img" aria-label="ASRS-Verlauf">
      <line x1="0" y1={SMALL_CHART_HEIGHT * 0.5} x2={CHART_WIDTH} y2={SMALL_CHART_HEIGHT * 0.5} class="gitter" />
      {#each weeklyMarkers as marker (marker.x + marker.title)}
        <line x1={marker.x} y1={0} x2={marker.x} y2={SMALL_CHART_HEIGHT} class="marker">
          <title>{marker.title}</title>
        </line>
      {/each}
      <polyline points={asrsPoints} fill="none" stroke="var(--ruhe)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {/if}
</div>

<div class="karte">
  <h2>PHQ-9-Verlauf <span class="eyebrow">letzte {CHECK_LIMIT} Checks</span></h2>
  {#if phq9Checks.length === 0}
    <p class="leer">Noch keine PHQ-9-Checks.</p>
  {:else}
    <svg viewBox="0 0 {CHART_WIDTH} {SMALL_CHART_HEIGHT}" role="img" aria-label="PHQ-9-Verlauf">
      <line x1="0" y1={SMALL_CHART_HEIGHT * 0.5} x2={CHART_WIDTH} y2={SMALL_CHART_HEIGHT * 0.5} class="gitter" />
      {#each phq9Markers as marker (marker.x + marker.title)}
        <line x1={marker.x} y1={0} x2={marker.x} y2={SMALL_CHART_HEIGHT} class="marker">
          <title>{marker.title}</title>
        </line>
      {/each}
      <polyline points={phq9Points} fill="none" stroke="var(--dosis)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {/if}
</div>

<div class="karte">
  <h2>Schlaf-Übersicht <span class="eyebrow">{LIMIT} Tage</span></h2>
  <p class="zahl kennzahl">
    {avgSleepHours !== null ? avgSleepHours.toFixed(1) : "–"}<span class="einheit">h</span>
  </p>
  <p class="eyebrow">Ø Qualität {avgSleepQuality !== null ? avgSleepQuality.toFixed(1) : "–"}</p>
</div>

<div class="karte">
  <h2>Appetit-Übersicht <span class="eyebrow">{LIMIT} Tage</span></h2>
  {#if appetiteCounts.length === 0}
    <p class="leer">Keine Angaben.</p>
  {:else}
    <ul class="haeufigkeit-liste">
      {#each appetiteCounts as item (item.key)}
        <li><span>{item.key}</span><span class="zahl">{item.count} Tage</span></li>
      {/each}
    </ul>
  {/if}
</div>

<div class="karte">
  <h2>Nebenwirkungs-Häufigkeit <span class="eyebrow">{LIMIT} Tage</span></h2>
  {#if sideEffectCounts.length === 0}
    <p class="leer">Keine Nebenwirkungen erfasst.</p>
  {:else}
    <ul class="haeufigkeit-liste">
      {#each sideEffectCounts as item (item.key)}
        <li><span>{item.key.replace(/_/g, " ")}</span><span class="zahl">{item.count} Tage</span></li>
      {/each}
    </ul>
  {/if}
</div>

<div class="karte">
  <h2>Letzte Einträge</h2>
  {#if entries.length === 0}
    <p class="leer">Noch keine Einträge.</p>
  {:else}
    <div class="tabelle-wrap">
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Med.</th>
            <th>Fokus</th>
            <th>Stimmung</th>
            <th>Tagesfkt.</th>
          </tr>
        </thead>
        <tbody>
          {#each recentFirst as entry (entry.date)}
            <tr>
              <td class="zahl">{entry.date}</td>
              <td><i class="punkt" class:an={entry.med_taken}></i></td>
              <td class="zahl">{entry.focus}</td>
              <td class="zahl">{entry.mood}</td>
              <td class="zahl">{entry.day_function}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  h2 {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .delta-liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .delta-liste li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 0.87rem;
  }
  .delta-wert {
    font-size: 0.92rem;
  }
  .delta-wert .positiv {
    color: var(--ruhe);
  }
  .delta-wert .negativ {
    color: var(--achtung);
  }

  .serien-wahl {
    margin-bottom: 1rem;
  }
  .chip-liste {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  /* min-height 44px (M6-Review, ui-ux-pro-max) - s. .checkbox-zeile in app.css. */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    padding: 0.4rem 0.75rem;
    min-height: 44px;
    border-radius: 999px;
    border: 1px solid var(--papier-linie);
    color: var(--tinte-matt);
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background-color 150ms ease,
      color 150ms ease;
  }
  .chip.aktiv {
    border-color: var(--chip-farbe, var(--ruhe));
    color: var(--tinte);
    font-weight: 600;
  }
  .chip i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--chip-farbe, var(--tinte-matt));
    display: inline-block;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }

  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .gitter {
    stroke: var(--papier-linie);
    stroke-width: 1;
  }
  .marker {
    stroke: var(--dosis);
    stroke-width: 1.3;
    stroke-dasharray: 3, 3;
    opacity: 0.7;
  }

  .marker-liste,
  .haeufigkeit-liste {
    list-style: none;
    margin: 0.8rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .haeufigkeit-liste li {
    display: flex;
    justify-content: space-between;
    color: var(--tinte-matt);
  }

  .kennzahl {
    font-size: 2.2rem;
    font-weight: 600;
    margin: 0.3rem 0 0.1rem;
    color: var(--ruhe);
  }
  .einheit {
    font-size: 1.1rem;
    color: var(--tinte-matt);
    margin-left: 0.2rem;
  }

  .leer {
    color: var(--tinte-matt);
    font-size: 0.88rem;
  }

  .tabelle-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.5rem 0.5rem;
    border-bottom: 1px solid var(--papier-linie);
    white-space: nowrap;
  }
  th {
    font-family: var(--mono);
    font-size: 0.65rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tinte-matt);
    font-weight: 500;
  }
  .punkt {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--papier-linie);
    display: inline-block;
  }
  .punkt.an {
    background: var(--ruhe);
  }
</style>
