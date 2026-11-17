"""Checks the catalog metadata utility without making network requests."""
import importlib.util
import io
import json
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).with_name("verify_openlibrary.py")
SPEC = importlib.util.spec_from_file_location("inko_verify_openlibrary", SCRIPT_PATH)
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)


def test_curated_manifest_is_read_and_written_at_fixed_path():
    with TemporaryDirectory() as tmp:
        manifest_path = Path(tmp) / "catalogo-obras.json"
        manifest_path.write_text(
            json.dumps(
                {
                    "obras": [
                        {
                            "id": "INK-0001",
                            "titulo": "Naruto",
                            "autorOuCriador": "Masashi Kishimoto",
                            "categoria": "Mangá",
                        }
                    ]
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        metadata = [{"key": "/works/OL123W", "title": "Naruto", "author_name": ["Masashi Kishimoto"]}]
        with (
            patch.object(verifier, "MANIFEST_PATH", manifest_path),
            patch.object(verifier, "search", return_value=metadata) as searched,
            patch.object(verifier.time, "sleep"),
            patch.object(verifier.sys, "stdout", io.StringIO()),
        ):
            verifier.main()

        verified = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert verified["obras"][0]["referencia"]["url"] == "https://openlibrary.org/works/OL123W"
        assert searched.called
        assert manifest_path.read_text(encoding="utf-8").endswith("\n")


def test_cli_rejects_untrusted_filenames_before_accessing_files():
    for attempted in ("../../outside.json", "/etc/passwd", "data/seeds/catalogo-obras.json"):
        result = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), attempted],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        assert result.returncode != 0
        assert "Usage:" in result.stderr
