/* =========================================================
   Max & Alice · Lerici 2027 — RSVP
   Script da incollare nel Google Sheet (Estensioni → Apps Script).
   Guida passo passo: apps-script/GUIDA.md
   ========================================================= */

/* ---------- Impostazioni ---------- */

// Data limite per rispondere (formato AAAA-MM-GG). Vuoto = sempre aperto.
// Dopo questa data il modulo non accetta più risposte né modifiche.
var RSVP_DEADLINE = '';

// Protezione contro chi prova codici a caso: dopo troppi codici sbagliati
// in poco tempo, il modulo si blocca per qualche minuto.
var MAX_FAILED_ATTEMPTS = 50;
var BLOCK_WINDOW_SECONDS = 600;

var SHEET_GUESTS = 'Invitati';
var SHEET_ANSWERS = 'Risposte';
var SHEET_LOG = 'Storico';
var SHEET_SUMMARY = 'Riepilogo';

// Save the date: scheda dei contatti (sempre la prima del file).
// "Codice invito" e "Note (private)" sono vostre: lo script non le scrive mai.
var SHEET_CONTACTS = 'Contatti';
// Una riga per invito (singolo, coppia o famiglia).
var CONTACT_HEADERS = ['Data', 'Nomi', 'Email', 'Email 2', 'Cellulare (WhatsApp)', 'Cellulare 2', 'Lingua', 'Codice invito', 'Note (private)', 'Mail di conferma'];
var CONTACT_SCRIPT_COLUMNS = 7; // da "Data" a "Lingua"
var CONFIRM_COLUMN = 10;        // J, "Mail di conferma": a chi è partita (✓) o ⏳ se manca ancora
// Protezione: al massimo tanti invii di contatti ogni 10 minuti, in tutto.
var MAX_CONTACTS_PER_WINDOW = 150;
var CONTACT_WINDOW_SECONDS = 600;

// Mail di conferma della save the date: parte dal Gmail di chi ha pubblicato lo script,
// con Max sempre in copia. Gmail permette circa 100 destinatari al giorno, e la copia conta:
// quelle che non partono restano "⏳" e si mandano con 💍 Matrimonio → Invia le mail di conferma mancanti.
var CONFIRM_SENDER_NAME = 'Alice & Max';
var CONFIRM_CC = 'maxence.draguet@gmail.com';
var CONFIRM_PENDING = '⏳ da inviare';
var SITE_URL = 'https://alicemaxlerici.it';

var GUEST_HEADERS =['Codice', 'Nomi (separati da ;)', 'Lingua (it / fr / en)', 'Invitati al civile (sì / no)', 'Note (private)'];
// Nel codice "monday" vuol dire il matrimonio civile (nome rimasto da quando era di lunedì: ora è sabato 18/9).
var ANSWER_HEADERS = ['Data risposta', 'Codice', 'Nome', 'Domenica 19/9 – cerimonia e ricevimento', 'Sabato 18/9 – matrimonio civile', 'Lingua', '+1 (accompagnatore)'];
var LOG_HEADERS = ['Data', 'Codice', 'Azione', 'Dettaglio (JSON)'];

// Invitati di prova: gli stessi della modalità di prova del sito.
// Cancellateli dal foglio quando inserite la lista vera.
var TEST_GUESTS = [
  ['LIMONE-4K7', 'Giulia; Marco', 'it', 'sì', 'PROVA – da cancellare'],
  ['ONDA-9RT', 'Claire', 'fr', 'no', 'PROVA – da cancellare'],
  ['VELA-3MX', 'Luca; Sara; Tommaso', 'it', 'sì', 'PROVA – da cancellare'],
  ['SOLE-8PW', 'Emma; James', 'en', 'sì', 'PROVA – da cancellare']
];

var CODE_WORDS = ['LIMONE', 'ONDA', 'VELA', 'FARO', 'SOLE', 'SCOGLIO', 'GABBIANO', 'CASTELLO', 'PORTO', 'BARCA', 'OLIVO', 'MARE'];
var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // senza 0/O, 1/I/L per evitare confusioni
var LANGS = ['it', 'fr', 'en'];


