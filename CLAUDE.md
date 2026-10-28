# Note per Claude

Sito del matrimonio di Max & Alice a Lerici (Golfo dei Poeti, Liguria).
- **Sabato 18/9/2027:** matrimonio civile a Lerici / Tellaro (mattina, luogo preciso da definire: per ora niente link mappa) e aperitivo di benvenuto (sera, luogo da definire). Eventi collaterali per chi è già in zona.
- **Domenica 19/9/2027:** cerimonia simbolica e ricevimento, Villa Marigola, dal pomeriggio fino a tarda notte (16:00–02:00).
- Nel codice dell'RSVP `mon`/`monday`/`msgMondayOnly` vuol dire **il civile** (nomi rimasti da quando era di lunedì): non rinominarli, sono il formato fra sito e foglio.

Leggi anche README.md e apps-script/GUIDA.md.

## Stato attuale: pagina "Save the date"
- `index.html` è per ora una save the date che raccoglie i contatti, **un modulo per invito** (singolo, coppia o famiglia): nomi, email, cellulare WhatsApp; facoltativi, raggruppati sotto «Se siete in coppia»: seconda email e secondo cellulare. Niente "aggiungi un'altra persona".
  Dopo l'invio i dati restano in `localStorage` (`stdContact`): a una visita successiva dallo stesso dispositivo si vede il riepilogo con "Modifica i contatti". I dati non vengono mai riletti dal foglio (nessuno deve poter vedere i contatti altrui).
  In alto una banda fissa (`.std-bar`, sticky) con «A & M» e le lingue. Per spostare il cursore su un campo usare `focusInView()` (lo porta a metà schermo): con `focus()` semplice Chrome lo lascia sotto la banda.
  Colonna sinistra: programma (domenica a Villa Marigola in grande, poi "Il giorno prima" con civile e aperitivo del sabato affiancati; niente orari precisi), poi la foto. Colonna destra: il modulo.
  File suoi: `css/save-the-date.css` (dopo `css/style.css`), `js/save-the-date-i18n.js` (`window.STD_TRANSLATIONS`), `js/save-the-date.js`, foto `assets/img/alice-max.jpg`.
