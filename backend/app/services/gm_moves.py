"""Loader for the Daggerheart SRD GM-moves reference dataset.

The canonical data lives in `app/data/srd/gm_moves.json` -- transcribed from
the SRD's Core GM Mechanics chapter (see that file's `_source_note` for the
transcription method and its confidence caveat). Mirrors
`app.services.bestiary`'s loader pattern.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

_DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "srd" / "gm_moves.json"


@lru_cache(maxsize=1)
def get_dataset() -> dict[str, Any]:
    """Return the full GM-moves reference dataset (cached)."""
    return cast(dict[str, Any], json.loads(_DATASET_PATH.read_text(encoding="utf-8")))
