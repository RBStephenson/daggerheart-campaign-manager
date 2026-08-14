"""AI text draft generation endpoint (DHCM-96). Advisory only -- the
frontend is responsible for GM confirmation before a draft lands in a field.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import AiApiConfig, User
from app.routers.settings import get_settings
from app.schemas.ai import AiTextGenerateRequest, AiTextGenerateResponse
from app.services import ai_text, secrets

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _build_prompt(body: AiTextGenerateRequest) -> str:
    lines = [f"Entity type: {body.entity_type}"]
    if body.existing_fields:
        lines.append("Existing fields:")
        for key, value in body.existing_fields.items():
            lines.append(f"- {key}: {value}")
    lines.append(f"\nRequest: {body.prompt}")
    lines.append(
        "\nWrite a short draft addressing the request above. Respond with the "
        "draft text only -- no preamble, no explanation, no markdown headers."
    )
    return "\n".join(lines)


@router.post("/generate", response_model=AiTextGenerateResponse)
def generate(
    body: AiTextGenerateRequest,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role("gm"))],
) -> AiTextGenerateResponse:
    app_settings = get_settings(db)
    if not app_settings.get("ai_text_enabled"):
        raise HTTPException(status_code=403, detail="AI text generation is not enabled")

    config_id = app_settings.get("ai_text_api")
    if config_id is None:
        raise HTTPException(status_code=400, detail="No AI API config selected for text generation")

    config = db.get(AiApiConfig, config_id)
    if config is None:
        raise HTTPException(status_code=400, detail="The selected AI API config no longer exists")

    api_key = secrets.get_ai_api_config_key(db, config.id) or ""
    prompt = _build_prompt(body)
    draft, error = ai_text.generate_draft(config, api_key, prompt)
    if error is not None:
        raise HTTPException(status_code=502, detail=error)
    assert draft is not None
    return AiTextGenerateResponse(draft=draft)
