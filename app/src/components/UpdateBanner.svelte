<script lang="ts">
  import { useRegisterSW } from "virtual:pwa-register/svelte";

  // SPEC.md §4.1: "Update-Flow mit 'Neue Version verfügbar'-Hinweis".
  const { needRefresh, updateServiceWorker } = useRegisterSW();
</script>

{#if $needRefresh}
  <div role="alert">
    <span>Neue Version verfügbar.</span>
    <button type="button" onclick={() => updateServiceWorker(true)}>Aktualisieren</button>
  </div>
{/if}
