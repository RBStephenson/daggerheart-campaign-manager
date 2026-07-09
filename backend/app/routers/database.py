"""Database management: backup, restore, health check, repair, and reset.

Operates directly on the SQLite database file. Backup uses SQLite's online
backup API for a transactionally-consistent snapshot (folds in WAL contents);
restore validates an upload before swapping it in; repair attempts a REINDEX
for index-only corruption; reset wipes all data. Restore and reset run
`alembic downgrade base` / `upgrade head` afterward (rather than
`Base.metadata.create_all`) so the `alembic_version` table stays consistent
with the `alembic upgrade head` the container runs on every start.

Host-only, gated by `data_management_enabled`. A single in-process lock
serializes the destructive operations (repair/restore/reset) — this app has
no background job/scanner concept to check for "busy" the way STL Studio does.
"""

import sqlite3
import tempfile
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any, cast

from alembic.config import Config
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from alembic import command
from app.db import DATABASE_URL, engine, get_db
from app.deps import require_role
from app.routers.settings import get_settings

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_ALEMBIC_INI = _BACKEND_DIR / "alembic.ini"

_lock = threading.Lock()


def _require_data_management_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("data_management_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/database",
    tags=["database"],
    dependencies=[Depends(_require_data_management_enabled), Depends(require_role("host"))],
)


def _stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%d_%H%M%S")


def _db_path() -> Path:
    """Resolve the on-disk path of the SQLite database from its URL."""
    if not DATABASE_URL.startswith("sqlite"):
        raise HTTPException(500, "Database management is only supported for SQLite")
    if "sqlite:///" in DATABASE_URL:
        raw = DATABASE_URL.split("sqlite:///", 1)[1]
    else:
        raw = DATABASE_URL.split("sqlite://", 1)[1]
    if not raw or raw == ":memory:":
        raise HTTPException(500, "In-memory database cannot be backed up or restored")
    return Path(raw)


def _integrity_check(path: Path) -> str:
    conn = sqlite3.connect(str(path))
    try:
        return cast(str, conn.execute("PRAGMA integrity_check").fetchone()[0])
    finally:
        conn.close()


def _snapshot_db(reason: str) -> Path | None:
    """Best-effort pre-destructive-op snapshot via the online backup API."""
    db_path = _db_path()
    if not db_path.exists():
        return None

    backups = db_path.parent / "backups"
    backups.mkdir(parents=True, exist_ok=True)
    dest = backups / f"pre_{reason}_{_stamp()}.db"
    n = 2
    while dest.exists():
        dest = backups / f"pre_{reason}_{_stamp()}_{n}.db"
        n += 1

    src = sqlite3.connect(str(db_path))
    dst = sqlite3.connect(str(dest))
    try:
        with dst:
            src.backup(dst)
    finally:
        dst.close()
        src.close()
    return dest


def _alembic_config() -> Config:
    cfg = Config(str(_ALEMBIC_INI))
    cfg.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
    return cfg


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


@router.get("/backup")
def backup_database(background_tasks: BackgroundTasks) -> FileResponse:
    """Stream a consistent snapshot of the database as a downloadable file."""
    db_path = _db_path()
    if not db_path.exists():
        raise HTTPException(404, "Database file not found")

    stamp = _stamp()
    tmp = Path(tempfile.gettempdir()) / f"dhcm_backup_{stamp}.db"
    src = sqlite3.connect(str(db_path))
    dst = sqlite3.connect(str(tmp))
    try:
        with dst:
            src.backup(dst)
    finally:
        dst.close()
        src.close()

    background_tasks.add_task(_safe_unlink, tmp)
    return FileResponse(
        tmp,
        filename=f"dhcm_backup_{stamp}.db",
        media_type="application/octet-stream",
    )


@router.get("/health")
def database_health() -> dict[str, Any]:
    db_path = _db_path()
    if not db_path.exists():
        raise HTTPException(404, "Database file not found")
    try:
        detail = _integrity_check(db_path)
    except sqlite3.Error as e:
        raise HTTPException(500, f"Database health check failed: {e}") from e
    healthy = detail == "ok"
    return {"ok": healthy, "status": "healthy" if healthy else "corrupt", "detail": detail}


@router.post("/repair")
def repair_database() -> dict[str, Any]:
    """Conservative in-place repair for index-only SQLite corruption."""
    if not _lock.acquire(blocking=False):
        raise HTTPException(409, "Another database operation is in progress")
    try:
        db_path = _db_path()
        if not db_path.exists():
            raise HTTPException(404, "Database file not found")

        engine.dispose()
        snapshot = _snapshot_db("repair")
        before = _integrity_check(db_path)
        if before != "ok":
            conn = sqlite3.connect(str(db_path))
            try:
                conn.execute("REINDEX")
                conn.commit()
            finally:
                conn.close()
        after = _integrity_check(db_path)
    except sqlite3.Error as e:
        raise HTTPException(500, f"Database repair failed: {e}") from e
    finally:
        _lock.release()

    repaired = after == "ok" and before != "ok"
    return {
        "ok": after == "ok",
        "status": "healthy" if after == "ok" else "corrupt",
        "detail": after,
        "before": before,
        "repaired": repaired,
        "snapshot": str(snapshot) if snapshot else None,
    }


@router.post("/restore")
async def restore_database(file: UploadFile) -> dict[str, Any]:
    """Replace the live database with an uploaded backup, after validating it."""
    db_path = _db_path()
    tmp = Path(tempfile.gettempdir()) / f"dhcm_restore_{_stamp()}.db"
    tmp.write_bytes(await file.read())

    try:
        conn = sqlite3.connect(str(tmp))
        try:
            if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("integrity check failed")
            tables = {
                r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
        finally:
            conn.close()
        if "alembic_version" not in tables:
            raise ValueError("this file is not a Daggerheart Campaign Manager database")
    except Exception as e:
        _safe_unlink(tmp)
        raise HTTPException(400, f"Invalid backup file: {e}") from e

    if not _lock.acquire(blocking=False):
        _safe_unlink(tmp)
        raise HTTPException(409, "Another database operation is in progress")
    try:
        snapshot = _snapshot_db("restore")
        engine.dispose()
        for suffix in ("-wal", "-shm"):
            _safe_unlink(Path(str(db_path) + suffix))
        tmp.replace(db_path)
        # Bring a possibly-older backup's schema up to date.
        command.upgrade(_alembic_config(), "head")
    finally:
        _lock.release()

    return {"ok": True, "snapshot": str(snapshot) if snapshot else None}


@router.post("/reset")
def reset_database() -> dict[str, Any]:
    """Delete all data and recreate an empty schema."""
    if not _lock.acquire(blocking=False):
        raise HTTPException(409, "Another database operation is in progress")
    try:
        snapshot = _snapshot_db("reset")
        engine.dispose()
        cfg = _alembic_config()
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
    finally:
        _lock.release()

    return {"ok": True, "snapshot": str(snapshot) if snapshot else None}
