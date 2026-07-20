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
  const CHART_HEIGHT = 120;
  const SMALL_CHART_HEIGHT = 80;
  const LIMIT = 30;
  const CHECK_LIMIT = 12;

  // SPEC.md §5.3: "wählbare Serien, Default Fokus/Stimmung/Tagesfunktion".
  // Alle 6 Kernskalen sind einheitlich int 1-10 (§3.1) - ein gemeinsamer
  // Wertebereich für toPolylinePoints() reicht, keine zweite Achse nötig.
  const SCALES = [
    { key: "focus", label: "Fokus", color: "#4f9dff", defaultOn: true },
    { key: "task_initiation", label: "Ins Tun kommen", color: "#ff9d4f", defaultOn: false },
    { key: "inner_calm", label: "Innere Ruhe", color: "#7fd858", defaultOn: false },
    { key: "emotional_stability", label: "Emot. Ausgeglichenheit", color: "#e05fd0", defaultOn: false },
    { key: "mood", label: "Stimmung", color: "#ffd54f", defaultOn: true },
    { key: "day_function", label: "Tagesfunktion", color: "#5fd0d0", defaultOn: true },
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

  const weekDeltas = $derived(
    SCALES.map((scale) => ({ ...scale, ...weekOverWeekDelta(entries, scale.key, today) })),
  );

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
    return ` (${sign}${delta.toFixed(1)})`;
  }
</script>

<section>
  <h2>7-Tage-Mittel (letzte 7 Tage vs. Vorwoche)</h2>
  <ul>
    {#each weekDeltas as scale (scale.key)}
      <li>
        {scale.label}: {scale.current !== null ? scale.current.toFixed(1) : "–"}{formatDelta(scale.delta)}
      </li>
    {/each}
  </ul>
</section>

<section>
  <h2>Verlauf (letzte {LIMIT} Einträge)</h2>
  <fieldset>
    <legend>Serien</legend>
    {#each SCALES as scale (scale.key)}
      <label>
        <input
          type="checkbox"
          checked={selectedScales.has(scale.key)}
          onchange={() => toggleScale(scale.key)}
        />
        <span style="color: {scale.color}">■</span>
        {scale.label}
      </label>
    {/each}
  </fieldset>
  {#if entries.length === 0}
    <p>Noch keine Einträge.</p>
  {:else}
    <svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" role="img" aria-label="Verlauf der ausgewählten Kernskalen">
      {#each scaleSeries as series (series.key)}
        <polyline points={series.points} fill="none" stroke={series.color} stroke-width="2" />
      {/each}
      {#each markers as marker (marker.x + marker.title)}
        <line x1={marker.x} y1={0} x2={marker.x} y2={CHART_HEIGHT} stroke="currentColor" stroke-dasharray="3,3" opacity="0.6">
          <title>{marker.title}</title>
        </line>
      {/each}
    </svg>
    {#if markers.length > 0}
      <ul>
        {#each markers as marker (marker.x + marker.title)}
          <li>{marker.title}</li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<section>
  <h2>ASRS-Verlauf (letzte {CHECK_LIMIT} Wochen-Checks)</h2>
  {#if weeklyChecks.length === 0}
    <p>Noch keine Wochen-Checks.</p>
  {:else}
    <svg viewBox="0 0 {CHART_WIDTH} {SMALL_CHART_HEIGHT}" role="img" aria-label="ASRS-Verlauf">
      <polyline points={asrsPoints} fill="none" stroke="currentColor" stroke-width="2" />
      {#each weeklyMarkers as marker (marker.x + marker.title)}
        <line x1={marker.x} y1={0} x2={marker.x} y2={SMALL_CHART_HEIGHT} stroke="currentColor" stroke-dasharray="3,3" opacity="0.6">
          <title>{marker.title}</title>
        </line>
      {/each}
    </svg>
  {/if}
</section>

<section>
  <h2>PHQ-9-Verlauf (letzte {CHECK_LIMIT} Checks)</h2>
  {#if phq9Checks.length === 0}
    <p>Noch keine PHQ-9-Checks.</p>
  {:else}
    <svg viewBox="0 0 {CHART_WIDTH} {SMALL_CHART_HEIGHT}" role="img" aria-label="PHQ-9-Verlauf">
      <polyline points={phq9Points} fill="none" stroke="currentColor" stroke-width="2" />
      {#each phq9Markers as marker (marker.x + marker.title)}
        <line x1={marker.x} y1={0} x2={marker.x} y2={SMALL_CHART_HEIGHT} stroke="currentColor" stroke-dasharray="3,3" opacity="0.6">
          <title>{marker.title}</title>
        </line>
      {/each}
    </svg>
  {/if}
</section>

<section>
  <h2>Schlaf-Übersicht (letzte {LIMIT} Tage)</h2>
  <p>
    Ø Stunden: {avgSleepHours !== null ? avgSleepHours.toFixed(1) : "–"} ·
    Ø Qualität: {avgSleepQuality !== null ? avgSleepQuality.toFixed(1) : "–"}
  </p>
</section>

<section>
  <h2>Appetit-Übersicht (letzte {LIMIT} Tage)</h2>
  {#if appetiteCounts.length === 0}
    <p>Keine Angaben.</p>
  {:else}
    <ul>
      {#each appetiteCounts as item (item.key)}
        <li>{item.key}: {item.count} Tage</li>
      {/each}
    </ul>
  {/if}
</section>

<section>
  <h2>Nebenwirkungs-Häufigkeit (letzte {LIMIT} Tage)</h2>
  {#if sideEffectCounts.length === 0}
    <p>Keine Nebenwirkungen erfasst.</p>
  {:else}
    <ul>
      {#each sideEffectCounts as item (item.key)}
        <li>{item.key.replace(/_/g, " ")}: {item.count} Tage</li>
      {/each}
    </ul>
  {/if}
</section>

<section>
  <h2>Letzte Einträge</h2>
  {#if entries.length === 0}
    <p>Noch keine Einträge.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Datum</th>
          <th>Medikation</th>
          <th>Fokus</th>
          <th>Stimmung</th>
          <th>Tagesfunktion</th>
        </tr>
      </thead>
      <tbody>
        {#each recentFirst as entry (entry.date)}
          <tr>
            <td>{entry.date}</td>
            <td>{entry.med_taken ? "ja" : "nein"}</td>
            <td>{entry.focus}</td>
            <td>{entry.mood}</td>
            <td>{entry.day_function}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>