/* =========================================================
   Menu nel foglio
   ========================================================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💍 Matrimonio')
    .addItem('Prepara il foglio (solo la prima volta)', 'setupSheets')
    .addItem('Genera i codici mancanti', 'generateMissingCodes')
    .addItem('Controlla i contatti', 'checkContacts')
    .addItem('Invia le mail di conferma mancanti', 'sendMissingConfirmations')
    .addItem('Mandami le mail di conferma di prova', 'sendTestConfirmations')
    .addToUi();
}

function setupSheets() {
  var ss = SpreadsheetApp.getActive();

  getOrCreateContactsSheet_(ss);

  var guests = getOrCreateSheet_(ss, SHEET_GUESTS, GUEST_HEADERS);
  if (guests.getLastRow() < 2) {
    guests.getRange(2, 1, TEST_GUESTS.length, TEST_GUESTS[0].length).setValues(TEST_GUESTS);
  }
  guests.setColumnWidth(1, 130).setColumnWidth(2, 260).setColumnWidth(3, 140).setColumnWidth(4, 200).setColumnWidth(5, 240);

  var answers = getOrCreateSheet_(ss, SHEET_ANSWERS, ANSWER_HEADERS);
  answers.setColumnWidth(1, 150).setColumnWidth(3, 160).setColumnWidth(4, 260).setColumnWidth(5, 240).setColumnWidth(7, 160);

  getOrCreateSheet_(ss, SHEET_LOG, LOG_HEADERS).setColumnWidth(4, 500);

  var summary = getOrCreateSheet_(ss, SHEET_SUMMARY, ['Voce', 'Numero']);
  var rows = [
    ['Inviti (nuclei)', '=COUNTA(Invitati!A2:A)'],
    ['Persone invitate', '=SUMPRODUCT((LEN(TRIM(Invitati!B2:B))>0)*(LEN(Invitati!B2:B)-LEN(SUBSTITUTE(Invitati!B2:B;";";""))+1))'],
    ['Inviti che hanno risposto', '=COUNTUNIQUEIFS(Risposte!B2:B;Risposte!B2:B;"<>")'],
    ['Domenica – ci saranno', '=COUNTIF(Risposte!D2:D;"Sì")'],
    ['Domenica – non ci saranno', '=COUNTIF(Risposte!D2:D;"No")'],
    ['Sabato (civile) – ci saranno', '=COUNTIF(Risposte!E2:E;"Sì")'],
    ['Sabato (civile) – non ci saranno', '=COUNTIF(Risposte!E2:E;"No")'],
    ['Accompagnatori (+1)', '=COUNTIF(Risposte!G2:G;"Sì")'],
    ['Contatti ricevuti (save the date)', '=COUNTA(Contatti!C2:C)'],
    ['Mail di conferma da inviare', '=COUNTIF(Contatti!J2:J;"*⏳*")']
  ];
  // Formule col ";" come separatore, perché il foglio è in italiano.
  // Se un giorno il foglio passa a una lingua con la virgola (es. inglese), vanno cambiati in ",".
  summary.getRange(2, 1, rows.length, 2).setValues(rows);
  summary.setColumnWidth(1, 260);

  ss.setActiveSheet(guests);
  SpreadsheetApp.getUi().alert('Fatto! Il foglio è pronto, con 4 invitati di prova.\n\n' +
    'Ora pubblica lo script come "App web" (vedi la guida, passo 4).');
}

function generateMissingCodes() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_GUESTS);
  if (!sheet || sheet.getLastRow() < 2) return;
  var created = fillMissingCodes_(sheet);
  SpreadsheetApp.getUi().alert(created ? 'Creati ' + created + ' codici nuovi.' : 'Tutti gli inviti hanno già un codice.');
}

// Dà un codice casuale (e mai ripetuto) agli inviti che non ce l'hanno; restituisce quanti ne ha creati
function fillMissingCodes_(sheet) {
  var range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
  var values = range.getValues();
  var used = {};
  values.forEach(function (r) { if (r[0]) used[normalizeCode_(r[0])] = true; });

  var created = 0;
  values.forEach(function (r) {
    if (!r[0] && String(r[1]).trim()) {
      var code;
      do { code = randomCode_(); } while (used[normalizeCode_(code)]);
      used[normalizeCode_(code)] = true;
      r[0] = code;
      created++;
    }
  });
  range.setValues(values);
  return created;
}


/* =========================================================
   App web: il sito chiama questi due punti
   ========================================================= */

// GET ?action=lookup&code=XXX → dati dell'invito e risposte già date
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'lookup') return json_(lookup_(p.code));
  return json_({ ok: true, service: 'rsvp' });
}

// POST (corpo JSON) → salva le risposte di un invito
function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (data && data.website) return json_({ ok: true }); // campo trappola compilato: è un bot
  if (data && data.action === 'contact') return json_(saveContact_(data)); // pagina "save the date"
  return json_(save_(data || {}));
}


/* ---------- Logica ---------- */

function lookup_(rawCode) {
  if (isBlocked_()) return { ok: false, error: 'busy' };
  var guest = findGuest_(rawCode);
  if (!guest) {
    registerFailure_();
    return { ok: false, error: 'not_found' };
  }
  if (isClosed_()) return { ok: false, error: 'closed' };
  return {
    ok: true,
    guest: { code: guest.code, names: guest.names, lang: guest.lang, civil: guest.civil },
    previous: readAnswers_(guest.code)
  };
}

function save_(data) {
  if (isBlocked_()) return { ok: false, error: 'busy' };
  var guest = findGuest_(data.code);
  if (!guest) {
    registerFailure_();
    return { ok: false, error: 'not_found' };
  }
  if (isClosed_()) return { ok: false, error: 'closed' };

  // Controlla che le persone corrispondano all'invito e che ogni risposta sia valida.
  // Chi è invitato da solo può aggiungere un accompagnatore (+1), con il suo nome.
  var people = Array.isArray(data.people) ? data.people : [];
  var byName = {}, plus = null, listed = 0;
  for (var i = 0; i < people.length; i++) {
    var person = people[i] || {};
    if (typeof person.sunday !== 'boolean') return { ok: false, error: 'invalid' };
    if (guest.civil && typeof person.monday !== 'boolean') return { ok: false, error: 'invalid' };
    if (person.plusOne) {
      if (plus || guest.names.length !== 1) return { ok: false, error: 'invalid' };
      var plusName = String(person.name || '').trim().slice(0, 100);
      if (!plusName) return { ok: false, error: 'invalid' };
      plus = { name: plusName, sunday: person.sunday, monday: person.monday };
      continue;
    }
    if (guest.names.indexOf(person.name) === -1 || byName[person.name]) return { ok: false, error: 'invalid' };
    byName[person.name] = person;
    listed++;
  }
  if (listed !== guest.names.length) return { ok: false, error: 'invalid' };

  var lang = LANGS.indexOf(data.lang) > -1 ? data.lang : guest.lang;
  var now = new Date();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(SHEET_ANSWERS);
    var hadAnswers = deleteAnswerRows_(sheet, guest.code);

    var row = function (name, p, isPlus) {
      return [
        now,
        guest.code,
        name,
        p.sunday ? 'Sì' : 'No',
        guest.civil ? (p.monday ? 'Sì' : 'No') : '—',
        lang,
        isPlus ? 'Sì' : ''
      ];
    };
    var rows = guest.names.map(function (name) { return row(name, byName[name], false); });
    if (plus) rows.push(row(safeText_(plus.name), plus, true));
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    ss.getSheetByName(SHEET_LOG).appendRow([
      now, guest.code, hadAnswers ? 'Modifica' : 'Nuova risposta',
      safeText_(JSON.stringify({ people: people, lang: lang }))
    ]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, updatedAt: now.toISOString() };
}


