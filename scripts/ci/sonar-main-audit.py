import argparse
import base64
import json
import os
import re
import sys
from time import monotonic, sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

HOST = "https://sonarcloud.io"
PROJECT = "DevAngeloOliveira_Inko"
QUALITIES = {
    "SECURITY": "securityIssues",
    "RELIABILITY": "reliabilityIssues",
    "MAINTAINABILITY": "maintainabilityIssues",
}
LEGACY_QUALITIES = {"VULNERABILITY": "SECURITY", "BUG": "RELIABILITY", "CODE_SMELL": "MAINTAINABILITY"}
REQUIRED_CONDITIONS = {"security_rating", "reliability_rating"}

def fetch(endpoint, params, *, timeout=30):
    url = HOST + "/api/" + endpoint + "?" + urlencode(params)
    headers = {"Accept": "application/json", "User-Agent": "inko-security-audit/1.0"}
    token = os.getenv("SONAR_TOKEN", "")
    if token:
        credentials = base64.b64encode((token + ":").encode()).decode()
        headers["Authorization"] = "Basic " + credentials
    try:
        with urlopen(Request(url, headers=headers), timeout=timeout) as response:
            payload = json.load(response)
            return payload if isinstance(payload, dict) else {"error": "Invalid API response"}
    except (HTTPError, URLError, OSError, ValueError) as error:
        code = getattr(error, "code", None)
        return {"error": "HTTP " + str(code) if code else type(error).__name__}

def inventory_by_quality(issues):
    results = {field: [] for field in QUALITIES.values()}
    for issue in issues:
        impacts = issue.get("impacts") or []
        qualities = {impact["softwareQuality"] for impact in impacts}
        legacy = LEGACY_QUALITIES.get(issue.get("type"))
        if legacy and (not qualities or legacy != "MAINTAINABILITY"):
            qualities.add(legacy)
        text_range = issue.get("textRange") or {}
        entry = {
            "file": (issue.get("component") or "").removeprefix(PROJECT + ":"),
            "line": text_range.get("startLine", issue.get("line")),
            "textRange": text_range,
            "rule": issue.get("rule"),
            "message": issue.get("message"),
            "severity": issue.get("severity"),
            "impacts": impacts,
            "status": issue.get("issueStatus") or issue.get("status"),
            "type": issue.get("type"),
            "key": issue["key"],
        }
        for quality in sorted(qualities.intersection(QUALITIES)):
            results[QUALITIES[quality]].append(entry)
    return results


def valid_issue(issue):
    if not isinstance(issue, dict) or not isinstance(issue.get("key"), str) or not issue["key"].strip():
        return False
    if any(issue.get(field) is not None and not isinstance(issue[field], str)
           for field in ("component", "rule", "message", "severity", "issueStatus", "status", "type")):
        return False
    if issue.get("textRange") is not None and not isinstance(issue["textRange"], dict):
        return False
    impacts = issue.get("impacts")
    if impacts is not None and (not isinstance(impacts, list) or not all(
        isinstance(impact, dict) and isinstance(impact.get("softwareQuality"), str)
        for impact in impacts
    )):
        return False
    return any(impact["softwareQuality"] in QUALITIES for impact in impacts or ()) or issue.get("type") in LEGACY_QUALITIES


def retrieve_issues(target, read):
    issues = {}
    total = None
    for page in range(1, 11):
        payload = read("issues/search", {
            "componentKeys": PROJECT,
            "resolved": "false",
            "ps": 100,
            "p": page,
            **target,
        })
        if "error" in payload:
            return {"error": payload["error"], "issues": list(issues.values()), "total": total}
        paging = payload.get("paging", {})
        if not isinstance(paging, dict):
            return {"error": "Invalid issue inventory", "issues": list(issues.values()), "total": total}
        page_total = paging.get("total", payload.get("total"))
        items = payload.get("issues")
        if (type(page_total) is not int or page_total < 0 or (total is not None and page_total != total)
                or not isinstance(items, list) or len(items) > 100
                or paging.get("pageIndex", page) != page or not all(map(valid_issue, items))):
            return {"error": "Invalid issue inventory", "issues": list(issues.values()), "total": total}
        total = page_total
        for item in items:
            issues.setdefault(item["key"], item)
        if len(issues) > total:
            return {"error": "Invalid issue inventory", "issues": list(issues.values()), "total": total}
        if len(issues) == total or not items:
            break
    return {"issues": list(issues.values()), "total": total, "truncated": len(issues) != total}

def rating(value):
    normalized = str(value).removesuffix(".0")
    if normalized in ("A", "B", "C", "D", "E"):
        return normalized
    return dict(zip("12345", "ABCDE")).get(normalized, "unknown")

