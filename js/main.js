/* =========================================================
   Logica del sito: cambio lingua + RSVP personalizzato

   Flusso RSVP (ricalca il modulo Tally originale):
   1. l'ospite inserisce il codice dell'invito (o arriva con ?code=…)
   2. Parte 1 – domenica (cerimonia simbolica + ricevimento): una risposta per persona;
      sotto ogni persona compare un messaggio ("Evviva!" oppure "Perché?? 🤌🏼")
   3. Parte 2 – lunedì (matrimonio civile), solo se l'invito lo prevede;
      sotto ogni persona, un messaggio secondo la combinazione delle sue risposte
   4. pagina di ringraziamento con i simboli di Lerici
   ========================================================= */

(function () {
  "use strict";

  var T = window.TRANSLATIONS;
  var CFG = window.RSVP_CONFIG || {};
  var LANGS = ["it", "fr", "en"];
  var DEFAULT_LANG = "it";
  var current = DEFAULT_LANG;

  var $ = function (id) { return document.getElementById(id); };

  /* =========================================================
     Lingua
     ========================================================= */

  // t("q1", 1) usa "q1_one" se esiste (versione per una sola persona)
  function t(key, count) {
    var dict = T[current] || {};
    var base = T[DEFAULT_LANG];
    if (count === 1 && (dict[key + "_one"] || (!dict[key] && base[key + "_one"]))) key = key + "_one";
    return dict[key] || base[key] || key;
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
    document.querySelectorAll(".langs button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    try { localStorage.setItem("lang", lang); } catch (e) {}

    render();
  }

  // La scelta manuale vale solo per questa visita: alla visita successiva
  // il codice dell'invito torna a decidere la lingua.
  var langClicked = false;

  function langChosenByUser() {
    return langClicked || !!new URLSearchParams(location.search).get("lang");
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

  try { localStorage.removeItem("langChosen"); } catch (e) {} // residuo delle versioni precedenti

  document.querySelectorAll(".langs button").forEach(function (b) {
    b.addEventListener("click", function () {
      langClicked = true;
      setLang(b.dataset.lang);
    });
  });

  /* =========================================================
     Collegamento ai dati: Google Sheet oppure modalità di prova
     ========================================================= */

  function normalizeCode(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  function remoteApi(url) {
    return {
      lookup: function (code) {
        return fetch(url + "?action=lookup&code=" + encodeURIComponent(code)).then(function (r) { return r.json(); });
      },
      save: function (payload) {
        // niente header Content-Type: così il browser non fa la richiesta "preflight",
        // che Google Apps Script non supporta
        return fetch(url, { method: "POST", body: JSON.stringify(payload) }).then(function (r) { return r.json(); });
      }
    };
  }

  // Gli stessi 4 invitati di prova creati nel Google Sheet da "Prepara il foglio"
  var DEMO_GUESTS = [
    { code: "LIMONE-4K7", names: ["Giulia", "Marco"], lang: "it", civil: true },
    { code: "ONDA-9RT", names: ["Claire"], lang: "fr", civil: false },
    { code: "VELA-3MX", names: ["Luca", "Sara", "Tommaso"], lang: "it", civil: true },
    { code: "SOLE-8PW", names: ["Emma", "James"], lang: "en", civil: true }
  ];

  function demoApi() {
    var memory = {};
    function load() {
      try { return JSON.parse(localStorage.getItem("demoAnswers") || "{}"); } catch (e) { return memory; }
    }
    function store(all) {
      memory = all;
      try { localStorage.setItem("demoAnswers", JSON.stringify(all)); } catch (e) {}
    }
    function find(code) {
      var n = normalizeCode(code);
      return DEMO_GUESTS.filter(function (g) { return normalizeCode(g.code) === n; })[0];
    }
    function later(value) { return new Promise(function (res) { setTimeout(function () { res(value); }, 350); }); }
    return {
      lookup: function (code) {
        var g = find(code);
        if (!g) return later({ ok: false, error: "not_found" });
        return later({ ok: true, guest: g, previous: load()[g.code] || null });
      },
      save: function (payload) {
        var g = find(payload.code);
        if (!g) return later({ ok: false, error: "not_found" });
        var all = load();
        var now = new Date().toISOString();
        all[g.code] = { updatedAt: now, people: payload.people };
        store(all);
        return later({ ok: true, updatedAt: now });
      }
    };
  }

  var isDemo = !CFG.endpoint;
  var api = isDemo ? demoApi() : remoteApi(CFG.endpoint);

  /* =========================================================
     RSVP
     ========================================================= */

  var state = {
    guest: null,      // { code, names[], lang, civil }
    previous: null,   // risposte già date
    ans: [],          // per persona: { sun: true/false/null, mon: true/false/null }
    step: "code"      // "code" | "part1" | "part2" | "thanks"
  };

  var panel = $("rsvp-panel");
  var stepCode = $("step-code");
  var codeForm = $("code-form");
  var codeInput = $("code");
  var codeErr = $("code-error");
  var codeBtn = $("code-btn");
  var form = $("rsvp-form");
  var thanks = $("thanks");

  function showError(el, key) {
    el.dataset.i18n = key;
    el.textContent = t(key);
    el.hidden = false;
  }

  function setBusy(btn, busy, key) {
    btn.disabled = busy;
    btn.dataset.i18n = key;
    btn.textContent = t(key);
  }

  function count() { return state.guest ? state.guest.names.length : 0; }

  function listNames(names) {
    try {
      return new Intl.ListFormat(current, { style: "long", type: "conjunction" }).format(names);
    } catch (e) {
      return names.join(", ");
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(current, { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return iso.slice(0, 10); }
  }

  /* ---------- Passo 1: codice ---------- */

  codeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    checkCode(codeInput.value);
  });
  codeInput.addEventListener("input", function () { codeErr.hidden = true; });

  function checkCode(raw) {
    var code = String(raw || "").trim();
    if (!code) { showError(codeErr, "errCodeEmpty"); codeInput.focus(); return; }
    codeErr.hidden = true;
    setBusy(codeBtn, true, "codeChecking");

    api.lookup(code)
      .then(function (res) {
        if (res && res.ok) { openGuest(res); return; }
        var err = res && res.error;
        showError(codeErr, err === "busy" ? "errBusy" : err === "closed" ? "errClosed" : "errCodeWrong");
        codeInput.focus();
      })
      .catch(function () { showError(codeErr, "errNetwork"); })
      .then(function () { setBusy(codeBtn, false, "codeBtn"); });
  }

  function openGuest(res) {
    state.guest = res.guest;
    state.previous = res.previous || null;
    state.ans = res.guest.names.map(function () { return { sun: null, mon: null }; });

    if (state.previous && state.previous.people) {
      state.previous.people.forEach(function (p) {
        var i = state.guest.names.indexOf(p.name);
        if (i > -1) state.ans[i] = { sun: p.sunday, mon: p.monday };
      });
    }
    $("website").value = "";

    buildRows("rows-sun", "sun");
    buildRows("rows-mon", "mon");
    hideErrors();

    // Lingua dell'invito, se l'ospite non ne ha scelta una
    if (!langChosenByUser() && state.guest.lang && state.guest.lang !== current) setLang(state.guest.lang);

    go("part1", $("hello"));
  }

  /* ---------- Righe per persona ---------- */

  function buildRows(containerId, part) {
    var box = $(containerId);
    box.textContent = "";
    state.guest.names.forEach(function (name, i) {
      var row = document.createElement("div");
      row.className = "person";

      var label = document.createElement("span");
      label.className = "person-name";
      label.id = part + "-name-" + i;
      label.textContent = name; // textContent: i nomi dal foglio non vengono mai interpretati come HTML

      var group = document.createElement("div");
      group.className = "choice";
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-labelledby", label.id);

      ["yes", "no"].forEach(function (value) {
        var opt = document.createElement("label");
        var input = document.createElement("input");
        input.type = "radio";
        input.name = part + "-" + i;
        input.value = value;
        input.checked = state.ans[i][part] === (value === "yes");
        input.addEventListener("change", function () {
          state.ans[i][part] = value === "yes";
          $(part === "sun" ? "err-sun" : "err-mon").hidden = true;
          render();
        });
        var text = document.createElement("span");
        text.dataset.i18n = value === "yes" ? "yesOpt" : "noOpt";
        text.textContent = t(text.dataset.i18n);
        opt.appendChild(input);
        opt.appendChild(text);
        group.appendChild(opt);
      });

      // messaggio per questa persona, riempito da render()
      var feedback = document.createElement("p");
      feedback.className = "feedback";
      feedback.id = part + "-fb-" + i;
      feedback.setAttribute("role", "status");
      feedback.hidden = true;

      row.appendChild(label);
      row.appendChild(group);
      row.appendChild(feedback);
      box.appendChild(row);
    });
  }

  function values(part) { return state.ans.map(function (a) { return a[part]; }); }
  function allAnswered(part) { return values(part).every(function (v) { return v !== null; }); }
  function any(part, v) { return values(part).some(function (x) { return x === v; }); }

  function hideErrors() {
    ["err-sun", "err-mon", "send-error"].forEach(function (id) { $(id).hidden = true; });
  }

  /* ---------- Navigazione tra i passi ---------- */

  function go(step, focusEl) {
    state.step = step;
    stepCode.hidden = step !== "code";
    form.hidden = step !== "part1" && step !== "part2";
    $("part1").hidden = step !== "part1";
    $("part2").hidden = step !== "part2";
    thanks.hidden = step !== "thanks";
    render();
    panel.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (focusEl) focusEl.focus({ preventScroll: true });
  }

  $("next-btn").addEventListener("click", function () {
    if (!allAnswered("sun")) { $("err-sun").hidden = false; return; }
    go("part2", $("q2"));
  });

  $("back-btn").addEventListener("click", function () { go("part1"); });

  $("not-me").addEventListener("click", function () {
    state.guest = null;
    codeInput.value = "";
    if (history.replaceState && location.search.indexOf("code=") > -1) {
      var p = new URLSearchParams(location.search);
      p.delete("code");
      history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash);
    }
    go("code", codeInput);
  });

  $("edit-btn").addEventListener("click", function () { go("part1", $("hello")); });

  /* ---------- Invio ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideErrors();
    if (!allAnswered("sun")) { go("part1"); $("err-sun").hidden = false; return; }
    if (state.guest.civil && !allAnswered("mon")) { $("err-mon").hidden = false; return; }

    var civil = state.guest.civil;
    var payload = {
      code: state.guest.code,
      lang: current,
      website: $("website").value,
      people: state.guest.names.map(function (name, i) {
        return { name: name, sunday: state.ans[i].sun, monday: civil ? state.ans[i].mon : null };
      })
    };

    var buttons = [$("send-btn-1"), $("send-btn-2")];
    buttons.forEach(function (b) { setBusy(b, true, "sending"); });

    api.save(payload)
      .then(function (res) {
        if (res && res.ok) {
          state.previous = { updatedAt: res.updatedAt, people: payload.people };
          go("thanks", $("thanks-title"));
          return;
        }
        showError($("send-error"), res && res.error === "closed" ? "errClosed" : "errSend");
      })
      .catch(function () { showError($("send-error"), "errNetwork"); })
      .then(function () { buttons.forEach(function (b) { setBusy(b, false, "send"); }); });
  });

  /* ---------- Testi che dipendono dall'invito e dalle risposte ---------- */

  function showFeedback(el, key) {
    if (!el) return;
    el.hidden = !key;
    el.textContent = key ? t(key) : "";
  }

  function render() {
    if (!state.guest) return;
    var n = count();
    var civil = state.guest.civil;

    $("hello").textContent = fill(t("hello"), { names: listNames(state.guest.names) });
    $("hello-sub").textContent = t("helloSub", n);

    var already = $("already");
    already.hidden = !(state.previous && state.previous.updatedAt);
    if (!already.hidden) already.textContent = fill(t("already", n), { date: formatDate(state.previous.updatedAt) });

    $("q1").textContent = t("q1", n);
    $("q2").textContent = t("q2", n);

    // Messaggio sotto ogni persona, secondo la sua risposta
    state.ans.forEach(function (a, i) {
      // Parte 1: sì → "Evviva!", no → "Perché?? 🤌🏼"
      showFeedback($("sun-fb-" + i), a.sun === null ? null : a.sun ? "sunYes" : "sunNo");
      // Parte 2: combinazione di domenica e lunedì (come nel modulo Tally)
      var monKey = null;
      if (civil && a.mon !== null && a.sun !== null) {
        monKey = a.sun && a.mon ? "msgBoth" : a.sun ? "msgSundayOnly" : a.mon ? "msgMondayOnly" : "msgNone";
      }
      showFeedback($("mon-fb-" + i), monKey);
    });

    // Parte 1: "Avanti" se c'è la Parte 2, altrimenti "Invia"
    $("next-btn").hidden = !civil;
    $("send-btn-1").hidden = civil;

    // Grazie
    var anyoneComing = any("sun", true) || any("mon", true);
    $("thanks-title").textContent = t("thanksTitle", n);
    $("thanks-body").textContent = t(anyoneComing ? "thanksBody" : "thanksBodyNone", n);
  }

  /* =========================================================
     Avvio
     ========================================================= */

  if (isDemo) {
    var box = $("demo-codes");
    DEMO_GUESTS.forEach(function (g) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = g.code;
      b.addEventListener("click", function () { codeInput.value = g.code; checkCode(g.code); });
      box.appendChild(b);
    });
    $("demo-note").hidden = false;
  }

  setLang(initialLang());

  // Link personale: …/?code=LIMONE-4K7
  var urlCode = new URLSearchParams(location.search).get("code");
  if (urlCode) {
    codeInput.value = urlCode;
    checkCode(urlCode);
  }
})();
