# Haven Desk landing page redesign plan

Target: `site/` (deployed to `https://omerakben.github.io/haven-desk/` via `.github/workflows/pages.yml` on push to `main`).
Benchmark: the live app at `http://localhost:4141/` — design system defined in `cockpit/src/app/globals.css`.
Date: 2026-06-28.

---

## 1. Design rationale (the "why")

The current landing page is a competent dark-only tech-startup page, but it does **not** speak the product's design language. The app (`cockpit/src/app/globals.css`) ships a documented, Apple-HIG design system — **Clarity, Deference, Depth** — that is *light-first* and uses a specific cool-gray neutral ramp, Apple blue accent, 12px radii, and soft layered shadows. The marketing page uses a different near-black palette (`#090a0c`), a different blue (`#0a84ff`), hue-neutral grays, 8px radius, and one harsh deep shadow.

The brief's mandate — **elegant, minimal, sophisticated, trustworthy** — maps one-to-one onto the app's stated principles. So the redesign is not a taste exercise: it **ports the product's existing, documented design tokens onto the static page**, so the landing page reads as a genuine extension of the app a visitor will install. Every decision is checkable against one source of truth.

Three weaknesses this fixes:
1. **Trust gap.** A dark, glowing-gradient page sells "edgy tech," but the audience is non-technical small-business operators. A light, airy, hairline-bordered layout (the app's default) reads as calm and trustworthy — and it's what they'll actually see after install.
2. **Brand discontinuity.** Different blue, radius, shadow, and neutrals make the page feel like a *different* product than the screenshot it shows. Matching tokens closes that gap.
3. **Visual flatness / weak hierarchy.** Heavy borders and uniform card treatments flatten the page. The app's layered-shadow "grouped" depth and restrained single-accent system create hierarchy through elevation and whitespace, not chrome.

Key intentional decisions:
- **System-aware, light-first, manual toggle.** The app's `defaultTheme="system"`. The page will honor `prefers-color-scheme`, default to light, and add a sun/moon toggle (persisted to `localStorage`) — mirroring the product exactly and giving dark-mode users continuity.
- **No external webfont.** The app relies on the native system stack. A privacy/local-first product whose landing page phones home to Google Fonts is off-message. Match the app's stack; ship zero third-party requests.
- **Keep the content/IA.** The brief says the structure is sound. Sections and copy stay; only layout rhythm, hierarchy, and styling change.

---

## 2. Structural improvements (HTML / UX)

Sections are kept (hero, quick-start, workflow, pack, honesty, setup, apply, footer). Changes are structural-quality, not content:

1. **Header.** Add a theme-toggle button (sun/moon) before the Apply CTA. Keep sticky + blur. On mobile, toggle sits in the top bar (not inside the drawer) so it's always reachable.
2. **Hero.** Slightly reduce the copy/mockup imbalance (currently `0.74fr / 1.26fr`) and increase vertical breathing room. Add a one-line trust microcopy under the CTAs ("No cloud calls. No account. Runs on your machine."). The product mockup re-skins to the app's **light grouped-card** look so it matches what installs.
3. **Truth strip → "grouped" cards.** Replace the single bordered 3-column strip with three elevated cards (app's `--card` + `--shadow-sm`) for clearer scanning.
4. **Workflow rail.** Convert the 4-column hard-bordered rail into 4 elevated step cards with a numbered eyebrow; on tablet it becomes 2×2, on mobile a single column — no border gymnastics.
5. **Section rhythm.** Standardize vertical padding to a scale (use a `--section-y` token), add consistent max-width content wells, and use the app's hairline `--border` for separators instead of mixed custom line colors.
6. **Apply form.** Re-skin inputs to the app's input tokens (`--input` border, brand focus ring at 0.16 alpha). Keep the privacy-first "prepare a private summary" behavior verbatim.
7. **Motion / interactivity.** Add a subtle IntersectionObserver scroll-reveal (opacity + 8px translate, Apple ease, respects `prefers-reduced-motion`). No parallax, no novelty.
8. **Accessibility.** Maintain visible focus rings (brand ring token), `aria-pressed` on the theme toggle, keep the existing skip-to-content-via-anchor and nav semantics, verify AA contrast in both modes (the app tokens are already AA-tuned).

---

## 3. Visual style guide (CSS / branding)

Ported verbatim from `cockpit/src/app/globals.css` (HSL triplets → the page uses the same `hsl(var(--token))` pattern so alpha composition works for materials/rings).

### Color palette

**Light (default)**
| Role | Token | Value | Hex (approx) |
|---|---|---|---|
| Canvas | `--background` | `240 14% 97%` | `#F4F4F7` |
| Card | `--card` | `0 0% 100%` | `#FFFFFF` |
| Primary text | `--foreground` | `240 6% 11%` | `#1A1A1E` |
| Secondary text | `--muted-foreground` | `240 4% 44%` | `#6E6E78` |
| Primary / CTA | `--primary` | `211 100% 43%` | Apple blue |
| Link / accent text | `--brand` | `211 100% 40%` | (AA 6:1 on white) |
| Hairline | `--border` | `240 13% 90%` | |
| Focus ring | `--ring` | `211 100% 43%` | |
| Success / Warning / Destructive | `145 63% 42%` / `35 100% 50%` / `4 86% 57%` | Apple green/orange/red |

**Dark (toggle / `prefers-color-scheme: dark`)**
| Role | Token | Value |
|---|---|---|
| Canvas | `--background` | `240 8% 6%` (`#0E0E11`) |
| Card | `--card` | `240 6% 11%` (`#1A1A1E`) |
| Primary text | `--foreground` | `240 9% 96%` |
| Primary | `--primary` | `211 100% 45%` |
| Brand text | `--brand` | `211 100% 72%` |
| Hairline | `--border` | `240 5% 24%` |

### Typography
- Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", "Inter", system-ui, "Helvetica Neue", sans-serif`.
- `-webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-feature-settings: "cv01","ss01";`
- Headings: `letter-spacing: -0.014em`, weight ~680–760, line-height ~1.05.
- Hierarchy: H1 `clamp(2.75rem, 4.4vw, 4.25rem)`; section H2 `clamp(2rem, 3.4vw, 3.25rem)`; lede 18–20px at line-height 1.55; body 16px; eyebrow 12px uppercase, `0.10em` tracking, `--brand` color; labels 14px.

### General styling rules
- **Radius:** `--radius: 0.75rem` (12px) for buttons/inputs; cards `1rem`–`1.25rem` (rounded-2xl); pills `999px`.
- **Shadows:** port `--shadow-sm … --shadow-xl` (soft layered ambient+key). Cards use `--shadow-sm`; the product mockup + terminal use `--shadow-xl`. No `0 32px 90px` slab.
- **Buttons:** min-height 44px (touch), 12px radius, weight 680. Primary = `--primary` fill, white text, `--shadow-sm`; hover lifts `translateY(-1px)` + slightly stronger shadow (Apple ease). Secondary = `--card` fill + `--border`. Focus = 3px `--ring`/0.4 ring.
- **Cards:** `--card` fill, `1px --border`, `--shadow-sm`, 20–24px padding; hover (interactive only) adds `--shadow-md` + 1px lift.
- **Inputs:** `--card`/`--background` fill, `1px --input`, focus → `--ring` border + `0 0 0 3px hsl(var(--ring)/0.16)`.
- **Spacing:** section vertical rhythm `clamp(64px, 8vw, 112px)`; content gutters `5vw` desktop / `20px` mobile; grid gaps 12–16px.
- **Motion:** `--ease-apple: cubic-bezier(0.22,1,0.36,1)`; transitions 160–220ms; scroll-reveal 8px/opacity, staggered, reduced-motion safe.

---

## 4. Implementation plan (critical components)

### A. Token layer (top of `styles.css`)
```css
:root {
  color-scheme: light;
  --background: 240 14% 97%; --foreground: 240 6% 11%;
  --card: 0 0% 100%; --card-foreground: 240 6% 11%;
  --primary: 211 100% 43%; --primary-foreground: 0 0% 100%;
  --brand: 211 100% 40%; --muted-foreground: 240 4% 44%;
  --secondary: 240 11% 95%; --accent: 240 12% 94%;
  --border: 240 13% 90%; --input: 240 11% 87%; --ring: 211 100% 43%;
  --success: 145 63% 42%; --warning: 35 100% 50%; --destructive: 4 86% 57%;
  --radius: 0.75rem;
  --shadow-sm: 0 1px 2px 0 hsl(240 12% 18% / .05), 0 1px 1px -.5px hsl(240 12% 18% / .04);
  --shadow-md: 0 4px 14px -3px hsl(240 12% 18% / .10), 0 2px 5px -2px hsl(240 12% 18% / .06);
  --shadow-xl: 0 24px 56px -16px hsl(240 16% 14% / .22), 0 10px 20px -10px hsl(240 16% 14% / .10);
  --ease-apple: cubic-bezier(0.22, 1, 0.36, 1);
}
:root[data-theme="dark"], :root.dark {
  color-scheme: dark;
  --background: 240 8% 6%; --foreground: 240 9% 96%;
  --card: 240 6% 11%; --primary: 211 100% 45%; --brand: 211 100% 72%;
  --muted-foreground: 240 5% 64%; --border: 240 5% 24%; --input: 240 5% 28%;
  --ring: 211 100% 62%; /* + dark shadows over black */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* mirror the dark block */ }
}
body { background: hsl(var(--background)); color: hsl(var(--foreground));
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text","SF Pro Display","Segoe UI","Inter",system-ui,sans-serif;
  -webkit-font-smoothing: antialiased; font-feature-settings: "cv01","ss01"; }
```

### B. Navigation bar
```css
.site-header {
  position: sticky; top: 0; z-index: 20; display: flex; align-items: center;
  justify-content: space-between; gap: 24px; min-height: 64px; padding: 0 5vw;
  background: hsl(var(--background) / 0.72); backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid hsl(var(--border));
}
.site-nav a { padding: 8px 12px; border-radius: var(--radius); color: hsl(var(--muted-foreground));
  font-weight: 560; transition: color .16s var(--ease-apple), background .16s var(--ease-apple); }
.site-nav a:hover { color: hsl(var(--foreground)); background: hsl(var(--accent)); }
.nav-cta { background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
  box-shadow: var(--shadow-sm); }
.theme-toggle { width: 38px; height: 38px; border-radius: 999px; border: 1px solid hsl(var(--border));
  background: hsl(var(--card)); display: grid; place-items: center; }
```

### C. Theme toggle (append to `app.js`)
```js
const root = document.documentElement;
const saved = localStorage.getItem("hd-theme");
if (saved) root.setAttribute("data-theme", saved);
document.querySelector(".theme-toggle")?.addEventListener("click", (e) => {
  const isDark = root.getAttribute("data-theme") === "dark"
    || (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  const next = isDark ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("hd-theme", next);
  e.currentTarget.setAttribute("aria-pressed", String(next === "dark"));
});
```
A tiny inline `<head>` script applies the saved theme before paint to prevent a flash.

### D. Scroll reveal (append to `app.js`)
```js
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
}
```
```css
[data-reveal] { opacity: 0; transform: translateY(8px); transition: opacity .5s var(--ease-apple), transform .5s var(--ease-apple); }
[data-reveal].in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; } }
```

### Build / verify / ship
1. Rewrite `site/styles.css` (token-driven), edit `site/index.html` (toggle button + inline anti-flash script + `data-reveal` hooks), extend `site/app.js` (toggle + reveal). Preserve all existing JS behavior.
2. Verify locally (`python3 -m http.server` in `site/`) in Chrome: light + dark, desktop + mobile widths, all interactive bits (install tabs, copy, form). Screenshot before/after.
3. Adversarial review (visual / a11y / responsive / brand-match / perf lenses) → fix.
4. Branch `redesign/haven-desk-landing` → PR to `main`. Merge triggers the Pages deploy.
