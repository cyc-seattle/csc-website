import base from "@cyc-seattle/ts-config/prettier";

export default {
  ...base,
  plugins: ["prettier-plugin-astro"],
  overrides: [{ files: "*.astro", options: { parser: "astro" } }],
};
