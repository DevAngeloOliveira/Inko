"""Aceitação do SDD-002 contra o BFF real do Next (Compose + PostgreSQL + volume).

Uso:
  INKO_E2E_EMAIL=... INKO_E2E_PASSWORD=... python scripts/ci/e2e-mvp-auth-media.py [URL_DO_WEB] [--after-restart]

Credenciais vêm só do ambiente (a conta é criada pelo bootstrap do serviço de
Usuários). Com `docker compose` disponível, confere também o PostgreSQL e o
volume `catalogo_media` (defina COMPOSE_PROJECT_NAME para outra stack).

Sem --after-restart: AUTH-02..07, MEDIA-01..03, 05, 06 e envia uma capa que fica
gravada em INK-0006. Com --after-restart: MEDIA-04, a mesma capa ainda é servida
depois de `docker compose restart catalogo web` ou de reiniciar a stack.
"""
import base64
import hashlib
import http.cookiejar
import json
import os
import re
import secrets
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
import zlib
from concurrent.futures import ThreadPoolExecutor

ARGS = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
BASE = (ARGS[0] if ARGS else "http://127.0.0.1:3000").rstrip("/")
AFTER_RESTART = "--after-restart" in sys.argv
EMAIL = os.environ.get("INKO_E2E_EMAIL", "")
PASSWORD = os.environ.get("INKO_E2E_PASSWORD", "")
DURABLE_BOOK = "INK-0006"
SCRATCH_BOOK = "INK-0043"
STATE_FILE = os.environ.get("INKO_E2E_STATE", os.path.join(tempfile.gettempdir(), "inko-e2e-mvp-state.json"))
JPEG = base64.b64decode("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAA8ACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmKKKK+eP08KKKKACiiigAooooAKKKKACiiigAorlviL/yBIP+vhf/AEFq87rro4X2sea9jxMfnP1Or7Lkv87foe20V4lRWv1D+9+H/BOL/WT/AKdfj/wD22iuJ+Gv/MR/7Z/+zUVx1afs5uJ72CxP1qjGta176fOxd+Iv/IEg/wCvhf8A0Fq87r22it6OK9lHltc87H5N9cq+157fK/6niVFe20Vr9f8A7v4/8A4v9W/+nv4f8E4n4a/8xH/tn/7NRXbUVx1antJuR72Cw31WjGje9r6/O5//2Q==")
STEPS = []


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def client():
    jar = http.cookiejar.CookieJar()
    return jar, urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect)


ANON_JAR, ANON = client()


def call(opener, method, path, body=None, headers=None, raw=None, content_type=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    request = urllib.request.Request(BASE + path, data=data, method=method)
    if content_type or (data is not None and raw is None):
        request.add_header("Content-Type", content_type or "application/json")
    if method != "GET":
        request.add_header("Origin", BASE)
    for name, value in (headers or {}).items():
        request.add_header(name, value)
    try:
        with opener.open(request, timeout=15) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()


def payload(raw):
    try:
        return json.loads(raw or b"null")
    except ValueError:
        return None


def step(name, condition, detail=""):
    STEPS.append(name)
    print(("PASS " if condition else "FAIL ") + name + (f" — {detail}" if detail and not condition else ""))
    if not condition:
        raise SystemExit(1)


def psql(database, sql):
    try:
        result = subprocess.run(
            ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "inko_admin", "-d", database, "-tAc", sql],
            capture_output=True, text=True, timeout=30, check=True,
        )
        return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None


def media_files():
    try:
        result = subprocess.run(
            ["docker", "compose", "exec", "-T", "catalogo", "sh", "-c", "ls -A /var/lib/inko/covers"],
            capture_output=True, text=True, timeout=30, check=True,
        )
        return sorted(result.stdout.split())
    except (OSError, subprocess.SubprocessError):
        return None


def png(width, height, color=(196, 59, 47)):
    row = b"\x00" + bytes(color) * width
    raw = zlib.compress(row * height)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")


def multipart(content, mime, filename="capa.bin"):
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"arquivo\"; filename=\"{filename}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def upload(opener, book, content, mime, headers=None):
    body, content_type = multipart(content, mime)
    return call(opener, "PUT", f"/api/media/livros/{book}", raw=body, content_type=content_type, headers=headers)


def sign_in():
    jar, opener = client()
    status, headers, raw = call(opener, "POST", "/api/auth/session", {"email": EMAIL, "senha": PASSWORD})
    return jar, opener, status, headers, raw


