<script lang="ts">
  import { authenticated } from "./lib/auth";
  import { syncNow } from "./lib/sync";
  import { db } from "./lib/db";
  import { todayInBerlin } from "./lib/dailyEntry";
  import { isWeeklyCheckDue, isPhq9Due, isFallbackBadgeDue } from "./lib/reminders";
  import { isPushSupported, currentPushSubscription, enablePushReminders, disablePushReminders } from "./lib/push";
  import Login from "./components/Login.svelte";
  import DailyEntryForm from "./components/DailyEntryForm.svelte";
  import WeeklyCheckForm from "./components/WeeklyCheckForm.svelte";
  import Phq9Form from "./components/Phq9Form.svelte";
  import EventForm from "./components/EventForm.svelte";
  import Dashboard from "./components/Dashboard.svelte";
  import UpdateBanner from "./components/UpdateBanner.svelte";

  let view = $state<"entry" | "weekly" | "phq9" | "events" | "dashboard">("entry");
  let weeklyCheckDue = $state(false);
  let phq9Due = $state(false);
  let pushSupported = $state(false);
  let pushSubscribed = $state(false);
  let pushBusy = $state(false);
  let pushError = $state<string | null>(null);
  let fallbackBadgeDue = $state(false);

  const TABS = [
    { key: "entry", label: "Eintrag" },
    { key: "weekly", label: "Wochen" },
    { key: "phq9", label: "PHQ-9" },
    { key: "events", label: "Ereignisse" },
    { key: "dashboard", label: "Verlauf" },
  ] as const;

  async function checkDueReminders(): Promise<void> {
    const today = todayInBerlin();

    const weeklyExisting = await db.weekly_checks.toArray();
    weeklyCheckDue = isWeeklyCheckDue(
      today,
      weeklyExisting.map((check) => check.week_start),
    );

    const phq9Existing = await db.phq9_checks.toArray();
    const lastPhq9Date = phq9Existing.map((check) => check.date).sort().at(-1);
    phq9Due = isPhq9Due(today, lastPhq9Date);
  }

  // SPEC.md §4.1: Fallback-Badge nur relevant, wenn keine aktive
  // Push-Subscription existiert - sonst doppelte Nervigkeit (Push + Badge).
  async function checkPushState(): Promise<void> {
    pushSupported = isPushSupported();
    pushSubscribed = pushSupported ? !!(await currentPushSubscription()) : false;

    const allEntries = await db.daily_entries.toArray();
    const lastEntryDate = allEntries
      .filter((entry) => !entry.deleted_at)
      .map((entry) => entry.date)
      .sort()
      .at(-1);
    fallbackBadgeDue = !pushSubscribed && isFallbackBadgeDue(todayInBerlin(), lastEntryDate);
  }

  // MUSS aus einem echten Klick-Handler aufgerufen werden (User-Geste), sonst
  // scheitert Notification.requestPermission() auf iOS/Safari (s. lib/push.ts).
  async function togglePush(): Promise<void> {
    pushError = null;
    pushBusy = true;
    try {
      if (pushSubscribed) {
        await disablePushReminders();
      } else {
        await enablePushReminders();
      }
    } catch (error) {
      pushError = error instanceof Error ? error.message : String(error);
    } finally {
      pushBusy = false;
      await checkPushState();
    }
  }

  // SPEC.md §7 AK1: nach Verbindungsabbruch bleibt ein Eintrag "pending",
  // bis er nachgeschoben wird - das MUSS von selbst passieren, sobald die
  // Verbindung zurück ist, nicht erst beim nächsten manuellen Speichern
  // desselben Datensatzes (per E2E-Test gefunden, s. e2e/tests/).
  $effect(() => {
    if (!$authenticated) return;

    function resync(): void {
      syncNow()
        .catch(() => {
          // offline - kein Problem, IndexedDB ist der Cache (SPEC.md §4.1);
          // pending Einträge bleiben bis zum nächsten "online"-Event liegen
        })
        .finally(() => {
          checkDueReminders();
          checkPushState();
        });
    }

    resync();
    window.addEventListener("online", resync);
    return () => window.removeEventListener("online", resync);
  });
