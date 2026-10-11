import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const PURE_CORE = "Logika inti harus murni: waktu & seed diberikan sebagai argumen (CLAUDE.md).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/lib/core/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: PURE_CORE },
        { object: "Date", property: "now", message: PURE_CORE },
        { object: "performance", property: "now", message: PURE_CORE },
        { object: "crypto", property: "getRandomValues", message: PURE_CORE },
        { object: "crypto", property: "randomUUID", message: PURE_CORE },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: PURE_CORE },
        { selector: "CallExpression[callee.name='Date']", message: PURE_CORE },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: PURE_CORE },
        { name: "localStorage", message: PURE_CORE },
        { name: "process", message: PURE_CORE },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["node:*", "fs", "path", "@/lib/db/*", "next/*", "react", "react-dom"], message: PURE_CORE },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Worktree agen Claude Code (salinan repo lengkap dengan .next sendiri)
    ".claude/**",
  ]),
]);

export default eslintConfig;
