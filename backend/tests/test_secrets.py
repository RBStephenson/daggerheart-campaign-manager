import os

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.services import secrets
from tests.conftest import make_user


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


# --- ensure_fernet_key (DHCM-100) -------------------------------------------


@pytest.fixture()
def env_file(tmp_path, monkeypatch):
    path = tmp_path / ".env"
    monkeypatch.setenv("DHCM_ENV_FILE", str(path))
    monkeypatch.delenv("DHCM_FERNET_KEY", raising=False)
    yield path
    # ensure_fernet_key sets os.environ directly (production behavior, not
    # via monkeypatch), so undo that leak into later tests explicitly.
    monkeypatch.delenv("DHCM_FERNET_KEY", raising=False)


def test_no_op_when_no_gm_account_exists(db, env_file) -> None:
    secrets.ensure_fernet_key(db)

    assert not env_file.exists()
    assert "DHCM_FERNET_KEY" not in os.environ


def test_no_op_when_users_table_does_not_exist_yet(env_file) -> None:
    # Regression: app booting ahead of migrations (or, as in CI, a shared
    # SessionLocal engine whose schema another test dropped) must not crash
    # -- there can't be a GM account without a users table either, so this
    # is just the "not yet" outcome, not a real error.
    engine = create_engine("sqlite://")  # no Base.metadata.create_all()
    empty_db = sessionmaker(bind=engine)()
    try:
        secrets.ensure_fernet_key(empty_db)
    finally:
        empty_db.close()

    assert not env_file.exists()
    assert "DHCM_FERNET_KEY" not in os.environ


def test_generates_and_persists_key_once_a_gm_exists(db, env_file) -> None:
    make_user(db, username="gm-one", role="gm")

    secrets.ensure_fernet_key(db)

    assert env_file.exists()
    content = env_file.read_text(encoding="utf-8")
    assert "DHCM_FERNET_KEY=" in content
    assert os.environ.get("DHCM_FERNET_KEY")


def test_reuses_existing_key_across_a_simulated_restart(db, env_file, monkeypatch) -> None:
    make_user(db, username="gm-one", role="gm")
    secrets.ensure_fernet_key(db)
    first_key = os.environ["DHCM_FERNET_KEY"]
    first_content = env_file.read_text(encoding="utf-8")

    # Simulate a process restart: env var is gone from this process, but
    # .env on disk (and the data it already encrypted) persists -- on a real
    # restart docker-compose would re-read .env and re-inject the same
    # value, which this reproduces directly rather than re-parsing the file.
    monkeypatch.delenv("DHCM_FERNET_KEY", raising=False)
    secrets.reset_cache()
    monkeypatch.setenv("DHCM_FERNET_KEY", first_key)

    secrets.ensure_fernet_key(db)

    assert os.environ["DHCM_FERNET_KEY"] == first_key
    assert env_file.read_text(encoding="utf-8") == first_content


def test_does_not_overwrite_or_duplicate_an_already_persisted_key(db, env_file) -> None:
    make_user(db, username="gm-one", role="gm")
    secrets.ensure_fernet_key(db)
    first_content = env_file.read_text(encoding="utf-8")

    # Env var still set from the first call (same process) -- calling again
    # (e.g. a second lifespan hook, or DHCM-101's setup endpoint firing
    # right after the env-var bootstrap already did) must be a clean no-op.
    secrets.ensure_fernet_key(db)

    assert env_file.read_text(encoding="utf-8") == first_content
    assert first_content.count("DHCM_FERNET_KEY=") == 1


def test_does_not_fire_when_env_var_already_set_by_operator(db, env_file, monkeypatch) -> None:
    make_user(db, username="gm-one", role="gm")
    monkeypatch.setenv("DHCM_FERNET_KEY", Fernet.generate_key().decode())

    secrets.ensure_fernet_key(db)

    assert not env_file.exists()


def test_appends_to_existing_env_file_content(db, env_file) -> None:
    env_file.write_text("SOME_OTHER_VAR=1\n", encoding="utf-8")
    make_user(db, username="gm-one", role="gm")

    secrets.ensure_fernet_key(db)

    content = env_file.read_text(encoding="utf-8")
    assert "SOME_OTHER_VAR=1" in content
    assert "DHCM_FERNET_KEY=" in content
