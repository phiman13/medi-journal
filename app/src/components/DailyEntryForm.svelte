<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/db";
  import { saveEntry } from "../lib/sync";
  import { emptyEntry, todayInBerlin, SIDE_EFFECTS, FLAGS, type DailyEntry } from "../lib/dailyEntry";

  const today = todayInBerlin();

  let date = $state(today);
  let entry = $state<DailyEntry>(emptyEntry(today));
  let saving = $state(false);
  let savedStatus = $state<"idle" | "local" | "synced">("idle");

  async function findPreviousValue(
    beforeDate: string,
    field: "med_dose_mg" | "quetiapine_dose_mg",
  ): Promise<number | null> {
    const priorEntries = await db.daily_entries.where("date").below(beforeDate).toArray();
    priorEntries.sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const prior of priorEntries) {
      if (prior[field] != null) return prior[field] as number;
    }
    return null;
  }

  async function loadEntry(forDate: string): Promise<void> {
    const existing = await db.daily_entries.get(forDate);
    if (existing) {
      entry = existing;
      savedStatus = existing.sync_status === "synced" ? "synced" : "local";
      return;
    }

    const fresh = emptyEntry(forDate);
    fresh.med_dose_mg = await findPreviousValue(forDate, "med_dose_mg");
    fresh.quetiapine_dose_mg = await findPreviousValue(forDate, "quetiapine_dose_mg");
    entry = fresh;
    savedStatus = "idle";
  }

  onMount(() => {
    loadEntry(date);
  });

  function goToDate(newDate: string): void {
    if (newDate > today) return; // Zukunft gesperrt (SPEC.md §5.1)
    date = newDate;
    loadEntry(newDate);
  }

  function shiftDay(deltaDays: number): void {
    const shifted = new Date(`${date}T00:00:00`);
    shifted.setDate(shifted.getDate() + deltaDays);
    goToDate(shifted.toISOString().slice(0, 10));
  }

  async function handleSave(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    saving = true;
    savedStatus = "local";
    await saveEntry(entry);
    const stored = await db.daily_entries.get(entry.date);
    savedStatus = stored?.sync_status === "synced" ? "synced" : "local";
    saving = false;
  }

  function toggleInList(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
  }
</script>

<form onsubmit={handleSave}>
  <header>
    <button type="button" onclick={() => shiftDay(-1)} aria-label="Vorheriger Tag">←</button>
    <input type="date" bind:value={date} max={today} onchange={() => goToDate(date)} />
    <button type="button" onclick={() => shiftDay(1)} disabled={date >= today} aria-label="Nächster Tag">→</button>
  </header>

  <fieldset>
    <legend>Medikation</legend>
    <label><input type="checkbox" bind:checked={entry.med_taken} /> Elvanse eingenommen</label>
    {#if entry.med_taken}
      <label>
        Dosis (mg)
        <input type="number" bind:value={entry.med_dose_mg} min="0" />
      </label>
      <label>
        Einnahmezeit
        <input type="time" bind:value={entry.med_time} />
      </label>
      <label>
        Wirkung ließ nach um
        <input type="time" bind:value={entry.wear_off_time} />
      </label>
    {/if}
    <label><input type="checkbox" bind:checked={entry.quetiapine_taken} /> Quetiapin eingenommen</label>
    {#if entry.quetiapine_taken}
      <label>
        Dosis (mg)
        <input type="number" bind:value={entry.quetiapine_dose_mg} min="0" />
      </label>
    {/if}
  </fieldset>

  <fieldset>
    <legend>Fokus / Ablenkbarkeit ({entry.focus})</legend>
    <input type="range" min="1" max="10" bind:value={entry.focus} />
  </fieldset>
  <fieldset>
    <legend>Ins Tun kommen ({entry.task_initiation})</legend>
    <input type="range" min="1" max="10" bind:value={entry.task_initiation} />
  </fieldset>
  <fieldset>
    <legend>Innere Ruhe ({entry.inner_calm})</legend>
    <input type="range" min="1" max="10" bind:value={entry.inner_calm} />
  </fieldset>
  <fieldset>
    <legend>Emotionale Ausgeglichenheit ({entry.emotional_stability})</legend>
    <input type="range" min="1" max="10" bind:value={entry.emotional_stability} />
  </fieldset>
  <fieldset>
    <legend>Stimmung ({entry.mood})</legend>
    <input type="range" min="1" max="10" bind:value={entry.mood} />
  </fieldset>
  <fieldset>
    <legend>Tagesfunktion gesamt ({entry.day_function})</legend>
    <input type="range" min="1" max="10" bind:value={entry.day_function} />
  </fieldset>

  <label>
    Was habe ich geschafft?
    <textarea bind:value={entry.accomplished}></textarea>
  </label>

  <fieldset>
    <legend>Schlaf (letzte Nacht)</legend>
    <label>
      Stunden
      <input type="number" step="0.5" min="0" max="24" bind:value={entry.sleep_hours} />
    </label>
    <label>
      Qualität (1–10)
      <input type="range" min="1" max="10" bind:value={entry.sleep_quality} />
    </label>
  </fieldset>

  <fieldset>
    <legend>Körper</legend>
    <label>
      Appetit
      <select bind:value={entry.appetite}>
        <option value={null}></option>
        <option value="normal">normal</option>
        <option value="reduziert">reduziert</option>
        <option value="stark_reduziert">stark reduziert</option>
      </select>
    </label>
    <label>
      Ruhepuls (bpm)
      <input type="number" bind:value={entry.resting_hr} min="0" />
    </label>
    <label>
      Blutdruck systolisch
      <input type="number" bind:value={entry.bp_sys} min="0" />
    </label>
    <label>
      Blutdruck diastolisch
      <input type="number" bind:value={entry.bp_dia} min="0" />
    </label>
  </fieldset>

  <fieldset>
    <legend>Kontext</legend>
    <label>
      Koffeinportionen
      <input type="number" bind:value={entry.caffeine_units} min="0" />
    </label>
    <label><input type="checkbox" bind:checked={entry.alcohol} /> Alkohol konsumiert</label>
  </fieldset>

  <fieldset>
    <legend>Nebenwirkungen</legend>
    {#each SIDE_EFFECTS as key (key)}
      <label>
        <input
          type="checkbox"
          checked={entry.side_effects.includes(key)}
          onchange={() => (entry.side_effects = toggleInList(entry.side_effects, key))}
        />
        {key.replace(/_/g, " ")}
      </label>
    {/each}
    <label>
      Sonstiges
      <input type="text" bind:value={entry.side_effects_other} />
    </label>
    {#each FLAGS as key (key)}
      <label>
        <input
          type="checkbox"
          checked={entry.flags.includes(key)}
          onchange={() => (entry.flags = toggleInList(entry.flags, key))}
        />
        {key.replace(/_/g, " ")}
      </label>
    {/each}
  </fieldset>

  <label>
    Notizen
    <textarea bind:value={entry.notes}></textarea>
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
