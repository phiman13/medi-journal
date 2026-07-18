<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/db";
  import { toPolylinePoints } from "../lib/chart";
  import type { DailyEntry } from "../lib/dailyEntry";

  const CHART_WIDTH = 600;
  const CHART_HEIGHT = 120;
  const LIMIT = 30;

  let entries = $state<DailyEntry[]>([]);

  async function load(): Promise<void> {
    const all = await db.daily_entries.orderBy("date").toArray();
    entries = all.filter((entry) => !entry.deleted_at).slice(-LIMIT);
  }

  onMount(load);

  const focusPoints = $derived(
    toPolylinePoints(
      entries.map((entry) => entry.focus),
      { width: CHART_WIDTH, height: CHART_HEIGHT, min: 1, max: 10 },
    ),
  );
  const recentFirst = $derived([...entries].reverse());
</script>

<section>
  <h2>Fokus-Verlauf (letzte {LIMIT} Einträge)</h2>
  {#if entries.length === 0}
    <p>Noch keine Einträge.</p>
  {:else}
    <svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" role="img" aria-label="Fokus-Verlauf">
      <polyline points={focusPoints} fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
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
