<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/db";
  import { saveEvent } from "../lib/sync";
  import { emptyEvent, EVENT_TYPES, type JournalEvent } from "../lib/event";
  import { todayInBerlin } from "../lib/dailyEntry";

  const today = todayInBerlin();

  let draft = $state<JournalEvent>(emptyEvent(today));
  let saving = $state(false);
  let savedStatus = $state<"idle" | "local" | "synced">("idle");
  let events = $state<JournalEvent[]>([]);

  async function loadEvents(): Promise<void> {
    const all = await db.events.toArray();
    events = all.filter((event) => !event.deleted_at).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  onMount(() => {
    loadEvents();
  });

  async function handleSave(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!draft.title.trim()) return;
    saving = true;
    savedStatus = "local";
    try {
      await saveEvent($state.snapshot(draft));
      savedStatus = "synced";
      draft = emptyEvent(today);
      await loadEvents();
    } catch (error) {
      console.error("Speichern fehlgeschlagen", error);
      savedStatus = "idle";
    } finally {
      saving = false;
    }
  }
</script>

<form onsubmit={handleSave}>
  <fieldset>
    <legend>Neues Ereignis</legend>
    <label>
      Datum
      <input type="date" bind:value={draft.date} max={today} />
    </label>
    <label>
      Typ
      <select bind:value={draft.type}>
        {#each EVENT_TYPES as { value, label } (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
    <label>
      Titel
      <input type="text" bind:value={draft.title} placeholder="z. B. Elvanse 30 → 50 mg" required />
    </label>
    <label>
      Details
      <textarea bind:value={draft.details}></textarea>
    </label>
  </fieldset>

  <button type="submit" disabled={saving}>Speichern</button>
  <p role="status">
    {#if savedStatus === "synced"}
      lokal gespeichert · synchronisiert ✓
    {:else if savedStatus === "local"}
      lokal gespeichert · synchronisiert …
    {/if}
  </p>
</form>

<section>
  <h2>Ereignisse</h2>
  {#if events.length === 0}
    <p>Noch keine Ereignisse.</p>
  {:else}
    <ul>
      {#each events as event (event.id)}
        <li>{event.date} — {event.title}</li>
      {/each}
    </ul>
  {/if}
</section>