def latest_main_analysis(read):
    result = read("project_analyses/search", {"project": PROJECT, "branch": "main", "ps": 1})
    if "error" in result:
        return result
    analyses = result.get("analyses")
    if not isinstance(analyses, list) or not all(isinstance(item, dict) for item in analyses):
        return {"error": "Invalid main analysis inventory"}
    return analyses[0] if analyses else {}


def latest_pr_analysis(read, number):
    result = read("project_pull_requests/list", {"project": PROJECT})
    if "error" in result:
        return result
    pull_requests = result.get("pullRequests")
    if not isinstance(pull_requests, list) or not all(isinstance(item, dict) for item in pull_requests):
        return {"error": "Invalid pull request analysis inventory"}
    for pull_request in pull_requests:
        if str(pull_request.get("key")) == str(number):
            commit = pull_request.get("commit")
            revision = commit.get("sha") if isinstance(commit, dict) else commit
            if not isinstance(revision, str) or not re.fullmatch(r"[0-9a-f]{40}", revision):
                return {"error": "Pull request analysis has no full commit SHA"}
            return {"revision": revision, "date": pull_request.get("analysisDate")}
    return {"error": "No analysis for this pull request"}


def wait_for_gate(read, expected_sha, deadline):
    while True:
        analysis = latest_main_analysis(read)
        gate = {}
        if analysis.get("revision") == expected_sha and analysis.get("key"):
            gate = read("qualitygates/project_status", {"analysisId": analysis["key"]})
            status = gate.get("projectStatus")
            if isinstance(status, dict) and status.get("status") in ("OK", "WARN", "ERROR"):
                return analysis, gate, None
        error = analysis.get("error") or gate.get("error")
        remaining = deadline - monotonic()
        if remaining <= 0 or error in {"HTTP 401", "HTTP 403"}:
            return analysis, gate, error or "No calculated gate for the expected main revision"
        sleep(min(10, remaining))


def markdown_cell(value):
    raw = " ".join(str(value or "").split())
    return "".join(character if character.isalnum() or character == " " else f"&#{ord(character)};" for character in raw)


def gate_conditions_ok(conditions):
    if not isinstance(conditions, list) or not all(
        isinstance(condition, dict) and isinstance(condition.get("metricKey"), str)
        and condition.get("status") == "OK" for condition in conditions
    ):
        return False
    ratings = set()
    for condition in conditions:
        metric = condition["metricKey"]
        if not metric.startswith("new_"):
            continue
        quality = metric.removeprefix("new_").removeprefix("software_quality_")
        if quality in REQUIRED_CONDITIONS:
            if condition.get("comparator") != "GT" or any(
                rating(condition.get(field)) != "A" for field in ("actualValue", "errorThreshold")
            ):
                return False
            ratings.add(quality)
    return ratings == REQUIRED_CONDITIONS