def warm_up(timeout=120):
    deadline = time.monotonic() + timeout
    probes = [
        ("POST", "/api/auth/session", {"email": f"warmup-{uuid.uuid4().hex[:8]}@inko.local", "senha": "x" * 14}, {401}),
        ("GET", "/api/v1/livros", None, {200}),
        ("GET", f"/api/media/livros/{SCRATCH_BOOK}", None, {200, 404}),
        ("GET", "/api/public/disponibilidade", None, {200}),
    ]
    for method, path, body, expected in probes:
        while True:
            try:
                status = call(ANON, method, path, body, {"X-Forwarded-For": "203.0.113.10"})[0]
            except OSError:
                status = 0
            if status in expected:
                break
            if time.monotonic() > deadline:
                raise SystemExit(f"Serviços não responderam a tempo: {method} {path} → {status}")
            time.sleep(1)
    print(f"Serviços aquecidos ({len(probes)} rotas).")


def auth_checks():
    noise = {"X-Forwarded-For": f"198.51.100.{secrets.randbelow(254) + 1}"}
    status, headers, raw = call(ANON, "POST", "/api/auth/session", {"email": EMAIL, "senha": PASSWORD + "-errada"}, noise)
    step("AUTH-02 senha incorreta → 401 genérico", status == 401 and payload(raw).get("code") == "INVALID_CREDENTIALS", f"{status} {raw[:120]}")
    step("AUTH-02 sem cookie de sessão após falha", not any(cookie.value for cookie in ANON_JAR))

    jar, opener, status, headers, raw = sign_in()
    body = payload(raw) or {}
    cookie_header = " ".join(headers.get_all("Set-Cookie") or [])
    step("AUTH-03 login correto → 200", status == 200 and body.get("email") == EMAIL.strip().lower(), f"{status} {raw[:160]}")
    step("AUTH-03 cookie HttpOnly e SameSite=Lax", "HttpOnly" in cookie_header and "SameSite=Lax" in cookie_header, cookie_header)
    step("AUTH-03 token ausente do JSON", "token" not in body and not any(cookie.value in raw.decode() for cookie in jar))
    token = next(cookie.value for cookie in jar if cookie.name.endswith("inko_session"))
    digest = hashlib.sha256(token.encode()).hexdigest()
    stored = psql("inko_usuarios", f"SELECT count(*) FROM sessoes_operador WHERE token_hash = '{digest}' AND revogado_em IS NULL")
    if stored is not None:
        step("AUTH-03 sessão persistida só como SHA-256", stored == "1", stored)
        leaked = psql("inko_usuarios", f"SELECT count(*) FROM sessoes_operador WHERE token_hash = '{token}'")
        step("AUTH-03 token em claro não está no banco", leaked == "0", leaked)

    status, _, raw = call(opener, "GET", "/api/auth/session")
    step("AUTH-04 recarga mantém a sessão", status == 200 and payload(raw).get("papel") in {"ADMIN", "BIBLIOTECARIO"}, f"{status}")
    status, _, _ = call(opener, "GET", "/api/v1/emprestimos")
    step("AUTH-04 rota privada aceita a sessão", status == 200, f"{status}")

    status, _, raw = call(ANON, "GET", "/api/v1/emprestimos")
    step("AUTH-06 anônimo em /api/v1/emprestimos → 401", status == 401 and payload(raw).get("code") == "UNAUTHENTICATED", f"{status}")
    for path in ("/api/v1/usuarios", "/api/v1/relatorios/multas?referenceDate=2026-11-09", "/api/v1/emprestimos/ativos", "/api/v1/livros/INK-0001/disponibilidade"):
        status, _, _ = call(ANON, "GET", path)
        step(f"AUTH-06 anônimo em {path.split('?')[0]} → 401", status == 401, f"{status}")
    status, _, _ = call(ANON, "POST", "/api/v1/livros", {"id": "INK-9999"})
    step("AUTH-06 anônimo não cadastra obra", status == 401, f"{status}")
    status, _, raw = call(ANON, "GET", "/api/v1/livros")
    step("AUTH-06 catálogo público continua anônimo", status == 200 and isinstance(payload(raw), list), f"{status}")
    status, _, raw = call(ANON, "GET", "/api/public/disponibilidade")
    body = payload(raw) or {}
    step("AUTH-06 disponibilidade pública sem dados de leitores", status == 200 and set(body) == {"emprestados"}, f"{status} {raw[:120]}")

    status, _, raw = call(opener, "POST", "/api/v1/livros", {"id": "INVALIDO"}, {"Origin": "https://evil.example"})
    step("AUTH-07 Origin cruzada em POST → 403", status == 403 and payload(raw).get("code") == "ORIGIN_REJECTED", f"{status}")
    status, _, _ = call(opener, "DELETE", "/api/auth/session", headers={"Origin": "https://evil.example"})
    step("AUTH-07 Origin cruzada no logout → 403", status == 403, f"{status}")
    target = f"bruteforce-{uuid.uuid4().hex[:8]}@inko.local"
    statuses = [call(ANON, "POST", "/api/auth/session", {"email": target, "senha": "x" * 14}, noise)[0] for _ in range(6)]
    step("AUTH-07 tentativas repetidas → 429", statuses[:5] == [401] * 5 and statuses[5] == 429, str(statuses))
    return token, jar, opener


