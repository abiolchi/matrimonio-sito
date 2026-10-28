"""
Controlli automatici del sito: li lancia GitHub a ogni Pull Request
(.github/workflows/controllo-sito.yml). Se passano, la Pull Request si può unire.

Il sito non ha un "build": qui lo si apre in un browser vero (Chromium, senza finestra)
e si controlla che tutto funzioni. La rete verso Google è finta, quindi nessun dato
arriva al foglio vero.

Per lanciarli in locale:
    python3 -m venv .venv && .venv/bin/pip install playwright==1.48.0
    .venv/bin/playwright install chromium
    .venv/bin/python tests/controlla_sito.py
"""

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGES = {
    "save the date": ("index.html", "STD_TRANSLATIONS"),
    "sito completo": ("sito-completo.html", "TRANSLATIONS"),
}
LANGS = ["it", "fr", "en"]
SIZES = {"desktop": (1280, 900), "telefono": (390, 844)}

failures = []


def check(ok, message):
    print(("  ✓ " if ok else "  ✗ ") + message)
    if not ok:
        failures.append(message)
    return ok


def section(title):
    print("\n" + title)


# =========================================================
# 1. File citati e testi tradotti (senza browser)
# =========================================================

class Refs(HTMLParser):
    """Raccoglie i file locali citati e le chiavi data-i18n di una pagina."""

    def __init__(self):
        super().__init__()
        self.files, self.keys = set(), set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for attr in ("src", "href"):
            url = a.get(attr) or ""
            if url and not re.match(r"^(https?:|mailto:|#|data:)", url):
                self.files.add(url.split("?")[0].split("#")[0])
        for attr in ("data-i18n", "data-i18n-alt", "data-i18n-aria"):
            if a.get(attr):
                self.keys.add(a[attr])


def static_checks():
    section("File citati")
    for name, (page, _) in PAGES.items():
        refs = Refs()
        refs.feed((ROOT / page).read_text(encoding="utf-8"))
        missing = sorted(f for f in refs.files if f and not (ROOT / f).exists())
        check(not missing, f"{page}: tutti i file citati esistono" + (f" (mancano: {', '.join(missing)})" if missing else ""))
        PAGES[name] = PAGES[name] + (refs.keys,)

    for css in sorted((ROOT / "css").glob("*.css")):
        urls = re.findall(r"url\(['\"]?([^'\")]+)['\"]?\)", css.read_text(encoding="utf-8"))
        missing = [u for u in urls if not u.startswith(("http", "data:")) and not (css.parent / u).resolve().exists()]
        check(not missing, f"css/{css.name}: tutte le immagini citate esistono" + (f" (mancano: {', '.join(missing)})" if missing else ""))


def translation_checks(browser):
    section("Traduzioni")
    page = browser.new_page()
    for name, (html, var, keys) in PAGES.items():
        script = {"TRANSLATIONS": "js/i18n.js", "STD_TRANSLATIONS": "js/save-the-date-i18n.js"}[var]
        page.set_content("<!doctype html><title>t</title>")
        page.add_script_tag(content=(ROOT / script).read_text(encoding="utf-8"))
        data = page.evaluate(f"window.{var}")
        check(sorted(data) == sorted(LANGS), f"{script}: ci sono le tre lingue")
        base = set(data["it"])
        for lang in ["fr", "en"]:
            other = set(data[lang])
            # le chiavi "_one" (versione per una persona) possono mancare: si usa quella normale
            missing = sorted(k for k in base - other if not k.endswith("_one"))
            extra = sorted(other - base)
            check(not missing, f"{script}: in {lang} ci sono tutti i testi dell'italiano" + (f" (mancano: {', '.join(missing)})" if missing else ""))
            check(not extra, f"{script}: in {lang} non ci sono testi in più" + (f" ({', '.join(extra)})" if extra else ""))
        unknown = sorted(k for k in keys if k not in base)
        check(not unknown, f"{html}: ogni data-i18n ha il suo testo" + (f" (sconosciute: {', '.join(unknown)})" if unknown else ""))
    page.close()


# =========================================================
# 2. Pagine nel browser: lingue, telefono, errori
# =========================================================

def fake_google(context, guest=None, sent=None):
    """La rete esterna è finta: Google Fonts vuoto, script Google che risponde sempre ok."""

    def handle(route):
        req = route.request
        url = req.url
        if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url:
            return route.fulfill(status=200, body="", content_type="text/css")
        if "script.google.com" in url:
            if req.method == "POST":
                if sent is not None:
                    sent.append(json.loads(req.post_data or "{}"))
                body = {"ok": True, "updatedAt": "2027-01-01T10:00:00.000Z"}
            elif "action=lookup" in url and guest:
                body = {"ok": True, "guest": guest, "previous": None}
            else:
                body = {"ok": True, "service": "rsvp"}
            return route.fulfill(status=200, body=json.dumps(body), content_type="application/json")
        return route.abort()

    context.route(re.compile(r"^https?://"), handle)


