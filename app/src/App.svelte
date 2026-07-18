<script lang="ts">
  import { authenticated } from "./lib/auth";
  import { pullChanges } from "./lib/sync";
  import { db } from "./lib/db";
  import { todayInBerlin } from "./lib/dailyEntry";
  import { isWeeklyCheckDue, isPhq9Due } from "./lib/reminders";
  import Login from "./components/Login.svelte";
  import DailyEntryForm from "./components/DailyEntryForm.svelte";
  import WeeklyCheckForm from "./components/WeeklyCheckForm.svelte";
  import Phq9Form from "./components/Phq9Form.svelte";
  import Dashboard from "./components/Dashboard.svelte";
  import UpdateBanner from "./components/UpdateBanner.svelte";

  let view = $state<"entry" | "weekly" | "phq9" | "dashboard">("entry");
  let weeklyCheckDue = $state(false);
  let phq9Due = $state(false);

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

  $effect(() => {
    if ($authenticated) {
      pullChanges()
        .catch(() => {
          // offline beim Start - kein Problem, IndexedDB ist der Cache (SPEC.md §4.1)
        })
        .finally(checkDueReminders);
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
    {#if view === "entry"}
      <DailyEntryForm />
    {:else if view === "weekly"}
      <WeeklyCheckForm />
    {:else if view === "phq9"}
      <Phq9Form />
    {:else}
      <Dashboard />
    {/if}
  {:else}
    <Login />
  {/if}
</main>
