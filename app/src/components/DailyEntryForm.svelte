<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/db";
  import { saveEntry } from "../lib/sync";
  import {
    emptyEntry,
    todayInBerlin,
    addDays,
    SIDE_EFFECTS,
    FLAGS,
    type DailyEntry,
  } from "../lib/dailyEntry";
  import Skala from "./Skala.svelte";

  const today = todayInBerlin();

  let date = $state(today);
  let entry = $state<DailyEntry>(emptyEntry(today));
  let saving = $state(false);
  let savedStatus = $state<"idle" | "local" | "synced">("idle");
  let saveError = $state<string | null>(null);

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
    goToDate(addDays(date, deltaDays));
  }

  async function handleSave(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    saving = true;
    savedStatus = "local";
    saveError = null;
    try {
      // $state.snapshot(): Dexie/IndexedDB (structured clone) kann den
      // reaktiven $state-Proxy nicht klonen - ohne Snapshot schlägt der
      // Schreibvorgang unbemerkt fehl (Svelte-5-Falle).
      await saveEntry($state.snapshot(entry));
      const stored = await db.daily_entries.get(entry.date);
      savedStatus = stored?.sync_status === "synced" ? "synced" : "local";
    } catch (error) {
      console.error("Speichern fehlgeschlagen", error);
      savedStatus = "idle";
      saveError = "Speichern fehlgeschlagen. Bitte erneut versuchen.";
    } finally {
      saving = false;
    }
  }

  function toggleInList(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
  }
</script>

<form onsubmit={handleSave}>
  <header class="datum-kopf">
    <button type="button" class="knopf leise" onclick={() => shiftDay(-1)} aria-label="Vorheriger Tag">←</button>
    <input type="date" bind:value={date} max={today} onchange={() => goToDate(date)} />
    <button
      type="button"
      class="knopf leise"
      onclick={() => shiftDay(1)}
      disabled={date >= today}
      aria-label="Nächster Tag"
    >
      →
    </button>
  </header>

  <fieldset class="karte">
    <legend>Medikation</legend>
    <label class="checkbox-zeile"><input type="checkbox" bind:checked={entry.med_taken} /> Elvanse eingenommen</label>
    {#if entry.med_taken}
      <div class="feld-liste einzug">
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
      </div>
    {/if}
    <label class="checkbox-zeile abstand"
      ><input type="checkbox" bind:checked={entry.quetiapine_taken} /> Quetiapin eingenommen</label
    >
    {#if entry.quetiapine_taken}
      <div class="feld-liste einzug">
        <label>
          Dosis (mg)
          <input type="number" bind:value={entry.quetiapine_dose_mg} min="0" />
        </label>
      </div>
    {/if}
  </fieldset>

  <fieldset class="karte">
    <legend>Kernskalen</legend>
    <Skala id="entry-focus" label="Fokus / Ablenkbarkeit" bind:value={entry.focus} />
    <Skala id="entry-task" label="Ins Tun kommen" bind:value={entry.task_initiation} />
    <Skala id="entry-calm" label="Innere Ruhe" bind:value={entry.inner_calm} />
    <Skala id="entry-stability" label="Emotionale Ausgeglichenheit" bind:value={entry.emotional_stability} />
    <Skala id="entry-mood" label="Stimmung" bind:value={entry.mood} />
    <Skala id="entry-function" label="Tagesfunktion gesamt" bind:value={entry.day_function} />
  </fieldset>

  <fieldset class="karte">
    <legend>Was habe ich geschafft?</legend>
    <textarea bind:value={entry.accomplished} aria-label="Was habe ich geschafft?"></textarea>
  </fieldset>

  <fieldset class="karte">
    <legend>Schlaf (letzte Nacht)</legend>
    <div class="feld-liste">
      <label>
        Stunden
        <input type="number" step="0.5" min="0" max="24" bind:value={entry.sleep_hours} />
      </label>
    </div>
    <Skala id="entry-sleep" label="Qualität" bind:value={entry.sleep_quality} />
  </fieldset>

  <fieldset class="karte">
    <legend>Körper</legend>
    <div class="feld-liste">
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
    </div>
  </fieldset>

  <fieldset class="karte">
    <legend>Kontext</legend>
    <div class="feld-liste">
      <label>
        Koffeinportionen
        <input type="number" bind:value={entry.caffeine_units} min="0" />
      </label>
    </div>
    <label class="checkbox-zeile abstand"><input type="checkbox" bind:checked={entry.alcohol} /> Alkohol konsumiert</label>
  </fieldset>

  <fieldset class="karte">
    <legend>Nebenwirkungen</legend>
    <div class="chip-liste">
      {#each SIDE_EFFECTS as key (key)}
        <label class="chip" class:aktiv={entry.side_effects.includes(key)}>
          <input
            type="checkbox"
            checked={entry.side_effects.includes(key)}
            onchange={() => (entry.side_effects = toggleInList(entry.side_effects, key))}
          />
          {key.replace(/_/g, " ")}
        </label>
      {/each}
    </div>
    <div class="feld-liste abstand">
      <label>
        Sonstiges
        <input type="text" bind:value={entry.side_effects_other} />
      </label>
    </div>
    <p class="eyebrow abstand">Flags</p>
    <div class="chip-liste">
      {#each FLAGS as key (key)}
        <label class="chip" class:aktiv={entry.flags.includes(key)}>
          <input
            type="checkbox"
            checked={entry.flags.includes(key)}
            onchange={() => (entry.flags = toggleInList(entry.flags, key))}
          />
          {key.replace(/_/g, " ")}
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="karte">
    <legend>Notizen</legend>
    <textarea bind:value={entry.notes} aria-label="Notizen"></textarea>
  </fieldset>

  <button type="submit" class="knopf" disabled={saving}>Speichern</button>
  <p class="status-zeile" role="status">
    {#if savedStatus === "synced"}
      lokal gespeichert · synchronisiert ✓
    {:else if savedStatus === "local"}
      lokal gespeichert · synchronisiert …
    {/if}
  </p>
  {#if saveError}
    <p class="fehler" role="alert">{saveError}</p>
  {/if}
</form>

<style>
  .datum-kopf {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
    margin-bottom: 1.1rem;
  }
  .datum-kopf input[type="date"] {
    width: auto;
    font-family: var(--mono);
    text-align: center;
  }

  .einzug {
    margin-top: 0.85rem;
    padding-left: 0.2rem;
  }
  .abstand {
    margin-top: 0.85rem;
  }

  .chip-liste {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  /* min-height 44px (M6-Review, ui-ux-pro-max) - Touch-Target-Mindestgröße
     auch für die Nebenwirkungs-/Flags-Chips, s. .checkbox-zeile in app.css. */
  .chip {
    display: inline-flex;
    align-items: center;
    font-size: 0.8rem;
    padding: 0.45rem 0.8rem;
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
    border-color: var(--dosis);
    background: var(--dosis-fläche);
    /* Text in --tinte statt --dosis (M6-Review, Kontrast): s. Kommentar zu
       .hinweis in app.css - derselbe Fall bei getönten Chip-Flächen. */
    color: var(--tinte);
    font-weight: 600;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
</style>