def open_page(browser, html, lang, size=(1280, 900), **fake):
    context = browser.new_context(viewport={"width": size[0], "height": size[1]})
    fake_google(context, **fake)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto((ROOT / html).as_uri() + f"?lang={lang}")
    page.wait_for_load_state("load")
    return context, page, errors


def page_checks(browser):
    for name, (html, _var, _keys) in PAGES.items():
        section(f"Pagina: {name} ({html})")
        for lang in LANGS:
            for size_name, size in SIZES.items():
                context, page, errors = open_page(browser, html, lang, size)
                where = f"{lang}, {size_name}"
                check(page.evaluate("document.documentElement.lang") == lang, f"[{where}] si apre in {lang}")
                empty = page.evaluate("""() => [...document.querySelectorAll('[data-i18n]')]
                    .filter(el => !el.closest('[hidden]') && !el.textContent.trim() && !el.classList.contains('error'))
                    .map(el => el.dataset.i18n)""")
                check(not empty, f"[{where}] nessun testo vuoto" + (f" ({', '.join(empty)})" if empty else ""))
                broken = page.evaluate("""async () => {
                    const imgs = [...document.images];
                    imgs.forEach(i => i.loading = 'eager');
                    await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
                    return imgs.filter(i => !i.naturalWidth).map(i => i.getAttribute('src'));
                }""")
                check(not broken, f"[{where}] tutte le immagini si caricano" + (f" ({', '.join(broken)})" if broken else ""))
                if size_name == "telefono":
                    wide = page.evaluate("document.documentElement.scrollWidth")
                    check(wide <= size[0], f"[{where}] niente scroll orizzontale (larghezza {wide}px)")
                check(not errors, f"[{where}] nessun errore JavaScript" + (f": {errors[0]}" if errors else ""))
                context.close()


# =========================================================
# 3. Modulo della save the date
# =========================================================

PHONE_CASES = [
    # (prefisso scelto, numero scritto, risultato atteso oppure None se va rifiutato)
    ("IT", "333 1234567", "+393331234567"),
    ("IT", "+32 (0)470 12 34 56", "+32470123456"),
    ("FR", "06 12 34 56 78", "+33612345678"),
    ("UK", "07911 123456", "+447911123456"),
    ("US", "(212) 555-1234", "+12125551234"),
    ("BE", "0470/12.34.56", "+32470123456"),
    ("IT", "0039 06 1234 5678", "+390612345678"),
    ("IT", "+49 151 23456789", None),
    ("FR", "06 12 34 56", None),
]


def form_checks(browser):
    section("Save the date: modulo contatti")
    sent = []
    context, page, errors = open_page(browser, "index.html", "it", sent=sent)

    page.click("#send-btn")
    check(page.evaluate("document.activeElement.id") == "name", "modulo vuoto: il cursore va sul primo campo")
    check(page.is_visible("#phone1-error"), "modulo vuoto: errore sul cellulare")
    check(not sent, "modulo vuoto: non viene inviato niente")

    expected = {"it": "IT", "fr": "BE", "en": "UK"}
    for lang, cc in expected.items():
        page.click(f'.langs [data-lang="{lang}"]')
        check(page.input_value("#cc1") == cc, f"prefisso iniziale in {lang}: {cc}")
    page.click('.langs [data-lang="it"]')

    page.fill("#name", "Vanessa e Marco Rossi")
    page.fill("#email", "vanessa@example.com")
    for cc, number, result in PHONE_CASES:
        page.fill("#phone1", "")
        page.select_option("#cc1", cc)
        page.fill("#phone1", number)
        sent.clear()
        page.click("#send-btn")
        page.wait_for_timeout(400)
        if result:
            got = sent[0]["phones"][0] if sent else None
            check(got == result, f"{cc} {number} → {result}" + ("" if got == result else f" (ottenuto {got})"))
            if sent:
                page.click("#edit-btn")
        else:
            check(not sent and page.is_visible("#phone1-error"), f"{cc} {number} → rifiutato con un errore")

    page.fill("#phone1", "")
    page.select_option("#cc1", "IT")
    page.fill("#phone1", "333 1234567")
    page.fill("#email2", "marco@")
    sent.clear()
    page.click("#send-btn")
    check(not sent and page.is_visible("#email2-error"), "seconda email sbagliata: errore, niente invio")

    page.fill("#email2", "marco@example.com")
    page.select_option("#cc2", "BE")
    page.fill("#phone2", "0470 12 34 56")
    page.click("#send-btn")
    page.wait_for_selector("#std-thanks:not([hidden])")
    payload = sent[-1] if sent else {}
    check(payload.get("action") == "contact" and payload.get("email2") == "marco@example.com"
          and payload.get("phones") == ["+393331234567", "+32470123456"] and payload.get("website") == "",
          "invio completo: dati giusti nel formato giusto")
    check("marco@example.com" in page.inner_text("#thanks-body"), "grazie: mostra anche la seconda email")

    page.reload()
    page.wait_for_load_state("load")
    check(page.is_visible("#std-thanks") and not page.is_visible("#contact-form"),
          "visita successiva dallo stesso dispositivo: mostra il riepilogo")
    page.click("#edit-btn")
    check(page.input_value("#email2") == "marco@example.com", "«Modifica i contatti» riempie il modulo")
    check(not errors, "nessun errore JavaScript" + (f": {errors[0]}" if errors else ""))
    context.close()


