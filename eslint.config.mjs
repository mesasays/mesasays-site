import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "restaurant-intelligence/pipeline/**",
    "restaurant-intelligence/archive/**",
    // Dormant member feature: kept out of the public tree, not type-checked or linted with the site.
    "features/**",
  ]),
]);

export default eslintConfig;
