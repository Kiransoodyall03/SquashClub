# Design System

**Status:** implemented 13 August 2026. Palette values are placeholders pending confirmed Parkview Squash Club brand colours.

---

## The four rules

These are not preferences. They are constraints, and the token system is built so that breaking them requires deliberate effort.

1. **No gradients.** There is no gradient token to reach for. Every surface is a flat fill.
2. **No glow effects.** No coloured shadows, no large-blur shadows, no `filter: drop-shadow`. Depth is expressed with 1px borders and flat surface tints.
3. **No rounded corners.** Every radius token resolves to `0`. The single exception is `border-radius: 50%` on genuine circles — the loading spinner and avatar images. A circle is not a rounded box.
4. **No emoji.** Not in the interface, not in outbound messages, not in console output. Iconography is `lucide-react` only.

## Where things live

```
src/styles/tokens.css      Every colour, size, weight, duration. The ONLY file
                           you edit to rebrand. Also holds the legacy aliases.
src/styles/base.css        Reset, document typography, layout primitives.
src/styles/components.css  The component vocabulary: .btn, .card, .stat,
                           .table, .badge, .modal, .notice, .tabs, .field.
src/App/App.css            Imports the three above, then restyles the LEGACY
                           class names the existing pages still use.
src/pages/*/[Page].css     Page layout only. Must not redefine components.
```

Load order matters. `App/index.js` imports the page modules first (which pull in their own stylesheets), then `./App.css` last — so the shared definitions win at equal specificity. Do not change that import order.

---

## Rebranding

Change only the `--color-*` block at the top of `tokens.css`. Nothing else needs touching.

```css
--color-brand:       #0E3A5C;  /* primary actions, active nav, filled headers */
--color-brand-hover: #0A2C46;
--color-brand-on:    #FFFFFF;  /* text that sits on a brand fill */
--color-brand-wash:  #E8EEF3;  /* selected rows, quiet brand surfaces */
```

Two things to check after any change:

- `--color-brand-on` must reach 4.5:1 against `--color-brand`.
- `--color-brand-wash` must be light enough that `--color-ink` stays readable on it.

There are two other places the brand colour is hard-coded and must be updated by hand: the `theme-color` meta tag in `public/index.html`, and `public/manifest.json`.

---

## Tokens

### Colour

| Token | Role |
|---|---|
| `--color-ink` / `--color-ink-muted` / `--color-ink-subtle` | Text, in descending emphasis |
| `--color-page` | Application background |
| `--color-surface` | Cards, panels, table bodies |
| `--color-surface-sunken` | Table headers, inset panels, hover states |
| `--color-border` / `--color-border-strong` | 1px rules; strong for inputs and emphasis |
| `--color-brand` and friends | Primary actions and active states |
| `--color-positive` / `--color-negative` / `--color-caution` / `--color-info` | Semantic, each with a matching `-wash` |

Every semantic colour has a `-wash` variant for filled backgrounds. Never place a semantic colour on a semantic wash of a different family.

### Type

One family, `Inter`, loaded via `<link>` in `public/index.html` rather than a CSS `@import` (an `@import` blocks render). One monospace stack for all numerals.

**All numbers use `--font-mono` with `font-variant-numeric: tabular-nums`** — ratings, scores, counts, currency. Digits must align vertically in tables and stay stable when a value changes. This is the single most important typographic rule in a sports data product.

Scale runs 11px to 36px. The interface is deliberately dense: body text is 15px and table text 13px, because the club owner's screens are tables.

### Spacing

4px base, `--space-1` (4px) through `--space-8` (64px). Do not introduce intermediate values.

---

## Component vocabulary

Two vocabularies exist during the migration.

**New** — use these for anything you write from now on:

`.btn` with `--primary` `--danger` `--positive` `--quiet` `--sm` `--lg` `--block` `--icon` · `.card` with `__header` `__title` `__body` `__footer` · `.stat` with `__label` `__value` `__meta` `__delta` · `.field` with `__label` `__hint` `__error` and `.input` `.select` `.textarea` · `.badge` with semantic and status modifiers · `.table-wrap` + `.table` with `.col-numeric` `.col-actions` · `.tabs` + `.tab` · `.modal-overlay` + `.modal` · `.notice` · `.empty` · `.spinner` · `.meter` · `.deflist`

**Legacy** — defined in `App/App.css`, restyled onto the new tokens so the existing twenty pages inherited the new look without being rewritten:

`.btn-primary` `.btn-outline` `.btn-ghost` `.card-header` `.form-input` `.form-label` `.badge-upcoming` `.elo-badge` `.empty-state` `.error-message` `.loading-spinner` and the utility classes.

**Retire the legacy block page by page.** When a page is migrated to the new vocabulary, delete the corresponding rules from `App/App.css`.

### Status badge names are load-bearing

`.badge-upcoming`, `.badge-active`, `.badge-completed`, `.badge-cancelled`, `.badge-pending` are constructed at runtime from data strings such as `` className={`badge badge-${status}`} ``. Renaming a status value in Firestore silently unstyles the badge. They are now defined once, in `App/App.css` — previously they were defined in several page stylesheets with conflicting colours (`.badge-upcoming` was orange in one file and blue in another).

---

## What was removed

| Removed | Count | Replaced with |
|---|---|---|
| Gradient declarations | 28 | Flat fills |
| Box-shadows, including 6 coloured glows | 32 | 1px borders |
| Border-radius declarations | 137 | Square corners |
| Hard-coded legacy brand hex values | 76 | Tokens |
| Duplicate component rule blocks across page stylesheets | 63 | Single definitions in `App/App.css` |
| Emoji characters | 20 across 6 files | Text, numerals, or lucide icons |
| Decorative diagonal court-pattern background | 1 | Plain surface |
| Gradient-clipped heading text | 1 | Solid ink |
| Button ripple pseudo-element | 1 | Removed |
| `Bebas Neue` + `Outfit` via blocking CSS `@import` | 1 | `Inter` via `<link>` |

Emoji specifically: podium medals in tournament results (now rank numerals), a tick in the format-locked badge, arrows in navigation copy, the bullet in a match summary, three emoji in the WhatsApp invitation body, and seven in `console.log` calls.

Motion was cut back to a 150ms fade and a 6px rise. `animate-pulse` and `animate-bounce` are neutralised rather than deleted, so any lingering class reference stays harmless. All animation is disabled under `prefers-reduced-motion`.

---

## Accessibility commitments

- `:focus-visible` outlines are global and must never be removed. The old design suppressed focus in favour of a coloured glow; that glow is gone, so the outline is the only affordance left.
- Status is never conveyed by colour alone — every badge carries a text label.
- Rank is never conveyed by a medal colour — it is a numeral.
- Tabular data uses real `<table>` markup with `<th>` headers.

Still outstanding, tracked in `ROADMAP.md`: `aria-label` on icon-only buttons, focus traps and Escape handling in modals, live regions for async errors, and `scope` attributes on table headers.

---

## House patterns

**Tables over cards for the owner.** The club owner's job is comparison — who owes money, which courts are free, who has not played. Cards force scanning; tables allow comparison. Reserve cards for a player's own single-subject views.

**Numbers right-aligned, monospaced, tabular.** Always.

**One accent per screen.** If everything is brand-coloured, nothing reads as the primary action. One filled `.btn--primary` per view; everything else is bordered or quiet.

**Empty states say what to do next**, not just that something is empty.

**Destructive actions confirm.** The existing app fires Leave Tournament, Reject Request and Complete Tournament with no confirmation at all.
