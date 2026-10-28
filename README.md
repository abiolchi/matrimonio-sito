# Max & Alice · Lerici · 18–19 settembre 2027

Sito del matrimonio, con le informazioni per gli ospiti e un RSVP personalizzato, in italiano, francese e inglese.
Lo stile è "Limoni": crema, blu mare, accento giallo limone, font Cormorant Garamond e Jost, acquerelli di Lerici.

- **Sabato 18/9:** matrimonio civile a Lerici / Tellaro (mattina) e aperitivo di benvenuto (sera)
- **Domenica 19/9:** cerimonia simbolica e ricevimento, Villa Marigola, dal pomeriggio fino a tarda notte


## Per ora: pagina "Save the date"

Al momento `index.html` è una pagina **save the date** che raccoglie i contatti, un modulo per invito (singolo, coppia o famiglia): nomi, email, cellulare WhatsApp e un secondo cellulare facoltativo. I contatti finiscono nella scheda **Contatti** del Google Sheet.
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

- [ ] Incollare il nuovo `Code.gs` e pubblicare una **nuova versione** del deployment (serve per salvare i contatti della save the date)
- [ ] Al momento dell'RSVP: tornare al sito completo (vedi sopra) e mandare a ogni contatto il suo link personale
- [ ] Collegare il Google Sheet (`apps-script/GUIDA.md`) e inserire la lista invitati vera
- [ ] Data limite RSVP: `[DATA]` / `[DATE]` in i18n.js (chiave `rsvpSub`) e `RSVP_DEADLINE` in Code.gs
- [ ] Sezione viaggio e alloggio
- [ ] Luogo preciso del civile (Lerici o Tellaro) e link Google Maps; luogo dell'aperitivo di benvenuto
- [ ] Pubblicazione e dominio
