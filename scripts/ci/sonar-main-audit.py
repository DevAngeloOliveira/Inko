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

def issue_security(issues):
    results = []
    for issue in issues:
        impacts = issue.get("impacts") or []
        qualities = {impact.get("softwareQuality") for impact in impacts}
        if "SECURITY" in qualities or issue.get("type") == "VULNERABILITY":
            results.append(issue)
    return results

def retrieve_issues(target, read):
    issues = []
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
            return {"error": payload["error"], "issues": issues}
        total = payload.get("total")
        items = payload.get("issues")
        if not isinstance(total, int) or total < 0 or not isinstance(items, list):
            return {"error": "Invalid issue inventory", "issues": issues}
        issues.extend(items)
        if len(issues) >= total:
            break
    return {"issues": issues, "total": total, "truncated": total is not None and len(issues) < total}

def rating(value):
    return dict(zip("12345", "ABCDE")).get(str(value).removesuffix(".0"), "unknown")

def latest_main_analysis(read):
    result = read("project_analyses/search", {"project": PROJECT, "branch": "main", "ps": 1})
    if "error" in result:
        return result
    analyses = result.get("analyses") or []
    return analyses[0] if analyses else {}


def wait_for_gate(read, expected_sha, deadline):
    while True:
        analysis = latest_main_analysis(read)
        gate = {}
        if analysis.get("revision") == expected_sha and analysis.get("key"):
            gate = read("qualitygates/project_status", {"analysisId": analysis["key"]})
            if (gate.get("projectStatus") or {}).get("status") in {"OK", "WARN", "ERROR"}:
                return analysis, gate, None
        error = analysis.get("error") or gate.get("error")
        remaining = deadline - monotonic()
        if remaining <= 0 or error in {"HTTP 401", "HTTP 403"}:
            return analysis, gate, error or "No calculated gate for the expected main revision"
        sleep(min(10, remaining))


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
        gate_response = read("qualitygates/project_status", {"projectKey": PROJECT, **target})
    gate = gate_response.get("projectStatus") or {}
    status = gate.get("status", "UNAVAILABLE")
    measures = {} if analysis_error else read("measures/component", {
        "component": PROJECT,
        **target,
        "metricKeys": "security_rating,reliability_rating,sqale_rating,alert_status",
    })
    found = {}
    for metric in (measures.get("component") or {}).get("measures", []):
        found[metric["metric"]] = metric.get("value")
    issue_report = {} if analysis_error else retrieve_issues(target, read)
    if strict and not analysis_error:
        final_analysis = latest_main_analysis(read)
        if (final_analysis.get("key"), final_analysis.get("revision")) != (analysis["key"], expected_sha):
            analysis_error = final_analysis.get("error") or "Main analysis changed during the audit"
            found = {}
            issue_report = {}
    security_issues = issue_security(issue_report.get("issues", []))
    result = {
        "project": PROJECT,
        "branch": "main" if not pull_request else None,
        "pullRequest": pull_request,
        "expectedSha": expected_sha,
        "analyzedSha": analysis.get("revision"),
        "analysisId": analysis.get("key") if analysis.get("revision") == expected_sha else None,
        "qualityGate": status,
        "qualityGateConditions": gate.get("conditions", []),
        "overallSecurityRating": rating(found.get("security_rating")),
        "overallMetrics": found,
        "openIssuesFetched": len(issue_report.get("issues", [])),
        "openIssuesTotal": issue_report.get("total"),
        "issueListTruncated": issue_report.get("truncated", False),
        "securityIssues": [
            {
                "file": issue.get("component", "").replace(PROJECT + ":", ""),
                "line": (issue.get("textRange") or {}).get("startLine"),
                "rule": issue.get("rule"),
                "message": issue.get("message"),
                "severity": issue.get("severity"),
                "impacts": issue.get("impacts", []),
                "key": issue.get("key"),
            }
            for issue in security_issues
        ],
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
            out.write("## SonarCloud / main security audit\n")
            if strict:
                out.write(f"**Expected SHA:** {expected_sha}  \n")
                out.write(f"**Analyzed SHA:** {result['analyzedSha'] or 'unavailable'}  \n")
                out.write(f"**Analysis ID:** {result['analysisId'] or 'unavailable'}  \n")
            out.write("**Quality Gate:** " + status + "  \n")
            out.write("**Overall Security Rating:** " + result["overallSecurityRating"] + "  \n")
            out.write("**Security issues identified:** " + str(len(security_issues)) + "  \n")
            for key, error in result["apiErrors"].items():
                if error:
                    out.write("**API " + key + ":** " + error + "  \n")
            if security_issues:
                out.write("\n| File | Line | Rule | Finding |\n| --- | ---: | --- | --- |\n")
                for issue in security_issues[:50]:
                    values = [str(issue.get(field) or "").replace("|", "/").replace("\n", " ") for field in ("file", "line", "rule", "message")]
                    out.write("| " + " | ".join(values) + " |\n")
    if not strict:
        return 0
    if any(result["apiErrors"].values()):
        print("Cannot verify main gate: SonarCloud API unavailable or requires access.", file=sys.stderr)
        return 2
    if status != "OK":
        print("Main Quality Gate must be computed and OK, got " + status, file=sys.stderr)
        return 2
    if result["overallSecurityRating"] != "A":
        print("Main overall Security Rating must be A, got " + result["overallSecurityRating"], file=sys.stderr)
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
    if args.strict and (args.pull_request or not re.fullmatch(r"[0-9a-f]{40}", args.expected_sha or "")):
        parser.error("--strict requires a full main revision via --expected-sha or GITHUB_SHA")
    sys.exit(audit(args.strict, args.pull_request, args.expected_sha if args.strict else None))
