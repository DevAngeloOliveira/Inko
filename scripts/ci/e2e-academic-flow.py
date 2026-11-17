"""Fluxo acadêmico obrigatório do INKO contra o Gateway real (Compose + PostgreSQL).

Uso: python scripts/ci/e2e-academic-flow.py [URL_DO_GATEWAY] [--warmup]

Antes das verificações, aquece cada serviço Java com leituras e requisições inválidas
(respostas 4xx, sem gravar nada): a primeira chamada de uma JVM recém-iniciada pode
passar do prazo de 2 s do Gateway. Com --warmup, só aquece e encerra.

Contra o BFF do Next (SDD-002), as rotas privadas exigem sessão de operador: defina
INKO_E2E_EMAIL e INKO_E2E_PASSWORD (nunca commitados) e o script entra por
/api/auth/session, guarda o cookie HttpOnly e envia `Origin` nas mutações.
"""
import http.cookiejar
import os
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

ARGS = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
BASE = (ARGS[0] if ARGS else "http://127.0.0.1:8000").rstrip("/")
WARMUP = [
    ("GET", "/api/v1/livros", None), ("GET", "/api/v1/usuarios", None), ("GET", "/api/v1/emprestimos", None),
    ("GET", "/api/v1/emprestimos/ativos", None), ("GET", "/api/v1/livros/INK-0001/disponibilidade", None),
    ("GET", "/api/v1/relatorios/multas?referenceDate=2026-11-09", None),
    ("GET", "/api/v1/relatorios/estatisticas?referenceDate=2026-11-09", None),
    ("POST", "/api/v1/livros", {"id": "INVALIDO"}), ("POST", "/api/v1/usuarios", {"nome": ""}),
    ("POST", "/api/v1/emprestimos", {"livroId": "INK-0000", "usuarioId": "USR-0000"}),
    ("POST", "/api/v1/emprestimos/EMP-0/devolucao", {}), ("GET", "/api/v1/emprestimos/EMP-0", None),
    ("GET", "/api/v1/emprestimos/atrasados?referenceDate=2026-11-09", None),
]
REFERENCIA = "2026-11-09"
STEPS = []
COOKIES = http.cookiejar.CookieJar()
OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(COOKIES))


def call(method, path, body=None):
    for _ in range(10):
        status, payload, retry_after = attempt(method, path, body)
        if not (status == 429 and isinstance(payload, dict) and payload.get("code") == "RATE_LIMITED"):
            return status, payload
        time.sleep(min(float(retry_after or 1), 5))
    return status, payload


def attempt(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, method=method)
    if data is not None:
        request.add_header("Content-Type", "application/json")
    if method != "GET":
        request.add_header("Origin", BASE)
    try:
        with OPENER.open(request, timeout=5) as response:
            return response.status, json.loads(response.read() or b"null"), None
    except urllib.error.HTTPError as error:
        payload = error.read()
        return error.code, json.loads(payload) if payload else None, error.headers.get("Retry-After")


def cents(value):
    return int(Decimal(str(value)) * 100)


def step(name, condition, detail=""):
    STEPS.append((name, condition))
    print(("PASS " if condition else "FAIL ") + name + (f" — {detail}" if detail and not condition else ""))
    if not condition:
        raise SystemExit(1)


def sign_in():
    email, password = os.environ.get("INKO_E2E_EMAIL"), os.environ.get("INKO_E2E_PASSWORD")
    if not email or not password:
        return
    deadline = time.monotonic() + 90
    while True:
        try:
            status, _ = call("POST", "/api/auth/session", {"email": email, "senha": password})
        except OSError:
            status = 0
        if status == 200:
            print("Sessão de operador aberta no BFF.")
            return
        if status == 404:
            return
        if status in (401, 403, 429) or time.monotonic() > deadline:
            raise SystemExit(f"Login de operador falhou: HTTP {status}")
        time.sleep(1)


