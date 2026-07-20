<script lang="ts">
  // Ersetzt native <select>-Dropdowns für ASRS-6/PHQ-9-Antworten - horizontale
  // Auswahlreihe im selben "Messskala"-Vokabular wie Skala.svelte, größere
  // Touch-Targets als ein Dropdown (SPEC.md §6).
  let {
    frage,
    value = $bindable(),
    optionen,
    name,
  }: {
    frage: string;
    value: number;
    optionen: { value: number; label: string }[];
    name: string;
  } = $props();
</script>

<fieldset class="antwortreihe">
  <legend>{frage}</legend>
  <div class="optionen" role="radiogroup" aria-label={frage}>
    {#each optionen as option (option.value)}
      <label class="option" class:aktiv={value === option.value}>
        <input type="radio" {name} value={option.value} bind:group={value} />
        <span>{option.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .antwortreihe {
    border: none;
    margin: 0 0 1.15rem;
    padding: 0;
  }
  .antwortreihe legend {
    font-size: 0.87rem;
    padding: 0 0 0.55rem;
    text-wrap: pretty;
  }
  .optionen {
    display: flex;
    gap: 0.4rem;
  }
  .option {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-family: var(--mono);
    font-size: 0.66rem;
    line-height: 1.25;
    padding: 0.55rem 0.3rem;
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid var(--papier-linie);
    color: var(--tinte-matt);
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background-color 150ms ease,
      color 150ms ease;
  }
  .option.aktiv {
    border-color: var(--ruhe);
    background: var(--ruhe-fläche);
    /* Text in --tinte statt --ruhe (M6-Review, Kontrast): s. Kommentar zu
       .hinweis in app.css - derselbe Fall bei getönten Pill-Flächen. */
    color: var(--tinte);
    font-weight: 700;
  }
  .option input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
  .option:has(input:focus-visible) {
    outline: 2px solid var(--ruhe);
    outline-offset: 2px;
  }
</style>
