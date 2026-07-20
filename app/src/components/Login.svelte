<script lang="ts">
  import { login } from "../lib/api";
  import { authenticated } from "../lib/auth";

  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    loading = true;
    error = null;
    const ok = await login(password);
    loading = false;
    if (ok) {
      authenticated.set(true);
    } else {
      error = "Falsches Passwort.";
    }
  }
</script>

<main class="login-bühne">
  <form class="karte login-karte" onsubmit={handleSubmit}>
    <h1 class="login-marke">medi-journal</h1>
    <p class="eyebrow">Privates Tagebuch</p>
    <label class="login-feld">
      Passwort
      <input type="password" bind:value={password} autocomplete="current-password" required />
    </label>
    <button type="submit" class="knopf" disabled={loading}>Anmelden</button>
    {#if error}
      <p class="fehler" role="alert">{error}</p>
    {/if}
  </form>
</main>

<style>
  .login-bühne {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .login-karte {
    width: 100%;
    max-width: 340px;
    margin: 0;
    text-align: center;
  }
  .login-marke {
    font-size: 1.7rem;
    margin-bottom: 0.2rem;
  }
  .login-karte .eyebrow {
    margin-bottom: 1.6rem;
  }
  .login-feld {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    text-align: left;
    font-size: 0.85rem;
    color: var(--tinte-matt);
    margin-bottom: 1.1rem;
  }
  .login-karte .knopf {
    width: 100%;
  }
</style>
