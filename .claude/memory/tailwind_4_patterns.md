---
name: tailwind-4-patterns
description: "Tailwind 4 patterns for this repo — CSS-first @theme config, data-theme attribute for the multi-theme store, @apply boundary at ui/ primitives only."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 05df18e6-4bd0-4dd4-a4b8-439ea5176112
---

The repo uses Tailwind 4 via `@tailwindcss/vite`. These are the patterns that fit the theme store and Chrome-extension constraints.

## CSS-first config

Tailwind 4 moves config from `tailwind.config.js` into CSS via `@theme`. Single import:

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.6 0.2 250);
  --color-surface: ...;
  /* all design tokens here */
}
```

`tailwind.config.js` is still loadable via `@config "../tailwind.config.js"` but `corePlugins`, `safelist`, and `separator` are no longer supported through it. ([tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide))

## Multi-theme with `data-theme` attribute

Canonical Tailwind 4 pattern for named themes ([simonswiss.com/posts/tailwind-v4-multi-theme/](https://simonswiss.com/posts/tailwind-v4-multi-theme/)):

```css
@theme {
  --color-primary: #aab9ff;   /* default theme */
  --color-surface: #fff;
  --color-fg: #111;
}

@layer base {
  [data-theme="sait-light"]  { --color-primary: ...; --color-surface: ...; }
  [data-theme="sait-dark"]   { --color-primary: ...; --color-surface: ...; }
  [data-theme="ocean"]       { --color-primary: ...; --color-surface: ...; }
  /* one block per named theme */
}
```

The theme store sets `document.documentElement.dataset.theme = name`. Every Tailwind utility that references `--color-primary` updates automatically. No separate `darkMode` config needed if dark is just another named theme.

This pattern matches how this repo's theme store is structured (multiple named themes, not just light/dark). Don't roll a custom JS theme switcher — the CSS does the work.

## When to `@apply`

- **Inside `ui/` primitives** (Button, Card, Spinner, etc.) — fine. These are the design system seams; `@apply` makes the primitive's class bundle reusable.
- **In feature components** — don't. Use utility classes directly on elements. `@apply` in feature components defeats the colocation benefit of Tailwind.

## Chrome extension MV3 + Tailwind 4

- Tailwind 4 generates a static CSS file. No `'unsafe-inline'` needed for Tailwind's own output.
- The risk is libraries that inject inline styles (some animation libs, Headless UI). If you add one, check whether it needs CSP relaxation.
- MV3 default CSP (`script-src 'self'`) is compatible with Vite-compiled bundles as long as `eval` is not used (production builds don't). No special CSP config needed for this stack.
- See [extension.js.org Tailwind integration](https://extension.js.org/docs/integrations/tailwindcss) for reference.

Related: [[vue-pinia-conventions]]