/* ---------- Save the date: contatti ---------- */

// Salva nomi, email (più una seconda facoltativa) e cellulari nella scheda "Contatti".
// Se l'email principale c'è già (maiuscole o minuscole non contano), aggiorna quella riga.
// Se l'ospite corregge l'email dallo stesso dispositivo, il sito manda anche
// previousEmail: in quel caso si aggiorna la riga della vecchia email.
function saveContact_(data) {
  if (contactLimitReached_()) return { ok: false, error: 'busy' };

  var name = String(data.name || '').trim().slice(0, 150);
  var email = String(data.email || '').trim().slice(0, 200);
  var email2 = String(data.email2 || '').trim().slice(0, 200);
  var previousEmail = String(data.previousEmail || '').trim().toLowerCase();
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!name || !emailRe.test(email)) return { ok: false, error: 'invalid' };
  if (email2 && !emailRe.test(email2)) return { ok: false, error: 'invalid' };
  if (email2.toLowerCase() === email.toLowerCase()) email2 = '';

  var phones = [];
  var given = Array.isArray(data.phones) ? data.phones : [];
  for (var i = 0; i < given.length; i++) {
    var phone = String(given[i] || '').trim();
    if (!phone) continue;
    if (!/^\+\d{7,15}$/.test(phone)) return { ok: false, error: 'invalid' };
    if (phones.indexOf(phone) === -1) phones.push(phone);
  }
  if (!phones.length || phones.length > 2) return { ok: false, error: 'invalid' };

  var lang = LANGS.indexOf(data.lang) > -1 ? data.lang : 'it';
  var now = new Date();
  var mail;
  var values = [
    now,
    safeText_(name),
    safeText_(email),
    safeText_(email2),
    safeText_(phones[0]), // safeText_ evita che "+39…" venga letto come formula
    safeText_(phones[1] || ''),
    lang
  ];

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = getOrCreateContactsSheet_(ss);

    var row = 0, previousRow = 0;
    var last = sheet.getLastRow();
    if (last >= 2) {
      var emails = sheet.getRange(2, 3, last - 1, 1).getValues();
      var wanted = email.toLowerCase();
      for (var r = 0; r < emails.length; r++) {
        var cell = String(emails[r][0]).replace(/^'/, '').trim().toLowerCase();
        if (cell === wanted) { row = r + 2; break; }
        if (previousEmail && cell === previousEmail && !previousRow) previousRow = r + 2;
      }
    }
    row = row || previousRow;
    // solo le colonne dello script: "Codice invito" e "Note (private)" restano come sono
    sheet.getRange(row || last + 1, 1, 1, CONTACT_SCRIPT_COLUMNS).setValues([values]);

    var log = ss.getSheetByName(SHEET_LOG) || getOrCreateSheet_(ss, SHEET_LOG, LOG_HEADERS);
    log.appendRow([
      now, '', row ? 'Contatti aggiornati' : 'Nuovi contatti',
      safeText_(JSON.stringify({ name: name, email: email, email2: email2, phones: phones, lang: lang }))
    ]);
    // mail di conferma solo agli indirizzi nuovi: chi cambia solo il cellulare non la riceve di nuovo
    mail = confirmContact_(sheet, row || last + 1, { name: name, email: email, email2: email2, phones: phones, lang: lang }, log);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, mail: mail };
}

// La scheda "Contatti", creata se manca e sempre spostata al primo posto
function getOrCreateContactsSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_CONTACTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CONTACTS, 0);
    sheet.getRange(1, 1, 1, CONTACT_HEADERS.length).setValues([CONTACT_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150).setColumnWidth(2, 200).setColumnWidth(3, 240).setColumnWidth(4, 240)
      .setColumnWidth(5, 170).setColumnWidth(6, 150)
      .setColumnWidth(8, 130).setColumnWidth(9, 240).setColumnWidth(CONFIRM_COLUMN, 300);
  } else if (String(sheet.getRange(1, 4).getValue()) === 'Cellulare (WhatsApp)') {
    // scheda creata con la versione senza "Email 2": inserisce la colonna dopo "Email",
    // così i dati già presenti (e le vostre colonne) si spostano a destra senza mescolarsi
    sheet.insertColumnAfter(3);
    sheet.getRange(1, 4).setValue('Email 2').setFontWeight('bold');
    sheet.setColumnWidth(4, 240);
  }
  if (String(sheet.getRange(1, CONFIRM_COLUMN).getValue()) === '') {
    // scheda creata prima delle mail di conferma
    sheet.getRange(1, CONFIRM_COLUMN).setValue(CONTACT_HEADERS[CONFIRM_COLUMN - 1]).setFontWeight('bold');
    sheet.setColumnWidth(CONFIRM_COLUMN, 300);
  }
  if (sheet.getIndex() !== 1) {
    var active = ss.getActiveSheet();
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(1);
    if (active) ss.setActiveSheet(active);
  }
  return sheet;
}

// true se negli ultimi 10 minuti sono già arrivati troppi invii di contatti
function contactLimitReached_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('contacts') || 0);
  if (n >= MAX_CONTACTS_PER_WINDOW) return true;
  cache.put('contacts', String(n + 1), CONTACT_WINDOW_SECONDS);
  return false;
}



/* ---------- Save the date: mail di conferma ---------- */

