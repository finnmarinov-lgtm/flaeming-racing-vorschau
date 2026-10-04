/* Flaeming Racing · Seite
   Held: drei Bildebenen (offene Garage, Wände, Tor). Beim Scrollen fährt das Tor hoch, das Licht wird wärmer.
   Mit ?demo in der Adresse speichert das Formular nur im Browser (zum Ausprobieren ohne Datenbank). */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const root = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)');

  /* ================= Daten: Supabase oder Demo ================= */
  const SB = {
    url: 'https://yzzipjtounvktdhhvrnt.supabase.co',
    key: 'sb_publishable_OCNFFT4wa4CMaHyhcLAY4A_u2flZF1s' // öffentlicher Schlüssel, darf im Code stehen
  };
  const params = new URLSearchParams(location.search);
  // Vorschau-Schalter im Seitenkopf: <meta name="fr-modus" content="vorschau"> = Testdaten und Vorschau-Hinweise
  const VORSCHAU = (document.querySelector('meta[name="fr-modus"]') || {}).content === 'vorschau';
  if (VORSCHAU) root.classList.add('vorschau');
  const DEMO = params.has('demo') || VORSCHAU;

  async function rpc(fn, body) {
    let res;
    try {
      res = await fetch(SB.url + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: SB.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
    } catch { throw new Error('netz'); }
    if (!res.ok) throw new Error('fehler_' + res.status);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // Demo: gleicher Speicher wie die Crew-Seite (localStorage „fr_demo“), Crew-Code dort „demo-crew“
  const demo = (() => {
    const KEY = 'fr_demo';
    const lesen = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
    const schreiben = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* egal */ } };
    const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    let s = lesen();
    if (!s || !Array.isArray(s.termine)) {
      s = { termine: [], anmeldungen: [] };
      if (params.get('demo') === 'termin') {
        const d = new Date(); d.setDate(d.getDate() + 13);
        s.termine.push({ id: 'demo-1', datum: d.toLocaleDateString('sv-SE'), km: 50, hinweis: null, status: 'geplant' });
      }
      schreiben(s);
    }
    const naechster = () => s.termine.filter(t => t.datum >= heute() && t.status !== 'abgesagt').sort((a, b) => a.datum.localeCompare(b.datum))[0] || null;
    return {
      naechste: async () => {
        s = lesen() || s;
        const t = naechster();
        return { termin: t, anzahl: s.anmeldungen.filter(a => a.termin === (t ? t.id : null)).length };
      },
      anmelden: async (termin, name, insta, moped) => {
        await new Promise(r => setTimeout(r, 500));
        s = lesen() || s;
        const tid = termin || (naechster() ? naechster().id : null);
        if (insta && s.anmeldungen.some(a => a.termin === tid && a.instagram === insta)) return { ok: true, schon: true };
        s.anmeldungen.push({ id: 'a' + Date.now(), termin: tid, name, instagram: insta || null, moped: moped || null, erstellt: new Date().toISOString() });
        schreiben(s);
        return { ok: true };
      }
    };
  })();

  const api = DEMO ? demo : {
    naechste: () => rpc('fr_naechste'),
    anmelden: (termin, name, insta, moped) => rpc('fr_anmelden', { p_termin: termin, p_name: name, p_instagram: insta, p_moped: moped })
  };

  /* ================= Text zerlegen (einmal beim Laden) ================= */
  function rng(seed) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }
  $$('.split').forEach((el, n) => {
    const text = el.textContent.trim();
    const fx = el.dataset.fx;
    const rand = rng(17 + n * 101);
    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = text;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    const woerter = text.split(/\s+/);
    const zeichenGesamt = text.replace(/\s+/g, '').length;
    let ci = 0;
    woerter.forEach((wort, wi) => {
      const w = document.createElement('span');
      w.className = 'w';
      if (fx === 'spalt') {
        [...wort].forEach(ch => {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          c.style.setProperty('--th', ((ci / zeichenGesamt) * 0.55 + rand() * 0.05).toFixed(3));
          w.appendChild(c);
          ci++;
        });
      } else {
        w.textContent = wort;
        w.style.setProperty('--th', ((wi / woerter.length) * 0.5).toFixed(3));
      }
      vis.appendChild(w);
      if (wi < woerter.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    el.textContent = '';
    el.append(sr, vis);
  });

  /* ================= Held: das Tor ================= */
  const hero = $('.hero');
  const wrap = $('.wrap', hero);
  const stage = $('#stage');
  const ring = $('.ring', hero);
  const cue = $('.cue', hero);
  const VW = 2752, VH = 1536, FX = 1378, FY = 760;
  // Toröffnung im Bild (870..1885 x 292..1175), etwas nach innen gerückt: Am Ende der Ausfahrt liegt der Ausschnitt ganz darin
  const OEFFNUNG = { x0: 884, x1: 1871, y0: 332, y1: 1135 };
  const szene = {
    tor: $('.torclip img', stage), glow: $('.torglow', stage), beam: $('.beam', stage),
    dunst: $('.dunst-ebene', stage), waende: $('.waende', stage)
  };
  const masse = { bw: innerWidth, bh: 0, top: 0, h: 0, range: 1, ende: 1 };
  function masseLesen() {
    masse.bw = innerWidth;
    masse.bh = wrap.clientHeight;
    masse.top = hero.getBoundingClientRect().top + scrollY;
    masse.h = hero.offsetHeight;
    masse.range = Math.max(1, masse.h - innerHeight);
    // Die Torfahrt belegt 420vh der Scrollstrecke, danach kommt die Ausfahrt (150vh). Held ist 670vh hoch.
    masse.ende = root.classList.contains('scrub') ? Math.min(1, (4.2 * masse.h / 6.7) / masse.range) : 1;
    hero.dataset.ende = masse.ende.toFixed(4);   // für die Prüfwerkzeuge
    // Ausfahrt: so weit heranfahren, dass Torrahmen, Sturz und Boden ganz aus dem Bild sind (am Laptop mehr als am Handy)
    const s0 = Math.max(masse.bw / VW, masse.bh / VH), o = OEFFNUNG;
    const sEnde = Math.max(s0 * 1.85, masse.bw / (o.x1 - o.x0), masse.bh / (o.y1 - o.y0));
    masse.zEnde = sEnde / s0;
    masse.fxEnde = clamp(FX, o.x0 + masse.bw / 2 / sEnde, o.x1 - masse.bw / 2 / sEnde);
    masse.fyEnde = clamp(860, o.y0 + masse.bh / 2 / sEnde, o.y1 - masse.bh / 2 / sEnde);
  }
  masseLesen();
  const bands = $$('.band', hero).map((el, i, all) => ({
    el,
    a: parseFloat(el.dataset.a),
    b: parseFloat(el.dataset.b),
    ramp: el.dataset.ramp ? parseFloat(el.dataset.ramp) : null,
    erste: i === 0,
    letzte: i === all.length - 1,
    ecke: i === 1 ? $('#ecke-l') : i === 2 ? $('#ecke-r') : null,
    op: -1, k: -1, e: -1, inert: null
  }));

  let scrubAn = false;
  let target = 0, shown = 0, rafId = null, lastTick = 0, onScreen = true;
  let lastT = '', lastD = -1, lastW = -1, lastCue = -1, lastNacht = -1;
  const schleier = $('#nachtschleier');
  let ladeK = 0, ladeStart = 0, ladeFertig = false;

  function progress() {
    return clamp((scrollY - masse.top) / masse.range, 0, 1);   // ohne Layout zu lesen: Maße kommen aus masseLesen()
  }

  function bandWerte(bd, p) {
    const { a, b } = bd;
    const f = Math.min(0.02, (b - a) / 3);
    const ein = bd.erste ? 1 : smooth(a, a + f, p);
    const aus = bd.letzte ? 1 : 1 - smooth(b - f, b, p);
    const op = ein * aus;
    const ramp = bd.ramp || Math.min(0.025, (b - a) * 0.35);
    let k = clamp((p - a) / ramp, 0, 1);
    if (bd.erste) k = Math.max(k, ladeK);   // Band 1 steht beim Öffnen schon da
    return { op, k };
  }

  function render(p) {
    const q = Math.min(1, p / masse.ende);                                          // Torfahrt 0..1
    const e = masse.ende < 1 ? clamp((p - masse.ende) / (1 - masse.ende), 0, 1) : 0;   // Ausfahrt 0..1
    const d = easeIO(clamp((q - 0.04) / 0.70, 0, 1));
    const w = 1 - smooth(0.05, 0.9, d);
    const zq = 1 + 0.06 * (1 - Math.pow(1 - q, 2));
    const ze = easeIO(clamp((e - 0.06) / 0.8, 0, 1));                              // Rausfahren: durchs Tor auf die Straße
    const z = zq * Math.pow(masse.zEnde / zq, ze);   // gleichmäßig wirkende Fahrt (Zoom im Verhältnis, nicht linear)
    const fx = FX + (masse.fxEnde - FX) * ze;
    const fy = FY + (masse.fyEnde - FY) * ze;
    const s = Math.max(masse.bw / VW, masse.bh / VH) * z;
    let tx = masse.bw / 2 - fx * s;
    let ty = masse.bh / 2 - fy * s;
    tx = clamp(tx, masse.bw - VW * s, 0);
    ty = clamp(ty, masse.bh - VH * s, 0);
    const t = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${s.toFixed(5)})`;
    if (t !== lastT) { stage.style.transform = t; lastT = t; }
    // Alles direkt als transform/opacity: der Grafikchip verschiebt nur Ebenen, nichts muss neu gemalt werden
    if (Math.abs(d - lastD) > 0.0008) {
      lastD = d;
      const hoch = `translate3d(0,${(-d * 934).toFixed(1)}px,0)`;
      szene.tor.style.transform = hoch;
      szene.glow.style.transform = hoch;
      szene.glow.style.opacity = (0.3 + d * 0.45).toFixed(3);
      szene.beam.style.opacity = (d * 0.9).toFixed(3);
      szene.dunst.style.opacity = (0.22 + d * 0.6).toFixed(3);
      bands[0].el.style.translate = `0 ${(-d * 934 * s).toFixed(1)}px`;   // Band 1 fährt mit dem Tor hoch
    }
    if (Math.abs(w - lastW) > 0.002) { szene.waende.style.opacity = w.toFixed(3); lastW = w; }
    const nacht = 0.5 * smooth(0.3, 1, e);
    if (Math.abs(nacht - lastNacht) > 0.004) { schleier.style.opacity = nacht.toFixed(3); lastNacht = nacht; }
    const c = 1 - smooth(0, 0.05, q);
    if (Math.abs(c - lastCue) > 0.01) { cue.style.opacity = c.toFixed(2); lastCue = c; }
    for (const bd of bands) {
      let { op, k } = bandWerte(bd, q);
      if (bd.letzte) op *= 1 - smooth(0.04, 0.4, e);   // Schlusstext blendet beim Rausfahren aus
      if (bd.ecke) {   // Ecken-Abdunklung folgt ihrem Band
        const e = op * (0.35 + 0.65 * k);
        if (Math.abs(e - bd.e) > 0.004) { bd.ecke.style.opacity = e.toFixed(3); bd.e = e; }
      }
      if (Math.abs(op - bd.op) > 0.004) { bd.el.style.opacity = op.toFixed(3); bd.op = op; }
      if (Math.abs(k - bd.k) > 0.008 || (k === 1 && bd.k !== 1) || (k === 0 && bd.k !== 0)) { bd.el.style.setProperty('--k', k.toFixed(3)); bd.k = k; }
      const inert = op < 0.5;
      if (inert !== bd.inert) { bd.el.inert = inert; bd.inert = inert; }
    }
  }

  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    shown += (target - shown) * (1 - Math.pow(1 - 0.16, dt / 16.667));
    let weiter = Math.abs(target - shown) >= 0.0005;
    if (!weiter) shown = target;
    if (!ladeFertig && ladeStart) {
      ladeK = easeOut(clamp((now - ladeStart) / 1500, 0, 1));
      if (ladeK >= 1) ladeFertig = true; else weiter = true;
    }
    render(shown);
    if (weiter && scrubAn) rafId = requestAnimationFrame(tick);
    else { rafId = null; lastTick = 0; }
  }

  function wecken() {
    if (rafId === null && onScreen && scrubAn) rafId = requestAnimationFrame(tick);
  }
  function onScroll() {
    target = progress();
    wecken();
  }

  // Die drei Bildebenen laden erst, wenn die Torfahrt wirklich läuft (nicht bei reduzierter Bewegung).
  // Der Ring zählt sie mit; danach startet der Auftritt von Band 1. Fehlt ein Bild, bleibt die Seite beim Standbild.
  let bildFehler = false, geladenGestartet = false;
  function heldBilderLaden() {
    if (geladenGestartet) return;
    geladenGestartet = true;
    const bilder = $$('img[data-src]', stage);
    let fertig = 0, gestartet = false;
    function start() {
      if (gestartet) return;
      gestartet = true;
      ring.classList.add('fertig');
      ladeStart = performance.now();
      wecken();
    }
    const eins = () => {
      fertig++;
      ring.style.setProperty('--ld', Math.round(126 * (1 - fertig / bilder.length)));
      if (fertig === bilder.length) start();
    };
    const fehler = () => { bildFehler = true; ring.classList.add('fertig'); heldModus(); };
    bilder.forEach(img => {
      img.addEventListener('load', eins, { once: true });
      img.addEventListener('error', fehler, { once: true });
      img.src = img.dataset.src;
    });
    setTimeout(start, 6000);   // Sicherheit: ein hängendes Bild blockiert den Auftritt nie
  }

  function scrubEin() {
    if (scrubAn) return;
    heldBilderLaden();
    scrubAn = true;
    root.classList.add('scrub');
    addEventListener('scroll', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; b.e = -1; b.inert = null; });
    lastT = ''; lastD = -1; lastW = -1; lastCue = -1; lastNacht = -1;
    masseLesen();
    target = shown = progress();
    render(shown);
    wecken();
  }
  function scrubAus() {
    if (!scrubAn) return;
    scrubAn = false;
    root.classList.remove('scrub');
    removeEventListener('scroll', onScroll);
    masseLesen();
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    bands.forEach(b => { b.el.inert = false; });
  }
  function heldModus() {
    if (RM.matches || bildFehler) scrubAus(); else scrubEin();
  }

  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    wrap.classList.toggle('aus-sicht', !onScreen);
    if (onScreen) onScroll();
  }).observe(hero);
  addEventListener('resize', () => { masseLesen(); lastT = ''; navPruefen(); if (scrubAn) { target = shown = progress(); render(shown); } });

  /* ================= Einblenden, Pausen, Navigation ================= */
  const nav = $('#nav');
  let navFest = null;
  function navPruefen() {
    const fest = masse.top + masse.h - scrollY < 120;
    if (fest !== navFest) { nav.classList.toggle('fest', fest); navFest = fest; }
  }
  addEventListener('scroll', navPruefen, { passive: true });
  navPruefen();

  const zeigen = new IntersectionObserver(eintraege => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      if (e.target.matches('.zahlen')) zaehlen();
      zeigen.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  let offen = $$('.reveal, .spalt, .strecke');
  offen.forEach(el => zeigen.observe(el));
  // Absicherung für sehr schnelles Wischen: Was schon vorbeigescrollt ist, gilt als eingeblendet
  let vorbeiGeplant = false;
  addEventListener('scroll', () => {
    if (vorbeiGeplant || !offen.length || scrollY < masse.top + masse.h - innerHeight * 1.2) return;   // im Held gibt es nichts einzublenden
    vorbeiGeplant = true;
    requestAnimationFrame(() => {
      vorbeiGeplant = false;
      offen = offen.filter(el => {
        if (el.classList.contains('in')) return false;
        if (el.getBoundingClientRect().top < innerHeight * 0.9) {
          el.classList.add('in');
          if (el.matches('.zahlen')) zaehlen();
          zeigen.unobserve(el);
          return false;
        }
        return true;
      });
    });
  }, { passive: true });

  // Dauer-Animationen nur, solange der Abschnitt zu sehen ist
  const sicht = new IntersectionObserver(eintraege => {
    for (const e of eintraege) e.target.classList.toggle('sicht', e.isIntersecting);
  });
  $$('.sek, .spalt').forEach(el => sicht.observe(el));
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* ================= Zahlen hochzählen ================= */
  let gezaehlt = false;
  function zaehlen() {
    if (gezaehlt) return;
    gezaehlt = true;
    const fmt = new Intl.NumberFormat('de-DE');
    $$('.zaehler').forEach(el => {
      const ziel = Number(el.dataset.ziel);
      if (RM.matches || !ziel) { el.textContent = fmt.format(ziel); return; }
      const t0 = performance.now();
      let letzter = '';
      const schritt = now => {
        const t = clamp((now - t0) / 1600, 0, 1);
        const txt = fmt.format(Math.round(ziel * easeOut(t)));
        if (txt !== letzter) { el.textContent = txt; letzter = txt; }
        if (t < 1) requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    });
  }

  /* ================= Auspuff: Linie am linken Rand ================= */
  const feld = $('#auspuff');
  const rohr = $('.rohr', feld);
  const glut = $('.rohr-glut', feld);
  const kante = $('.rohr-kante', feld);
  const ende = $('.rohr-ende', feld);
  const chrom = $('#chrom');
  let rohrLaenge = 0, rohrTop = 0, rohrHoehe = 0, rohrLetzter = -1;
  function rohrBauen() {
    if (getComputedStyle(feld).display === 'none') { rohrLaenge = 0; return; }
    const start = $('#crew'), ziel = $('#formular');
    const top = start.getBoundingClientRect().top + scrollY + 40;
    const bottom = ziel.getBoundingClientRect().top + scrollY + 60;
    const h = Math.max(200, bottom - top);
    const x = 46;
    const amp = 16;
    chrom.setAttribute('x1', x - 5); chrom.setAttribute('x2', x + 5);
    const grenzen = $$('.sek').map(s => s.getBoundingClientRect().top + scrollY - top).filter(y => y > 0 && y < h);
    let d = `M${x} 0`;
    let y0 = 0;
    grenzen.forEach((y, i) => {
      const dir = i % 2 ? -1 : 1;
      const m = (y0 + y) / 2;
      d += ` L${x} ${(m - 60).toFixed(0)} C${x} ${(m - 20).toFixed(0)} ${x + amp * dir} ${(m - 20).toFixed(0)} ${x + amp * dir} ${m.toFixed(0)}`
         + ` C${x + amp * dir} ${(m + 20).toFixed(0)} ${x} ${(m + 20).toFixed(0)} ${x} ${(m + 60).toFixed(0)}`;
      y0 = y;
    });
    d += ` L${x} ${h.toFixed(0)}`;
    feld.style.top = top + 'px';
    feld.style.height = h + 'px';
    [rohr, glut, kante].forEach(p => p.setAttribute('d', d));
    rohrLaenge = rohr.getTotalLength();
    [rohr, glut, kante].forEach(p => { p.style.strokeDasharray = rohrLaenge; });
    rohrTop = top; rohrHoehe = h; rohrLetzter = -1;
    rohrZeichnen();
  }
  function rohrZeichnen() {
    if (!rohrLaenge) return;
    const anteil = RM.matches ? 1 : clamp((scrollY + innerHeight * 0.72 - rohrTop) / rohrHoehe, 0, 1);
    const off = rohrLaenge * (1 - anteil);
    if (Math.abs(off - rohrLetzter) < 0.5) return;
    rohrLetzter = off;
    rohr.style.strokeDashoffset = off;
    glut.style.strokeDashoffset = off;
    kante.style.strokeDashoffset = off;
    const spitze = rohr.getPointAtLength(rohrLaenge * anteil);   // das Endrohr wandert mit
    ende.setAttribute('cx', spitze.x.toFixed(1));
    ende.setAttribute('cy', spitze.y.toFixed(1));
    ende.style.opacity = anteil > 0.002 ? 1 : 0;
  }
  addEventListener('scroll', rohrZeichnen, { passive: true });
  let bauTimer = 0;
  const spaeterBauen = () => { clearTimeout(bauTimer); bauTimer = setTimeout(rohrBauen, 120); };
  addEventListener('resize', spaeterBauen);
  addEventListener('load', rohrBauen);
  if (document.fonts) document.fonts.ready.then(rohrBauen);
  new ResizeObserver(spaeterBauen).observe(document.body);

  /* ================= Antreten: Tacho bis 60 ================= */
  const tacho = $('#tacho');
  const striche = $('#tacho-striche');
  const NS = 'http://www.w3.org/2000/svg';
  for (let v = 0; v <= 60; v += 10) {
    const a = (-90 + (v / 60) * 180) * Math.PI / 180;
    const pt = r => [160 + r * Math.sin(a), 170 - r * Math.cos(a)];
    const [x1, y1] = pt(104), [x2, y2] = pt(92), [tx, ty] = pt(76);
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1));
    l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', tx.toFixed(1)); t.setAttribute('y', (ty + 4).toFixed(1)); t.setAttribute('text-anchor', 'middle');
    t.textContent = v;
    striche.append(l, t);
  }
  const kick = $('#kick');
  const kickTxt = $('.kick-txt', kick);
  const laeuftEl = $('#laeuft');
  const karte = $('#termin-karte');
  let v = 0, halten = false, fertig = false, kickRaf = null, kickLast = 0, vLetzt = -1;
  function vSetzen(x) {
    if (Math.abs(x - vLetzt) < 0.002 && x !== 0 && x !== 1) return;
    vLetzt = x;
    tacho.style.setProperty('--v', x.toFixed(3));
    kick.style.setProperty('--v', x.toFixed(3));
  }
  function kickTick(now) {
    const dt = Math.min(64, now - (kickLast || now));
    kickLast = now;
    if (halten) v = Math.min(1, v + dt / 2000);
    else v = Math.max(0, v - (dt / 900) * (0.4 + v));
    vSetzen(easeIO(v) * 0.15 + v * 0.85);
    if (v >= 1 && !fertig) return geschafft();
    if (halten || v > 0) kickRaf = requestAnimationFrame(kickTick);
    else { kickRaf = null; kickLast = 0; }
  }
  function geschafft(sofort) {
    fertig = true; halten = false; kickRaf = null;
    v = 1; vSetzen(1);
    kick.classList.remove('halten');
    kick.classList.add('fertig');
    kick.setAttribute('aria-disabled', 'true');
    kickTxt.textContent = 'Läuft.';
    laeuftEl.textContent = 'Läuft.';
    laeuftEl.classList.add('an');
    karte.classList.add('offen');
    if (!sofort) {
      tacho.classList.add('laeuft', 'paff-an');
      if (navigator.vibrate) navigator.vibrate(60);
    }
  }
  function druecken(e) {
    if (fertig) return;
    if (e && e.pointerId !== undefined) { try { kick.setPointerCapture(e.pointerId); } catch { /* egal */ } }
    halten = true;
    kick.classList.add('halten');
    kickTxt.textContent = 'Weiter halten';
    if (kickRaf === null) kickRaf = requestAnimationFrame(kickTick);
  }
  function loslassen() {
    if (fertig || !halten) return;
    halten = false;
    kick.classList.remove('halten');
    kickTxt.textContent = 'Gedrückt halten';
    if (kickRaf === null) kickRaf = requestAnimationFrame(kickTick);
  }
  kick.addEventListener('pointerdown', e => { e.preventDefault(); druecken(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => kick.addEventListener(n, loslassen));
  kick.addEventListener('contextmenu', e => e.preventDefault());
  kick.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); druecken(); } });
  kick.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') loslassen(); });
  kick.addEventListener('blur', loslassen);

  /* ================= Termin anzeigen ================= */
  let terminId = null;
  const tage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  function datumText(iso) {
    const [j, m, t] = iso.split('-').map(Number);
    const d = new Date(j, m - 1, t);
    return `${tage[d.getDay()]}, ${String(t).padStart(2, '0')}.${String(m).padStart(2, '0')}.`;
  }
  function terminZeigen(info) {
    const t = info && info.termin;
    terminId = t ? t.id : null;
    let zeile = 'Termin folgt auf Instagram.';
    let text = 'Trag dich schon mal ein. Sobald der Termin steht, erfährst du ihn auf Instagram.';
    if (t) {
      const km = t.km ? ` · ${t.km} km` : '';
      if (t.status === 'verschoben') {
        zeile = `Verschoben auf ${datumText(t.datum)}`;
        text = t.hinweis ? `Grund: ${t.hinweis}` : 'Treffpunkt und Uhrzeit kommen einen Tag vorher auf Instagram.';
      } else {
        zeile = `${datumText(t.datum)}${km}`;
        text = t.hinweis || 'Treffpunkt und Uhrzeit kommen einen Tag vorher auf Instagram.';
      }
    }
    if (info && info.anzahl >= 3) text += ` Schon ${info.anzahl} dabei.`;
    $$('[data-termin="zeile"]').forEach(el => {
      el.textContent = el.closest('.mitfahren-kopf') && !(t && t.status === 'verschoben') ? `Nächste Ausfahrt: ${zeile}` : zeile;
    });
    $$('[data-termin="info"]').forEach(el => { el.textContent = text; });
  }
  api.naechste().then(terminZeigen).catch(() => { /* bleibt bei „Termin folgt“ */ });

  /* ================= Formular ================= */
  const form = $('#formular');
  const fehlerEl = $('#f-fehler');
  const senden = $('#f-senden');
  const erfolg = $('#f-erfolg');
  const fName = $('#f-name'), fInsta = $('#f-insta'), fMoped = $('#f-moped'), fOk = $('#f-ok'), fWeb = $('#f-web');
  const MELDUNG = {
    name: 'Bitte gib deinen Namen oder Spitznamen an.',
    instagram: 'Instagram-Namen bestehen nur aus Buchstaben, Zahlen, Punkt und Unterstrich.',
    ok: 'Bitte bestätige, dass du Führerschein, Kennzeichen und Helm hast.',
    zu_viele: 'Gerade melden sich sehr viele an. Versuch es in einer Minute nochmal.',
    voll: 'Die Liste für diese Ausfahrt ist voll. Schreib uns auf Instagram.',
    allgemein: 'Das hat nicht geklappt. Versuch es gleich nochmal oder schreib uns auf Instagram.'
  };
  function zeigeFehler(code, feldEl) {
    fehlerEl.textContent = MELDUNG[code] || MELDUNG.allgemein;
    [fName, fInsta, fOk].forEach(f => f.removeAttribute('aria-invalid'));
    if (feldEl) { feldEl.setAttribute('aria-invalid', 'true'); feldEl.focus(); }
  }
  [fName, fInsta, fOk].forEach(f => f.addEventListener('input', () => { f.removeAttribute('aria-invalid'); fehlerEl.textContent = ''; }));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    fehlerEl.textContent = '';
    const name = fName.value.replace(/\s+/g, ' ').trim();
    const insta = fInsta.value.trim().replace(/^@+/, '').toLowerCase();
    const moped = fMoped.value.replace(/\s+/g, ' ').trim();
    if (!name || name.length > 40) return zeigeFehler('name', fName);
    if (insta && !/^[a-z0-9._]{1,30}$/.test(insta)) return zeigeFehler('instagram', fInsta);
    if (!fOk.checked) return zeigeFehler('ok', fOk);
    const fertigMachen = () => {
      form.classList.add('gesendet');
      erfolg.focus({ preventScroll: true });
      erfolg.scrollIntoView({ block: 'center', behavior: RM.matches ? 'auto' : 'smooth' });
    };
    if (fWeb.value) return fertigMachen();   // Honigtopf: Bots bekommen ein freundliches „Danke“
    senden.disabled = true;
    const alt = senden.textContent;
    senden.textContent = 'Wird eingetragen …';
    try {
      const r = await api.anmelden(terminId, name, insta || null, moped || null);
      if (r && r.ok) { fertigMachen(); api.naechste().then(terminZeigen).catch(() => {}); }
      else if (r && r.fehler === 'termin') { api.naechste().then(terminZeigen).catch(() => {}); zeigeFehler('allgemein'); }
      else zeigeFehler(r && r.fehler === 'name' ? 'name' : r && r.fehler, r && r.fehler === 'instagram' ? fInsta : null);
    } catch {
      zeigeFehler('allgemein');
    } finally {
      senden.disabled = false;
      senden.textContent = alt;
    }
  });

  /* ================= Reduzierte Bewegung: live in beide Richtungen ================= */
  function endzustaende() {
    $$('.reveal, .spalt, .strecke').forEach(el => el.classList.add('in'));
    gezaehlt = false; zaehlen();
    if (!fertig) geschafft(true);
    rohrLetzter = -1; rohrZeichnen();
  }
  function endzustaendeLoesen() {
    rohrLetzter = -1; rohrZeichnen();
  }
  RM.addEventListener('change', () => {
    if (RM.matches) endzustaende(); else endzustaendeLoesen();
    heldModus();
  });
  if (RM.matches) endzustaende();
  heldModus();

  // Nur lokal: Werkzeug zum Testen
  if (location.hostname === 'localhost') window.__fr = { progress, render: p => render(p), get shown() { return shown; }, demo: DEMO };
})();