</script>

<UpdateBanner />
{#if $authenticated}
  <main class="seite app-inhalt">
    <!-- Nur für Screenreader: Kartentitel starten sonst direkt bei h2, ohne
         h1 fehlt die Ebene für die Heading-Navigation (M6-Review). Die
         aktuelle Ansicht ist über die Tab-Bar bereits visuell erkennbar. -->
    <h1 class="sr-only">{TABS.find((tab) => tab.key === view)?.label}</h1>
    {#if weeklyCheckDue && view !== "weekly"}
      <div class="hinweis">
        <span>Wochen-Check steht aus.</span>
        <button type="button" class="knopf" onclick={() => (view = "weekly")}>Ausfüllen</button>
      </div>
    {/if}
    {#if phq9Due && view !== "phq9"}
      <div class="hinweis">
        <span>PHQ-9 steht aus.</span>
        <button type="button" class="knopf" onclick={() => (view = "phq9")}>Ausfüllen</button>
      </div>
    {/if}
    {#if fallbackBadgeDue}
      <div class="hinweis">
        <span>Seit mehreren Tagen kein Eintrag.</span>
      </div>
    {/if}
    {#if pushSupported}
      <div class="hinweis">
        <span>{pushSubscribed ? "Erinnerungen sind aktiv." : "Erinnerungen sind aus."}</span>
        <button type="button" class="knopf" onclick={togglePush} disabled={pushBusy}>
          {pushSubscribed ? "Deaktivieren" : "Aktivieren"}
        </button>
      </div>
    {/if}
    {#if pushError}
      <p class="fehler" role="alert">{pushError}</p>
    {/if}

    {#if view === "entry"}
      <DailyEntryForm />
    {:else if view === "weekly"}
      <WeeklyCheckForm />
    {:else if view === "phq9"}
      <Phq9Form />
    {:else if view === "events"}
      <EventForm />
    {:else}
      <Dashboard />
    {/if}
  </main>

  <nav class="tabbar" aria-label="Hauptnavigation">
    {#each TABS as tab (tab.key)}
      <button
        type="button"
        class:aktiv={view === tab.key}
        aria-current={view === tab.key}
        onclick={() => (view = tab.key)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          {#if tab.key === "entry"}
            <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16M9 4v6" />
          {:else if tab.key === "weekly"}
            <path d="M4 19V10l8-6 8 6v9" /><path d="M9 19v-6h6v6" />
          {:else if tab.key === "phq9"}
            <circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" />
          {:else if tab.key === "events"}
            <path
              d="M12 21s-7-4.6-9.5-9C1 8.5 3 5 6.5 5c2 0 3.3 1.1 5.5 3.2C14.2 6.1 15.5 5 17.5 5 21 5 23 8.5 21.5 12c-2.5 4.4-9.5 9-9.5 9Z"
            />
          {:else}
            <path d="M4 19h16M7 19V9m5 10V5m5 14v-7" />
          {/if}
        </svg>
        <span>{tab.label}{(tab.key === "weekly" && weeklyCheckDue) || (tab.key === "phq9" && phq9Due) ? " •" : ""}</span>
      </button>
    {/each}
  </nav>
{:else}
  <Login />
{/if}

<style>
  .app-inhalt {
    padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
  }

  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    background: var(--papier-hoch);
    border-top: 1px solid var(--papier-linie);
    padding: 0.45rem 0.3rem calc(0.55rem + env(safe-area-inset-bottom, 0px));
    z-index: 10;
  }
  .tabbar button {
    all: unset;
    box-sizing: border-box;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.62rem;
    color: var(--tinte-matt);
    padding: 0.3rem 0.1rem;
    cursor: pointer;
    border-radius: 10px;
  }
  .tabbar button.aktiv {
    color: var(--ruhe);
  }
  .tabbar svg {
    width: 21px;
    height: 21px;
  }
</style>
