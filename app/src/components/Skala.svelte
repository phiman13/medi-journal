<script lang="ts">
  // Signature-Komponente des M6-Redesigns ("Dosier-Skala"): ersetzt native
  // <input type="range"> für alle 1-10-Kernskalen. Strichskala + große
  // Ziehfläche (SPEC.md §6, große Touch-Targets) + Live-Zahlwert in der
  // Mono-Schrift, in Anlehnung an eine Dosier-/Messspritze.
  // `value` ist bewusst number|null: manche Skalen sind optionale Felder
  // (z. B. entry.sleep_quality), null bedeutet "noch nicht erfasst" und darf
  // nicht durch bloßes Rendern der Skala unbemerkt zu einem echten Wert
  // werden (SPEC.md-Nullhandling, s. dashboardStats.ts). Deshalb kein
  // bind:value auf das native Element, sondern value/oninput getrennt: nur
  // eine echte Nutzer-Interaktion schreibt einen Wert zurück.
  let {
    label,
    value = $bindable(),
    min = 1,
    max = 10,
    minLabel = "gering",
    maxLabel = "hoch",
    id,
  }: {
    label: string;
    value: number | null;
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
    id: string;
  } = $props();

  const angezeigterWert = $derived(value ?? Math.round((min + max) / 2));
  const fill = $derived(((angezeigterWert - min) / (max - min)) * 100);
  const ticks = $derived(Array.from({ length: max - min + 1 }, (_, i) => min + i));
</script>

<div class="skala">
  <div class="skala-kopf">
    <label for={id}>{label}</label>
    <span class="skala-wert zahl">{value ?? "–"}</span>
  </div>
  <div class="skala-spur-wrap">
    <div class="skala-striche" aria-hidden="true">
      {#each ticks as tick (tick)}
        <span class:groß={(tick - min) % 5 === 0}></span>
      {/each}
    </div>
    <input
      class="skala-eingabe"
      {id}
      type="range"
      {min}
      {max}
      value={angezeigterWert}
      oninput={(event) => (value = event.currentTarget.valueAsNumber)}
      style:--fill="{fill}%"
    />
  </div>
  <div class="skala-enden">
    <span>{min} {minLabel}</span>
    <span>{max} {maxLabel}</span>
  </div>
</div>

<style>
  .skala {
    margin-top: 1.1rem;
  }
  .skala:first-child {
    margin-top: 0;
  }
  .skala-kopf {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.4rem;
    gap: 0.75rem;
  }
  .skala-kopf label {
    font-size: 0.92rem;
  }
  .skala-wert {
    font-size: 1rem;
    font-weight: 600;
    color: var(--ruhe);
    flex-shrink: 0;
  }
  .skala-spur-wrap {
    position: relative;
    padding: 0.3rem 0 0.8rem;
  }
  .skala-striche {
    display: flex;
    justify-content: space-between;
    padding: 0 3px;
    margin-bottom: 5px;
  }
  .skala-striche span {
    width: 1px;
    height: 6px;
    background: var(--papier-linie);
  }
  .skala-striche span.groß {
    height: 9px;
    background: var(--tinte-matt);
  }
  .skala-eingabe {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    /* 44px Mindesthöhe für die Ziehfläche - SPEC.md §6, große Touch-Targets */
    height: 44px;
    background: transparent;
    margin: 0;
    cursor: pointer;
  }
  .skala-eingabe::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      var(--ruhe) 0%,
      var(--ruhe) var(--fill, 50%),
      var(--papier-linie) var(--fill, 50%),
      var(--papier-linie) 100%
    );
  }
  .skala-eingabe::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--papier-hoch);
    border: 3px solid var(--ruhe);
    margin-top: -10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  }
  .skala-eingabe::-moz-range-track {
    height: 6px;
    border-radius: 999px;
    background: var(--papier-linie);
  }
  .skala-eingabe::-moz-range-progress {
    height: 6px;
    border-radius: 999px;
    background: var(--ruhe);
  }
  .skala-eingabe::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--papier-hoch);
    border: 3px solid var(--ruhe);
  }
  .skala-enden {
    display: flex;
    justify-content: space-between;
    font-family: var(--mono);
    font-size: 0.66rem;
    color: var(--tinte-matt);
    margin-top: -4px;
  }
</style>
