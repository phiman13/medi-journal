import { defineConfig } from "vitest/config";

// Noch keine Komponenten-Tests in M1 (der Tages-Eintrags-Screen kommt erst in
// M2) - passWithNoTests verhindert einen roten Build, solange test/ leer ist.
export default defineConfig({
  test: {
    passWithNoTests: true,
  },
});
