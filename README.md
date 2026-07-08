# Daggerheart Campaign Manager

Campaign management tool for the [Daggerheart](https://www.daggerheart.com/) TTRPG.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, SQLite
- **Frontend:** React 18, TypeScript (strict), Vite, Vitest
- **Dev:** Docker Compose; CI via GitHub Actions

## Development

```bash
docker-compose up
```

- Backend: http://localhost:8000 (OpenAPI docs at `/docs`)
- Frontend: http://localhost:5173 (proxies `/api` to backend)

### Running checks locally

Backend (from `backend/`):

```bash
pip install -e ".[dev]"
ruff check . && mypy app && pytest
```

Frontend (from `frontend/`):

```bash
npm install
npm run lint && npm run typecheck && npm test
```

## Settings & feature flags

Settings live in the `app_settings` key/value table (JSON values — adding a
setting needs no migration). Defaults are defined in
`backend/app/routers/settings.py` (`DEFAULTS`) and mirrored in
`frontend/src/context/AppSettingsContext.tsx`. New user-facing features ship
behind a `<feature>_enabled` flag (default off) toggled from the Settings page.

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/settings` | All settings (defaults overlaid with stored values) |
| `PUT /api/settings` | Partial update; unknown keys rejected (422) |
