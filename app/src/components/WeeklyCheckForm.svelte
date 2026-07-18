<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/db";
  import { saveWeeklyCheck } from "../lib/sync";
  import { emptyWeeklyCheck, ASRS_QUESTIONS, mondayOfWeek, type WeeklyCheck } from "../lib/weeklyCheck";
  import { addDays, todayInBerlin } from "../lib/dailyEntry";
  import { mostRecentlyCompletedWeekStart } from "../lib/reminders";

  const today = todayInBerlin();
  const dueWeekStart = mostRecentlyCompletedWeekStart(today);

  let weekStart = $state(dueWeekStart);
  let check = $state<WeeklyCheck>(emptyWeeklyCheck(dueWeekStart));
  let saving = $state(false);
  let savedStatus = $state<"idle" | "local" | "synced">("idle");
  let previousScore = $state<number | null>(null);

  async function loadWeek(forWeekStart: string): Promise<void> {
    const existing = await db.weekly_checks.get(forWeekStart);
    check = existing ?? emptyWeeklyCheck(forWeekStart);
    savedStatus = existing ? (existing.sync_status === "synced" ? "synced" : "local") : "idle";

    const previous = await db.weekly_checks.get(mondayOfWeek(addDays(forWeekStart, -7)));
    previousScore = previous?.asrs_score ?? null;
  }

  onMount(() => {
    loadWeek(weekStart);
  });

  function goToWeek(newWeekStart: string): void {
    if (newWeekStart > dueWeekStart) return; // keine zukünftigen Wochen
    weekStart = newWeekStart;
    loadWeek(newWeekStart);
  }

  function shiftWeek(deltaWeeks: number): void {
    goToWeek(addDays(weekStart, deltaWeeks * 7));
  }

  async function handleSave(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    saving = true;
    savedStatus = "local";
    try {
      await saveWeeklyCheck($state.snapshot(check));
      const stored = await db.weekly_checks.get(check.week_start);
      savedStatus = stored?.sync_status === "synced" ? "synced" : "local";
      if (stored) check = stored;
    } catch (error) {
      console.error("Speichern fehlgeschlagen", error);
      savedStatus = "idle";
    } finally {
      saving = false;
    }
  }
</script>

<form onsubmit={handleSave}>
  <header>
    <button type="button" onclick={() => shiftWeek(-1)} aria-label="Vorherige Woche">←</button>
    <span>Woche ab {weekStart}</span>
    <button type="button" onclick={() => shiftWeek(1)} disabled={weekStart >= dueWeekStart} aria-label="Nächste Woche">
      →
    </button>
  </header>

  <fieldset>
    <legend>ASRS-6 (letzte 7 Tage)</legend>
    {#each ASRS_QUESTIONS as question, index (question)}
      <div>
        <label for={`asrs-${index}`}>{question}</label>
        <select id={`asrs-${index}`} bind:value={check.asrs[index]}>
          <option value={0}>nie</option>
          <option value={1}>selten</option>
          <option value={2}>manchmal</option>
          <option value={3}>oft</option>
          <option value={4}>sehr oft</option>
        </select>
      </div>
    {/each}
  </fieldset>

  <p role="status">
    ASRS {check.asrs.reduce((sum, value) => sum + value, 0)}
    {#if previousScore !== null}
      → vor einer Woche {previousScore}
    {/if}
  </p>

  <fieldset>
    <legend>Wochenmessung</legend>
    <label>
      Gewicht (kg)
      <input type="number" step="0.1" bind:value={check.weight_kg} />
    </label>
    <label>
      Blutdruck systolisch
      <input type="number" bind:value={check.bp_sys} />
    </label>
    <label>
      Blutdruck diastolisch
      <input type="number" bind:value={check.bp_dia} />
    </label>
    <label>
      Puls
      <input type="number" bind:value={check.hr} />
    </label>
    <label>
      Geschätzte Wirkdauer (Stunden)
      <input type="number" step="0.5" bind:value={check.effect_duration_h} />
    </label>
  </fieldset>

  <label>
    Gesamteindruck gegenüber Vorwoche
    <select bind:value={check.week_rating}>
      <option value={null}></option>
      <option value="deutlich_besser">deutlich besser</option>
      <option value="etwas_besser">etwas besser</option>
      <option value="gleich">gleich</option>
      <option value="schlechter">schlechter</option>
    </select>
  </label>

  <label>
    Notizen
    <textarea bind:value={check.notes}></textarea>
  </label>

  <button type="submit" disabled={saving}>Speichern</button>
  <p role="status">
    {#if savedStatus === "synced"}
      lokal gespeichert · synchronisiert ✓
    {:else if savedStatus === "local"}
      lokal gespeichert · synchronisiert …
    {/if}
  </p>
</form>
