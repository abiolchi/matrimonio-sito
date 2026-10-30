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

# L'indirizzo del deployment VERO dello script Google (quello del foglio con i dati veri).
# js/config.js deve contenere proprio questo: non vuoto (modalità di prova) e non quello
# di una copia di prova del foglio. Se un giorno create apposta un NUOVO deployment
# (nuovo indirizzo), aggiornatelo sia in js/config.js sia qui.
SITE_DOMAIN = "alicemaxlerici.it"  # il dominio comprato da Alice e Max (file CNAME, letto da GitHub Pages)
PRODUCTION_ENDPOINT = "https://script.google.com/macros/s/AKfycbxwLz1Hx73wcOQtGQdcCOK7nOjv7N1a4Jv9vuILEX0J4i_zeDZgBoY14-SGdWXNwSg/exec"
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
    section("Indirizzo dello script Google (js/config.js)")
    found = re.search(r'endpoint\s*:\s*"([^"]*)"', (ROOT / "js/config.js").read_text(encoding="utf-8"))
    endpoint = found.group(1) if found else None
    detail = ("" if endpoint == PRODUCTION_ENDPOINT else
              " (non trovo «endpoint» nel file)" if endpoint is None else
              " (è vuoto: il sito sarebbe in modalità di prova e non salverebbe niente)" if not endpoint else
              " (c'è un altro indirizzo: è quello di una copia di prova del foglio?)")
    check(endpoint == PRODUCTION_ENDPOINT, "js/config.js usa il deployment vero" + detail)

    section("Dominio (file CNAME)")
    cname = (ROOT / "CNAME").read_text(encoding="utf-8").strip() if (ROOT / "CNAME").exists() else None
    check(cname == SITE_DOMAIN, f"CNAME contiene {SITE_DOMAIN}" + ("" if cname == SITE_DOMAIN else
          " (il file manca: GitHub Pages smetterebbe di usare il dominio)" if cname is None else f" (c'è «{cname}»)"))

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
    context.set_default_timeout(10000)
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
                if html == "index.html":
                    # la banda con le lingue resta in alto anche in fondo alla pagina, e si può cliccare
                    reachable = page.evaluate("""() => {
                        document.documentElement.style.scrollBehavior = 'auto';
                        window.scrollTo(0, document.documentElement.scrollHeight);
                        const b = document.querySelector('.langs button[data-lang="en"]').getBoundingClientRect();
                        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
                        return window.scrollY > 0 && b.top >= 0 && b.bottom <= 100 && !!hit && !!hit.closest('.langs');
                    }""")
                    check(reachable, f"[{where}] in fondo alla pagina le lingue sono ancora visibili in alto")
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


def under_bar(page, element_id):
    """True se l'elemento (dopo lo scorrimento della pagina) è nascosto sotto la banda fissa o fuori schermo."""
    page.wait_for_timeout(900)  # lo scorrimento è morbido
    return page.evaluate("""id => {
        const bar = document.querySelector('.std-bar').getBoundingClientRect();
        const el = document.getElementById(id).getBoundingClientRect();
        return el.top < bar.bottom || el.bottom > window.innerHeight;
    }""", element_id)


def form_checks(browser):
    section("Save the date: modulo contatti")
    sent = []
    context, page, errors = open_page(browser, "index.html", "it", sent=sent)

    page.click("#send-btn")
    check(page.evaluate("document.activeElement.id") == "name", "modulo vuoto: il cursore va sul primo campo")
    check(not under_bar(page, "name"), "modulo vuoto: il campo col cursore non finisce sotto la banda in alto")
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
    check(page.is_visible(".mail-hint") and "spam" in page.inner_text(".mail-hint"), "grazie: avvisa della mail di conferma e dello spam")

    page.reload()
    page.wait_for_load_state("load")
    check(page.is_visible("#std-thanks") and not page.is_visible("#contact-form"),
          "visita successiva dallo stesso dispositivo: mostra il riepilogo")
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    page.click("#edit-btn")
    check(page.input_value("#email2") == "marco@example.com", "«Modifica i contatti» riempie il modulo")
    check(not under_bar(page, "name"), "«Modifica i contatti»: il primo campo non finisce sotto la banda in alto")
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
# 6. "Controlla i contatti" su un foglio finto
# =========================================================

