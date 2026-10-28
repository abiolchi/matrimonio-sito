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

Finché il sito mostra la pagina save the date, ogni invito (singolo, coppia o famiglia) lascia i nomi, un'email, un cellulare e, se vuole, un secondo cellulare. Lo script li scrive nella scheda **Contatti**, una riga per invito:

| Colonna | Chi la scrive |
|---|---|
| Data, Nomi, Email, Cellulare (WhatsApp), Cellulare 2, Lingua | lo script |
| Codice invito, Note (private) | **voi**: lo script non le tocca mai |

- I numeri sono già in formato internazionale, per esempio `+32470123456`.
- Se qualcuno rimanda il modulo con **la stessa email**, la sua riga viene aggiornata (Codice invito e Note restano come li avete scritti).
- Il sito ricorda i dati mandati **su quel dispositivo**: tornando sulla pagina, l'ospite vede cosa ha salvato e può correggerlo. Se corregge anche l'email, viene aggiornata la stessa riga invece di crearne una nuova. Da un altro telefono o computer il modulo riparte vuoto, e con un'email diversa arriva una riga nuova.
- Ogni invio finisce anche nello **Storico** ("Nuovi contatti" o "Contatti aggiornati").
- Nel **Riepilogo** c'è la riga "Contatti ricevuti (save the date)".
- Se la scheda Contatti manca, lo script la ricrea da solo al primo invio.
- Protezione: al massimo 150 invii ogni 10 minuti in tutto. Oltre, il sito chiede di riprovare più tardi.

Se il foglio esisteva già prima della save the date, dopo aver incollato il nuovo codice lancia di nuovo **💍 Matrimonio → Prepara il foglio**: aggiunge la scheda Contatti e la riga nel Riepilogo senza toccare invitati e risposte.

## Impostazioni nello script

In cima a `Code.gs`:

- `RSVP_DEADLINE = '2027-06-30'` chiude le risposte dopo quella data. Vuoto vuol dire sempre aperto.
- `MAX_FAILED_ATTEMPTS` imposta dopo quanti codici sbagliati in 10 minuti il modulo si blocca per qualche minuto, come protezione da chi prova codici a caso.

**Dopo ogni modifica a `Code.gs`** bisogna pubblicare una nuova versione, altrimenti il sito continua a usare quella vecchia: **Esegui il deployment → Gestisci deployment → ✏️ → Versione: Nuova versione → Esegui il deployment**. L'URL resta lo stesso.

## Condividere con Max

Condividete il foglio con Max come un normale Google Sheet (**Condividi**, poi **Editor**).