def audit(strict=False, pull_request=None, expected_sha=None, wait_seconds=600):
    target = {"pullRequest": pull_request} if pull_request else {"branch": "main"}
    deadline = monotonic() + wait_seconds

    def read(endpoint, params):
        timeout = min(30, deadline - monotonic()) if strict else 30
        if timeout <= 0:
            return {"error": "Analysis wait deadline exceeded"}
        return fetch(endpoint, params, timeout=timeout)

    analysis, analysis_error = {}, None
    if strict:
        analysis, gate_response, analysis_error = wait_for_gate(read, expected_sha, deadline)
    else:
        if pull_request:
            analysis = latest_pr_analysis(read, pull_request)
            if not expected_sha or analysis.get("revision") != expected_sha:
                analysis_error = analysis.get("error") or "SonarCloud pull request analysis does not match the expected head"
        gate_response = {} if analysis_error else read("qualitygates/project_status", {"projectKey": PROJECT, **target})
    gate = gate_response.get("projectStatus")
    if not isinstance(gate, dict):
        gate = {}
    conditions = gate.get("conditions")
    status = gate.get("status", "UNAVAILABLE")
    if status not in ("OK", "WARN", "ERROR", "NONE"):
        status = "UNAVAILABLE"
    measures = {} if analysis_error else read("measures/component", {
        "component": PROJECT,
        **target,
        "metricKeys": "security_rating,reliability_rating,sqale_rating,alert_status",
    })
    found = {}
    for metric in (measures.get("component") or {}).get("measures", []):
        found[metric["metric"]] = metric.get("value")
    issue_report = {} if analysis_error else retrieve_issues(target, read)
    if (strict or pull_request) and not analysis_error:
        final_analysis = latest_main_analysis(read) if strict else latest_pr_analysis(read, pull_request)
        identity_fields = ("key", "revision") if strict else ("revision", "date")
        if any(final_analysis.get(field) != analysis.get(field) for field in identity_fields):
            analysis_error = final_analysis.get("error") or "SonarCloud analysis changed during the audit"
            found = {}
            issue_report = {}
            if pull_request:
                status = "UNAVAILABLE"
                conditions = []
    inventories = inventory_by_quality(issue_report.get("issues", []))
    result = {
        "project": PROJECT,
        "branch": "main" if not pull_request else None,
        "pullRequest": pull_request,
        "expectedSha": expected_sha,
        "analyzedSha": analysis.get("revision"),
        "analysisId": analysis.get("key") if analysis.get("revision") == expected_sha else None,
        "qualityGate": status,
        "qualityGateConditions": conditions or [],
        "overallSecurityRating": rating(found.get("security_rating")),
        "overallReliabilityRating": rating(found.get("reliability_rating")),
        "overallMetrics": found,
        "openIssuesFetched": len(issue_report.get("issues", [])),
        "openIssuesTotal": issue_report.get("total"),
        "issueListTruncated": issue_report.get("truncated", False),
        **inventories,
        "apiErrors": {
            "analysis": analysis_error,
            "gate": gate_response.get("error"),
            "measures": measures.get("error"),
            "issues": issue_report.get("error"),
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    summary_path = os.getenv("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as out:
            out.write("## SonarCloud quality audit\n")
            if expected_sha:
                out.write(f"**Expected SHA:** {markdown_cell(expected_sha)}  \n")
                out.write(f"**Analyzed SHA:** {markdown_cell(result['analyzedSha'] or 'unavailable')}  \n")
            if strict:
                out.write(f"**Analysis ID:** {markdown_cell(result['analysisId'] or 'unavailable')}  \n")
            out.write("**Quality Gate:** " + markdown_cell(status) + "  \n")
            out.write("**Overall Security Rating:** " + result["overallSecurityRating"] + "  \n")
            out.write("**Overall Reliability Rating:** " + result["overallReliabilityRating"] + "  \n")
            out.write(f"**Unique open issues:** {result['openIssuesFetched']} / {result['openIssuesTotal']}  \n")
            if result["issueListTruncated"]:
                out.write("**Inventory truncated.**  \n")
            for key, error in result["apiErrors"].items():
                if error:
                    out.write("**API " + key + ":** " + markdown_cell(error) + "  \n")
            for quality, field in QUALITIES.items():
                issues = inventories[field]
                out.write(f"\n### {quality} ({len(issues)})\n")
                if not issues:
                    continue
                out.write("\n| File | Start | End | Rule | Key | Status | Severity | Impacts | Finding |\n"
                          "| --- | ---: | ---: | --- | --- | --- | --- | --- | --- |\n")
                for issue in issues[:50]:
                    impacts = ", ".join(
                        f"{impact['softwareQuality']}/{impact.get('severity', '?')}" for impact in issue["impacts"]
                    )
                    values = [issue["file"], issue["line"], issue["textRange"].get("endLine"),
                              issue["rule"], issue["key"], issue["status"], issue["severity"], impacts, issue["message"]]
                    values = list(map(markdown_cell, values))
                    out.write("| " + " | ".join(values) + " |\n")
                if len(issues) > 50:
                    out.write("\nShowing 50 rows. Full inventory is in the JSON output.\n")
    if not strict:
        return 0
    if any(result["apiErrors"].values()):
        print("Cannot verify main gate: SonarCloud API unavailable or requires access.", file=sys.stderr)
        return 2
    if status != "OK" or not gate_conditions_ok(conditions):
        print("Main Quality Gate must be computed and OK, got " + status, file=sys.stderr)
        return 2
    if result["overallSecurityRating"] != "A" or result["overallReliabilityRating"] != "A":
        print("Main overall Security and Reliability ratings must both be A", file=sys.stderr)
        return 3
    if issue_report.get("truncated"):
        print("Incomplete issue inventory", file=sys.stderr)
        return 4
    return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--pull-request", type=int)
    parser.add_argument("--expected-sha", default=os.getenv("GITHUB_SHA"))
    args = parser.parse_args()
    if args.strict and args.pull_request is not None:
        parser.error("--strict is only supported for main")
    if (args.strict or args.pull_request is not None) and not re.fullmatch(r"[0-9a-f]{40}", args.expected_sha or ""):
        parser.error("Supply the full main revision or PR head with --expected-sha")
    sys.exit(audit(args.strict, args.pull_request, args.expected_sha if args.strict or args.pull_request else None))
