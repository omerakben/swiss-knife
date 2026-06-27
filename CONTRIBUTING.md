# Contributing to Swiss Knife / Haven Desk

Thanks for your interest. This project is a local-first private AI daily runner, and contributions of all kinds are welcome — code, docs, packs, issues, discussions.

## What we need help with

| Area | How to help |
|---|---|
| **Packs** | Build useful template packs for specific personas (household, small business, students, etc.). See `docs/haven-desk-plugin-pack-spec.md` for the manifest contract. |
| **macOS Shortcut** | Build and test the documented quick-capture Shortcut recipe. |
| **Setup experience** | Reduce the friction of getting Ollama + Docker running. One-click installer ideas welcome. |
| **Docs** | Improve README, fix errors, write tutorials, translate into other languages. |
| **Bug reports** | File an issue with `swiss doctor` output and the steps to reproduce. |
| **Code quality** | Review open PRs, add unit tests, improve the e2e coverage. |
| **Feedback** | Tell us what breaks on your machine, what's confusing, what's missing. |

## Quick start

```bash
git clone <repo-url> && cd haven-desk
./swiss up          # start everything (Docker + Ollama)
```

See the [README](README.md) for full setup instructions on macOS and Windows.

## Before you contribute

- **Local-only is a hard rule.** No feature that sends data to a third-party cloud will be accepted. PRs adding cloud API keys, telemetry, or remote model endpoints will be rejected.
- **Deterministic gates over model checks.** If you add a feature that uses a local model, wrap the output in a pure, testable validation gate before anything is saved.
- **Small commits.** One feature, one commit. Conventional commits preferred (`feat:`, `fix:`, `docs:`, `chore:`).

## Development

```bash
cd cockpit
npm install
npm run db:push
npm run dev              # local dev at :3000
npm run test:unit        # Vitest
npm run test:e2e         # Playwright (route-mocked, no Ollama needed)
npm run lint
npm run build
```

No `.env` is needed for local dev — defaults work against a running Ollama at `localhost:11434`.

## Code of conduct

Be respectful, constructive, and assume good faith. Harassment, trolling, and entitlement won't be tolerated. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Questions

Open a [discussion](https://github.com/omerakben/haven-desk/discussions) or [issue](https://github.com/omerakben/haven-desk/issues).