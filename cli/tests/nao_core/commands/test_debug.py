from unittest.mock import MagicMock, patch

import pytest

from nao_core.commands.debug import check_database_connection, check_llm_connection, debug
from nao_core.config.llm import LLMConfig, LLMProvider


class TestLLMConnection:
    """
    Tests for check_llm_connection.
    """

    def test_openai_connection_success(self):
        config = LLMConfig(provider=LLMProvider.OPENAI, api_key="sk-test-api-key")

        with patch("openai.OpenAI") as mock_openai_class:
            mock_client = MagicMock()
            mock_client.models.list.return_value = [MagicMock(), MagicMock(), MagicMock()]
            mock_openai_class.return_value = mock_client

            success, message = check_llm_connection(config)

            assert success is True
            assert "Connected successfully" in message
            assert "3 models available" in message
            mock_openai_class.assert_called_once_with(api_key="sk-test-api-key")

    def test_anthropic_connection_success(self):
        config = LLMConfig(provider=LLMProvider.ANTHROPIC, api_key="sk-test-api-key")

        with patch("anthropic.Anthropic") as mock_anthropic_class:
            mock_client = MagicMock()
            mock_client.models.list.return_value = [MagicMock(), MagicMock(), MagicMock()]
            mock_anthropic_class.return_value = mock_client

            success, message = check_llm_connection(config)

            assert success is True
            assert "Connected successfully" in message
            assert "3 models available" in message
            mock_anthropic_class.assert_called_once_with(api_key="sk-test-api-key")

    def test_unknown_provider_returns_failure(self):
        """Unknown provider should return False with error message."""
        config = MagicMock()
        config.provider.value = "super big model"

        success, message = check_llm_connection(config)

        assert success is False
        assert "Unknown provider" in message
        assert "super big model" in message

    def test_openai_exception_returns_failure(self):
        """API exception should return False with error message."""
        config = LLMConfig(provider=LLMProvider.OPENAI, api_key="invalid")

        with patch("openai.OpenAI") as mock_class:
            mock_class.return_value.models.list.side_effect = Exception("Invalid API key")

            success, message = check_llm_connection(config)

            assert success is False
            assert "Invalid API key" in message

    def test_anthropic_exception_returns_failure(self):
        """API exception should return False with error message."""
        config = LLMConfig(provider=LLMProvider.ANTHROPIC, api_key="invalid")

        with patch("anthropic.Anthropic") as mock_class:
            mock_class.return_value.models.list.side_effect = Exception("Authentication failed")

            success, message = check_llm_connection(config)

            assert success is False
            assert "Authentication failed" in message


class TestDatabaseConnection:
    """Tests for check_database_connection."""

    def test_connection_with_tables(self):
        mock_db = MagicMock()
        mock_db.dataset_id = "my_dataset"
        mock_conn = MagicMock()
        mock_conn.list_tables.return_value = ["table1", "table2"]
        mock_db.connect.return_value = mock_conn

        success, message = check_database_connection(mock_db)

        assert success is True
        assert "2 tables found" in message

    def test_connection_with_schemas(self):
        mock_db = MagicMock(spec=["connect", "name", "type"])  # no dataset_id
        mock_conn = MagicMock()
        mock_conn.list_databases.return_value = ["schema1", "schema2", "schema3"]
        mock_db.connect.return_value = mock_conn

        success, message = check_database_connection(mock_db)

        assert success is True
        assert "3 schemas found" in message

    def test_connection_fallback(self):
        mock_db = MagicMock(spec=["connect", "name", "type"])  # no dataset_id
        mock_conn = MagicMock(spec=[])  # no list_tables or list_databases
        mock_db.connect.return_value = mock_conn

        success, message = check_database_connection(mock_db)

        assert success is True
        assert "unable to list" in message

    def test_connection_failure(self):
        mock_db = MagicMock()
        mock_db.connect.side_effect = Exception("Connection refused")

        success, message = check_database_connection(mock_db)

        assert success is False
        assert "Connection refused" in message


class TestDebugCommand:
    """Tests for the debug() command."""

    def test_exits_when_no_config_found(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("NAO_DEFAULT_PROJECT_PATH", raising=False)

        with patch("nao_core.commands.debug.console"):
            with pytest.raises(SystemExit) as exc_info:
                debug()

            assert exc_info.value.code == 1
