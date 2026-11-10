import base from "@cyc-seattle/ts-config/eslint";
import astro from "eslint-plugin-astro";

export default [
  { ignores: [".astro", ".content", "test-results", "playwright-report"] },
  ...base,
  ...astro.configs.recommended,
];