# Una piccola imitazione di Google Sheets: solo quello che usa Code.gs nel controllo.
FAKE_SHEETS_JS = r"""
window.makeSpreadsheet = function (tabs) {
  const sheets = {};
  const make = (name, rows) => {
    const S = { data: rows.map(r => r.slice()), bg: {}, notes: {}, maxRows: 60 };
    const get = (r, c) => { const v = (S.data[r - 1] || [])[c - 1]; return v === undefined ? '' : v; };
    const put = (r, c, v) => { while (S.data.length < r) S.data.push([]); S.data[r - 1][c - 1] = v; };
    const each = (r, c, nr, nc, fn) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) fn(r + i, c + j, i, j); };
    S.getName = () => name;
    S.getMaxRows = () => S.maxRows;
    S.getIndex = () => Object.keys(sheets).indexOf(name) + 1;
    S.getLastRow = () => { for (let r = S.data.length; r >= 1; r--) if ((S.data[r - 1] || []).some(v => v !== '' && v != null)) return r; return 0; };
    S.setFrozenRows = () => S; S.setColumnWidth = () => S; S.insertColumnAfter = () => S;
    S.appendRow = r => { S.data.splice(S.getLastRow(), 0, r.slice()); return S; };
    S.getRange = (r, c, nr = 1, nc = 1) => {
      const R = {
        getValue: () => get(r, c),
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r + i, c + j))),
        setValue: v => { put(r, c, v); return R; },
        setValues: m => { each(r, c, nr, nc, (a, b, i, j) => put(a, b, m[i][j])); return R; },
        setFormulas: m => { each(r, c, nr, nc, (a, b, i, j) => put(a, b, m[i][j])); return R; },
        clearContent: () => { each(r, c, nr, nc, (a, b) => put(a, b, '')); return R; },
        setBackground: v => { each(r, c, nr, nc, (a, b) => { S.bg[a + ',' + b] = v; }); return R; },
        setBackgrounds: m => { each(r, c, nr, nc, (a, b, i, j) => { S.bg[a + ',' + b] = m[i][j]; }); return R; },
        getNotes: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => S.notes[(r + i) + ',' + (c + j)] || '')),
        setNotes: m => { each(r, c, nr, nc, (a, b, i, j) => { S.notes[a + ',' + b] = m[i][j]; }); return R; },
        setFontWeight: () => R
      };
      return R;
    };
    sheets[name] = S;
    return S;
  };
  Object.keys(tabs).forEach(n => make(n, tabs[n]));
  const ss = {
    sheets,
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => make(n, []),
    getActiveSheet: () => null, setActiveSheet: () => {}, moveActiveSheet: () => {}
  };
  window.SpreadsheetApp = { getActive: () => ss, getUi: () => ({ alert: m => { window.lastAlert = m; } }) };
  window.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  const cache = {};
  window.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) };
  // Gmail finto: niente parte davvero, le mail restano in window.mails
  window.mails = [];
  window.mailQuota = 100;
  window.MailApp = {
    getRemainingDailyQuota: () => window.mailQuota,
    sendEmail: m => { window.mails.push(m); window.mailQuota -= m.to.split(',').length + (m.cc ? 1 : 0); }
  };
  window.Session = { getEffectiveUser: () => ({ getEmail: () => 'alice@example.com' }) };
  return ss;
};
"""