- Il sito completo è in `sito-completo.html` (nessun link dalla save the date). Rispetto all'originale sono cambiati solo l'acquerello di Villa Marigola (`villa-marigola-giardino.jpg`) e il civile: sabato 18/9, mattina, Lerici / Tellaro (anche in `js/i18n.js` e nelle colonne/Riepilogo di `Code.gs`). Per il resto non modificarlo finché resta nascosto, salvo richiesta.
- Per tornare al sito completo: `git mv index.html save-the-date.html` e `git mv sito-completo.html index.html` (vedi README).
- Invio: POST `{ action: "contact", name, email, email2, phones: ["+32…"], lang, website, previousEmail? }` (previousEmail se l'email salvata sul dispositivo è cambiata) all'`endpoint` di `js/config.js`; endpoint vuoto = finto invio.
  Numeri: prefissi IT BE FR UK US PL NL CH (iniziale secondo la lingua della pagina: it → IT, fr → BE, en → UK), cifra nazionale tolta (0, o 1 per gli USA; in Italia lo 0 resta), salvati come `+32470123456`.
- `Code.gs`: `doPost` manda `action === 'contact'` a `saveContact_`, che scrive nella scheda **Contatti** (sempre la prima; colonne "Codice invito" e "Note (private)" solo nostre), colonne Data | Nomi | Email | Email 2 | Cellulare (WhatsApp) | Cellulare 2 | Lingua | Codice invito | Note; aggiorna la riga se l'email principale (o previousEmail) esiste già (Email 2 non conta per i doppioni); se trova la scheda vecchia senza Email 2 inserisce la colonna, max 150 invii ogni 10 minuti, riga nello Storico.

## Contesto e decisioni prese
- Scopo: prima RSVP, poi aggiungere informazioni man mano (viaggio, alloggio…).
- Lingue: italiano (predefinita), francese, inglese. Ogni testo nuovo va in tutte e tre.
- Hosting: niente Azure. GitHub Pages (repo pubblico) oppure Cloudflare Pages (repo privato), più un dominio personalizzato.
  `staticwebapp.config.json` è un residuo della vecchia idea Azure e si può cancellare.
- Stile "Limoni" (mediterraneo ed elegante). Palette e font in `css/style.css` `:root`.
  Gli acquerelli (generati con Gemini) stanno in `assets/img/`; quello del golfo è in trasparenza (~30%) solo nella hero.
- RSVP personalizzato, senza Tally:
  - codice personale per invito (`LIMONE-4K7`), anche via link `?code=…`;
  - dati in Google Sheet + Apps Script (`apps-script/Code.gs`), con le schede Invitati, Risposte (una riga per persona, sostituite a ogni modifica), Storico e Riepilogo;
  - `js/config.js` → `endpoint` vuoto = modalità di prova con 4 invitati finti (gli stessi di TEST_GUESTS in Code.gs).
  - Il flusso ricalca il vecchio modulo Tally "RSVP - Wedding of Alice & Max" (id eq1dQ0):
    1. Parte 1 (domenica): sì/no per persona; sotto ogni persona compare un riquadro giallo (sunYes / sunNo "Perché?? 🤌🏼"). Niente messaggio libero.
    2. Parte 2 (civile): solo se l'invito ha "Invitati al civile = sì"; sotto ogni persona un messaggio secondo la sua combinazione domenica+civile (msgBoth / msgSundayOnly / msgMondayOnly / msgNone).
    +1: ogni invito con una sola persona può mettere il tick "+1" e scrivere il nome dell'accompagnatore (obbligatorio).
      Tick nella Parte 1 → il +1 viene domenica (niente sì/no); nella Parte 2 ha la sua riga sì/no per il civile.
      Nessun tick nella Parte 1 → nella Parte 2 ricompare il tick: se lo mette, il +1 viene solo al civile.
      Il tick è chiaro e bloccato finché l'invitato non risponde "Ci sarò" a quell'evento; se passa a "no" si toglie da solo. In Risposte è una riga in più con "Sì" nella colonna G "+1 (accompagnatore)".
    3. Grazie: simboli di Lerici in SVG e l'acquerello con la didascalia "non rispecchia la realtà".
- Menu «Controlla i contatti» (`checkContacts` → `linkContacts_`, funzione pura provabile fuori da Google): collega Contatti ↔ Invitati 1 a 1 col codice.
  Verde solo se tutti i nomi dell'invito sono nel contatto, l'invito è il più preciso (più nomi, poi più parole) ed è unico in entrambe le direzioni; altrimenti giallo con nota 🔎 sul nome.
  A ogni giro prima toglie colori e note 🔎 da tutte le righe (anche vuote), poi ricolora. Non cancella/unisce righe, non cambia codici già scritti; in Invitati colonne F–I = formule INDEX/MATCH su Contatti.
- Sicurezza: la lista non sta mai nel codice del sito; i codici sono casuali; blocco dopo 50 codici sbagliati in 10 minuti; campo trappola per i bot; testi protetti dall'interpretazione come formule.

## Regole
- Ogni Pull Request verso main deve passare **«Controllo del sito»** (`.github/workflows/controllo-sito.yml` → `tests/controlla_sito.py`, Python + Playwright, rete Google finta). Se cambi comportamento (testi, prefissi, campi, ID degli elementi, regole di «Controlla i contatti»), aggiorna anche i controlli e lanciali in locale prima del push.
- Sito statico, niente framework né build step. HTML/CSS/JS semplici.
- Testi solo in `js/i18n.js` / `js/save-the-date-i18n.js` (non scritti a mano nell'HTML se hanno `data-i18n`).
- `index.html` deve funzionare anche aperto con doppio clic (niente fetch di file locali).
- Dati che arrivano dal foglio (nomi) → sempre `textContent`, mai `innerHTML`.
- Accessibilità: label sui campi, pulsanti ≥ 44px, contrasto buono, funzionare da telefono.
- Le persone con cui lavori sono Alice e Max; rispondi in italiano salvo richiesta diversa.
- Lavoro su git: un branch per argomento partito da `main` aggiornato, commit e Pull Request solo quando Alice lo chiede.

## Provare senza toccare il foglio vero
Il Google Sheet vero contiene (o conterrà) i dati veri degli invitati: **mai** usarlo per le prove.
1. **Sito** (testi, grafica, modulo): `tests/controlla_sito.py` con la rete Google finta, e a mano la modalità di prova
   (`endpoint: ""` in `js/config.js`, **solo in locale, mai committato**). Per i controlli nel browser locale servire con
   `python3 -m http.server` e, se cambi un JS, cambiare host (`localhost` ↔ `127.0.0.1`) o ricaricare senza cache: il browser tiene i JS vecchi.
2. **Script** (`Code.gs`): la logica pura si prova fuori da Google (vedi `linkContacts_` e il foglio finto in `tests/controlla_sito.py`).
   Per il resto, Alice la prova su una **copia del foglio** con il suo deployment di prova; l'indirizzo di prova va in `js/config.js` solo in locale.
3. **Prova finale sul foglio vero**: con l'invito di Alice e Max (`Alice; Max`), non con quello di ospiti veri.
- `tests/controlla_sito.py` ha `PRODUCTION_ENDPOINT`: il controllo è rosso se `js/config.js` non ha esattamente quell'indirizzo.
  Se Alice crea apposta un nuovo deployment, vanno aggiornati entrambi.
- Non inviare mai dati di prova all'endpoint vero senza chiederlo ad Alice.

## Promemoria ad Alice dopo ogni modifica
Ogni volta che modifichi il sito o lo script, chiudi la risposta con un blocco **«⚠️ Da ricordare»** con le azioni manuali,
secondo i file cambiati (le stesse che `tests/promemoria.py` scrive come commento nelle Pull Request; puoi lanciarlo con
`python3 tests/promemoria.py` per avere la lista):
- `apps-script/Code.gs` → provare su una copia del foglio; incollare il codice in **Estensioni → Apps Script**; pubblicare una
  **Nuova versione** del deployment esistente (mai «Nuovo deployment», che cambia indirizzo); ricaricare il foglio; se cambiano schede/colonne,
  **Prepara il foglio**. Se cambiano insieme sito e script: script pubblicato **prima** del merge.
- `js/config.js` → deve restare l'indirizzo vero (o aggiornare anche `PRODUCTION_ENDPOINT`).
- Sito → dopo il merge controllare il sito vero in incognito / dal telefono (cache); testi nelle tre lingue; rimettere l'indirizzo vero se si è provato in modalità di prova.
Se aggiungi un nuovo tipo di modifica con azioni manuali, aggiungilo anche a `tests/promemoria.py`.
