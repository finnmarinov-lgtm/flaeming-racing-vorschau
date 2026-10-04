/* Flaeming Racing · Crew-Liste
   Mit ?demo in der Adresse läuft alles nur im Browser (Code „demo-crew“), gleicher Speicher wie die Startseite. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const SB = { url: 'https://yzzipjtounvktdhhvrnt.supabase.co', key: 'sb_publishable_OCNFFT4wa4CMaHyhcLAY4A_u2flZF1s' };
  const DEMO = new URLSearchParams(location.search).has('demo');

  async function rpc(fn, body) {
    let res;
    try {
      res = await fetch(SB.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch { return { fehler: 'netz' }; }
    if (res.status === 404) return { fehler: 'kein_sql' };
    if (!res.ok) return { fehler: 'server' };
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  const demo = (() => {
    const KEY = 'fr_demo', CODE = 'demo-crew';
    const lesen = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && Array.isArray(s.termine) ? s : { termine: [], anmeldungen: [] }; } catch { return { termine: [], anmeldungen: [] }; } };
    const schreiben = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* egal */ } };
    const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    const pruefen = c => (c === CODE ? null : { fehler: 'falsch' });
    return {
      laden: async c => {
        const f = pruefen(c); if (f) return f;
        const s = lesen();
        return {
          heute: heute(),
          termine: s.termine.slice().sort((a, b) => a.datum.localeCompare(b.datum)).map(t => ({ ...t, anmeldungen: s.anmeldungen.filter(a => a.termin === t.id) })),
          ohne_termin: s.anmeldungen.filter(a => !a.termin)
        };
      },
      termin: async (c, id, datum, km, hinweis, status) => {
        const f = pruefen(c); if (f) return f;
        const s = lesen();
        if (!datum) return { fehler: 'datum' };
        if (!id) {
          if (datum < heute()) return { fehler: 'datum' };
          const t = { id: 't' + Date.now(), datum, km, hinweis, status };
          s.termine.push(t);
          s.anmeldungen.forEach(a => { if (!a.termin) a.termin = t.id; });
          schreiben(s); return { ok: true, id: t.id };
        }
        const t = s.termine.find(x => x.id === id);
        if (!t) return { fehler: 'termin' };
        Object.assign(t, { datum, km, hinweis, status });
        schreiben(s); return { ok: true, id };
      },
      terminLoeschen: async (c, id) => {
        const f = pruefen(c); if (f) return f;
        const s = lesen();
        s.termine = s.termine.filter(t => t.id !== id);
        s.anmeldungen = s.anmeldungen.filter(a => a.termin !== id);
        schreiben(s); return { ok: true };
      },
      anmeldungLoeschen: async (c, id) => {
        const f = pruefen(c); if (f) return f;
        const s = lesen();
        s.anmeldungen = s.anmeldungen.filter(a => a.id !== id);
        schreiben(s); return { ok: true };
      },
      codeAendern: async () => ({ fehler: 'demo' })
    };
  })();

  const api = DEMO ? demo : {
    laden: c => rpc('fr_crew_laden', { p_code: c }),
    termin: (c, id, datum, km, hinweis, status) => rpc('fr_crew_termin', { p_code: c, p_id: id || null, p_datum: datum, p_km: km, p_hinweis: hinweis, p_status: status }),
    terminLoeschen: (c, id) => rpc('fr_crew_termin_loeschen', { p_code: c, p_id: id }),
    anmeldungLoeschen: (c, id) => rpc('fr_crew_anmeldung_loeschen', { p_code: c, p_id: id }),
    codeAendern: (c, neu) => rpc('fr_crew_code_aendern', { p_code: c, p_neu: neu })
  };

  const MELDUNG = {
    falsch: 'Der Code stimmt nicht.',
    nicht_eingerichtet: 'Die Liste ist noch nicht eingerichtet: Der Crew-Code fehlt noch.',
    kein_sql: 'Die Datenbank ist noch nicht eingerichtet.',
    netz: 'Keine Verbindung. Prüf dein Internet und versuch es nochmal.',
    server: 'Der Server hat einen Fehler gemeldet. Versuch es gleich nochmal.',
    datum: 'Bitte ein Datum wählen, das nicht in der Vergangenheit liegt.',
    km: 'Kilometer bitte zwischen 1 und 1000.',
    hinweis: 'Der Hinweis darf höchstens 140 Zeichen haben.',
    termin: 'Diesen Termin gibt es nicht mehr. Die Liste wird neu geladen.',
    code_kurz: 'Der neue Code braucht 6 bis 72 Zeichen.',
    demo: 'Im Demo-Modus lässt sich der Code nicht ändern.'
  };
  const meldung = r => (r.fehler === 'gesperrt' ? `Zu viele falsche Versuche. Warte ${Math.ceil((r.sekunden || 600) / 60)} Minuten.` : MELDUNG[r.fehler] || 'Das hat nicht geklappt.');

  const KEY = 'fr_crew_code';
  let code = '';
  try { code = sessionStorage.getItem(KEY) || ''; } catch { /* egal */ }
  const tage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const datumText = iso => { const [j, m, t] = iso.split('-').map(Number); const d = new Date(j, m - 1, t); return `${tage[d.getDay()]}, ${String(t).padStart(2, '0')}.${String(m).padStart(2, '0')}.${j}`; };
  const zeit = iso => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const status = $('#status');
  const sagen = t => { status.textContent = t; if (t) setTimeout(() => { if (status.textContent === t) status.textContent = ''; }, 4000); };
  let daten = null;

  function zeigeListe(an) {
    $('#tuer').hidden = an;
    $('#liste').hidden = !an;
    $('#abmelden').hidden = !an;
  }

  async function laden() {
    const r = await api.laden(code);
    if (!r || r.fehler) {
      zeigeListe(false);
      $('#code-fehler').textContent = r ? meldung(r) : MELDUNG.server;
      return false;
    }
    daten = r;
    try { sessionStorage.setItem(KEY, code); } catch { /* egal */ }
    zeigeListe(true);
    zeichnen();
    return true;
  }

  function personZeile(a) {
    const li = document.createElement('li');
    const name = document.createElement('span'); name.className = 'name'; name.textContent = a.name;
    const insta = document.createElement('span'); insta.className = 'klein';
    if (a.instagram) {
      const l = document.createElement('a'); l.href = 'https://www.instagram.com/' + encodeURIComponent(a.instagram) + '/'; l.target = '_blank'; l.rel = 'noopener'; l.textContent = '@' + a.instagram;
      insta.append(l);
    } else insta.textContent = 'ohne Instagram';
    const moped = document.createElement('span'); moped.className = 'klein'; moped.textContent = (a.moped || 'Moped offen') + ' · ' + zeit(a.erstellt);
    const weg = document.createElement('button'); weg.type = 'button'; weg.className = 'btn btn-glas btn-mini btn-gefahr'; weg.textContent = 'Löschen';
    weg.setAttribute('aria-label', `${a.name} löschen`);
    weg.addEventListener('click', async () => {
      if (!confirm(`${a.name} von der Liste löschen?`)) return;
      const r = await api.anmeldungLoeschen(code, a.id);
      if (r && r.ok) { sagen(`${a.name} gelöscht.`); laden(); } else sagen(meldung(r || {}));
    });
    li.append(name, insta, moped, weg);
    return li;
  }

  function block(titel, statusText, klasse, hinweis, leute, termin) {
    const el = $('#tpl-termin').content.firstElementChild.cloneNode(true);
    el.classList.add(klasse);
    $('.termin-datum', el).textContent = titel;
    $('.termin-status', el).textContent = statusText;
    $('.termin-hinweis', el).textContent = hinweis || '';
    $('.termin-anzahl', el).textContent = leute.length === 1 ? '1 Anmeldung' : `${leute.length} Anmeldungen`;
    const ul = $('.leute', el);
    if (!leute.length) { const p = document.createElement('p'); p.className = 'leer'; p.textContent = 'Noch niemand eingetragen.'; ul.replaceWith(p); }
    else leute.forEach(a => ul.append(personZeile(a)));
    $('[data-aktion="kopieren"]', el).addEventListener('click', async () => {
      const text = leute.map(a => a.name + (a.instagram ? ' (@' + a.instagram + ')' : '') + (a.moped ? ', ' + a.moped : '')).join('\n');
      try { await navigator.clipboard.writeText(text || '(niemand)'); sagen('Namen kopiert.'); } catch { sagen('Kopieren ging nicht.'); }
    });
    const bearbeiten = $('[data-aktion="bearbeiten"]', el), loeschen = $('[data-aktion="loeschen"]', el);
    if (!termin) { bearbeiten.remove(); loeschen.remove(); return el; }
    bearbeiten.addEventListener('click', () => {
      $('#t-id').value = termin.id; $('#t-datum').value = termin.datum; $('#t-km').value = termin.km || '';
      $('#t-hinweis').value = termin.hinweis || ''; $('#t-status').value = termin.status;
      $('#termin-h').textContent = 'Termin ändern'; $('#termin-neu').hidden = false;
      $('#termin-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#t-datum').focus({ preventScroll: true });
    });
    loeschen.addEventListener('click', async () => {
      if (!confirm(`Termin am ${datumText(termin.datum)} mit allen ${leute.length} Anmeldungen löschen?`)) return;
      const r = await api.terminLoeschen(code, termin.id);
      if (r && r.ok) { sagen('Termin gelöscht.'); laden(); } else sagen(meldung(r || {}));
    });
    return el;
  }

  function zeichnen() {
    const ziel = $('#termine');
    ziel.textContent = '';
    for (const t of daten.termine) {
      const titel = datumText(t.datum) + (t.km ? ` · ${t.km} km` : '');
      const vorbei = t.datum < daten.heute;
      ziel.append(block(titel, vorbei ? 'vorbei' : t.status, 'status-' + t.status, t.hinweis, t.anmeldungen, t));
    }
    if (daten.ohne_termin.length || !daten.termine.length) {
      ziel.append(block('Ohne Termin', 'für die nächste Ausfahrt', 'status-offen', 'Sobald ihr einen Termin eintragt, wandern diese Anmeldungen dorthin.', daten.ohne_termin, null));
    }
  }

  function terminFormLeeren() {
    $('#termin-form').reset(); $('#t-id').value = '';
    $('#termin-h').textContent = 'Termin eintragen'; $('#termin-neu').hidden = true;
  }

  $('#code-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('#code-fehler').textContent = '';
    code = $('#code').value.trim();
    if (!code) { $('#code-fehler').textContent = 'Bitte den Crew-Code eingeben.'; return; }
    if (await laden()) $('#code').value = '';
  });

  $('#termin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fehlerEl = $('#termin-fehler');
    fehlerEl.textContent = '';
    const kmWert = $('#t-km').value.trim();
    const r = await api.termin(code, $('#t-id').value || null, $('#t-datum').value || null, kmWert ? Number(kmWert) : null,
      $('#t-hinweis').value.trim() || null, $('#t-status').value);
    if (r && r.ok) { sagen('Termin gespeichert. Die Startseite zeigt ihn sofort.'); terminFormLeeren(); laden(); }
    else { fehlerEl.textContent = meldung(r || {}); if (r && r.fehler === 'termin') laden(); }
  });
  $('#termin-neu').addEventListener('click', terminFormLeeren);

  $('#neu-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fehlerEl = $('#neu-fehler');
    const a = $('#neu-code').value, b = $('#neu-code2').value;
    fehlerEl.textContent = '';
    if (a !== b) { fehlerEl.textContent = 'Die beiden Codes sind nicht gleich.'; return; }
    const r = await api.codeAendern(code, a);
    if (r && r.ok) { code = a; try { sessionStorage.setItem(KEY, code); } catch { /* egal */ } $('#neu-form').reset(); sagen('Neuer Crew-Code gilt ab sofort.'); }
    else fehlerEl.textContent = meldung(r || {});
  });

  $('#abmelden').addEventListener('click', () => {
    code = ''; daten = null;
    try { sessionStorage.removeItem(KEY); } catch { /* egal */ }
    $('#termine').textContent = '';
    zeigeListe(false);
    $('#code').focus();
  });

  if (code) laden(); else zeigeListe(false);
})();
