# Haven Desk — design system

The cockpit's whole look is controlled from **one file**: `src/app/globals.css`.
It's built on Apple's three design principles — Clarity, Deference, Depth — over
the existing shadcn + Tailwind v4 architecture. Change a value here and it
cascades to every primitive and all 19 tool pages. You don't restyle pages; you
tune tokens.

## How control works

```text
globals.css  (the tokens: color, radius, shadow, motion — light + dark)
     │  defined as bare HSL triplets:  --primary: 211 100% 43%;
     ▼
tailwind.config.ts  (maps tokens → utilities: bg-primary, shadow-md, ease-apple…)
     ▼
src/components/ui/*  (button, card, input… consume the utilities)
     ▼
every tool page (renders those primitives — no per-page color)
```

Tokens are stored as `H S% L%` (not `#hex`) so one value composes two ways:

| Use | Example |
|---|---|
| Solid color | `bg-primary` → `hsl(var(--primary))` |
| Same hue, transparent | `bg-primary/10` → `hsl(var(--primary) / 0.10)` (tints, rings, materials) |

## The knobs (edit in `globals.css`)

| Token | What it controls | Default (light / dark) |
|---|---|---|
| `--background` | app canvas (the gray behind cards) | `240 14% 97%` / `240 8% 6%` |
| `--card` | cards, panels, fields | `0 0% 100%` / `240 6% 11%` |
| `--foreground` | primary text | `240 6% 11%` / `240 9% 96%` |
| `--primary` | **the one accent** — filled CTAs, app icon, focus rings | `211 100% 43%` (Apple blue) / `211 100% 45%` |
| `--brand` | accent **as text** — links, active nav (tuned for AA on its backdrop) | `211 100% 40%` / `211 100% 72%` |
| `--muted-foreground` | secondary text | `240 4% 44%` / `240 5% 64%` |
| `--success` / `--warning` / `--destructive` | status hues (green/orange/red); `--badge-*-fg` are the AA-safe text variants | Apple system colors |
| `--border` | hairline separators | `240 13% 90%` / `240 5% 24%` |
| `--radius` | corner softness (buttons/inputs; cards are `rounded-2xl`) | `0.75rem` (12px) |
| `--shadow-*` | the soft ambient+key elevation scale | see file |
| `--ease-apple` / `--ease-spring` | motion curves | `cubic-bezier(...)` |

**Want a different brand color?** Change `--primary` (light + dark) and `--ring`
to a new hue. Everything — buttons, links, active nav, focus rings, the sidebar
app-icon, tinted badges — follows. That's the whole rebrand.

**Want it lighter/darker?** Nudge `--background` and `--card`. The 3-4% lightness
gap between them is what makes cards float (Apple's "grouped" look).

## Materials & motion

- `.glass` / `.glass-strong` — translucent `backdrop-blur` surfaces for chrome
  that should recede (sidebar, command palette, dialogs, dropdowns, toasts).
  Falls back to a solid surface where `backdrop-filter` is unsupported.
- `ease-apple` (decelerating) is the default interaction curve; buttons get a
  tactile `active:scale-[0.97]`. `prefers-reduced-motion` disables all of it.

## Preview locally

```bash
cd cockpit
DATABASE_URL="file:./prisma/preview.db" npx prisma db push --schema=prisma/schema.prisma
DATABASE_URL="file:./prisma/preview.db" npm run db:seed
DATABASE_URL="file:./prisma/preview.db" PORT=3009 npm run dev   # http://localhost:3009
```

(The Docker stack on :3000 serves a built image, so source edits don't show there
— use a local `npm run dev` to see changes live.)

## Conventions to keep

- Use theme tokens (`bg-card`, `text-muted-foreground`, `border-border`,
  `text-primary`, `bg-success/12`…), never raw `neutral-*` / `gray-*`.
- New `Card`/popover surfaces inherit the look automatically. New status colors
  go through `--success` / `--warning`, not hardcoded `text-green-600`.
- Keep focus rings: every interactive primitive uses a 2px brand-blue
  `focus-visible` ring with offset (WCAG 2.2).