# =========================================================
# 4. RSVP del sito completo, con un invitato finto
# =========================================================

def rsvp_checks(browser):
    section("Sito completo: RSVP")
    guest = {"code": "PROVA-1", "names": ["Giulia", "Marco"], "lang": "it", "civil": True}
    sent = []
    context, page, errors = open_page(browser, "sito-completo.html", "it", guest=guest, sent=sent)
    page.fill("#code", "PROVA-1")
    page.click("#code-btn")
    page.wait_for_selector("#part1:not([hidden])")
    check("Giulia" in page.inner_text("#hello"), "codice: saluta per nome")
    page.check('input[name="sun-0"][value="yes"]', force=True)
    page.check('input[name="sun-1"][value="yes"]', force=True)
    page.click("#next-btn")
    page.wait_for_selector("#part2:not([hidden])")
    page.check('input[name="mon-0"][value="yes"]', force=True)
    page.check('input[name="mon-1"][value="no"]', force=True)
    page.click("#send-btn-2")
    page.wait_for_selector("#thanks:not([hidden])")
    people = sent[-1]["people"] if sent else []
    check([(p["name"], p["sunday"], p["monday"]) for p in people] == [("Giulia", True, True), ("Marco", True, False)],
          "risposte inviate correttamente")
    check(not errors, "nessun errore JavaScript" + (f": {errors[0]}" if errors else ""))
    context.close()


# =========================================================
# 5. Code.gs: si carica, e "Controlla i contatti" collega bene
# =========================================================

def apps_script_checks(browser):
    section("Google Apps Script (Code.gs)")
    page = browser.new_page()
    page.set_content("<!doctype html><title>t</title>")
    try:
        page.add_script_tag(content=(ROOT / "apps-script/Code.gs").read_text(encoding="utf-8"))
        loaded = page.evaluate("typeof linkContacts_ === 'function' && typeof doPost === 'function'")
    except Exception as e:  # errore di sintassi
        loaded = False
        print("    " + str(e).splitlines()[0])
    if not check(loaded, "Code.gs si carica senza errori di sintassi"):
        page.close()
        return

    result = page.evaluate("""() => {
        const C = (name, email, code) => ({ name, emails: [email, ''], phones: ['', ''], code: code || '' });
        const r = linkContacts_([
            { code: 'A', names: ['Veronica', 'Matteo'] }, { code: 'B', names: ['Jessica', 'Matteo'] },
            { code: 'C', names: ['Matteo Neri'] }, { code: 'D', names: ['Matteo'] },
            { code: 'E', names: ['Giulia', 'Marco'] }, { code: 'F', names: ['Claire'] }
        ], [
            C('Veronica e Matteo Rossi', 'v@x.it'), C('Jessica & Matteo', 'j@x.it'), C('Matteo Neri', 'mn@x.it'),
            C('Giulia Bianchi', 'g@x.it'), C('Claire Dupont', 'c@x.fr'), C('claire dupont', 'C@X.FR'),
            C('Pinco Pallino', 'p@x.it', 'NONESISTE')
        ]);
        return r.contacts.map(c => [c.status, c.newCode]);
    }""")
    expected = [["green", "A"], ["green", "B"], ["green", "C"], ["yellow", ""], ["yellow", ""], ["yellow", ""], ["yellow", ""]]
    labels = ["coppia Veronica e Matteo", "coppia Jessica e Matteo", "Matteo Neri (vince il cognome)",
              "Giulia da sola (iscritti separatamente)", "Claire doppione 1", "Claire doppione 2", "codice inesistente"]
    for label, got, want in zip(labels, result, expected):
        check(got == want, f"Controlla i contatti: {label} → {want[0]}" + ("" if got == want else f" (ottenuto {got})"))
    page.close()


# =========================================================

def main():
    static_checks()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        translation_checks(browser)
        page_checks(browser)
        form_checks(browser)
        rsvp_checks(browser)
        apps_script_checks(browser)
        browser.close()

    print()
    if failures:
        print(f"✗ {len(failures)} controlli non passati.")
        sys.exit(1)
    print("✓ Tutti i controlli passati: la Pull Request si può unire.")


if __name__ == "__main__":
    main()