def sheet_checks(browser):
    section("«Controlla i contatti» su un foglio finto")
    page = browser.new_page()
    page.set_content("<!doctype html><title>t</title>")
    page.add_script_tag(content=(ROOT / "apps-script/Code.gs").read_text(encoding="utf-8"))
    page.add_script_tag(content=FAKE_SHEETS_JS)
    r = page.evaluate("""() => {
        const H = CONTACT_HEADERS;
        let n = 0;  // ogni riga con un cellulare diverso (i doppioni sono solo quelli voluti)
        const row = (name, email, code) => [new Date(), name, email, '', "'+3933300000" + (n++), '', 'it', code || '', ''];
        const ss = makeSpreadsheet({
            Contatti: [H, row('Veronica e Matteo Rossi', 'v@x.it'), row('Claire', 'c@x.fr'), row('claire', 'C@X.FR'), row('Pinco', 'p@x.it')],
            Invitati: [GUEST_HEADERS, ['', 'Veronica; Matteo', 'it', 'sì', ''], ['', 'Claire', 'fr', 'no', 'nota nostra']]
        });
        const C = ss.sheets.Contatti, I = ss.sheets.Invitati;
        C.notes['5,2'] = 'nota nostra';   // una nota vostra sul nome di Pinco: deve restare
        checkContacts();
        const first = {
            code: C.data[1][7], inviteCode: I.data[1][0],
            green: C.bg['2,1'], yellow: C.bg['3,1'], none: C.bg['5,1'],
            note: C.notes['3,2'] || '', ourNote: C.notes['5,2'],
            email: I.data[1][5], alert: lastAlert
        };
        // cancello tutti i contatti e rilancio
        C.data = [H];
        checkContacts();
        const leftBg = Object.keys(C.bg).filter(k => C.bg[k]).length + Object.keys(I.bg).filter(k => I.bg[k]).length;
        const leftNotes = Object.values(C.notes).filter(n => n && n.indexOf(CHECK_NOTE) === 0).length;
        const afterContacts = { leftBg, leftNotes, ourNote: C.notes['5,2'] };
        // cancello anche gli inviti (restano solo le formule a destra) e rilancio
        I.data = I.data.map((r, i) => i === 0 ? r : ['', '', '', '', ''].concat(r.slice(5)));
        checkContacts();
        const formulas = I.data.slice(1).filter(r => r.slice(5, 9).some(v => v)).length;
        return { first, afterContacts, formulas, alert: lastAlert };
    }""")
    f = r["first"]
    check(f["code"] and f["code"] == f["inviteCode"], "la coppia riceve il codice del suo invito")
    check(f["green"] == "#d9ead3" and f["yellow"] == "#fff2cc" and f["none"] is None, "colori: verde, giallo, nessuno")
    check(f["note"].startswith("🔎") and "doppione" in f["note"], "il doppione ha la nota 🔎 col motivo")
    check(f["ourNote"] == "nota nostra", "le vostre note restano")
    check(f["email"].startswith("=IF(") and "Contatti!$C:$C" in f["email"], "in Invitati compaiono le formule delle email")
    a = r["afterContacts"]
    check(a["leftBg"] == 0 and a["leftNotes"] == 0, "Contatti svuotato: il controllo toglie tutti i colori e le note 🔎")
    check(a["ourNote"] == "nota nostra", "Contatti svuotato: le vostre note restano")
    check(r["formulas"] == 0 and "vuota" in r["alert"], "Invitati svuotato: via anche le formule rimaste, e lo dice")
    page.close()


