# Neovim setup

This setup keeps formatting and linting consistent with CI.

1. Install tooling locally (project root)

```
pnpm install
```

2. Configure your formatter/linter

Example for `conform.nvim`:

```lua
require("conform").setup({
  formatters_by_ft = {
    javascript = { "prettier" },
    typescript = { "prettier" },
    vue = { "prettier" },
    json = { "prettier" },
    markdown = { "prettier" },
  },
  format_on_save = { timeout_ms = 2000, lsp_fallback = true },
})
```

3. ESLint diagnostics

Use `eslint-lsp` (or `vscode-eslint`) for diagnostics and fixes, and keep ESLint/Prettier installed locally so the same versions are used in CI.
