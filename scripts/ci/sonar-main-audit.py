import argparse
import base64
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

HOST = "https://sonarcloud.io"
PROJECT = "DevAngeloOliveira_Inko"

def fetch(endpoint, params):
    url = HOST + "/api/" + endpoint + "?" + urlencode(params)
    headers = {"Accept": "application/json", "User-Agent": "inko-security-audit/1.0"}
    token = os.getenv("SONAR_TOKEN", "")
    if token:
        credentials = base64.b64encode((token + ":").encode()).decode()
        headers["Authorization"] = "Basic " + credentials
    try:
        with urlopen(Request(url, headers=headers), timeout=30) as response:
            return json.load(response)
    except (HTTPError, URLError, ValueError) as error:
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

def retrieve_issues(target):
    issues = []
    total = None
    for page in range(1, 11):
        payload = fetch("issues/search", {
            "componentKeys": PROJECT,
            "resolved": "false",
            "ps": 100,
            "p": page,
            **target,
        })
        if "error" in payload:
            return {"error": payload["error"], "issues": issues}
        total = payload.get("total", 0)
        issues.extend(payload.get("issues", []))
        if len(issues) >= total:
            break
    return {"issues": issues, "total": total, "truncated": total is not None and len(issues) < total}

def rating(value):
    return {"1.0": "A", "2.0": "B", "3.0": "C", "4.0": "D", "5.0": "E"}.get(str(value), "unknown")

def audit(strict=False, pull_request=None):
    target = {"pullRequest": pull_request} if pull_request else {"branch": "main"}
    gate_response = fetch("qualitygates/project_status", {"projectKey": PROJECT, **target})
    gate = gate_response.get("projectStatus") or {}
    status = gate.get("status", "UNAVAILABLE")
    measures = fetch("measures/component", {
        "component": PROJECT,
        **target,
        "metricKeys": "security_rating,reliability_rating,sqale_rating,alert_status",
    })
    found = {}
    for metric in (measures.get("component") or {}).get("measures", []):
        found[metric["metric"]] = metric.get("value")
    issue_report = retrieve_issues(target)
    security_issues = issue_security(issue_report.get("issues", []))
    result = {
        "project": PROJECT,
        "branch": "main" if not pull_request else None,
        "pullRequest": pull_request,
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
    args = parser.parse_args()
    sys.exit(audit(args.strict, args.pull_request))
