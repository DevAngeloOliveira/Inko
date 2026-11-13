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


def rating_condition(metric, *, actual="1", threshold="1", comparator="GT"):
    return {"metricKey": metric, "status": "OK", "actualValue": actual, "errorThreshold": threshold,
            "comparator": comparator}


class SonarMainAuditTests(unittest.TestCase):
    def run_audit(
        self, *, revisions=(SHA,), status="OK", security="1.0", reliability="1.0",
        error=None, conditions=None, pages=(), pull_request=None, pr_commits=(SHA,), wait_seconds=20,
    ):
        now = 0
        revisions = list(revisions)
        pr_commits = list(pr_commits)
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
                return {"projectStatus": {"status": status, "conditions": conditions if conditions is not None else [
                    rating_condition("new_security_rating"),
                    rating_condition("new_reliability_rating"),
                ]}}
            if endpoint == "project_pull_requests/list":
                sha = pr_commits.pop(0) if len(pr_commits) > 1 else pr_commits[0]
                return {"pullRequests": [{"key": "11", "commit": {"sha": sha}}]}
            if endpoint == "measures/component":
                return {"component": {"measures": [
                    {"metric": "security_rating", "value": security},
                    {"metric": "reliability_rating", "value": reliability},
                ]}}
            if endpoint == "issues/search":
                page = params["p"]
                return pages[page - 1] if page <= len(pages) else {"total": 0, "issues": []}
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
            exit_code = AUDIT(
                strict=pull_request is None, expected_sha=SHA, pull_request=pull_request, wait_seconds=wait_seconds,
            )
        return exit_code, json.loads(out.getvalue()), calls

    def test_waits_for_exact_revision_and_queries_gate_by_analysis(self):
        exit_code, report, calls = self.run_audit(revisions=(OTHER, SHA))
        self.assertEqual(exit_code, 0)
        self.assertEqual(report["analyzedSha"], SHA)
        self.assertEqual(report["analysisId"], "analysis-a")
        self.assertEqual(report["overallReliabilityRating"], "A")
        self.assertIn(("qualitygates/project_status", {"analysisId": "analysis-a"}), calls)

    def test_unavailable_gate_or_wrong_revision_cannot_pass(self):
        for case in ({"revisions": (OTHER,)}, {"status": "NONE"}, {"error": "HTTP 401"}, {"error": "HTTP 403"}):
            with self.subTest(case=case):
                exit_code, report, calls = self.run_audit(**case)
                self.assertEqual(exit_code, 2)
                self.assertTrue(report["apiErrors"]["analysis"])
                self.assertNotIn("measures/component", [endpoint for endpoint, _ in calls])

    def test_failed_gate_or_security_rating_cannot_pass(self):
        for status in ("WARN", "ERROR"):
            self.assertEqual(self.run_audit(status=status)[0], 2)
        self.assertEqual(self.run_audit(security="3.0")[0], 3)
        self.assertEqual(self.run_audit(reliability="3.0")[0], 3)
        self.assertEqual(self.run_audit(reliability=None)[0], 3)
        self.assertEqual(self.run_audit(conditions=[{"status": "ERROR"}])[0], 2)
        self.assertEqual(self.run_audit(conditions=[{"metricKey": "new_security_rating", "status": "OK"}])[0], 2)

    def test_new_code_requires_rating_a_and_the_original_threshold(self):
        security = rating_condition("new_security_rating")
        for metric in ("new_reliability_rating", "new_software_quality_reliability_rating"):
            with self.subTest(metric=metric):
                self.assertEqual(self.run_audit(conditions=[security, rating_condition(metric)])[0], 0)
                for overrides in ({"actual": "2"}, {"threshold": "2"}, {"actual": None}, {"comparator": "LT"}):
                    self.assertEqual(self.run_audit(conditions=[security, rating_condition(metric, **overrides)])[0], 2)

    def test_expired_deadline_does_not_read_sonar(self):
        exit_code, _, calls = self.run_audit(wait_seconds=0)
        self.assertEqual(exit_code, 2)
        self.assertEqual(calls, [])

    def test_branch_change_during_metrics_read_invalidates_evidence(self):
        exit_code, report, _ = self.run_audit(revisions=(SHA, OTHER))
        self.assertEqual(exit_code, 2)
        self.assertEqual(report["overallSecurityRating"], "unknown")
        self.assertEqual(report["overallReliabilityRating"], "unknown")

    def test_inventory_deduplicates_and_preserves_multi_quality_and_legacy_issues(self):
        legacy = {"key": "bug", "type": "BUG", "line": 5, "status": "OPEN"}
        mixed = {
            "key": "mixed", "rule": "ts:ABC", "component": "DevAngeloOliveira_Inko:file.ts",
            "textRange": {"startLine": 7, "endLine": 9}, "issueStatus": "OPEN", "severity": "MAJOR",
            "impacts": [{"softwareQuality": "RELIABILITY"}, {"softwareQuality": "MAINTAINABILITY"}],
        }
        security = {"key": "vuln", "type": "VULNERABILITY"}
        pages = ({"total": 3, "issues": [legacy, mixed]}, {"total": 3, "issues": [mixed, security]})
        _, report, calls = self.run_audit(pages=pages)
        self.assertEqual(report["openIssuesFetched"], 3)
        self.assertEqual([i["key"] for i in report["reliabilityIssues"]], ["bug", "mixed"])
        self.assertEqual([i["key"] for i in report["securityIssues"]], ["vuln"])
        issue = report["maintainabilityIssues"][0]
        self.assertEqual((issue["file"], issue["line"], issue["textRange"]["endLine"], issue["status"]),
                         ("file.ts", 7, 9, "OPEN"))
        self.assertEqual([params["p"] for endpoint, params in calls if endpoint == "issues/search"], [1, 2])

    def test_truncated_or_malformed_inventory_cannot_pass(self):
        for pages, code in (
            (({"total": 2, "issues": [{"key": "first", "type": "BUG"}]}, {"total": 2, "issues": []}), 4),
            (({"total": 1, "issues": [{"type": "BUG"}]},), 2),
            (({"total": 1, "issues": [{"key": "first", "impacts": [{}]}]},), 2),
        ):
            with self.subTest(pages=pages):
                self.assertEqual(self.run_audit(pages=pages)[0], code)

    def test_summary_cells_escape_table_and_link_syntax(self):
        escape = AUDIT.__globals__["markdown_cell"]
        self.assertEqual(escape("[text](url)|<b>\nnext"),
                         "&#91;text&#93;&#40;url&#41;&#124;&#60;b&#62; next")

    def test_pr_diagnostic_uses_head_revision_and_discards_stale_results(self):
        code, report, calls = self.run_audit(pull_request=11, reliability="3.0")
        self.assertEqual(code, 0)
        self.assertEqual(report["analyzedSha"], SHA)
        self.assertEqual(report["overallReliabilityRating"], "C")
        self.assertTrue(all(params["pullRequest"] == 11 for endpoint, params in calls
                            if endpoint != "project_pull_requests/list"))
        for commits in ((OTHER,), (SHA, OTHER)):
            _, stale, _ = self.run_audit(pull_request=11, pr_commits=commits)
            self.assertTrue(stale["apiErrors"]["analysis"])
            self.assertEqual(stale["qualityGate"], "UNAVAILABLE")
            self.assertEqual(stale["overallReliabilityRating"], "unknown")


if __name__ == "__main__":
    unittest.main()