def warm_up(timeout=90):
    deadline = time.monotonic() + timeout
    for method, path, body in WARMUP:
        while True:
            try:
                status, _ = call(method, path, body)
            except OSError:
                status = 0
            if 0 < status < 500:
                break
            if time.monotonic() > deadline:
                raise SystemExit(f"Serviços não responderam a tempo: {method} {path} → {status}")
            time.sleep(1)
    print(f"Serviços aquecidos ({len(WARMUP)} rotas).")


def free_book_id():
    for number in range(9000, 10000):
        candidate = f"INK-{number}"
        if call("GET", f"/api/v1/livros/{candidate}")[0] == 404:
            return candidate
    raise SystemExit("Sem identificador livre para o teste")


def main():
    sign_in()
    warm_up()
    if "--warmup" in sys.argv:
        return
    suffix = str(int(time.time()))[-6:]
    book_id = free_book_id()

    status, book = call("POST", "/api/v1/livros", {
        "id": book_id, "titulo": "Fluxo Integrado", "autor": "Equipe INKO", "categoria": "Mangá", "volume": "Vol. 1",
    })
    step("RF-01 cadastrar livro (201)", status == 201 and book["id"] == book_id, f"{status} {book}")
    step("RF-01 identificador duplicado (409)", call("POST", "/api/v1/livros", book)[0] == 409)
    status, problem = call("POST", "/api/v1/livros", {"id": "INK-1", "titulo": "x", "autor": "y", "categoria": "HQ"})
    step("RF-01 identificador inválido (422)", status == 422 and problem["field"] == "id", f"{status} {problem}")
    step("RF-02 consultar livro por id (200)", call("GET", f"/api/v1/livros/{book_id}") == (200, book))
    step("RF-02 livro inexistente (404)", call("GET", "/api/v1/livros/INK-0000")[0] == 404)
    status, mangas = call("GET", "/api/v1/livros?categoria=Mang%C3%A1")
    step("RF-03 filtrar por categoria", status == 200 and mangas and all(item["categoria"] == "Mangá" for item in mangas))

    status, reader = call("POST", "/api/v1/usuarios", {"nome": "Leitora Integrada", "matricula": f"E2E{suffix}", "email": f"e2e{suffix}@exemplo.com"})
    step("RF-04 cadastrar usuário (201)", status == 201 and reader["id"].startswith("USR-"), f"{status} {reader}")
    status, other = call("POST", "/api/v1/usuarios", {"nome": "Leitor Concorrente", "matricula": f"E2F{suffix}"})
    step("RF-04 segundo usuário (201)", status == 201, f"{status} {other}")
    step("RF-04 matrícula duplicada (409)", call("POST", "/api/v1/usuarios", {"nome": "Repetido", "matricula": f"E2E{suffix}"})[0] == 409)
    step("RF-05 consultar usuário (200)", call("GET", f"/api/v1/usuarios/{reader['id']}") == (200, reader))
    step("RF-05 usuário inexistente (404)", call("GET", "/api/v1/usuarios/USR-9999999")[0] == 404)

    status, availability = call("GET", f"/api/v1/livros/{book_id}/disponibilidade")
    step("RF-06 livro novo disponível", status == 200 and availability["disponivel"] is True, f"{availability}")

    loan_body = {"livroId": book_id, "dataEmprestimo": REFERENCIA, "dataPrevista": "2026-11-23"}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda user: call("POST", "/api/v1/emprestimos", {**loan_body, "usuarioId": user}),
                                (reader["id"], other["id"])))
    statuses = sorted(status for status, _ in results)
    step("Caso B concorrência: um 201 e um 409", statuses == [201, 409], f"{results}")
    loan = next(payload for status, payload in results if status == 201)
    winner = loan["usuarioId"]
    loser = other["id"] if winner == reader["id"] else reader["id"]

    status, availability = call("GET", f"/api/v1/livros/{book_id}/disponibilidade")
    step("RF-06 livro indisponível após empréstimo", availability["disponivel"] is False and availability["emprestimoId"] == loan["id"])
    status, problem = call("POST", "/api/v1/emprestimos", {**loan_body, "usuarioId": loser})
    step("RF-07 segundo empréstimo do mesmo livro (409)", status == 409 and problem["code"] == "BOOK_UNAVAILABLE", f"{status} {problem}")
    step("RF-07 livro inexistente (422)", call("POST", "/api/v1/emprestimos", {**loan_body, "livroId": "INK-0000", "usuarioId": reader["id"]})[0] == 422)
    step("RF-07 prazo inválido (422)", call("POST", "/api/v1/emprestimos", {**loan_body, "dataPrevista": REFERENCIA, "usuarioId": reader["id"]})[0] == 422)
    step("RF-08 consultar empréstimo (200)", call("GET", f"/api/v1/emprestimos/{loan['id']}") == (200, loan))
    status, active = call("GET", "/api/v1/emprestimos/ativos")
    step("RF-10 empréstimo aparece entre os ativos", any(item["id"] == loan["id"] for item in active))
    status, late = call("GET", "/api/v1/emprestimos/atrasados?referenceDate=2026-11-24")
    step("RF-11 atrasado após o vencimento", status == 200 and any(item["id"] == loan["id"] for item in late), f"{status} {late}")
    status, late = call("GET", "/api/v1/emprestimos/atrasados?referenceDate=2026-11-23")
    step("RF-11 sem atraso no dia do vencimento", status == 200 and all(item["id"] != loan["id"] for item in late), f"{status} {late}")

    status, report_before = call("GET", "/api/v1/relatorios/multas?referenceDate=2026-11-26")
    item = next((row for row in report_before["itens"] if row["emprestimoId"] == loan["id"]), None)
    step("RF-12/13 multa de 3 dias = R$ 6,00 no relatório", item is not None and item["diasAtraso"] == 3 and cents(item["valor"]) == 600, f"{item}")

    status, returned = call("POST", f"/api/v1/emprestimos/{loan['id']}/devolucao", {"dataDevolucao": "2026-11-20"})
    step("RF-09 registrar devolução (200)", status == 200 and returned["dataDevolucao"] == "2026-11-20", f"{status} {returned}")
    step("Caso D devolução repetida (409)", call("POST", f"/api/v1/emprestimos/{loan['id']}/devolucao", {"dataDevolucao": "2026-11-21"})[0] == 409)
    step("Caso D histórico preservado", call("GET", f"/api/v1/emprestimos/{loan['id']}")[1]["dataDevolucao"] == "2026-11-20")
    status, availability = call("GET", f"/api/v1/livros/{book_id}/disponibilidade")
    step("Caso C disponibilidade restaurada", availability["disponivel"] is True)
    status, second = call("POST", "/api/v1/emprestimos", {**loan_body, "dataEmprestimo": "2026-11-20", "dataPrevista": "2026-12-04", "usuarioId": loser})
    step("Caso C outro usuário pode emprestar", status == 201, f"{status} {second}")

    status, history = call("GET", f"/api/v1/emprestimos?usuarioId={winner}")
    step("RF-08/RF-21 histórico do usuário", [row["id"] for row in history] == [loan["id"]])
    status, report_after = call("GET", "/api/v1/relatorios/multas?referenceDate=2026-11-26")
    step("RF-13 devolvido sai do relatório", all(row["emprestimoId"] != loan["id"] for row in report_after["itens"]))
    status, fines = call("GET", f"/api/v1/relatorios/multas?referenceDate={REFERENCIA}")
    step("RF-18 total consistente com itens", sum(cents(row["valor"]) for row in fines["itens"]) == cents(fines["total"]))
    status, stats = call("GET", f"/api/v1/relatorios/estatisticas?referenceDate={REFERENCIA}")
    step("RF-14..17 estatísticas", status == 200 and cents(stats["totalMultas"]) == cents(fines["total"])
         and stats["emprestimosAtrasados"] == fines["quantidade"] and sum(stats["livrosPorCategoria"].values()) == stats["totalLivros"])
    step("Gateway recusa parâmetro não permitido (400)", call("GET", "/api/v1/livros?destino=x")[0] == 400)

    print(f"\n{len(STEPS)} verificações aprovadas contra {BASE}.")


if __name__ == "__main__":
    main()
