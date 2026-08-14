import pytest
from cryptography.fernet import Fernet

from app.services import secrets


@pytest.fixture(autouse=True)
def _reset_secrets_cache():
    secrets.reset_cache()
    yield
    secrets.reset_cache()


def test_roundtrip_with_ephemeral_key(db) -> None:
    secrets.set_ai_api_config_key(db, 1, "raw-key-value")
    assert secrets.get_ai_api_config_key(db, 1) == "raw-key-value"


def test_roundtrip_with_env_key(db, monkeypatch) -> None:
    monkeypatch.setenv("DHCM_FERNET_KEY", Fernet.generate_key().decode())
    secrets.set_ai_api_config_key(db, 1, "raw-key-value")
    assert secrets.get_ai_api_config_key(db, 1) == "raw-key-value"


def test_blank_key_clears_instead_of_storing(db) -> None:
    secrets.set_ai_api_config_key(db, 1, "raw-key-value")
    secrets.set_ai_api_config_key(db, 1, "   ")
    assert secrets.get_ai_api_config_key(db, 1) is None


def test_unset_config_key_is_none(db) -> None:
    assert secrets.get_ai_api_config_key(db, 42) is None


def test_key_lost_after_env_key_changes_treated_as_unset(db, monkeypatch) -> None:
    monkeypatch.setenv("DHCM_FERNET_KEY", Fernet.generate_key().decode())
    secrets.set_ai_api_config_key(db, 1, "raw-key-value")

    secrets.reset_cache()
    monkeypatch.setenv("DHCM_FERNET_KEY", Fernet.generate_key().decode())

    assert secrets.get_ai_api_config_key(db, 1) is None


def test_hint_masks_all_but_last_four_chars(db) -> None:
    secrets.set_ai_api_config_key(db, 1, "sk-ant-abcd1234")
    assert secrets.ai_api_config_key_hint(db, 1) == "…1234"


def test_hint_none_when_unset(db) -> None:
    assert secrets.ai_api_config_key_hint(db, 1) is None


def test_independent_configs_independent_keys(db) -> None:
    secrets.set_ai_api_config_key(db, 1, "key-one")
    secrets.set_ai_api_config_key(db, 2, "key-two")
    secrets.clear_ai_api_config_key(db, 1)

    assert secrets.get_ai_api_config_key(db, 1) is None
    assert secrets.get_ai_api_config_key(db, 2) == "key-two"
