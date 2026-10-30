# Max & Alice · Lerici · 18–19 settembre 2027

Sito del matrimonio, con le informazioni per gli ospiti e un RSVP personalizzato, in italiano, francese e inglese.
Lo stile è "Limoni": crema, blu mare, accento giallo limone, font Cormorant Garamond e Jost, acquerelli di Lerici.

- **Sabato 18/9:** matrimonio civile a Lerici / Tellaro (mattina) e aperitivo di benvenuto (sera)
- **Domenica 19/9:** cerimonia simbolica e ricevimento, Villa Marigola, dal pomeriggio fino a tarda notte


## Per ora: pagina "Save the date"

Al momento `index.html` è una pagina **save the date** che raccoglie i contatti, un modulo per invito (singolo, coppia o famiglia): nomi, email, cellulare WhatsApp e, facoltativi, una seconda email e un secondo cellulare per l'altra persona della coppia. I contatti finiscono nella scheda **Contatti** del Google Sheet, e lo script manda subito una **mail di conferma** (dal Gmail di Alice, con Max in copia; dettagli in `apps-script/GUIDA.md`, «Mail di conferma»).
Dopo l'invio i dati restano anche nel browser dell'ospite: tornando sulla pagina dallo stesso dispositivo vede cosa ha salvato e può correggerlo.
Il sito completo (programma, viaggio, RSVP) è in `sito-completo.html`, uguale a prima salvo il civile spostato a sabato 18/9 e il nuovo acquerello di Villa Marigola: non ha link dalla nuova pagina, ma chi conosce l'indirizzo può ancora aprirlo.

```
index.html                 save the date: hero, programma + foto, modulo contatti
css/save-the-date.css      stile in più (si carica dopo css/style.css)
js/save-the-date-i18n.js   testi della save the date nelle tre lingue
js/save-the-date.js        cambio lingua + controllo dei numeri + invio
assets/img/alice-max.jpg   la nostra foto (bianco e nero, 900×724)
sito-completo.html         il sito completo, identico a prima
```

### Tornare al sito completo

Quando è il momento di aprire l'RSVP:

```bash
git mv index.html save-the-date.html
git mv sito-completo.html index.html
```

Poi commit e push. Non serve cambiare nient'altro: il sito completo è già aggiornato con il civile di sabato, e lo script Google gestisce sia l'RSVP sia i contatti.

## Come funziona l'RSVP

```
Sito statico (GitHub Pages)  ──codice invito──▶  Google Apps Script  ──▶  Google Sheet
     index.html, css, js      ◀── nomi, risposte ──   (apps-script/Code.gs)     Invitati / Risposte / Riepilogo
```

- Ogni invito ha un **codice personale** (es. `LIMONE-4K7`) che fa da password.
- Con il codice, il modulo saluta per nome e chiede una risposta per ogni persona. La Parte 2 (civile) compare solo per gli inviti che la prevedono.
- Chi ha già risposto ritrova le sue risposte e può modificarle.
- La lista invitati sta **solo nel Google Sheet**, mai nel codice del sito.

## Struttura

```
index.html                 per ora la save the date (vedi sopra)
sito-completo.html         sito completo: hero, programma, viaggio, RSVP
css/style.css              stile; colori e font in :root
js/config.js               indirizzo dello script Google (vuoto = modalità di prova)
js/i18n.js                 TUTTI i testi nelle tre lingue
js/main.js                 cambio lingua + logica RSVP
assets/img/                acquerelli ottimizzati per il web
assets/favicon.svg
apps-script/Code.gs        script da incollare nel Google Sheet
apps-script/GUIDA.md       guida passo passo per collegare il foglio
tests/controlla_sito.py    controlli automatici (li lancia GitHub a ogni Pull Request)
tests/promemoria.py        promemoria «Da ricordare» scritto nelle Pull Request
.github/workflows/         la pipeline di GitHub Actions
```

Non serve nessun build. Per vedere il sito in locale basta aprire `index.html` (la save the date) o `sito-completo.html` nel browser.

## Modalità di prova