def logout_checks(token, opener):
    status, headers, _ = call(opener, "DELETE", "/api/auth/session")
    cleared = " ".join(headers.get_all("Set-Cookie") or [])
    step("AUTH-05 logout → 204 e cookie apagado", status == 204 and "Max-Age=0" in cleared, f"{status} {cleared}")
    digest = hashlib.sha256(token.encode()).hexdigest()
    revoked = psql("inko_usuarios", f"SELECT count(*) FROM sessoes_operador WHERE token_hash = '{digest}' AND revogado_em IS NOT NULL")
    if revoked is not None:
        step("AUTH-05 sessão revogada no PostgreSQL", revoked == "1", revoked)
    _, replay = client()
    for name in ("inko_session", "__Host-inko_session"):
        replay.addheaders = [("Cookie", f"{name}={token}")]
        status, _, _ = call(replay, "GET", "/api/v1/emprestimos")
        step(f"AUTH-05 replay do token ({name}) → 401", status == 401, f"{status}")


def expiry_check():
    jar, opener, status, _, _ = sign_in()
    token = next(cookie.value for cookie in jar if cookie.name.endswith("inko_session"))
    digest = hashlib.sha256(token.encode()).hexdigest()
    changed = psql("inko_usuarios", f"UPDATE sessoes_operador SET criado_em = now() - interval '9 hours', expira_em = now() - interval '1 hour' WHERE token_hash = '{digest}' RETURNING 1")
    if changed is None:
        print("SKIP AUTH-04 expiração (docker compose indisponível; coberto por JUnit)")
        return
    status, _, _ = call(opener, "GET", "/api/auth/session")
    step("AUTH-04 sessão expirada → 401", status == 401, f"{status}")


