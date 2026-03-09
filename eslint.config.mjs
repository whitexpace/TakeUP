import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt({
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "vue/html-self-closing": ["off"],
  },
})
