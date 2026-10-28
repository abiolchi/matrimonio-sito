"""
Promemoria per Alice e Max: cosa fare a mano dopo una modifica, secondo i file cambiati.

GitHub lo lancia a ogni Pull Request (.github/workflows/controllo-sito.yml) e lo scrive
come commento nella Pull Request e come avviso giallo tra i controlli.

In locale (confronta il branch attuale con main):
    python3 tests/promemoria.py
"""

import os
import subprocess
import sys

DEPLOY_NEW_VERSION = ("In Apps Script: **Esegui il deployment → Gestisci deployment → ✏️ → Versione: Nuova versione → "
                      "Esegui il deployment**. L'indirizzo resta lo stesso. ⚠️ *Non* usate «Nuovo deployment»: "
                      "creerebbe un indirizzo nuovo e il sito continuerebbe a usare quello vecchio.")


def changed_files(base):
    out = subprocess.run(["git", "diff", "--name-only", f"{base}...HEAD"], capture_output=True, text=True, check=True)
    return [f for f in out.stdout.splitlines() if f]


def reminders(files):
    script = "apps-script/Code.gs" in files
    config = "js/config.js" in files
    site = [f for f in files if f.endswith((".html", ".css")) or f.startswith(("js/", "assets/"))]
    site = [f for f in site if f != "js/config.js"]
    items = []  # (titolo, [azioni])

    if config:
        items.append(("🚨 È cambiato js/config.js (l'indirizzo dello script Google)", [
            "Deve esserci l'indirizzo del deployment **vero**, mai vuoto e mai quello di una copia di prova: "
            "il «Controllo del sito» diventa rosso se non è così.",
            "Se avete creato apposta un nuovo deployment, aggiornate lo stesso indirizzo anche in "
            "`tests/controlla_sito.py` (PRODUCTION_ENDPOINT).",
        ]))

    if script:
        steps = [
            "**Prima** provate il nuovo codice su una **copia del foglio** (File → Crea una copia, con il suo deployment di prova), "
            "non sul foglio vero.",
            "Nel foglio vero: **Estensioni → Apps Script**, cancellate tutto, incollate il nuovo `apps-script/Code.gs`, salvate (⌘S).",
            DEPLOY_NEW_VERSION,
            "Ricaricate la pagina del foglio: il menu 💍 Matrimonio si aggiorna solo così. Se sono cambiate schede, colonne "
            "o il Riepilogo, lanciate **💍 Matrimonio → Prepara il foglio** (non tocca invitati e risposte).",
        ]
        if site:
            steps.insert(1, "⚠️ In questa Pull Request cambiano **sia il sito sia lo script**: pubblicate lo script "
                            "(i passi qui sotto) **prima** del merge, altrimenti il sito online parla con lo script vecchio.")
        items.append(("⚠️ È cambiato lo script Google (apps-script/Code.gs)", steps))

    if site:
        items.append(("🌐 È cambiato il sito", [
            "Se avete provato a mano in modalità di prova (`endpoint: \"\"` in js/config.js), rimettete l'indirizzo vero "
            "prima del commit.",
            "Dopo il merge GitHub Pages si aggiorna in 1–2 minuti: controllate il sito vero, anche dal telefono, "
            "in una **finestra in incognito** (o ricaricando con ⌘⇧R): il browser tiene a lungo le versioni vecchie.",
            "Un testo nuovo va in **italiano, francese e inglese** (il controllo lo verifica).",
        ]))

    if any(f.startswith(("tests/", ".github/")) for f in files):
        items.append(("🔧 Sono cambiati i controlli automatici", [
            "Guardate che «Controllo del sito» sia partito e sia verde in questa Pull Request.",
        ]))
    return items


def to_markdown(items):
    lines = ["## 📋 Da ricordare per questa modifica", ""]
    for title, steps in items:
        lines.append(f"### {title}")
        lines += [f"{i}. {step}" for i, step in enumerate(steps, 1)]
        lines.append("")
    lines.append("_Messaggio automatico, aggiornato a ogni nuovo push (tests/promemoria.py)._")
    return "\n".join(lines)


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    items = reminders(changed_files(base))
    if not items:
        print("Niente da ricordare per questa modifica.")
        return
    text = to_markdown(items)
    print(text)
    if os.environ.get("GITHUB_ACTIONS"):
        for title, _ in items:
            # avviso giallo tra i controlli della Pull Request
            print(f"::warning title=Da ricordare::{title} (dettagli nel commento della Pull Request)")
        with open("promemoria.md", "w", encoding="utf-8") as f:
            f.write(text)


if __name__ == "__main__":
    main()
