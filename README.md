# Mooi

Monorepository. Each artifact lives in its own root-level directory.

| Artifact | Description |
| --- | --- |
| `spa-mooi` | Vite + React + TypeScript SPA (UI) |

## Requirements

- [Bun](https://bun.sh) >= 1.3

## spa-mooi

### Setup

```bash
cd spa-mooi
bun install
```

Configuration lives in `spa-mooi/.env` (template: `spa-mooi/.env.example`). All variables must be prefixed with `VITE_`.

| Variable | Description |
| --- | --- |
| `VITE_DEV_HOST` | Dev server host |
| `VITE_DEV_PORT` | Dev server port |
| `VITE_PREVIEW_PORT` | Preview server port |
| `VITE_APP_NAME` | Application name |
| `VITE_APP_TAGLINE` | Headline tagline |
| `VITE_APP_DESCRIPTION` | Meta and hero description |
| `VITE_APP_VERSION` | Displayed version |
| `VITE_GITHUB_URL` | Repository link |
| `VITE_DOCS_URL` | Docs link |
| `VITE_CONTACT_EMAIL` | Contact email |
| `VITE_STORAGE_PREFIX` | Local storage key prefix |

### Commands

```bash
bun run dev        # dev server (http://localhost:5173)
bun run build      # type check + production build to dist/
bun run preview    # serve dist/
bun run typecheck  # type check only
```
