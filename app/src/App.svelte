<script lang="ts">
  import { authenticated } from "./lib/auth";
  import { pullChanges } from "./lib/sync";
  import Login from "./components/Login.svelte";
  import DailyEntryForm from "./components/DailyEntryForm.svelte";
  import Dashboard from "./components/Dashboard.svelte";

  let view = $state<"entry" | "dashboard">("entry");

  $effect(() => {
    if ($authenticated) {
      pullChanges().catch(() => {
        // offline beim Start - kein Problem, IndexedDB ist der Cache (SPEC.md §4.1)
      });
    }
  });
</script>

<main>
  {#if $authenticated}
    <nav>
      <button type="button" onclick={() => (view = "entry")} aria-current={view === "entry"}>
        Eintrag
      </button>
      <button type="button" onclick={() => (view = "dashboard")} aria-current={view === "dashboard"}>
        Verlauf
      </button>
    </nav>
    {#if view === "entry"}
      <DailyEntryForm />
    {:else}
      <Dashboard />
    {/if}
  {:else}
    <Login />
  {/if}
</main>
