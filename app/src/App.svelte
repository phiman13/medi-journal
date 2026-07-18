<script lang="ts">
  import { authenticated } from "./lib/auth";
  import { pullChanges } from "./lib/sync";
  import Login from "./components/Login.svelte";
  import DailyEntryForm from "./components/DailyEntryForm.svelte";

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
    <DailyEntryForm />
  {:else}
    <Login />
  {/if}
</main>