// Testi della mail, nella lingua scelta sul sito. {name} = i nomi scritti nel modulo.
var CONFIRM_TEXTS = {
  it: {
    subject: 'Alice & Max · Abbiamo ricevuto i vostri contatti',
    hello: 'Ciao {name},',
    intro: 'grazie! Abbiamo ricevuto i vostri contatti:',
    names: 'Nomi', email: 'Email', phones: 'Cellulari',
    date: 'Segnatevi la data: domenica 19 settembre 2027 a Lerici (Golfo dei Poeti).',
    notRsvp: 'Questa mail non conferma la vostra presenza: nei prossimi mesi riceverete un invito personalizzato a questo indirizzo.',
    spam: 'Per essere sicuri di riceverlo, aggiungete questo indirizzo ai vostri contatti. Se avete trovato questa mail nello spam o nelle promozioni, segnatela come «Non è spam» o spostatela nella posta in arrivo.',
    fix: 'Qualcosa non va? Potete correggere i dati dal sito, dallo stesso dispositivo, oppure rispondere a questa mail:',
    bye: 'A presto!'
  },
  fr: {
    subject: 'Alice & Max · Nous avons bien reçu vos coordonnées',
    hello: 'Bonjour {name},',
    intro: 'merci ! Nous avons bien reçu vos coordonnées :',
    names: 'Noms', email: 'E-mail', phones: 'Portables',
    date: 'Notez la date : dimanche 19 septembre 2027 à Lerici (Golfe des Poètes).',
    notRsvp: 'Cet e-mail ne confirme pas votre présence : dans les prochains mois, vous recevrez une invitation personnalisée à cette adresse.',
    spam: 'Pour être sûrs de la recevoir, ajoutez cette adresse à vos contacts. Si vous avez trouvé cet e-mail dans les spams ou les promotions, marquez-le comme « Non spam » ou déplacez-le dans votre boîte de réception.',
    fix: 'Quelque chose ne va pas ? Vous pouvez corriger vos données sur le site, depuis le même appareil, ou répondre à cet e-mail :',
    bye: 'À bientôt !'
  },
  en: {
    subject: "Alice & Max · We've received your details",
    hello: 'Hi {name},',
    intro: "thank you! We've received your details:",
    names: 'Names', email: 'Email', phones: 'Mobiles',
    date: 'Save the date: Sunday 19 September 2027 in Lerici (Gulf of Poets).',
    notRsvp: "This email doesn't confirm your attendance: in the coming months you'll receive a personal invitation at this address.",
    spam: "To make sure you get it, add this address to your contacts. If you found this email in spam or promotions, mark it as \"Not spam\" or move it to your inbox.",
    fix: 'Something not right? You can correct your details on the website, from the same device, or just reply to this email:',
    bye: 'See you soon!'
  }
};

// Manda la mail di conferma agli indirizzi del contatto che non l'hanno ancora ricevuta e scrive
// nella colonna "Mail di conferma" a chi è partita. Non lancia mai errori: se Gmail non può
// (limite giornaliero o altro), la cella dice "⏳ da inviare" e ci pensa il menu.
// Restituisce 'sent', 'pending' o 'none' (niente da mandare).
function confirmContact_(sheet, row, contact, log) {
  var cell = sheet.getRange(row, CONFIRM_COLUMN);
  var before = String(cell.getValue());
  var already = confirmedEmails_(before);
  var current = [contact.email, contact.email2].filter(String);
  var done = current.filter(function (e) { return already.indexOf(e.toLowerCase()) > -1; });
  var missing = current.filter(function (e) { return already.indexOf(e.toLowerCase()) === -1; });

  var result = 'none';
  if (missing.length) {
    result = 'pending';
    var cc = missing.some(function (e) { return e.toLowerCase() === CONFIRM_CC; }) ? '' : CONFIRM_CC;
    try {
      // la copia a Max conta nel limite giornaliero
      if (MailApp.getRemainingDailyQuota() >= missing.length + (cc ? 1 : 0)) {
        MailApp.sendEmail(confirmMessage_(missing, cc, contact));
        done = done.concat(missing);
        result = 'sent';
        if (log) log.appendRow([new Date(), '', 'Mail di conferma', safeText_(missing.join(', '))]);
      } else if (log) {
        log.appendRow([new Date(), '', 'Mail di conferma rimandata', 'Limite giornaliero di Gmail: ' + safeText_(missing.join(', '))]);
      }
    } catch (err) {
      if (log) log.appendRow([new Date(), '', 'Mail di conferma non partita', safeText_(missing.join(', ') + ' – ' + err)]);
    }
  }
  // nell'ordine del modulo: prima l'email principale
  done = current.filter(function (e) { return done.indexOf(e) > -1; });
  var text = (done.length ? '✓ ' + done.join(', ') : '') + (result === 'pending' ? (done.length ? ' · ' : '') + CONFIRM_PENDING : '');
  if (text !== before) cell.setValue(safeText_(text));
  return result;
}

