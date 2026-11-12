import json
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
from runpy import run_path
from unittest.mock import patch


AUDIT = run_path(Path(__file__).with_name("sonar-main-audit.py"))["audit"]
SHA = "a" * 40
OTHER = "b" * 40


class SonarMainAuditTests(unittest.TestCase):
    def run_audit(self, *, revisions=(SHA,), status="OK", security="1.0", error=None):
        now = 0
        revisions = list(revisions)
        calls = []

        def fetch(endpoint, params, *, timeout):
            calls.append((endpoint, params))
            self.assertGreater(timeout, 0)
            if endpoint == "project_analyses/search":
                if error:
                    return {"error": error}
                sha = revisions.pop(0) if len(revisions) > 1 else revisions[0]
                return {"analyses": [{"revision": sha, "key": f"analysis-{sha[0]}"}]}
            if endpoint == "qualitygates/project_status":
                return {"projectStatus": {"status": status}}
            if endpoint == "measures/component":
                return {"component": {"measures": [{"metric": "security_rating", "value": security}]}}
            if endpoint == "issues/search":
                return {"total": 0, "issues": []}
            raise AssertionError(endpoint)

        def sleep(seconds):
            nonlocal now
            now += seconds

        out = StringIO()
        with (
            patch.dict(AUDIT.__globals__, fetch=fetch, monotonic=lambda: now, sleep=sleep),
            patch.dict("os.environ", {"GITHUB_STEP_SUMMARY": ""}),
            redirect_stdout(out),
            redirect_stderr(StringIO()),
        ):
            exit_code = AUDIT(strict=True, expected_sha=SHA, wait_seconds=20)
        return exit_code, json.loads(out.getvalue()), calls

    def test_waits_for_exact_revision_and_queries_gate_by_analysis(self):
        exit_code, report, calls = self.run_audit(revisions=(OTHER, SHA))
        self.assertEqual(exit_code, 0)
        self.assertEqual(report["analyzedSha"], SHA)
        self.assertEqual(report["analysisId"], "analysis-a")
        self.assertIn(("qualitygates/project_status", {"analysisId": "analysis-a"}), calls)

    def test_unavailable_gate_or_wrong_revision_cannot_pass(self):
        for case in ({"revisions": (OTHER,)}, {"status": "NONE"}, {"error": "HTTP 403"}):
            with self.subTest(case=case):
                exit_code, report, calls = self.run_audit(**case)
                self.assertEqual(exit_code, 2)
                self.assertTrue(report["apiErrors"]["analysis"])
                self.assertNotIn("measures/component", [endpoint for endpoint, _ in calls])

    def test_failed_gate_or_security_rating_cannot_pass(self):
        self.assertEqual(self.run_audit(status="ERROR")[0], 2)
        self.assertEqual(self.run_audit(security="2.0")[0], 3)

    def test_branch_change_during_metrics_read_invalidates_evidence(self):
        exit_code, report, _ = self.run_audit(revisions=(SHA, OTHER))
        self.assertEqual(exit_code, 2)
        self.assertEqual(report["overallSecurityRating"], "unknown")


if __name__ == "__main__":
    unittest.main()