Finché `js/config.js` ha `endpoint: ""`, la save the date finge di salvare i contatti (non li manda a nessuno) e il modulo RSVP usa 4 invitati finti, con le risposte che restano nel browser:

| Codice | Invitati | Lingua | Civile |
|---|---|---|---|
| `LIMONE-4K7` | Giulia, Marco | it | sì |
| `ONDA-9RT` | Claire | fr | sì |
| `VELA-3MX` | Luca, Sara, Tommaso | it | sì |
| `SOLE-8PW` | Emma, James | en | sì |

Per collegare il Google Sheet vero, segui **`apps-script/GUIDA.md`**.

## Modificare i testi

I testi della save the date stanno in `js/save-the-date-i18n.js`, quelli del sito completo in `js/i18n.js`. Ogni elemento in `index.html` con `data-i18n="chiave"` prende il testo da lì nella lingua scelta. Una chiave nuova va aggiunta in **tutte e tre** le lingue. Le chiavi `…_one` sono la versione per una persona sola.

La lingua iniziale viene scelta in quest'ordine:

1. `?lang=fr` nell'indirizzo;
2. la scelta fatta dall'ospite con i pulsanti, durante la stessa visita;
3. la lingua dell'invito, dopo aver inserito il codice (anche se in una visita precedente aveva scelto un'altra lingua);
4. l'ultima lingua usata su quel browser, poi la lingua del browser;
5. l'italiano.

**Link personale da mandare agli ospiti:** `https://alicemaxlerici.it/?code=LIMONE-4K7#rsvp`

## Controllo automatico delle Pull Request

A ogni Pull Request verso `main`, GitHub lancia **«Controllo del sito»** (`.github/workflows/controllo-sito.yml`), che apre le pagine in un browser vero e controlla:

- che `js/config.js` contenga l'indirizzo del deployment **vero** dello script Google (non vuoto, non quello di una copia di prova);
- che ogni immagine, CSS e script citato esista, e che ogni testo abbia la traduzione in IT, FR ed EN;
- save the date e sito completo in tre lingue, su desktop e su telefono: nessun errore JavaScript, nessun testo vuoto, immagini caricate, niente scroll orizzontale;
- il modulo dei contatti (numeri di prova di vari paesi, errori, invio, riepilogo alla visita successiva);
- l'RSVP del sito completo con un invitato finto;
- che `apps-script/Code.gs` non abbia errori di sintassi, «Controlla i contatti» sui casi tipici e le mail di conferma (a chi partono, Max in copia, limite di Gmail, menu delle mail mancanti).

La rete verso Google è finta: **nessun dato arriva al foglio vero** e **nessuna mail parte davvero**. Spunta verde = si può unire; rossa = nella pagina della Pull Request, **Checks → Controllo del sito**, c'è l'elenco con ✗ di cosa non va.