def media_checks(opener):
    status, _, _ = call(opener, "DELETE", f"/api/media/livros/{SCRATCH_BOOK}")
    step("MEDIA-00 obra de rascunho sem capa antes dos testes", status in (204, 404), f"{status}")
    before = media_files()
    image = png(120, 180)
    status, _, raw = upload(ANON, SCRATCH_BOOK, image, "image/png")
    step("MEDIA-06 anônimo não envia capa", status == 401, f"{status}")
    status, _, _ = call(ANON, "DELETE", f"/api/media/livros/{SCRATCH_BOOK}")
    step("MEDIA-06 anônimo não remove capa", status == 401, f"{status}")
    status, _, raw = upload(opener, SCRATCH_BOOK, image, "image/png", {"Origin": "https://evil.example"})
    step("MEDIA-06 upload com Origin cruzada → 403", status == 403, f"{status}")

    status, _, raw = upload(opener, DURABLE_BOOK, JPEG, "image/jpeg")
    meta = payload(raw) or {}
    step("MEDIA-01 JPEG válido gravado", status == 200 and meta.get("mimeType") == "image/jpeg" and meta.get("largura") == 40, f"{status} {raw[:200]}")
    row = psql("inko_catalogo", f"SELECT mime_type || ':' || sha256 FROM capas_livros WHERE livro_id = '{DURABLE_BOOK}'")
    if row is not None:
        step("MEDIA-01 metadados no PostgreSQL", row == f"image/jpeg:{meta.get('sha256')}", row)
    status, _, raw = call(ANON, "GET", f"/api/v1/livros/{DURABLE_BOOK}")
    step("MEDIA-01 obra referencia a capa (capaVersao)", status == 200 and payload(raw).get("capaVersao") == meta.get("versao"), f"{raw[:200]}")

    status, headers, raw = call(ANON, "GET", f"/api/media/livros/{DURABLE_BOOK}?v={meta.get('versao')}")
    step("MEDIA-02 leitura pública com MIME real", status == 200 and headers.get("Content-Type") == "image/jpeg" and raw[:3] == b"\xff\xd8\xff", f"{status} {headers.get('Content-Type')}")
    step("MEDIA-02 ETag igual ao SHA-256 dos bytes", headers.get("ETag") == f'"{hashlib.sha256(raw).hexdigest()}"' == f'"{meta.get("sha256")}"', headers.get("ETag"))
    step("MEDIA-02 nosniff", headers.get("X-Content-Type-Options") == "nosniff")
    status, _, _ = call(ANON, "GET", f"/api/media/livros/{DURABLE_BOOK}", headers={"If-None-Match": headers.get("ETag")})
    step("MEDIA-02 If-None-Match → 304", status == 304, f"{status}")

    rejected = [
        ("arquivo > 2 MiB", png(16, 16) + b"\x00" * (2 * 1024 * 1024 + 10), "image/png", {413}),
        ("MIME falso (PNG declarado JPEG)", png(16, 16), "image/jpeg", {415}),
        ("SVG", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "image/svg+xml", {415}),
        ("HTML como PNG", b"<html><body>x</body></html>", "image/png", {415}),
        ("PNG corrompido", png(16, 16)[:40] + b"\x00" * 64, "image/png", {422}),
        ("dimensões acima de 12 MP", png(4000, 3500), "image/png", {413, 422}),
    ]
    for name, content, mime, expected in rejected:
        status, _, raw = upload(opener, SCRATCH_BOOK, content, mime)
        step(f"MEDIA-03 recusa {name}", status in expected, f"{status} {raw[:160]}")
    after = media_files()
    if before is not None and after is not None:
        added = sorted(set(after) - set(before))
        step("MEDIA-03 nenhum arquivo temporário ou órfão", all(name.endswith((".jpg", ".png")) for name in after) and len(added) <= 1, str(added))
    status, _, _ = call(ANON, "GET", f"/api/media/livros/{SCRATCH_BOOK}")
    step("MEDIA-03 recusas não criam capa", status == 404, f"{status}")

    images = [png(30 + index, 45 + index, (index * 40 % 255, 59, 47)) for index in range(4)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda content: upload(opener, SCRATCH_BOOK, content, "image/png"), images))
    ok = [payload(raw) for status, _, raw in results if status == 200]
    step("MEDIA-05 envios simultâneos concluem", len(ok) >= 1 and all(status in (200, 429) for status, _, _ in results), str([status for status, _, _ in results]))
    status, headers, raw = call(ANON, "GET", f"/api/media/livros/{SCRATCH_BOOK}")
    final = psql("inko_catalogo", f"SELECT sha256 || ':' || object_key FROM capas_livros WHERE livro_id = '{SCRATCH_BOOK}'")
    step("MEDIA-05 arquivo servido é o referenciado", headers.get("ETag") == f'"{hashlib.sha256(raw).hexdigest()}"' and (final is None or final.startswith(hashlib.sha256(raw).hexdigest())), f"{final}")
    files = media_files()
    if files is not None and final is not None:
        step("MEDIA-05 sem arquivo órfão após substituições", final.split(":")[1] in files and len([name for name in files if name.endswith((".jpg", ".png"))]) == int(psql("inko_catalogo", "SELECT count(*) FROM capas_livros") or -1), str(files))
    status, _, _ = call(opener, "DELETE", f"/api/media/livros/{SCRATCH_BOOK}")
    step("MEDIA-06 operador remove capa", status == 204, f"{status}")
    status, _, _ = call(ANON, "GET", f"/api/media/livros/{SCRATCH_BOOK}")
    step("MEDIA-06 capa removida deixa de ser servida", status == 404, f"{status}")
    with open(STATE_FILE, "w", encoding="utf-8") as handle:
        json.dump({"sha256": meta.get("sha256")}, handle)


def after_restart_checks():
    with open(STATE_FILE, encoding="utf-8") as handle:
        expected = str(json.load(handle).get("sha256", ""))
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise SystemExit(f"Estado inválido em {STATE_FILE}; rode o E2E sem --after-restart antes.")
    status, headers, raw = call(ANON, "GET", f"/api/media/livros/{DURABLE_BOOK}")
    step("MEDIA-04 capa persiste após restart", status == 200 and hashlib.sha256(raw).hexdigest() == expected, f"{status} {headers.get('ETag')}")
    jar, opener, status, _, _ = sign_in()
    step("MEDIA-04 login funciona após restart", status == 200, f"{status}")
    deadline = time.monotonic() + 60
    while True:
        status, _, _ = call(opener, "GET", "/api/v1/relatorios/estatisticas?referenceDate=2026-11-09")
        if status < 500 or time.monotonic() > deadline:
            break
        time.sleep(2)
    step("REG-01 relatórios via BFF autenticado", status == 200, f"{status}")
    call(opener, "DELETE", "/api/auth/session")


def main():
    if not EMAIL or not PASSWORD:
        raise SystemExit("Defina INKO_E2E_EMAIL e INKO_E2E_PASSWORD (conta criada pelo bootstrap do ambiente).")
    warm_up()
    if AFTER_RESTART:
        after_restart_checks()
    else:
        token, _, opener = auth_checks()
        media_checks(opener)
        logout_checks(token, opener)
        expiry_check()
    print(f"{len(STEPS)} verificações SDD-002 aprovadas contra {BASE}.")


if __name__ == "__main__":
    main()
