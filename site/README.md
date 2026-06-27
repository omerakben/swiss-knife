# Haven Desk GitHub Pages site

This folder is the static early-access marketing site for Haven Desk.

## Canonical project URL

Since this repo is published from `omerakben/haven-desk`, the default project Pages URL is:

```text
https://omerakben.github.io/haven-desk/
```

The site uses relative links, so it works directly upon deployment to the `gh-pages` target environment.

## One-line installer URLs

The Quick Start card on the site exposes the following URLs:

```bash
curl -fsSL https://omerakben.github.io/haven-desk/install.sh | bash
```

```powershell
irm https://omerakben.github.io/haven-desk/install.ps1 | iex
```

## Before publishing

Update `CONTACT_EMAIL` in `site/app.js` or replace the form handler with a Google Form, Tally, Airtable, or other approved application destination.

The page intentionally uses "Apply for early access" instead of "Download now." The one-line installer is present for approved pilots, but the public CTA should stay gated until installer support and intake routing are ready.
