<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "../lib/db";
  import { savePhq9Check } from "../lib/sync";
  import { emptyPhq9Check, PHQ9_QUESTIONS, PHQ9_ITEM_9_INDEX, phq9Severity, type Phq9Check } from "../lib/phq9";
  import { todayInBerlin } from "../lib/dailyEntry";
  import Antwortreihe from "./Antwortreihe.svelte";

  const PHQ9_OPTIONEN = [
    { value: 0, label: "überhaupt nicht" },
    { value: 1, label: "an einzelnen Tagen" },
    { value: 2, label: "an mehr als der Hälfte der Tage" },
    { value: 3, label: "beinahe jeden Tag" },
  ];

  const today = todayInBerlin();

  let date = $state(today);
  let check = $state<Phq9Check>(emptyPhq9Check(today));
  let saving = $state(false);
  let savedStatus = $state<"idle" | "local" | "synced">("idle");
  let previousScore = $state<number | null>(null);

  const score = $derived(check.answers.reduce((sum, value) => sum + value, 0));
  const severity = $derived(phq9Severity(score));
  // SPEC.md §3.3: Item 9 > 0 -> unaufdringlicher Hinweis mit Krisenkontakten,
  // kein Alarmismus, keine Blockade der App (Speichern bleibt normal möglich).
  const showCrisisHint = $derived(check.answers[PHQ9_ITEM_9_INDEX] > 0);

  async function loadCheck(forDate: string): Promise<void> {
    const existing = await db.phq9_checks.get(forDate);
    check = existing ?? emptyPhq9Check(forDate);
    savedStatus = existing ? (existing.sync_status === "synced" ? "synced" : "local") : "idle";

    const earlier = await db.phq9_checks.where("date").below(forDate).toArray();
    earlier.sort((a, b) => (a.date < b.date ? 1 : -1));
    previousScore = earlier[0]?.score ?? null;
  }

  onMount(() => {
    loadCheck(date);
  });

  function goToDate(newDate: string): void {
    if (newDate > today) return; // Zukunft gesperrt
    date = newDate;
    loadCheck(newDate);
  }

  async function handleSave(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    saving = true;
    savedStatus = "local";
    try {
      await savePhq9Check($state.snapshot(check));
      const stored = await db.phq9_checks.get(check.date);
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
  <header class="datum-kopf">
    <input type="date" bind:value={date} max={today} onchange={() => goToDate(date)} />
  </header>

  <div class="karte">
    <h2>PHQ-9 (letzte 2 Wochen)</h2>
    {#each PHQ9_QUESTIONS as question, index (question)}
      <Antwortreihe frage={question} name={`phq9-${index}`} optionen={PHQ9_OPTIONEN} bind:value={check.answers[index]} />
    {/each}
  </div>

  {#if showCrisisHint}
    <p class="warnhinweis" role="status">
      Du hast bei Frage 9 eine Belastung angegeben. Falls du gerade in einer Krise steckst: Telefonseelsorge
      0800 111 0 111 oder 116 123 (kostenlos, rund um die Uhr). Sprich das auch bei deiner nächsten
      ärztlichen Vorstellung an.
    </p>
  {/if}

  <p class="status-zeile" role="status">
    PHQ-9 <span class="zahl">{score}</span> ({severity})
    {#if previousScore !== null}
      → zuletzt <span class="zahl">{previousScore}</span>
    {/if}
  </p>

  <button type="submit" class="knopf" disabled={saving}>Speichern</button>
  <p class="status-zeile" role="status">
    {#if savedStatus === "synced"}
      lokal gespeichert · synchronisiert ✓
    {:else if savedStatus === "local"}
      lokal gespeichert · synchronisiert …
    {/if}
  </p>
</form>

<style>
  .datum-kopf {
    display: flex;
    justify-content: center;
    margin-bottom: 1.1rem;
  }
  .datum-kopf input[type="date"] {
    width: auto;
    font-family: var(--mono);
    text-align: center;
  }
</style>
