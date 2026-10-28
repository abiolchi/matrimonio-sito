# Collegare l'RSVP al Google Sheet

Ci vogliono circa 10 minuti, da fare una volta sola. Serve un account Google, e conviene usare quello che userete per tutto il matrimonio.

## 1. Crea il foglio

1. Vai su [sheets.new](https://sheets.new) e crea un foglio vuoto.
2. Dagli un nome, per esempio **Matrimonio – RSVP**.

## 2. Incolla lo script

1. Nel foglio apri il menu **Estensioni → Apps Script**.
2. Cancella tutto quello che c'è nell'editor e incolla il contenuto di `apps-script/Code.gs`.
3. Salva con l'icona del dischetto. Il progetto puoi chiamarlo "RSVP".

## 3. Prepara il foglio

1. Torna al foglio e ricarica la pagina. In alto compare il menu **💍 Matrimonio**.
2. Scegli **💍 Matrimonio → Prepara il foglio**.
3. Google chiede l'autorizzazione:
   - **Continua**, poi scegli il tuo account;
   - se compare "Google non ha verificato questa app", clicca **Avanzate → Vai a RSVP (non sicura)**. È il vostro script, quindi va bene;
   - **Consenti**.
4. Rilancia **Prepara il foglio** se la prima volta si è fermato all'autorizzazione.

Ora il foglio ha cinque schede:

| Scheda | A cosa serve |
|---|---|
| **Contatti** | Sempre la prima. Si riempie da sola con i contatti lasciati sulla pagina "save the date" (vedi sotto). |
| **Invitati** | Una riga per invito (coppia, famiglia, singolo). Qui scrivete voi la lista. |
| **Risposte** | Si riempie da sola: una riga per persona. Se un invito modifica la risposta, le sue righe vengono sostituite. |
| **Storico** | Tutte le risposte e modifiche, in ordine, così niente va perso. |
| **Riepilogo** | Numeri aggiornati: quanti sì e quanti no per domenica e per il civile di sabato. |

## 4. Pubblica lo script come "App web"

1. In Apps Script clicca **Esegui il deployment → Nuovo deployment**.
2. Clicca l'ingranaggio accanto a "Seleziona tipo" e scegli **App web**.
3. Imposta:
   - **Descrizione:** RSVP
   - **Esegui come:** *Me* (il tuo account)
   - **Chi ha accesso:** *Chiunque*
4. Clicca **Esegui il deployment** e copia l'**URL dell'app web**, quello che finisce con `/exec`.

"Chiunque" vuol dire che il sito può chiamare lo script senza login. Lo script però risponde solo a chi ha un codice valido, e anche allora mostra solo i dati di quell'invito.

## 5. Collega il sito

Apri `js/config.js` e incolla l'URL:

```js
window.RSVP_CONFIG = {
  endpoint: "https://script.google.com/macros/s/……/exec"
};
```

Finché `endpoint` è vuoto, il sito resta in **modalità di prova**: funziona tutto, ma le risposte restano solo nel browser.

## 6. Prova

Apri il sito e usa i codici di prova, per esempio `LIMONE-4K7`. Dopo l'invio, le risposte compaiono nella scheda **Risposte**. Riaprendo con lo stesso codice, le risposte sono già compilate e si possono modificare.

Quando siete soddisfatti:

1. cancellate le 4 righe di prova da **Invitati** (nella colonna Note c'è scritto "PROVA");
2. cancellate le righe di prova da **Risposte** e **Storico**.

## Inserire gli invitati veri

Nella scheda **Invitati**, una riga per invito:

| Colonna | Cosa scrivere |
|---|---|
| Codice | Lasciala vuota: poi usate **💍 Matrimonio → Genera i codici mancanti** |
| Nomi | I nomi separati da `;`, ad esempio `Giulia; Marco`. Come li scrivete qui, così li vedranno gli ospiti. |
| Lingua | `it`, `fr` o `en`: la lingua in cui il modulo si apre per quell'invito |
| Invitati al civile | `sì` se l'invito comprende anche il matrimonio civile di sabato, altrimenti `no`. Con `no` la Parte 2 non compare. |
| Note | Solo per voi: non viene mai mostrata agli ospiti |

**Attenzione:** se cambiate i nomi di un invito che ha già risposto, chiedete all'invito di rispondere di nuovo, perché le risposte sono legate ai nomi.

**Link personali:** potete mandare a ogni invito il link `https://vostro-dominio/?code=LIMONE-4K7#rsvp`, che apre il modulo già compilato col codice. Si può anche trasformare in QR code da stampare sulla partecipazione.

## Contatti della "save the date"

Finché il sito mostra la pagina save the date, ogni invito (singolo, coppia o famiglia) lascia i nomi, un'email, un cellulare e, se vuole, una seconda email e un secondo cellulare (per l'altra persona della coppia). Lo script li scrive nella scheda **Contatti**, una riga per invito:

| Colonna | Chi la scrive |
|---|---|
| Data, Nomi, Email, Email 2, Cellulare (WhatsApp), Cellulare 2, Lingua | lo script |
| Codice invito, Note (private) | **voi**: lo script non le tocca mai |

- I numeri sono già in formato internazionale, per esempio `+32470123456`.
- Se la scheda Contatti era stata creata prima che esistesse «Email 2», lo script inserisce da solo la colonna dopo «Email» al primo invio (o con **Prepara il foglio**): i dati già presenti si spostano a destra insieme alle loro colonne.
- Se qualcuno rimanda il modulo con **la stessa email principale**, la sua riga viene aggiornata (Codice invito e Note restano come li avete scritti).
- Il sito ricorda i dati mandati **su quel dispositivo**: tornando sulla pagina, l'ospite vede cosa ha salvato e può correggerlo. Se corregge anche l'email, viene aggiornata la stessa riga invece di crearne una nuova. Da un altro telefono o computer il modulo riparte vuoto, e con un'email diversa arriva una riga nuova.
- Ogni invio finisce anche nello **Storico** ("Nuovi contatti" o "Contatti aggiornati").
- Nel **Riepilogo** c'è la riga "Contatti ricevuti (save the date)".
- Se la scheda Contatti manca, lo script la ricrea da solo al primo invio.
- Protezione: al massimo 150 invii ogni 10 minuti in tutto. Oltre, il sito chiede di riprovare più tardi.

Se il foglio esisteva già prima della save the date, dopo aver incollato il nuovo codice lancia di nuovo **💍 Matrimonio → Prepara il foglio**: aggiunge la scheda Contatti e la riga nel Riepilogo senza toccare invitati e risposte.

## Collegare i contatti agli inviti (prima di mandare gli RSVP)

Alla fine ogni invito della scheda **Invitati** deve avere **un solo** contatto, e ogni contatto un solo invito. Il collegamento è il **codice dell'invito**, scritto nella colonna «Codice invito» di Contatti.

1. **Chiudete la save the date** (tornate al sito completo, vedi README), così nessuno aggiunge o cambia contatti mentre sistemate.
2. In **Invitati** scrivete la lista: una riga per invito, nomi separati da `;` (`Veronica; Matteo`). Se due inviti hanno lo stesso nome **e sono singoli**, aggiungete il cognome (`Matteo Neri`): così il controllo li distingue. Le coppie vanno bene anche senza cognome (`Veronica; Matteo` e `Jessica; Matteo` sono diversi).
3. **💍 Matrimonio → Controlla i contatti.** Lo script:
   - genera i codici mancanti in Invitati;
   - per ogni contatto cerca l'invito i cui nomi ci sono **tutti** («Veronica e Matteo Rossi» → `Veronica; Matteo`). Se ne combaciano più di uno vince il più preciso (più nomi, poi con il cognome);
   - colora le righe di **Contatti** e di **Invitati**:

     | Colore | Significato |
     |---|---|
     | 🟢 verde | collegato: un contatto ↔ un invito. Il codice viene scritto da solo in «Codice invito». |
     | 🟡 giallo | da guardare voi. Il motivo è nella **nota sulla cella del nome** (passateci sopra col mouse): doppione, coppia iscritta separatamente, più inviti possibili, codice sbagliato… |
     | nessuno | nessun corrispondente: contatto senza invito, o invito senza contatto. |

   - in **Invitati**, dalla colonna F, mostra **Email, Email 2, Cellulare, Cellulare 2** letti da Contatti tramite il codice (sono formule: se correggete Contatti, si aggiornano da sole). Le colonne F–I devono essere libere.
   - alla fine mostra un riepilogo con i numeri.
4. Sistemate i gialli a mano:
   - **doppione** → cancellate la riga in più;
   - **coppia iscritta separatamente** → spostate email e cellulare dell'altra persona in «Email 2» e «Cellulare 2» della prima riga e cancellate la seconda;
   - **contatto mancante** → aggiungete la riga (i numeri come testo: `'+39…` con l'apostrofo davanti);
   - **collegamento che lo script non trova** → scrivete voi il codice in «Codice invito».
5. Rilanciate **Controlla i contatti** finché è tutto verde.

Lo script **non cancella e non unisce mai** righe, e **non cambia mai** un codice già scritto in Contatti: lo controlla soltanto (se non esiste, se è su due righe o se i nomi non c'entrano, la riga diventa gialla). Le vostre note sulla cella del nome restano: lo script usa solo le note che iniziano con 🔎. A ogni controllo lo script prima **toglie tutti i colori e le note 🔎** del controllo precedente, anche dalle righe che avete cancellato, e poi ricolora: se svuotate Contatti (o Invitati) e rilanciate, il foglio torna pulito. Attenzione quindi: i colori di sfondo messi a mano sotto le intestazioni non restano. I codici già scritti in «Codice invito» invece restano: per ripartire davvero da zero durante le prove, cancellate anche quella colonna.

## Impostazioni nello script

In cima a `Code.gs`:

- `RSVP_DEADLINE = '2027-06-30'` chiude le risposte dopo quella data. Vuoto vuol dire sempre aperto.
- `MAX_FAILED_ATTEMPTS` imposta dopo quanti codici sbagliati in 10 minuti il modulo si blocca per qualche minuto, come protezione da chi prova codici a caso.

**Dopo ogni modifica a `Code.gs`** bisogna pubblicare una nuova versione, altrimenti il sito continua a usare quella vecchia: **Esegui il deployment → Gestisci deployment → ✏️ → Versione: Nuova versione → Esegui il deployment**. L'URL resta lo stesso.

## Condividere con Max

Condividete il foglio con Max come un normale Google Sheet (**Condividi**, poi **Editor**).
