"""Settings schemas."""

from pydantic import BaseModel


class AppSettings(BaseModel):
    """All application settings with their defaults.

    Feature flags follow the `<feature>_enabled` naming convention and
    default to off. Add new settings here and to DEFAULTS in
    app/routers/settings.py — no migration required.
    """

    # No feature flags yet; first feature adds `<feature>_enabled: bool = False`.


class AppSettingsUpdate(BaseModel):
    """Partial update: only provided keys are changed."""

    model_config = {"extra": "forbid"}