**Per rendere il controllo obbligatorio prima del merge** (una volta sola, su GitHub):
1. **Settings → Branches → Add branch ruleset** (o *Add classic branch protection rule*), per il branch `main`.
2. Attiva **Require status checks to pass** e aggiungi **«Controllo del sito»** (compare nell'elenco dopo che il controllo è girato almeno una volta).
3. Salva. Da quel momento il pulsante di merge resta bloccato finché il controllo non è verde.

Per lanciarlo in locale:

```bash
python3 -m venv .venv && .venv/bin/pip install playwright==1.48.0 && .venv/bin/playwright install chromium
.venv/bin/python tests/controlla_sito.py
```

### 📋 Il promemoria nella Pull Request

Nella stessa Pull Request GitHub scrive anche un **commento «Da ricordare per questa modifica»** (e un avviso giallo tra i controlli) con le cose da fare **a mano**, secondo i file cambiati: per esempio, se cambia `apps-script/Code.gs`, incollarlo in Apps Script e pubblicare una nuova versione del deployment. Il commento si aggiorna a ogni nuovo push. Per vederlo in locale: `python3 tests/promemoria.py`.

## Provare le modifiche senza toccare i dati veri

Quando il Google Sheet contiene gli invitati veri, **non usatelo per le prove**:

1. **Modifiche al sito** (testi, grafica, modulo): bastano il «Controllo del sito» e, a mano, la **modalità di prova**: in `js/config.js` mettete `endpoint: ""` **solo sul vostro computer** e aprite la pagina con doppio clic. Prima del commit rimettete l'indirizzo vero (se ve lo dimenticate, il controllo diventa rosso).
2. **Modifiche allo script** (`Code.gs`): nel foglio vero **File → Crea una copia** (es. «Matrimonio – PROVE»); nella copia **Estensioni → Apps Script → Esegui il deployment → Nuovo deployment** (App web): è un indirizzo solo per le prove. Incollate lì il codice nuovo, mettete quell'indirizzo in `js/config.js` solo in locale e provate tutto. Quando funziona: codice nel foglio vero + **nuova versione** del deployment vero, e indirizzo vero di nuovo in `config.js`.
3. **Prova finale sul foglio vero**: con il **vostro** invito (`Alice; Max` in Invitati), non con quello di un ospite.

## Pubblicazione

### GitHub Pages (gratis, richiede il repository pubblico)

1. Push su GitHub.
2. Nel repository: **Settings → Pages → Build and deployment**. Imposta *Source: Deploy from a branch*, *Branch: `main`* e la cartella `/ (root)`.
3. Dopo un minuto il sito è su `https://<utente>.github.io/<repo>/`.

Il codice del sito sarà visibile a tutti, ma non contiene dati privati: la lista invitati sta nel Google Sheet.

**In alternativa, con il repository privato:** Cloudflare Pages o Netlify, anche loro gratis. Basta collegare il repository GitHub e non impostare nessun comando di build.

### Dominio: alicemaxlerici.it

Comprato il 28/10/2026 (registro Tucows, privacy WHOIS attiva), **scade il 28/10/2027**: tenete attivo il rinnovo automatico,
altrimenti qualcun altro potrebbe ricomprarlo e i link già mandati porterebbero da lui.
Il file `CNAME` nella radice del repo dice a GitHub Pages di usare questo dominio (non cancellatelo).

Per collegarlo, **in quest'ordine**:
1. Dal registrar, nel DNS del dominio:
   - quattro record `A` per il dominio principale (`@`): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`;
   - un record `CNAME` per `www` verso `abiolchi.github.io`;
   - togliete eventuali record `A`/`CNAME` "di parcheggio" messi dal registrar.
2. GitHub, impostazioni del **vostro account** (non del repo): **Settings → Pages → Add a domain** → `alicemaxlerici.it`,
   aggiungete il record `TXT` che vi mostra e premete **Verify**. Così nessun altro può usare il dominio con un suo sito GitHub.
3. Merge della Pull Request con il file `CNAME` (o, nel repo, **Settings → Pages → Custom domain** → `alicemaxlerici.it`).
4. In **Settings → Pages** aspettate che il controllo DNS diventi verde (minuti o qualche ora), poi spuntate **Enforce HTTPS**.

Il vecchio indirizzo `abiolchi.github.io/matrimonio-sito/` porta da solo al dominio. Lo script Google e `js/config.js` non cambiano.

## Da completare

- [ ] Incollare il nuovo `Code.gs`, dare il permesso per le mail (menu **Mandami le mail di conferma di prova**) e pubblicare una **nuova versione** del deployment
- [ ] Al momento dell'RSVP: tornare al sito completo (vedi sopra), collegare contatti e inviti con **💍 Matrimonio → Controlla i contatti** (`apps-script/GUIDA.md`) e mandare a ogni contatto il suo link personale
- [ ] Collegare il Google Sheet (`apps-script/GUIDA.md`) e inserire la lista invitati vera
- [ ] Data limite RSVP: `[DATA]` / `[DATE]` in i18n.js (chiave `rsvpSub`) e `RSVP_DEADLINE` in Code.gs
- [ ] Sezione viaggio e alloggio
- [ ] Luogo preciso del civile (Lerici o Tellaro) e link Google Maps; luogo dell'aperitivo di benvenuto
- [ ] Collegare il dominio alicemaxlerici.it (DNS, verifica su GitHub, Enforce HTTPS: vedi «Dominio») e rinnovarlo prima del 28/10/2027
