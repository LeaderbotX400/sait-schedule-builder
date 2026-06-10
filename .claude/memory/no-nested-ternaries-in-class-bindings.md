---
name: no-nested-ternaries-in-class-bindings
description: Avoid nested ternaries in Vue :class bindings — use data-driven class maps or computed objects instead
metadata:
  type: feedback
---

Don't write nested ternary chains inside `:class` bindings (e.g. `cond ? (x ? 'a' : y ? 'b' : 'c') : 'd'`). Simple flat conditionals are fine; nesting that hurts readability is not.

**Why:** Eric flagged a nested ternary in BlockoutEditor.vue's paint-mode buttons as hard to read, citing https://vuejs.org/guide/essentials/class-and-style.html — class logic belongs in computed objects or data.

**How to apply:** Prefer (1) putting per-item classes in the data array itself (e.g. an `activeClass` field on each option object), (2) a computed object/map keyed by state, or (3) a small helper function with early returns. Keep at most one level of `cond ? a : b` in the template. Related: [[memories-live-in-repo]].
