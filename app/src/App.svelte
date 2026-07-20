<script lang="ts">
  import { authenticated } from "./lib/auth";
  import { pullChanges } from "./lib/sync";
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

  $effect(() => {
    if ($authenticated) {
      pullChanges()
        .catch(() => {
          // offline beim Start - kein Problem, IndexedDB ist der Cache (SPEC.md §4.1)
        })
        .finally(() => {
          checkDueReminders();
          checkPushState();
        });
    }
  });
</script>

<main>
  <UpdateBanner />
  {#if $authenticated}
    <nav>
      <button type="button" onclick={() => (view = "entry")} aria-current={view === "entry"}>
        Eintrag
      </button>
      <button type="button" onclick={() => (view = "weekly")} aria-current={view === "weekly"}>
        Wochen-Check{weeklyCheckDue ? " •" : ""}
      </button>
      <button type="button" onclick={() => (view = "phq9")} aria-current={view === "phq9"}>
        PHQ-9{phq9Due ? " •" : ""}
      </button>
      <button type="button" onclick={() => (view = "events")} aria-current={view === "events"}>
        Ereignisse
      </button>
      <button type="button" onclick={() => (view = "dashboard")} aria-current={view === "dashboard"}>
        Verlauf
      </button>
    </nav>
    {#if weeklyCheckDue && view !== "weekly"}
      <p role="status">
        Wochen-Check steht aus. <button type="button" onclick={() => (view = "weekly")}>Jetzt ausfüllen</button>
      </p>
    {/if}
    {#if phq9Due && view !== "phq9"}
      <p role="status">
        PHQ-9 steht aus. <button type="button" onclick={() => (view = "phq9")}>Jetzt ausfüllen</button>
      </p>
    {/if}
    {#if fallbackBadgeDue}
      <p role="status">Seit mehreren Tagen kein Eintrag.</p>
    {/if}
    {#if pushSupported}
      <p>
        <button type="button" onclick={togglePush} disabled={pushBusy}>
          {pushSubscribed ? "Erinnerungen deaktivieren" : "Erinnerungen aktivieren"}
        </button>
        {#if pushError}
          <span role="alert">{pushError}</span>
        {/if}
      </p>
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
  {:else}
    <Login />
  {/if}
</main>
