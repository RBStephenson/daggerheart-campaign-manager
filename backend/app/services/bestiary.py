"""Loader and typed accessors for the Daggerheart SRD bestiary dataset.

The canonical data lives in `app/data/srd/bestiary.json` — 129 adversary stat
blocks and 19 environment stat blocks, transcribed verbatim from the SRD (see
DHCM v2's Epic 6 for the transcription method and the PyMuPDF-vs-pdftotext
gotcha it uncovered). Mirrors `app.services.srd`'s loader pattern.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

_DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "srd" / "bestiary.json"


@lru_cache(maxsize=1)
def get_dataset() -> dict[str, Any]:
    """Return the full SRD bestiary dataset (cached)."""
    return cast(dict[str, Any], json.loads(_DATASET_PATH.read_text(encoding="utf-8")))


@lru_cache(maxsize=1)
def adversaries() -> tuple[dict[str, Any], ...]:
    """All adversary stat blocks (tiers 1-4)."""
    return tuple(get_dataset()["adversaries"])


@lru_cache(maxsize=1)
def adversaries_by_name() -> dict[str, dict[str, Any]]:
    return {a["name"]: a for a in adversaries()}


@lru_cache(maxsize=1)
def environments() -> tuple[dict[str, Any], ...]:
    """All environment stat blocks (tiers 1-4)."""
    return tuple(get_dataset()["environments"])


@lru_cache(maxsize=1)
def environments_by_name() -> dict[str, dict[str, Any]]:
    return {e["name"]: e for e in environments()}