def mail_checks(browser):
    section("Mail di conferma (Gmail finto)")
    page = browser.new_page()
    page.set_content("<!doctype html><title>t</title>")
    page.add_script_tag(content=(ROOT / "apps-script/Code.gs").read_text(encoding="utf-8"))
    page.add_script_tag(content=FAKE_SHEETS_JS)
    r = page.evaluate("""() => {
        const old = CONTACT_HEADERS.slice(0, 9);   // scheda creata prima delle mail di conferma
        const ss = makeSpreadsheet({ Contatti: [old], Storico: [LOG_HEADERS] });
        const C = ss.sheets.Contatti;
        const send = d => saveContact_(Object.assign({ phones: ['+393331234567'], lang: 'fr', website: '' }, d));
        const out = {};

        out.first = send({ name: 'Vanessa <b>Rossi</b>', email: 'v@x.it', email2: 'm@x.it' });
        out.header = C.data[0][CONFIRM_COLUMN - 1];
        out.mail = mails[0] || {};
        out.cell1 = C.data[1][CONFIRM_COLUMN - 1];

        out.samePhone = send({ name: 'Vanessa Rossi', email: 'v@x.it', email2: 'm@x.it', phones: ['+393339999999'] });
        out.count2 = mails.length;

        out.changed = send({ name: 'Vanessa Rossi', email: 'vanessa@x.it', email2: 'm@x.it', previousEmail: 'v@x.it' });
        out.changedTo = (mails[1] || {}).to;
        out.cell3 = C.data[1][CONFIRM_COLUMN - 1];
        out.rows = C.getLastRow();

        C.data[1][7] = 'LIMONE-4K7'; C.data[1][8] = 'nota nostra';
        mailQuota = 1;  // Gmail ha finito il limite di oggi
        out.noQuota = send({ name: 'Claire', email: 'c@x.fr', lang: 'xx' });
        out.cell4 = C.data[2][CONFIRM_COLUMN - 1];
        out.count4 = mails.length;

        mailQuota = 100;
        sendMissingConfirmations();
        out.alert = lastAlert;
        out.cell5 = C.data[2][CONFIRM_COLUMN - 1];
        out.late = mails[mails.length - 1] || {};
        out.ours = [C.data[1][7], C.data[1][8]];
        sendMissingConfirmations();
        out.alertAgain = lastAlert;

        MailApp.sendEmail = () => { throw new Error('Autorizzazione richiesta'); };
        out.broken = send({ name: 'Pinco', email: 'p@x.it' });
        out.log = ss.sheets.Storico.data.map(r => r[2]).join(' | ');
        return out;
    }""")
    m = r["mail"]
    check(r["header"] == "Mail di conferma", "la scheda Contatti già esistente riceve la colonna «Mail di conferma»")
    check(r["first"].get("mail") == "sent" and m.get("to") == "v@x.it,m@x.it" and m.get("cc") == "maxence.draguet@gmail.com",
          "contatto nuovo: una mail a entrambe le email, con Max in copia")
    check(m.get("name") == "Alice & Max" and "coordonnées" in m.get("subject", ""), "mittente «Alice & Max», testo nella lingua del sito (fr)")
    check("&lt;b&gt;Rossi&lt;/b&gt;" in m.get("htmlBody", "") and "<b>Rossi" not in m.get("htmlBody", ""),
          "nella mail i nomi scritti dagli ospiti non diventano HTML")
    check("spam" in m.get("body", "") and "alicemaxlerici.it" in m.get("body", ""), "la mail parla dello spam e porta al sito")
    check(r["cell1"] == "✓ v@x.it, m@x.it", "nel foglio: a chi è partita la mail")
    check(r["samePhone"].get("mail") == "none" and r["count2"] == 1, "cambia solo il cellulare: nessuna mail nuova")
    check(r["changedTo"] == "vanessa@x.it" and r["rows"] == 2, "cambia l'email: mail solo al nuovo indirizzo, stessa riga")
    check(r["cell3"] == "✓ vanessa@x.it, m@x.it", "dopo il cambio la cella elenca gli indirizzi attuali")
    check(r["noQuota"].get("ok") and r["noQuota"].get("mail") == "pending" and r["count4"] == 2 and r["cell4"] == "⏳ da inviare",
          "limite di Gmail finito: il contatto è salvato, la mail resta ⏳ da inviare")
    check(r["cell5"] == "✓ c@x.fr" and r["late"].get("to") == "c@x.fr" and "Mandate 1" in r["alert"],
          "menu «Invia le mail di conferma mancanti»: manda quella rimasta")
    check("Ciao" in r["late"].get("body", ""), "lingua sconosciuta: mail in italiano")
    check(r["ours"] == ["LIMONE-4K7", "nota nostra"], "le colonne «Codice invito» e «Note» restano vostre")
    check("Nessuna" in r["alertAgain"], "rilanciando il menu non parte niente due volte")
    check(r["broken"].get("ok") and r["broken"].get("mail") == "pending" and "non partita" in r["log"],
          "Gmail dà errore: il contatto è salvato, l'errore finisce nello Storico")
    page.close()


# =========================================================

def run(part, *args):
    """Lancia un gruppo di controlli; se si blocca, lo segna come fallito e si passa al successivo."""
    try:
        part(*args)
    except Exception as e:
        check(False, f"{part.__name__}: si è bloccato ({str(e).splitlines()[0][:160]})")


def main():
    run(static_checks)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for part in (translation_checks, page_checks, form_checks, rsvp_checks, apps_script_checks, sheet_checks, mail_checks):
            run(part, browser)
        browser.close()

    print()
    if failures:
        print(f"✗ {len(failures)} controlli non passati.")
        sys.exit(1)
    print("✓ Tutti i controlli passati: la Pull Request si può unire.")


if __name__ == "__main__":
    main()
