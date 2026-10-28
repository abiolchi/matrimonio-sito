/* =========================================================
   Logica della pagina "Save the date": cambio lingua + modulo contatti

   1. l'ospite scrive nome, email e cellulare (più un secondo cellulare facoltativo)
   2. i numeri vengono controllati e salvati in formato internazionale (+32470123456)
   3. invio al Google Sheet (scheda "Contatti"), oppure finto invio in modalità di prova
   4. "Grazie" con il riepilogo di cosa è stato salvato; i dati restano anche in questo
      browser, così a una visita successiva si vede il riepilogo e si può correggerlo
   Il modulo si compila una volta per invito (singolo, coppia o famiglia).
   ========================================================= */

(function () {
  "use strict";

  var T = window.STD_TRANSLATIONS;
  var CFG = window.RSVP_CONFIG || {};
  var LANGS = ["it", "fr", "en"];
  var DEFAULT_LANG = "it";
  var current = DEFAULT_LANG;

  var $ = function (id) { return document.getElementById(id); };

  /* =========================================================
     Lingua (stessa logica del sito completo)
     ========================================================= */

  function t(key) {
    return (T[current] || {})[key] || T[DEFAULT_LANG][key] || key;
  }

  function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; });
  }

  function setLang(lang) {
    if (LANGS.indexOf(lang) === -1) lang = DEFAULT_LANG;
    current = lang;
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) { el.alt = t(el.dataset.i18nAlt); });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    document.querySelectorAll(".langs button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    try { localStorage.setItem("lang", lang); } catch (e) {}

    followLang();
    render();
  }

  function initialLang() {
    // 1) ?lang=fr nell'indirizzo  2) scelta precedente  3) lingua del browser  4) italiano
    var fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl && LANGS.indexOf(fromUrl) !== -1) return fromUrl;
    try {
      var saved = localStorage.getItem("lang");
      if (saved && LANGS.indexOf(saved) !== -1) return saved;
    } catch (e) {}
    var browser = (navigator.language || "").slice(0, 2).toLowerCase();
    return LANGS.indexOf(browser) !== -1 ? browser : DEFAULT_LANG;
  }

  document.querySelectorAll(".langs button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.lang); });
  });

  /* =========================================================
     Prefissi e controllo dei numeri
     ========================================================= */

  // trunk = cifra nazionale da togliere davanti al numero (0 in Belgio, Francia…; 1 negli USA).
  // re = come deve essere il numero nazionale, senza prefisso internazionale.
  var COUNTRIES = [
    { id: "IT", flag: "🇮🇹", dial: "39", trunk: "",  re: /^(3\d{8,9}|0\d{5,10})$/ }, // in Italia lo 0 resta
    { id: "BE", flag: "🇧🇪", dial: "32", trunk: "0", re: /^(4\d{8}|[1-9]\d{7})$/ },
    { id: "FR", flag: "🇫🇷", dial: "33", trunk: "0", re: /^[1-9]\d{8}$/ },
    { id: "UK", flag: "🇬🇧", dial: "44", trunk: "0", re: /^[1-9]\d{8,9}$/ },
    { id: "US", flag: "🇺🇸", dial: "1",  trunk: "1", re: /^[2-9]\d{2}[2-9]\d{6}$/ },
    { id: "PL", flag: "🇵🇱", dial: "48", trunk: "",  re: /^[1-9]\d{8}$/ },
    { id: "NL", flag: "🇳🇱", dial: "31", trunk: "0", re: /^[1-9]\d{8}$/ },
    { id: "CH", flag: "🇨🇭", dial: "41", trunk: "0", re: /^[1-9]\d{8}$/ }
  ];
  var BY_ID = {};
  COUNTRIES.forEach(function (c) { BY_ID[c.id] = c; });

  // Prefisso iniziale secondo la lingua della pagina
  var LANG_COUNTRY = { it: "IT", fr: "BE", en: "UK" };
  function startCountry() { return LANG_COUNTRY[current] || "IT"; }

  // Restituisce { empty } | { error, country } | { value: "+32470123456", country }.
  // country è il paese letto da un numero che inizia con + o 00 (per aggiornare il menu).
  function parsePhone(raw, countryId) {
    var s = String(raw || "").replace(/[\s\-.()\/]/g, "");
    if (!s) return { empty: true };
    var c = BY_ID[countryId] || BY_ID.IT;
    var fromNumber = null;
    if (/^(\+|00)/.test(s)) {
      s = s.replace(/^(\+|00)/, "");
      if (!/^\d+$/.test(s)) return { error: "errPhone" };
      c = COUNTRIES.filter(function (x) { return s.indexOf(x.dial) === 0; })[0];
      if (!c) return { error: "errPhoneCountry" };
      s = s.slice(c.dial.length);
      fromNumber = c.id;
    }
    if (!/^\d+$/.test(s)) return { error: "errPhone", country: fromNumber };
    if (c.trunk && s.charAt(0) === c.trunk) s = s.slice(1);
    if (!c.re.test(s)) return { error: "errPhone", country: fromNumber };
    return { value: "+" + c.dial + s, country: fromNumber };
  }

  /* ---------- Menu dei prefissi ---------- */

  var PHONES = ["1", "2"];
  // menu scelti dall'ospite (o dal +… di un numero): il secondo, finché non è scelto,
  // segue il primo, e il primo segue la lingua della pagina
  var touched = { "1": false, "2": false };

  function fillSelects() {
    PHONES.forEach(function (n) {
      var sel = $("cc" + n);
      COUNTRIES.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.flag + " +" + c.dial;
        sel.appendChild(opt);
      });
    });
  }

  function resetSelects() {
    touched = { "1": false, "2": false };
    PHONES.forEach(function (n) { $("cc" + n).value = startCountry(); });
  }

  // cambiando lingua, il prefisso cambia solo se l'ospite non l'ha scelto e non ha ancora scritto il numero
  function followLang() {
    if (touched["1"] || $("phone1").value.trim() || !$("cc1").options.length) return;
    $("cc1").value = startCountry();
    followFirst();
  }

  function setCountry(n, id) {
    $("cc" + n).value = id;
    touched[n] = true;
    if (n === "1") followFirst();
  }

  function followFirst() {
    if (!touched["2"]) $("cc2").value = $("cc1").value;
  }

  PHONES.forEach(function (n) {
    $("cc" + n).addEventListener("change", function () {
      touched[n] = true;
      if (n === "1") followFirst();
      // con un numero già scritto, lo ricontrolla col nuovo prefisso
      PHONES.forEach(function (m) { if ($("phone" + m).value.trim()) check("phone" + m); });
    });
  });

  /* =========================================================
     Controllo dei campi
     ========================================================= */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var FIELDS = ["name", "email", "phone1", "phone2"];

  function setError(id, key) {
    var input = $(id), err = $(id + "-error");
    if (key) {
      err.dataset.i18n = key;
      err.textContent = t(key);
      err.hidden = false;
      input.setAttribute("aria-invalid", "true");
    } else {
      err.hidden = true;
      input.removeAttribute("aria-invalid");
    }
  }

  // true se il campo va bene; altrimenti mostra l'errore sotto il campo
  function check(id) {
    var value = $(id).value.trim();
    var key = null;
    if (id === "name") {
      key = value ? null : "errName";
    } else if (id === "email") {
      key = !value ? "errEmailEmpty" : EMAIL_RE.test(value) ? null : "errEmail";
    } else {
      var n = id.slice(-1);
      var r = parsePhone(value, $("cc" + n).value);
      if (r.country) setCountry(n, r.country);
      key = r.empty ? (n === "1" ? "errPhoneEmpty" : null) : r.error || null;
    }
    setError(id, key);
    return !key;
  }

  FIELDS.forEach(function (id) {
    // al blur si controlla solo un campo già compilato: quelli vuoti si segnalano all'invio
    $(id).addEventListener("blur", function () { if (this.value.trim()) check(id); });
    $(id).addEventListener("input", function () { setError(id, null); });
  });

  /* =========================================================
     Invio: Google Sheet oppure modalità di prova
     ========================================================= */

  function remoteApi(url) {
    // lo script Google si spegne dopo qualche minuto: una richiesta "sveglia" in anticipo
    // (al massimo una ogni 3 minuti) evita all'ospite 5–10 secondi di attesa all'invio
    var lastWarm = 0;
    return {
      warm: function () {
        if (Date.now() - lastWarm < 180000) return;
        lastWarm = Date.now();
        fetch(url).catch(function () {});
      },
      save: function (payload) {
        // niente header Content-Type: così il browser non fa la richiesta "preflight",
        // che Google Apps Script non supporta
        return fetch(url, { method: "POST", body: JSON.stringify(payload) }).then(function (r) { return r.json(); });
      }
    };
  }

  function demoApi() {
    return {
      save: function () {
        return new Promise(function (res) { setTimeout(function () { res({ ok: true }); }, 350); });
      }
    };
  }

  var isDemo = !CFG.endpoint;
  var api = isDemo ? demoApi() : remoteApi(CFG.endpoint);
  if (api.warm) {
    api.warm();
    ["focusin", "click"].forEach(function (ev) { $("contact-form").addEventListener(ev, api.warm); });
  }

  // Mostra "Un attimo…" se la risposta tarda più di 1,5 secondi; restituisce la funzione per nasconderlo
  function slowNote(el) {
    var timer = setTimeout(function () { el.hidden = false; }, 1500);
    return function () { clearTimeout(timer); el.hidden = true; };
  }

  function setBusy(btn, busy, key) {
    btn.disabled = busy;
    btn.dataset.i18n = key;
    btn.textContent = t(key);
  }

  function showSendError(key) {
    var el = $("send-error");
    el.dataset.i18n = key;
    el.textContent = t(key);
    el.hidden = false;
  }

  /* ---------- Memoria su questo dispositivo ----------
     Dopo un invio riuscito i dati restano anche nel browser (localStorage), così
     tornando dallo stesso dispositivo l'ospite vede cosa ha già mandato e può correggerlo.
     Su un altro dispositivo, o se il browser cancella i dati, il modulo riparte vuoto. */

  var STORE_KEY = "stdContact";

  function loadSaved() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      return s && s.name && s.email && Array.isArray(s.phones) ? s : null;
    } catch (e) { return null; }
  }

  function storeSaved(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  var saved = loadSaved(); // { name, email, phones: [{ cc, number, value }], savedAt }
  var view = "form";       // "form" | "thanks" (appena inviato) | "saved" (visita successiva)

  function show(next) {
    view = next;
    $("std-form-box").hidden = view !== "form";
    $("std-thanks").hidden = view === "form";
    $("cancel-btn").hidden = !saved;
    render();
  }

  // riempie il modulo con i dati salvati, per correggerli
  function fillForm() {
    $("contact-form").reset();
    resetSelects();
    FIELDS.forEach(function (id) { setError(id, null); });
    $("send-error").hidden = true;
    if (!saved) return;
    $("name").value = saved.name;
    $("email").value = saved.email;
    saved.phones.forEach(function (p, i) {
      var n = PHONES[i];
      if (!n) return;
      if (BY_ID[p.cc]) setCountry(n, p.cc);
      $("phone" + n).value = p.number;
    });
  }

  $("edit-btn").addEventListener("click", function () {
    fillForm();
    show("form");
    $("std-title").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    $("name").focus({ preventScroll: true });
  });

  $("cancel-btn").addEventListener("click", function () {
    show("saved");
    $("thanks-title").focus();
  });

  $("contact-form").addEventListener("submit", function (e) {
    e.preventDefault();
    $("send-error").hidden = true;

    var firstBad = null;
    FIELDS.forEach(function (id) { if (!check(id) && !firstBad) firstBad = id; });
    if (firstBad) { $(firstBad).focus(); return; }

    var phones = [], entered = [];
    PHONES.forEach(function (n) {
      var r = parsePhone($("phone" + n).value, $("cc" + n).value);
      if (!r.value || phones.indexOf(r.value) > -1) return;
      phones.push(r.value);
      entered.push({ cc: $("cc" + n).value, number: $("phone" + n).value.trim(), value: r.value });
    });
    var name = $("name").value.trim();
    var email = $("email").value.trim();
    var payload = { action: "contact", name: name, email: email, phones: phones, lang: current, website: $("website").value };
    // se da questo dispositivo era già stata mandata un'altra email, il foglio aggiorna quella riga
    if (saved && saved.email.toLowerCase() !== email.toLowerCase()) payload.previousEmail = saved.email;

    var btn = $("send-btn");
    setBusy(btn, true, "sending");
    var hideWait = slowNote($("send-wait"));

    api.save(payload)
      .then(function (res) {
        if (res && res.ok) {
          saved = { name: name, email: email, phones: entered, savedAt: new Date().toISOString() };
          storeSaved(saved);
          show("thanks");
          $("thanks-title").focus();
          return;
        }
        showSendError(res && res.error === "busy" ? "errBusy" : "errSend");
      })
      .catch(function () { showSendError("errNetwork"); })
      .then(function () { hideWait(); setBusy(btn, false, "send"); });
  });

  /* ---------- Testi che dipendono dai dati salvati ---------- */

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(current, { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return String(iso).slice(0, 10); }
  }

  // "+32470123456" → "+32 470123456"
  function prettyPhone(v) {
    var c = COUNTRIES.filter(function (x) { return v.indexOf("+" + x.dial) === 0; })[0];
    return c ? "+" + c.dial + " " + v.slice(c.dial.length + 1) : v;
  }

  function render() {
    if (view === "form" || !saved) return;
    // textContent: nomi, email e numeri non vengono mai interpretati come HTML
    if (view === "thanks") {
      $("thanks-title").textContent = fill(t("thanksTitle"), { name: saved.name });
      $("thanks-body").textContent = fill(t("thanksBody"), { email: saved.email });
    } else {
      $("thanks-title").textContent = t("savedTitle");
      $("thanks-body").textContent = fill(t("savedBody"), { date: formatDate(saved.savedAt) });
    }
    $("sum-names").textContent = saved.name;
    $("sum-email").textContent = saved.email;
    var box = $("sum-phones");
    box.textContent = "";
    saved.phones.forEach(function (p) {
      var line = document.createElement("span");
      line.textContent = prettyPhone(p.value);
      box.appendChild(line);
    });
  }

  /* =========================================================
     Avvio
     ========================================================= */

  $("demo-note").hidden = !isDemo;
  fillSelects();
  setLang(initialLang());
  resetSelects();
  if (saved) show("saved"); // già compilato da questo dispositivo: mostra cosa è stato salvato
})();
