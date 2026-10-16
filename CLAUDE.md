# Note per Claude

Sito del matrimonio di Max & Alice a Lerici (Golfo dei Poeti, Liguria).
- **Domenica 19/9/2027:** cerimonia simbolica e ricevimento, Villa Marigola, 16:00–02:00.
- **Lunedì 20/9/2027:** matrimonio civile, Castello / Municipio di Lerici, 12:30.

Leggi anche README.md e apps-script/GUIDA.md.

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
    2. Parte 2 (civile): solo se l'invito ha "Invitati al civile = sì"; sotto ogni persona un messaggio secondo la sua combinazione domenica+lunedì (msgBoth / msgSundayOnly / msgMondayOnly / msgNone).
    +1: ogni invito con una sola persona può mettere il tick "+1" e scrivere il nome dell'accompagnatore (obbligatorio).
      Tick nella Parte 1 → il +1 viene domenica (niente sì/no); nella Parte 2 ha la sua riga sì/no per il civile.
      Nessun tick nella Parte 1 → nella Parte 2 ricompare il tick: se lo mette, il +1 viene solo lunedì.
      Il tick è chiaro e bloccato finché l'invitato non risponde "Ci sarò" a quell'evento; se passa a "no" si toglie da solo. In Risposte è una riga in più con "Sì" nella colonna G "+1 (accompagnatore)".
    3. Grazie: simboli di Lerici in SVG e l'acquerello con la didascalia "non rispecchia la realtà".
- Sicurezza: la lista non sta mai nel codice del sito; i codici sono casuali; blocco dopo 50 codici sbagliati in 10 minuti; campo trappola per i bot; testi protetti dall'interpretazione come formule.

## Regole
- Sito statico, niente framework né build step. HTML/CSS/JS semplici.
- Testi solo in `js/i18n.js` (non scritti a mano nell'HTML se hanno `data-i18n`).
- `index.html` deve funzionare anche aperto con doppio clic (niente fetch di file locali).
- Dati che arrivano dal foglio (nomi) → sempre `textContent`, mai `innerHTML`.
- Dopo ogni modifica a Code.gs va ricordato ad Alice di pubblicare una "Nuova versione" del deployment.
- Accessibilità: label sui campi, pulsanti ≥ 44px, contrasto buono, funzionare da telefono.
- Le persone con cui lavori sono Alice e Max; rispondi in italiano salvo richiesta diversa.
