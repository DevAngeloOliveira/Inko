"""Confere autoria das obras do manifesto na Open Library e registra a referência encontrada.

Executado só durante a curadoria (precisa de internet); a aplicação nunca chama a Open Library.
Uso: python scripts/seeds/verify_openlibrary.py data/seeds/catalogo-obras.json
"""
import json
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

SEARCH = "https://openlibrary.org/search.json"
HEADERS = {"User-Agent": "INKO-catalog-curation/1.0 (academic project)"}
VERIFIED_ON = "2026-11-17"


def normalize(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return "".join(char if char.isalnum() else " " for char in text).split()


def creators(work):
    names = work["autorOuCriador"].replace(" e ", ", ").split(",")
    return [name.strip() for name in names if name.strip()]


def search(title, author, free=False):
    params = {"q": f"{title} {author}"} if free else {"title": title, "author": author}
    query = urllib.parse.urlencode({**params, "limit": 10, "fields": "key,title,author_name,first_publish_year"})
    request = urllib.request.Request(f"{SEARCH}?{query}", headers=HEADERS)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response).get("docs", [])


def matches(doc, work):
    found = {token for name in doc.get("author_name", []) for token in normalize(name)}
    surnames = [normalize(name)[-1] for name in creators(work)]
    return any(surname in found for surname in surnames)


def rank(doc, title):
    wanted = normalize(title)
    found = normalize(doc.get("title", ""))
    if found == wanted:
        return 0
    if found[:len(wanted)] == wanted and not any(token.isdigit() for token in found[len(wanted):]):
        return 1
    if set(wanted) <= set(found):
        return 2
    return 3


def main(path):
    sys.stdout.reconfigure(encoding="utf-8")
    manifest = json.load(open(path, encoding="utf-8"))
    for work in manifest["obras"]:
        lead = creators(work)[0]
        title = work["titulo"].split(":")[0] if work["categoria"] == "Mangá" else work["titulo"]
        candidates = []
        for attempt, free in ((title, False), (work["titulo"], False), (title, True)):
            try:
                docs = search(attempt, lead, free)
            except OSError as error:
                print(f"ERRO   {work['id']} {work['titulo']}: {error}")
                docs = []
            time.sleep(1.1)
            candidates += [doc for doc in docs if matches(doc, work)]
            if any(rank(doc, work["titulo"]) <= 1 for doc in candidates):
                break
        candidates.sort(key=lambda doc: rank(doc, work["titulo"]))
        doc = candidates[0] if candidates else None
        if doc:
            work["referencia"] = {
                "fonte": "Open Library",
                "url": f"https://openlibrary.org{doc['key']}",
                "tituloEncontrado": doc.get("title"),
                "autoresEncontrados": doc.get("author_name", [])[:4],
                "verificadoEm": VERIFIED_ON,
            }
            print(f"OK     {work['id']} {work['titulo']} -> {doc.get('title')} | {', '.join(doc.get('author_name', [])[:3])}")
        else:
            work.pop("referencia", None)
            print(f"SEMREF {work['id']} {work['titulo']}")
    with open(path, "w", encoding="utf-8", newline="\n") as output:
        json.dump(manifest, output, ensure_ascii=False, indent=2)
        output.write("\n")


if __name__ == "__main__":
    main(sys.argv[1])
