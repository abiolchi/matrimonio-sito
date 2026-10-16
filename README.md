# Max & Alice · Lerici · 19–20 settembre 2027

Sito del matrimonio, con le informazioni per gli ospiti e un RSVP personalizzato, in italiano, francese e inglese.
Lo stile è "Limoni": crema, blu mare, accento giallo limone, font Cormorant Garamond e Jost, acquerelli di Lerici.

- **Domenica 19/9:** cerimonia simbolica e ricevimento, Villa Marigola, 16:00–02:00
- **Lunedì 20/9:** matrimonio civile, Castello / Municipio di Lerici, 12:30

## Come funziona

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
index.html                 pagina unica: hero, programma, viaggio, RSVP
css/style.css              stile; colori e font in :root
js/config.js               indirizzo dello script Google (vuoto = modalità di prova)
js/i18n.js                 TUTTI i testi nelle tre lingue
js/main.js                 cambio lingua + logica RSVP
assets/img/                acquerelli ottimizzati per il web
assets/favicon.svg
apps-script/Code.gs        script da incollare nel Google Sheet
apps-script/GUIDA.md       guida passo passo per collegare il foglio
```

Non serve nessun build. Per vedere il sito in locale basta aprire `index.html` nel browser.

## Modalità di prova

Finché `js/config.js` ha `endpoint: ""`, il modulo usa 4 invitati finti e le risposte restano nel browser:

| Codice | Invitati | Lingua | Civile |
|---|---|---|---|
| `LIMONE-4K7` | Giulia, Marco | it | sì |
| `ONDA-9RT` | Claire | fr | no |
| `VELA-3MX` | Luca, Sara, Tommaso | it | sì |
| `SOLE-8PW` | Emma, James | en | sì |

Per collegare il Google Sheet vero, segui **`apps-script/GUIDA.md`**.

## Modificare i testi

I testi stanno in `js/i18n.js`. Ogni elemento in `index.html` con `data-i18n="chiave"` prende il testo da lì nella lingua scelta. Una chiave nuova va aggiunta in **tutte e tre** le lingue. Le chiavi `…_one` sono la versione per una persona sola.

La lingua iniziale viene scelta in quest'ordine:

1. `?lang=fr` nell'indirizzo;
2. la scelta fatta dall'ospite con i pulsanti, durante la stessa visita;
3. la lingua dell'invito, dopo aver inserito il codice (anche se in una visita precedente aveva scelto un'altra lingua);
4. l'ultima lingua usata su quel browser, poi la lingua del browser;
5. l'italiano.

**Link personale da mandare agli ospiti:** `https://vostro-dominio/?code=LIMONE-4K7#rsvp`

## Pubblicazione

### GitHub Pages (gratis, richiede il repository pubblico)

1. Push su GitHub.
2. Nel repository: **Settings → Pages → Build and deployment**. Imposta *Source: Deploy from a branch*, *Branch: `main`* e la cartella `/ (root)`.
3. Dopo un minuto il sito è su `https://<utente>.github.io/<repo>/`.

Il codice del sito sarà visibile a tutti, ma non contiene dati privati: la lista invitati sta nel Google Sheet.

**In alternativa, con il repository privato:** Cloudflare Pages o Netlify, anche loro gratis. Basta collegare il repository GitHub e non impostare nessun comando di build.

### Dominio personalizzato

1. Compra il dominio da un registrar (Cloudflare, Porkbun, OVH, Namecheap…).
2. GitHub: **Settings → Pages → Custom domain** → inserisci il dominio, poi attiva **Enforce HTTPS**.
3. Dal registrar, nel DNS:
   - record `A` del dominio principale verso `185.199.108.153`, `185.199.109.153`, `185.199.110.153` e `185.199.111.153`;
   - record `CNAME` di `www` verso `<utente>.github.io`.

## Da completare

- [ ] Collegare il Google Sheet (`apps-script/GUIDA.md`) e inserire la lista invitati vera
- [ ] Data limite RSVP: `[DATA]` / `[DATE]` in i18n.js (chiave `rsvpSub`) e `RSVP_DEADLINE` in Code.gs
- [ ] Sezione viaggio e alloggio
- [ ] Link Google Maps preciso per il municipio / castello (ora è una ricerca "Castello di Lerici")
- [ ] Pubblicazione e dominio
