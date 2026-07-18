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

<form onsubmit={handleSubmit}>
  <h1>medi-journal</h1>
  <label>
    Passwort
    <input type="password" bind:value={password} autocomplete="current-password" required />
  </label>
  <button type="submit" disabled={loading}>Anmelden</button>
  {#if error}
    <p role="alert">{error}</p>
  {/if}
</form>