// Gli indirizzi che hanno già ricevuto la mail, letti dalla cella "Mail di conferma"
function confirmedEmails_(text) {
  var sent = String(text || '').split('⏳')[0];
  return (sent.match(/[^\s,·✓']+@[^\s,·]+/g) || []).map(function (e) { return e.toLowerCase(); });
}

// La mail, in testo semplice e in HTML (i dati degli ospiti sempre "escaped")
function confirmMessage_(to, cc, contact) {
  var T = CONFIRM_TEXTS[contact.lang] || CONFIRM_TEXTS.it;
  var emails = [contact.email, contact.email2].filter(String).join(', ');
  var phones = contact.phones.join(', ');
  var hello = T.hello.replace('{name}', contact.name);

  var body = [
    hello, '', T.intro, '',
    T.names + ': ' + contact.name, T.email + ': ' + emails, T.phones + ': ' + phones, '',
    T.date, '', T.notRsvp, '', T.spam, '', T.fix, SITE_URL, '', T.bye, 'Alice & Max'
  ].join('\n');

  var p = function (s) { return '<p style="margin:0 0 14px">' + s + '</p>'; };
  var html = '<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1f3a5f;max-width:560px">' +
    p(escapeHtml_(hello)) + p(escapeHtml_(T.intro)) +
    '<table style="margin:0 0 14px;border-collapse:collapse">' +
    [[T.names, contact.name], [T.email, emails], [T.phones, phones]].map(function (r) {
      return '<tr><td style="padding:2px 16px 2px 0;color:#5b6b80">' + escapeHtml_(r[0]) + '</td><td style="color:#1f3a5f">' + escapeHtml_(r[1]) + '</td></tr>';
    }).join('') + '</table>' +
    p('<strong>' + escapeHtml_(T.date) + '</strong>') + p(escapeHtml_(T.notRsvp)) + p(escapeHtml_(T.spam)) +
    p(escapeHtml_(T.fix) + ' <a href="' + SITE_URL + '">' + SITE_URL.replace('https://', '') + '</a>') +
    p(escapeHtml_(T.bye) + '<br>Alice &amp; Max') + '</div>';

  var message = { to: to.join(','), name: CONFIRM_SENDER_NAME, subject: T.subject, body: body, htmlBody: html };
  if (cc) message.cc = cc;
  return message;
}

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Menu: manda le mail di conferma che mancano (righe con ⏳ o senza niente nella colonna J),
// finché il limite giornaliero di Gmail lo permette
function sendMissingConfirmations() {
  var message;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    message = runMissingConfirmations_(SpreadsheetApp.getActive());
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert(message);
}

function runMissingConfirmations_(ss) {
  var sheet = getOrCreateContactsSheet_(ss);
  var log = ss.getSheetByName(SHEET_LOG) || getOrCreateSheet_(ss, SHEET_LOG, LOG_HEADERS);
  var count = lastDataRow_(sheet, CONTACT_SCRIPT_COLUMNS) - 1;
  var rows = count > 0 ? sheet.getRange(2, 1, count, CONTACT_SCRIPT_COLUMNS).getValues() : [];
  var sent = 0, pending = 0;
  rows.forEach(function (r, i) {
    var clean = function (v) { return String(v).replace(/^'/, '').trim(); };
    var email = clean(r[2]);
    if (!email) return;
    var lang = clean(r[6]);
    var result = confirmContact_(sheet, i + 2, {
      name: clean(r[1]), email: email, email2: clean(r[3]),
      phones: [clean(r[4]), clean(r[5])].filter(String), lang: LANGS.indexOf(lang) > -1 ? lang : 'it'
    }, log);
    if (result === 'sent') sent++;
    if (result === 'pending') pending++;
  });
  return (sent ? 'Mandate ' + sent + ' mail di conferma.' : 'Nessuna mail di conferma da mandare.') +
    (pending ? '\n\n⏳ Ne restano ' + pending + ': Gmail ha raggiunto il limite di oggi (o c\'è stato un errore, vedi lo Storico). ' +
      'Riprovate domani con lo stesso menu.' : '');
}

// Menu: manda a voi (a chi ha pubblicato lo script) la mail di conferma nelle tre lingue,
// senza Max in copia, per vedere come arriva. Serve anche a dare a Google il permesso di mandare mail.
function sendTestConfirmations() {
  var me = Session.getEffectiveUser().getEmail();
  LANGS.forEach(function (lang) {
    MailApp.sendEmail(confirmMessage_([me], '', {
      name: 'Vanessa e Marco Rossi', email: me, email2: '', phones: ['+393331234567'], lang: lang
    }));
  });
  SpreadsheetApp.getUi().alert('Mandate 3 mail di prova (italiano, francese, inglese) a ' + me + '.\n\n' +
    'Nessuna riga è stata aggiunta ai Contatti.');
}


/* =========================================================
   Controlla i contatti: collega la scheda Contatti agli Invitati
   (menu 💍 Matrimonio → Controlla i contatti). Si può rilanciare quante volte serve.

   - 🟢 verde: il contatto è collegato a un solo invito, e quell'invito a un solo contatto.
     Il collegamento è il codice nella colonna "Codice invito" di Contatti.
   - 🟡 giallo: da guardare a mano. Il motivo è nella nota sulla cella del nome
     (passateci sopra col mouse): doppione, codice sbagliato, più inviti possibili…
   - nessun colore: nessun invito corrispondente.

   Un contatto si collega da solo quando i suoi nomi contengono TUTTI i nomi di un invito
   ("Veronica e Matteo Rossi" → invito "Veronica; Matteo"); se ne combaciano più di uno vince
   quello con più nomi. Un codice già scritto a mano in Contatti non viene mai cambiato.
   In Invitati, dalla colonna F, compaiono email e cellulari letti da Contatti tramite il codice.
   ========================================================= */

var CHECK_GREEN = '#d9ead3';
var CHECK_YELLOW = '#fff2cc';
var CHECK_NOTE = '🔎 ';                                  // le note che iniziano così sono del controllo
var NAME_JOINERS = ['e', 'ed', 'et', 'and', 'y', 'und']; // "Veronica e Matteo": la "e" non è un nome
var INVITE_LINK_HEADERS = ['Email', 'Email 2', 'Cellulare (WhatsApp)', 'Cellulare 2'];
var INVITE_LINK_FIRST_COLUMN = 6;                        // F, subito dopo "Note (private)"

function checkContacts() {
  var message;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    message = runContactCheck_(SpreadsheetApp.getActive());
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert(message);
}

function runContactCheck_(ss) {
  var guestsSheet = ss.getSheetByName(SHEET_GUESTS);
  var contactsSheet = getOrCreateContactsSheet_(ss);
  var linkColumns = INVITE_LINK_FIRST_COLUMN + INVITE_LINK_HEADERS.length - 1;

  // Prima si toglie tutto quello che aveva segnato il controllo precedente (colori e note 🔎),
  // anche sulle righe ormai vuote: se avete cancellato delle righe, il foglio torna pulito.
  clearCheckMarks_(contactsSheet, CONTACT_HEADERS.length, 2);
  if (guestsSheet) clearCheckMarks_(guestsSheet, linkColumns, 0);

  if (!guestsSheet || lastDataRow_(guestsSheet, 2) < 2) {
    if (guestsSheet) writeInviteLinks_(guestsSheet, 0);
    return 'La scheda Invitati è vuota: ho solo tolto i colori e le note del controllo precedente.\n\n' +
      'Inserite la lista degli inviti e rilanciate il controllo.';
  }

  var newCodes = fillMissingCodes_(guestsSheet);
  var inviteCount = lastDataRow_(guestsSheet, 2) - 1;
  var guestRows = guestsSheet.getRange(2, 1, inviteCount, 2).getValues();
  var invites = guestRows.map(function (r) {
    return { code: String(r[0]).trim(), names: String(r[1]).split(/[;\n]/).map(function (x) { return x.trim(); }).filter(String) };
  });

  var contactCount = lastDataRow_(contactsSheet, CONTACT_HEADERS.length) - 1;
  var contactRows = contactCount > 0 ? contactsSheet.getRange(2, 1, contactCount, CONTACT_HEADERS.length).getValues() : [];
  var contacts = contactRows.map(function (r) {
    return { name: String(r[1]), emails: [r[2], r[3]], phones: [r[4], r[5]], code: String(r[7]).trim() };
  });

  var result = linkContacts_(invites, contacts);

  // Contatti: codici nuovi, colori e note (le vostre note sulla cella del nome restano)
  if (contacts.length) {
    var codeRange = contactsSheet.getRange(2, 8, contacts.length, 1);
    var codes = codeRange.getValues();
    result.contacts.forEach(function (c, i) { if (c.newCode) codes[i][0] = c.newCode; });
    codeRange.setValues(codes);

    contactsSheet.getRange(2, 1, contacts.length, CONTACT_HEADERS.length).setBackgrounds(
      result.contacts.map(function (c) { return CONTACT_HEADERS.map(function () { return checkColor_(c.status); }); }));

    var noteRange = contactsSheet.getRange(2, 2, contacts.length, 1);
    var notes = noteRange.getNotes();
    result.contacts.forEach(function (c, i) {
      if (notes[i][0] || !c.notes.length) return;
      notes[i][0] = CHECK_NOTE + c.notes.join('\n');
    });
    noteRange.setNotes(notes);
  }

  // Invitati: colori e colonne con email e cellulari presi da Contatti
  guestsSheet.getRange(2, 1, inviteCount, linkColumns).setBackgrounds(
    result.invites.map(function (inv) {
      var row = [];
      for (var k = 0; k < linkColumns; k++) row.push(checkColor_(inv.status));
      return row;
    }));
  var linksWritten = writeInviteLinks_(guestsSheet, inviteCount);

  var t = result.totals;
  return 'Controllo fatto.\n\n' +
    '🟢 Contatti collegati a un invito: ' + t.linked + (t.newLinks ? ' (' + t.newLinks + ' collegati adesso)' : '') + '\n' +
    '🟡 Contatti da controllare: ' + t.check + '\n' +
    '⚪ Contatti senza un invito corrispondente: ' + t.unmatched + '\n' +
    '⚪ Inviti senza contatto: ' + t.invitesWithout + '\n' +
    (newCodes ? '\nCodici nuovi generati in Invitati: ' + newCodes + '\n' : '') +
    (t.check ? '\nIl motivo dei gialli è nella nota sulla cella del nome (in Contatti): passateci sopra col mouse.' : '') +
    (linksWritten ? '' : '\n\n⚠️ In Invitati le colonne F–I non sono vuote: non ho aggiunto email e cellulari. Liberatele e rilanciate.');
}

// Toglie colori e note 🔎 di un controllo precedente su tutte le righe sotto l'intestazione,
// comprese quelle ormai vuote. Le note scritte da voi restano.
function clearCheckMarks_(sheet, columns, noteColumn) {
  var rows = sheet.getMaxRows() - 1;
  if (rows < 1) return;
  sheet.getRange(2, 1, rows, columns).setBackground(null);
  if (!noteColumn) return;
  var range = sheet.getRange(2, noteColumn, rows, 1);
  var notes = range.getNotes();
  var changed = false;
  notes.forEach(function (r) {
    if (r[0] && r[0].indexOf(CHECK_NOTE) === 0) { r[0] = ''; changed = true; }
  });
  if (changed) range.setNotes(notes);
}

// L'ultima riga con qualcosa scritto nelle prime colonne (le formule più a destra non contano)
function lastDataRow_(sheet, columns) {
  var last = sheet.getLastRow();
  if (last < 2) return 1;
  var values = sheet.getRange(2, 1, last - 1, columns).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i].some(function (v) { return String(v).trim() !== ''; })) return i + 2;
  }
  return 1;
}

/* Il cuore del controllo, senza leggere né scrivere il foglio (così si può provare anche fuori).
   invites:  [{ code, names: ['Veronica', 'Matteo'] }]
   contacts: [{ name, emails: [..], phones: [..], code }]
   Restituisce per ogni contatto { status: 'green'|'yellow'|'', notes: [], newCode }
   e per ogni invito { status }. */
function linkContacts_(invites, contacts) {
  var byCode = {};
  var inv = invites.map(function (x, i) {
    var item = { code: x.code, key: normalizeCode_(x.code), row: i + 2, names: x.names,
      words: x.names.map(nameWords_).filter(function (w) { return w.length; }), contacts: [], maybe: false };
    if (item.key && item.words.length && !byCode[item.key]) byCode[item.key] = item;
    return item;
  });
  var usable = inv.filter(function (x) { return x.key && x.words.length; });

  var con = contacts.map(function (x, i) {
    return {
      row: i + 2, words: nameWords_(x.name), code: String(x.code || '').trim(),
      emails: x.emails.map(function (e) { return String(e || '').replace(/^'/, '').trim().toLowerCase(); }).filter(String),
      phones: x.phones.map(function (p) { return String(p || '').replace(/^'/, '').replace(/[^\d+]/g, ''); }).filter(String),
      empty: !String(x.name || '').trim() && !String(x.emails[0] || '').trim(),
      notes: [], invite: null, newCode: '', status: ''
    };
  });

  // 1. email o cellulari ripetuti su più righe
  var seen = {};
  con.forEach(function (c) {
    c.emails.concat(c.phones).forEach(function (v) { (seen[v] = seen[v] || []).push(c); });
  });
  Object.keys(seen).forEach(function (v) {
    var list = seen[v].filter(function (c, k, all) { return all.indexOf(c) === k; });
    if (list.length < 2) return;
    list.forEach(function (c) {
      var others = list.filter(function (o) { return o !== c; }).map(function (o) { return o.row; });
      c.notes.push(v + ' compare anche alla riga ' + others.join(', ') + ': doppione?');
    });
  });

  // 2. codici già scritti in Contatti (a mano o da un controllo precedente): si controllano soltanto
  con.forEach(function (c) {
    if (!c.code) return;
    var target = byCode[normalizeCode_(c.code)];
    if (!target) { c.notes.push('Il codice ' + c.code + ' non esiste in Invitati.'); return; }
    c.invite = target;
    target.contacts.push(c);
    // nessun nome dell'invito nel contatto: forse il codice è stato copiato sulla riga sbagliata
    var similar = target.words.some(function (ws) { return containsAll_(c.words, ws); });
    if (!similar) c.notes.push('Il codice ' + target.code + ' è di ' + target.names.join(', ') + ': è la riga giusta?');
  });

  // 3. per ogni contatto, l'invito più preciso i cui nomi ci sono tutti:
  //    prima quello con più nomi, poi quello con più parole (es. con il cognome)
  var score = function (x) { return x.words.length * 100 + [].concat.apply([], x.words).length; };
  var claims = [];
  con.forEach(function (c) {
    if (c.empty) return;
    var full = usable.filter(function (x) {
      return x.words.every(function (ws) { return containsAll_(c.words, ws); });
    });
    var best = 0;
    full.forEach(function (x) { best = Math.max(best, score(x)); });
    full = full.filter(function (x) { return score(x) === best; });

    // codice già scritto: se non è quello che i nomi suggeriscono, lo si dice e basta
    if (c.code) {
      if (c.invite && full.length && full.indexOf(c.invite) === -1) {
        c.notes.push('Dai nomi sembra piuttosto ' + full.map(describeInvite_).join(' / ') + '.');
        full.forEach(function (x) { x.maybe = true; });
      }
      return;
    }

    var taken = full.filter(function (x) { return x.contacts.length; });
    if (full.length === 1 && !taken.length) { claims.push({ contact: c, invite: full[0] }); return; }
    if (full.length > 1) {
      c.notes.push('Potrebbe essere più di un invito: ' + full.map(describeInvite_).join(' / '));
      full.forEach(function (x) { x.maybe = true; });
      return;
    }
    if (taken.length) {
      taken.forEach(function (x) {
        c.notes.push('Corrisponde a ' + describeInvite_(x) + ', che però è già collegato alla riga ' +
          x.contacts.map(function (o) { return o.row; }).join(', ') + '.');
        x.maybe = true;
      });
      return;
    }
    var partial = usable.filter(function (x) {
      return x.words.some(function (ws) { return containsAll_(c.words, ws); });
    });
    if (partial.length) {
      c.notes.push('In parte simile a: ' + partial.map(describeInvite_).join(' / ') + ' (iscritti separatamente?)');
      partial.forEach(function (x) { x.maybe = true; });
    }
  });

  // un invito reclamato da un solo contatto si collega; da più contatti, no
  claims.forEach(function (cl) {
    var rivals = claims.filter(function (o) { return o.invite === cl.invite && o !== cl; });
    if (rivals.length) {
      cl.contact.notes.push('Anche la riga ' + rivals.map(function (o) { return o.contact.row; }).join(', ') +
        ' corrisponde a ' + describeInvite_(cl.invite) + ': doppione?');
      cl.invite.maybe = true;
      return;
    }
    cl.contact.invite = cl.invite;
    cl.contact.newCode = cl.invite.code;
    cl.invite.contacts.push(cl.contact);
  });

  // 4. un invito con più contatti collegati
  inv.forEach(function (x) {
    if (x.contacts.length < 2) return;
    x.contacts.forEach(function (c) {
      var others = x.contacts.filter(function (o) { return o !== c; }).map(function (o) { return o.row; });
      c.notes.push('Il codice ' + x.code + ' è anche alla riga ' + others.join(', ') + '.');
    });
  });

  // colori e totali
  var totals = { linked: 0, newLinks: 0, check: 0, unmatched: 0, invitesWithout: 0 };
  con.forEach(function (c) {
    if (c.empty) return;
    c.status = c.notes.length ? 'yellow' : c.invite ? 'green' : '';
    // un collegamento automatico si scrive solo se la riga è davvero a posto
    if (c.status === 'yellow' && c.newCode) {
      c.invite.contacts.splice(c.invite.contacts.indexOf(c), 1);
      c.invite.maybe = true;
      c.invite = null;
      c.newCode = '';
    }
    if (c.status === 'green') { totals.linked++; if (c.newCode) totals.newLinks++; }
    else if (c.status === 'yellow') totals.check++;
    else totals.unmatched++;
  });
  inv.forEach(function (x) {
    var ok = x.contacts.length === 1 && x.contacts[0].status === 'green';
    x.status = ok ? 'green' : (x.contacts.length || x.maybe) ? 'yellow' : '';
    if (x.words.length && !x.contacts.length) totals.invitesWithout++;
  });

  return {
    contacts: con.map(function (c) { return { status: c.status, notes: c.notes, newCode: c.newCode }; }),
    invites: inv.map(function (x) { return { status: x.status }; }),
    totals: totals
  };
}

// "Véronica e Matteo D'Amico" → ['veronica', 'matteo', 'd', 'amico']
function nameWords_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, ' ').trim().split(' ')
    .filter(function (w) { return w && NAME_JOINERS.indexOf(w) === -1; });
}

function containsAll_(words, wanted) {
  return wanted.every(function (w) { return words.indexOf(w) > -1; });
}

function describeInvite_(x) {
  return x.code + ' (' + x.names.join(', ') + ')';
}

function checkColor_(status) {
  return status === 'green' ? CHECK_GREEN : status === 'yellow' ? CHECK_YELLOW : null;
}

// In Invitati, colonne F–I: email e cellulari letti da Contatti tramite il codice (formule,
// quindi sempre aggiornate). Se quelle colonne contengono altro, non tocca niente e restituisce false.
function writeInviteLinks_(sheet, count) {
  var headerRange = sheet.getRange(1, INVITE_LINK_FIRST_COLUMN, 1, INVITE_LINK_HEADERS.length);
  var headers = headerRange.getValues()[0];
  var free = headers.every(function (h, i) { return h === '' || h === INVITE_LINK_HEADERS[i]; });
  if (!free) return false;
  headerRange.setValues([INVITE_LINK_HEADERS]).setFontWeight('bold');

  var sourceColumns = ['C', 'D', 'E', 'F']; // Email, Email 2, Cellulare, Cellulare 2 in Contatti
  var formulas = [];
  for (var r = 2; r < count + 2; r++) {
    formulas.push(sourceColumns.map(function (col) {
      return '=IF($A' + r + '="";"";IFERROR(INDEX(' + SHEET_CONTACTS + '!$' + col + ':$' + col + ';MATCH($A' + r + ';' +
        SHEET_CONTACTS + '!$H:$H;0))&"";""))';
    }));
  }
  if (count) sheet.getRange(2, INVITE_LINK_FIRST_COLUMN, count, INVITE_LINK_HEADERS.length).setFormulas(formulas);
  // sotto l'ultimo invito, niente formule rimaste da righe cancellate
  var below = sheet.getMaxRows() - count - 1;
  if (below > 0) sheet.getRange(count + 2, INVITE_LINK_FIRST_COLUMN, below, INVITE_LINK_HEADERS.length).clearContent();
  for (var c = 0; c < INVITE_LINK_HEADERS.length; c++) sheet.setColumnWidth(INVITE_LINK_FIRST_COLUMN + c, c < 2 ? 220 : 160);
  return true;
}


/* ---------- Lettura e scrittura del foglio ---------- */

function findGuest_(rawCode) {
  var wanted = normalizeCode_(rawCode);
  if (!wanted) return null;
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_GUESTS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] && normalizeCode_(r[0]) === wanted) {
      var names = String(r[1]).split(/[;\n]/).map(function (s) { return s.trim(); }).filter(String);
      if (!names.length) return null;
      var lang = String(r[2]).trim().toLowerCase();
      return {
        code: String(r[0]).trim(),
        names: names,
        lang: LANGS.indexOf(lang) > -1 ? lang : 'it',
        civil: /^(s[iì]|si|yes|y|oui|x|1|true|vero)$/i.test(String(r[3]).trim())
      };
    }
  }
  return null;
}

function readAnswers_(code) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_ANSWERS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, ANSWER_HEADERS.length).getValues();
  var people = [], updatedAt = null;
  values.forEach(function (r) {
    if (String(r[1]) !== code) return;
    var person = {
      name: String(r[2]).replace(/^'/, ''),
      sunday: r[3] === 'Sì' ? true : r[3] === 'No' ? false : null,
      monday: r[4] === 'Sì' ? true : r[4] === 'No' ? false : null
    };
    if (r[6] === 'Sì') person.plusOne = true;
    people.push(person);
    if (r[0] instanceof Date) updatedAt = r[0].toISOString();
  });
  return people.length ? { updatedAt: updatedAt, people: people } : null;
}

function deleteAnswerRows_(sheet, code) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var codes = sheet.getRange(2, 2, last - 1, 1).getValues();
  var found = false;
  for (var i = codes.length - 1; i >= 0; i--) {
    if (String(codes[i][0]) === code) {
      sheet.deleteRow(i + 2);
      found = true;
    }
  }
  return found;
}

function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}


/* ---------- Utilità ---------- */

function normalizeCode_(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function randomCode_() {
  var word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  var tail = '';
  for (var i = 0; i < 3; i++) tail += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  return word + '-' + tail;
}

// Evita che un testo che inizia con = + - @ venga interpretato come formula
function safeText_(s) {
  s = String(s || '');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function isClosed_() {
  if (!RSVP_DEADLINE) return false;
  var end = new Date(RSVP_DEADLINE + 'T23:59:59');
  return new Date() > end;
}

function isBlocked_() {
  var n = Number(CacheService.getScriptCache().get('failed') || 0);
  return n >= MAX_FAILED_ATTEMPTS;
}

function registerFailure_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('failed') || 0) + 1;
  cache.put('failed', String(n), BLOCK_WINDOW_SECONDS);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
