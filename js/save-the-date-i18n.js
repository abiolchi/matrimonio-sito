/* =========================================================
   TESTI DELLA PAGINA "SAVE THE DATE" in italiano, francese e inglese.

   - Ogni chiave corrisponde a un elemento con data-i18n="chiave" in index.html
     (oppure viene usata da js/save-the-date.js).
   - data-i18n-alt → testo alternativo di un'immagine,
     data-i18n-aria → aria-label (es. il menu del prefisso).
   - Una chiave nuova va aggiunta in TUTTE e tre le lingue.
   - {name}, {email} e {date} vengono sostituiti automaticamente
     ({email} può essere "a@x.it e b@y.it": le due email unite con la parola "and").
   - Il modulo si compila una volta per invito (singolo, coppia o famiglia).
   ========================================================= */

window.STD_TRANSLATIONS = {
  it: {
    /* Apertura */
    kicker: "Save the date",
    place: "Lerici · Golfo dei Poeti",
    altPhoto: "Alice e Max che ridono insieme, lei con un calice di spumante in mano",

    /* Programma: la festa di domenica, poi gli eventi collaterali del sabato */
    eventsTitle: "Programma",
    labelWhen: "Quando",
    labelPlace: "Luogo",
    mapLink: "Apri su Google Maps",
    ev1Day: "Domenica 19 settembre 2027",
    ev1Title: "Cerimonia simbolica e ricevimento",
    ev1When: "Dal pomeriggio fino a tarda notte",
    beforeDay: "Sabato 18 settembre 2027 · Il giorno prima",
    beforeNote: "Per chi è già in zona: due momenti in più, prima della festa di domenica.",
    ev2Title: "Matrimonio civile",
    ev2When: "Mattina",
    ev3Title: "Aperitivo di benvenuto",
    ev3When: "Sera",
    altVilla: "Acquerello di Villa Marigola e del suo giardino all'italiana, visti dall'alto",

    /* Modulo */
    formTitle: "I vostri contatti",
    intro: "L'invito vero e proprio arriverà più avanti. Intanto lasciateci i vostri contatti, così sappiamo dove mandarvelo.",
    nameLabel: "I vostri nomi",
    nameHelp: "Il tuo nome e cognome, oppure quelli di entrambi se siete in coppia (es. Vanessa e Marco Rossi).",
    emailLabel: "Email",
    emailHelp: "Più avanti vi manderemo qui un link personale per confermare la presenza. Potrete rispondere e cambiare la risposta quando volete.",
    phoneLabel: "Cellulare (WhatsApp)",
    phoneHelp: "Lo useremo solo per mandarvi messaggi dell'ultimo minuto su WhatsApp il giorno del matrimonio.",
    ccLabel: "Prefisso del paese",
    optLegend: "Se siete in coppia (facoltativo)",
    email2Label: "Seconda email",
    email2Help: "Se volete ricevere entrambi le nostre email.",
    phone2Label: "Secondo cellulare (WhatsApp)",
    phone2Help: "Se volete ricevere entrambi i messaggi del giorno del matrimonio.",
    privacy: "Useremo questi dati solo per organizzare il matrimonio.",
    send: "Invia",
    sending: "Invio in corso…",
    cancelEdit: "Annulla",
    slowWait: "Un attimo, ci vuole qualche secondo…",
    demoNote: "Modalità di prova: i dati non vengono inviati a nessuno.",

    /* Errori */
    errName: "Scrivi almeno un nome e cognome.",
    errEmailEmpty: "Scrivi un indirizzo email.",
    errEmail: "Questo indirizzo email non sembra corretto.",
    errPhoneEmpty: "Scrivi un numero di cellulare.",
    errPhone: "Questo numero non sembra valido per il prefisso scelto. Controlla le cifre e il paese.",
    errPhoneCountry: "Non conosciamo questo prefisso. Scegli il paese dal menu oppure scrivici direttamente.",
    errNetwork: "Problema di connessione. Riprova tra poco.",
    errSend: "Qualcosa è andato storto. Riprova tra poco.",
    errBusy: "In questo momento riceviamo troppe richieste. Riprova tra qualche minuto.",

    /* Grazie / contatti già salvati */
    thanksTitle: "Grazie, {name}!",
    thanksBody: "Abbiamo salvato i vostri contatti. Più avanti vi scriveremo a {email} con il link per confermare la presenza.",
    savedTitle: "Bentornati!",
    savedBody: "Da questo dispositivo ci avete già lasciato i vostri contatti, il {date}.",
    summaryIntro: "Ecco cosa abbiamo salvato:",
    sumNames: "Nomi",
    sumEmail: "Email",
    sumPhones: "Cellulari",
    and: "e",
    editHint: "Qualcosa non va? Potete correggere i dati quando volete.",
    editBtn: "Modifica i contatti",

    /* Footer */
    footer: "Con amore, Alice & Max",
    credits: "Realizzato da Alice e Max con l'aiuto di Claude",
    sourceLink: "Il codice su GitHub"
  },

  fr: {
    kicker: "Save the date",
    place: "Lerici · Golfe des Poètes",
    altPhoto: "Alice et Max qui rient ensemble, elle tient une coupe de mousseux",

    eventsTitle: "Programme",
    labelWhen: "Quand",
    labelPlace: "Lieu",
    mapLink: "Ouvrir dans Google Maps",
    ev1Day: "Dimanche 19 septembre 2027",
    ev1Title: "Cérémonie symbolique et réception",
    ev1When: "De l'après-midi jusque tard dans la nuit",
    beforeDay: "Samedi 18 septembre 2027 · La veille",
    beforeNote: "Pour ceux qui seront déjà sur place : deux moments en plus, avant la fête du dimanche.",
    ev2Title: "Mariage civil",
    ev2When: "Matin",
    ev3Title: "Apéritif de bienvenue",
    ev3When: "Soir",
    altVilla: "Aquarelle de la Villa Marigola et de son jardin à l'italienne, vus d'en haut",

    formTitle: "Vos coordonnées",
    intro: "Le faire-part officiel arrivera plus tard. En attendant, laissez-nous vos coordonnées pour que nous sachions où vous l'envoyer.",
    nameLabel: "Vos noms",
    nameHelp: "Votre prénom et nom, ou ceux de vous deux si vous êtes en couple (ex. Vanessa et Marco Rossi).",
    emailLabel: "E-mail",
    emailHelp: "Plus tard, nous vous enverrons à cette adresse un lien personnel pour confirmer votre présence. Vous pourrez répondre et modifier votre réponse quand vous le souhaitez.",
    phoneLabel: "Portable (WhatsApp)",
    phoneHelp: "Nous l'utiliserons uniquement pour vous envoyer des messages de dernière minute sur WhatsApp le jour du mariage.",
    ccLabel: "Indicatif du pays",
    optLegend: "Si vous êtes en couple (facultatif)",
    email2Label: "Deuxième e-mail",
    email2Help: "Si vous souhaitez recevoir tous les deux nos e-mails.",
    phone2Label: "Deuxième portable (WhatsApp)",
    phone2Help: "Si vous souhaitez recevoir tous les deux les messages du jour du mariage.",
    privacy: "Nous utiliserons ces données uniquement pour organiser le mariage.",
    send: "Envoyer",
    sending: "Envoi en cours…",
    cancelEdit: "Annuler",
    slowWait: "Un instant, cela peut prendre quelques secondes…",
    demoNote: "Mode test : les données ne sont envoyées à personne.",

    errName: "Indiquez au moins un prénom et un nom.",
    errEmailEmpty: "Indiquez une adresse e-mail.",
    errEmail: "Cette adresse e-mail ne semble pas correcte.",
    errPhoneEmpty: "Indiquez un numéro de portable.",
    errPhone: "Ce numéro ne semble pas valide pour l'indicatif choisi. Vérifiez les chiffres et le pays.",
    errPhoneCountry: "Nous ne reconnaissons pas cet indicatif. Choisissez le pays dans le menu ou écrivez-nous directement.",
    errNetwork: "Problème de connexion. Réessayez dans un instant.",
    errSend: "Une erreur est survenue. Réessayez dans un instant.",
    errBusy: "Nous recevons trop de demandes en ce moment. Réessayez dans quelques minutes.",

    thanksTitle: "Merci, {name} !",
    thanksBody: "Nous avons bien enregistré vos coordonnées. Plus tard, nous vous écrirons à {email} avec le lien pour confirmer votre présence.",
    savedTitle: "Rebonjour !",
    savedBody: "Depuis cet appareil, vous nous avez déjà laissé vos coordonnées le {date}.",
    summaryIntro: "Voici ce que nous avons enregistré :",
    sumNames: "Noms",
    sumEmail: "E-mail",
    sumPhones: "Portables",
    and: "et",
    editHint: "Quelque chose ne va pas ? Vous pouvez corriger vos données quand vous le souhaitez.",
    editBtn: "Modifier les coordonnées",

    footer: "Avec amour, Alice & Max",
    credits: "Réalisé par Alice et Max avec l'aide de Claude",
    sourceLink: "Le code sur GitHub"
  },

  en: {
    kicker: "Save the date",
    place: "Lerici · Gulf of Poets",
    altPhoto: "Alice and Max laughing together, she is holding a glass of sparkling wine",

    eventsTitle: "Schedule",
    labelWhen: "When",
    labelPlace: "Location",
    mapLink: "Open in Google Maps",
    ev1Day: "Sunday, 19 September 2027",
    ev1Title: "Symbolic ceremony & reception",
    ev1When: "From the afternoon until late at night",
    beforeDay: "Saturday, 18 September 2027 · The day before",
    beforeNote: "For those already in the area: two extra moments before Sunday's celebration.",
    ev2Title: "Civil wedding",
    ev2When: "Morning",
    ev3Title: "Welcome drinks",
    ev3When: "Evening",
    altVilla: "Watercolour of Villa Marigola and its Italian garden, seen from above",

    formTitle: "Your details",
    intro: "The proper invitation will follow later. In the meantime, leave us your details so we know where to send it.",
    nameLabel: "Your names",
    nameHelp: "Your first and last name, or both of yours if you're a couple (e.g. Vanessa and Marco Rossi).",
    emailLabel: "Email",
    emailHelp: "Later on we'll send a personal link to this address so you can RSVP. You can reply and change your answer whenever you like.",
    phoneLabel: "Mobile (WhatsApp)",
    phoneHelp: "We'll only use it to send you last-minute WhatsApp messages on the wedding day.",
    ccLabel: "Country code",
    optLegend: "If you're a couple (optional)",
    email2Label: "Second email",
    email2Help: "If you'd both like to receive our emails.",
    phone2Label: "Second mobile (WhatsApp)",
    phone2Help: "If you'd both like to receive the messages on the wedding day.",
    privacy: "We'll only use these details to organise the wedding.",
    send: "Send",
    sending: "Sending…",
    cancelEdit: "Cancel",
    slowWait: "Just a moment, this can take a few seconds…",
    demoNote: "Test mode: your details are not sent anywhere.",

    errName: "Please enter at least one first and last name.",
    errEmailEmpty: "Please enter an email address.",
    errEmail: "This email address doesn't look right.",
    errPhoneEmpty: "Please enter a mobile number.",
    errPhone: "This number doesn't look valid for the selected country code. Please check the digits and the country.",
    errPhoneCountry: "We don't recognise this country code. Please pick the country from the menu or write to us directly.",
    errNetwork: "Connection problem. Please try again shortly.",
    errSend: "Something went wrong. Please try again shortly.",
    errBusy: "We're receiving too many requests right now. Please try again in a few minutes.",

    thanksTitle: "Thank you, {name}!",
    thanksBody: "We've saved your details. Later on we'll write to {email} with the link to RSVP.",
    savedTitle: "Welcome back!",
    savedBody: "You already left us your details from this device on {date}.",
    summaryIntro: "Here's what we saved:",
    sumNames: "Names",
    sumEmail: "Email",
    sumPhones: "Mobiles",
    and: "and",
    editHint: "Something not right? You can correct your details whenever you like.",
    editBtn: "Edit details",

    footer: "With love, Alice & Max",
    credits: "Made by Alice and Max with help from Claude",
    sourceLink: "The code on GitHub"
  }
};
