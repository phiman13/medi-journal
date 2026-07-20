<script lang="ts">
  import { useRegisterSW } from "virtual:pwa-register/svelte";

  // SPEC.md §4.1: "Update-Flow mit 'Neue Version verfügbar'-Hinweis".
  const { needRefresh, updateServiceWorker } = useRegisterSW();
</script>

{#if $needRefresh}
  <div class="update-banner" role="alert">
    <span>Neue Version verfügbar.</span>
    <button type="button" class="knopf" onclick={() => updateServiceWorker(true)}>Aktualisieren</button>
  </div>
{/if}

<style>
  .update-banner {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    background: var(--ruhe);
    color: var(--papier-hoch);
    font-size: 0.85rem;
    padding: 0.65rem 1.1rem;
  }
  .update-banner .knopf {
    background: var(--papier-hoch);
    color: var(--tinte);
    padding: 0.4rem 0.9rem;
    font-size: 0.78rem;
    min-height: auto;
    white-space: nowrap;
  }
</style>
