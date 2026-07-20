<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/db";
  import { saveEvent, SYNCED_EVENT } from "../lib/sync";
  import { emptyEvent, EVENT_TYPES, type JournalEvent } from "../lib/event";
  import { todayInBerlin } from "../lib/dailyEntry";

  const today = todayInBerlin();

  let draft = $state<JournalEvent>(emptyEvent(today));
  let saving = $state(false);
  let savedStatus = $state<"idle" | "local" | "synced">("idle");
  // id des zuletzt gespeicherten Ereignisses - draft wird nach dem Speichern
  // sofort zurückgesetzt, savedStatus muss trotzdem den echten sync_status
  // DIESES Datensatzes zeigen (nicht des neuen leeren Entwurfs).
  let savedEventId = $state<string | null>(null);
  let events = $state<JournalEvent[]>([]);

  async function loadEvents(): Promise<void> {
    const all = await db.events.toArray();
    events = all.filter((event) => !event.deleted_at).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async function refreshSavedStatus(): Promise<void> {
    if (!savedEventId) return;
    const stored = await db.events.get(savedEventId);
    if (stored) savedStatus = stored.sync_status === "synced" ? "synced" : "local";
  }

  onMount(() => {
    loadEvents();
    // saveEvent() wirft bei einem fehlgeschlagenen Push NICHT (bleibt lokal
    // "pending", s. lib/sync.ts) - savedStatus darf sich daher nicht allein
    // aus einem erfolgreichen await ergeben, sondern muss den echten
    // sync_status lesen (per E2E-Test gefunden, s. e2e/tests/).
    const onSynced = (): void => {
      refreshSavedStatus();
    };
    window.addEventListener(SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(SYNCED_EVENT, onSynced);
  });

  async function handleSave(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!draft.title.trim()) return;
    saving = true;
    savedStatus = "local";
    savedEventId = draft.id;
    try {
      await saveEvent($state.snapshot(draft));
      await refreshSavedStatus();
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
  <fieldset class="karte">
    <legend>Neues Ereignis</legend>
    <div class="feld-liste">
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
    </div>
  </fieldset>

  <button type="submit" class="knopf" disabled={saving}>Speichern</button>
  <p class="status-zeile" role="status">
    {#if savedStatus === "synced"}
      lokal gespeichert · synchronisiert ✓
    {:else if savedStatus === "local"}
      lokal gespeichert · synchronisiert …
    {/if}
  </p>
</form>

<section class="karte">
  <h2>Ereignisse</h2>
  {#if events.length === 0}
    <p>Noch keine Ereignisse.</p>
  {:else}
    <ul class="ereignis-liste">
      {#each events as event (event.id)}
        <li><span class="zahl">{event.date}</span> — {event.title}</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .ereignis-liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    font-size: 0.88rem;
  }
</style>
