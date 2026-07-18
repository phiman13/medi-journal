import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/build/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Plain JS Node-Skripte (kein TS, daher no-undef von typescript-eslint
    // nicht automatisch deaktiviert): console/process etc. als Globals setzen.
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
