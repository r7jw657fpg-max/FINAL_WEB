// Detailansicht eines Pieces (Ebene 3): Medien, Datenblatt, Story, Werkstatt-Prozess, Verwandtes, Ort.
// Nutzt T (Look-Daten, trace-main.js) und W (Szene, trace-scene.js).
const TYPE = { commission: "Origin", lost_and_found: "Found", scan: "Scan" };
const CUBE = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1"><path d="M13 3l9 5v10l-9 5-9-5V8z"/><path d="M4 8l9 5 9-5M13 13v10"/></svg>';
const TBD = '<span class="tbd">TBD</span>';
const pad = n => String(n).padStart(2, "0");
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const coord = p => Math.abs(p.lat).toFixed(5) + "° " + (p.lat >= 0 ? "N" : "S") + "  " + Math.abs(p.lng).toFixed(5) + "° " + (p.lng >= 0 ? "E" : "W");
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

// Vorschau eines Pieces: erstes Foto, sonst Platzhalter (Scan ohne Foto).
function thumbEl(p) {
  if (p.img) { const i = el("img"); i.decoding = "async"; i.alt = ""; i.src = p.img; return i; }
  return el("div", "ph", "<div>" + CUBE + (p.nModel ? "3D SCAN" : "NO IMAGE") + "</div>");
}

/* ----- Bildansicht: Tippen vergrößert, Wischen verschiebt, nochmal Tippen verkleinert ----- */
const lightboxEl = document.getElementById("lightbox"), lightboxImage = document.getElementById("lightboxImage");
function lightbox(url) { lightboxImage.src = url; lightboxEl.classList.remove("zoomed"); lightboxEl.scrollTo(0, 0); lightboxEl.classList.add("active"); }
function closeLightbox() { lightboxEl.classList.remove("active", "zoomed"); lightboxImage.removeAttribute("src"); }
document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
lightboxImage.addEventListener("click", () => {
  const zoomed = lightboxEl.classList.toggle("zoomed");
  if (zoomed) requestAnimationFrame(() => lightboxEl.scrollTo((lightboxEl.scrollWidth - lightboxEl.clientWidth) / 2, (lightboxEl.scrollHeight - lightboxEl.clientHeight) / 2));
});
lightboxEl.addEventListener("click", event => { if (event.target === lightboxEl && !lightboxEl.classList.contains("zoomed")) closeLightbox(); });

/* ----- Werkstatt-Daten (pro Look: gemeinsame unbearbeitete Fotos + eigene Changes) ----- */
const workshopCache = {};
function loadWorkshop(p) {
  if (!workshopCache[p.id]) workshopCache[p.id] = api("/api/points/" + p.id + "/workshop?trace_id=" + encodeURIComponent(T.trace.id)).catch(() => []);
  return workshopCache[p.id];
}

function fillPanel(p) {
  const panel = W.panel; panel.innerHTML = "";
  const block = (html) => { const d = el("div", "blk", html); d.style.animationDelay = (.5 + panel.children.length * .08) + "s"; panel.append(d); return d; };

  // Navigation
  const nav = el("div", "pback blk"), prev = T.points[p.idx - 1], next = T.points[p.idx + 1];
  const button = (text, onclick, off) => { const b = el("button", "btn", text); if (off) b.disabled = true; b.onclick = onclick; return b; };
  nav.append(button("← Network", () => go("#net")), button("‹ " + (prev ? prev.ref : ""), () => go("#p/" + prev.id), !prev), button((next ? next.ref : "") + " ›", () => go("#p/" + next.id), !next));
  panel.append(nav);

  // Medien
  const view = el("div", "pview"), tabs = el("div", "mt"), media = p.media.filter(m => m.kind !== "audio");
  const show = index => {
    view.innerHTML = ""; const m = media[index];
    [...tabs.children].forEach((b, k) => b.classList.toggle("on", k === index));
    if (!m) { view.innerHTML = '<div class="ph"><div>' + CUBE + "NO MEDIA YET</div></div>"; return; }
    if (m.kind === "image") { const im = el("img"); im.src = m.url; im.alt = m.caption || p.name; im.onclick = () => lightbox(m.url); view.append(im); }
    else if (m.kind === "video") { const v = el("video"); v.src = m.url; v.controls = true; v.playsInline = true; v.preload = "metadata"; Object.assign(v.style, { position: "absolute", inset: 0, width: "100%", height: "100%" }); view.append(v); }
    else {
      const mv = document.createElement("model-viewer");
      mv.setAttribute("src", m.url); mv.setAttribute("camera-controls", ""); mv.setAttribute("auto-rotate", ""); mv.setAttribute("exposure", "1");
      mv.setAttribute("touch-action", "pan-y"); // senkrechtes Wischen scrollt weiter das Panel
      const loading = el("div", "ph", "<div>Loading model …</div>");
      mv.addEventListener("load", () => loading.remove());
      mv.addEventListener("error", () => { loading.innerHTML = "<div>Model could not be loaded</div>"; });
      view.append(mv, loading);
    }
  };
  let ic = 0, iv = 0;
  media.forEach((m, i) => { const b = el("button", "", m.kind === "image" ? "IMG " + (++ic) : m.kind === "video" ? "VID " + (++iv) : "3D SCAN"); b.onclick = () => show(i); tabs.append(b); });
  const mediaBlock = el("div", "blk"); mediaBlock.append(view); if (media.length > 1) mediaBlock.append(tabs); panel.append(mediaBlock); show(0);

  block('<div class="ref">' + p.ref + " · " + TYPE[p.category] + "</div><h2>" + esc(p.name) + "</h2>");

  // Datenblatt
  const val = v => (v && String(v).trim()) ? esc(v) : TBD;
  const rows = [
    ["Ref", p.ref], ["Type", TYPE[p.category] + (p.category === "commission" ? " (start of trace)" : "")], ["Trace-ID", coord(p)],
    ["From origin", p.km != null ? p.km.toFixed(2) + " km" : "—"],
    ["Media", [p.nImg && "IMG " + p.nImg, p.nModel && "3D " + p.nModel, p.nAudio && "AUDIO " + p.nAudio].filter(Boolean).join(" · ") || TBD],
    ["Process", '<span data-process>…</span>'],
    ["Material", val(p.material)], ["Composition", val(p.composition)], ["Condition", val(p.condition)], ["Found on", val(p.found_on)], ["Status", val(p.status)],
  ];
  const spec = block('<div class="sec"><b>01</b> Specification</div><div class="kv">' + rows.map(r => '<div class="k">' + r[0] + "</div><div>" + r[1] + "</div>").join("") + "</div>");
  spec.dataset.s = "spec";

  // Story
  const story = (p.text || "").trim(), comment = (p.item_comment || "").trim();
  if (story || comment) block('<div class="sec"><b>02</b> Story</div>' + (story ? '<p class="story">' + esc(story) + "</p>" : "") + (comment ? '<p class="story cm">' + esc(comment) + "</p>" : ""));
  p.media.filter(m => m.kind === "audio").forEach(m => block('<audio controls preload="none" src="' + esc(m.url) + '" style="width:100%"></audio>' + (m.caption ? '<div class="pl">' + esc(m.caption) + "</div>" : "")));

  // Werkstatt-Prozess: lädt nach, verschwindet wenn leer
  const process = block(""); process.dataset.s = "process"; process.hidden = true;
  loadWorkshop(p).then(entries => {
    const cell = spec.querySelector("[data-process]"), raw = entries.filter(e => e.kind === "raw"), changes = entries.filter(e => e.kind === "change");
    if (cell) cell.innerHTML = entries.length ? "RAW " + raw.length + " → CHANGE " + changes.length : TBD;
    if (!entries.length || W.sel !== p.idx) return;
    const strip = (title, list) => list.length ? '<div class="pl">' + title + '</div><div class="ps">' + list.map(e => '<button data-u="' + esc(e.image_url) + '"><img loading="lazy" decoding="async" src="' + esc(e.image_url) + '" alt=""><span>' + esc(e.caption || "—") + "</span></button>").join("") + "</div>" : "";
    process.innerHTML = '<div class="sec"><b>03</b> Process</div>' + strip("Unprocessed ↓", raw) + strip("Changes ↓", changes);
    process.querySelectorAll("button[data-u]").forEach(b => b.onclick = () => lightbox(b.dataset.u));
    process.hidden = false;
    if (W.pendingSection === "process") scrollToSection("process");
  });

  // Verwandtes (Verlinkungen)
  if (p.links.length) {
    const related = block('<div class="sec"><b>04</b> Related</div>');
    p.links.forEach(link => {
      const o = T.points.find(x => x.id === link.point_id); if (!o) return;
      const r = el("button", "rel"), th = el("div", "th"); th.append(thumbEl(o));
      const t = el("div", "", '<div class="pl" style="margin:0">⇄ ' + o.ref + " · " + TYPE[o.category] + '</div><div class="nm">' + esc(o.name) + "</div><p>" + esc(link.note || "") + "</p>");
      r.append(th, t); r.onclick = () => go("#p/" + o.id); related.append(r);
    });
  }

  // Ort
  const loc = block(locatorHtml(p)); loc.dataset.s = "loc"; loc.querySelector("button").onclick = () => openMap(p);
  panel.scrollTop = 0;
  if (W.pendingSection && W.pendingSection !== "process") setTimeout(() => scrollToSection(W.pendingSection), 900);
}
function scrollToSection(name) {
  const target = W.panel.querySelector('[data-s="' + name + '"]');
  if (target && !target.hidden) { W.pendingSection = null; target.scrollIntoView({ behavior: "smooth", block: "start" }); }
}

// Mini-Lageplan aus den GPS-Punkten des Looks (technische Zeichnung, kein Kartenmaterial).
function locatorHtml(p) {
  const pts = T.points, la = pts.map(q => q.lat), ln = pts.map(q => q.lng);
  const minLa = Math.min(...la), maxLa = Math.max(...la), minLn = Math.min(...ln), maxLn = Math.max(...ln);
  const Wd = 400, H = 150, m = 20;
  const sx = q => m + (q.lng - minLn) / ((maxLn - minLn) || 1) * (Wd - 2 * m), sy = q => H - m - (q.lat - minLa) / ((maxLa - minLa) || 1) * (H - 2 * m);
  let s = '<svg viewBox="0 0 ' + Wd + " " + H + '" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="1"><rect x="1" y="1" width="' + (Wd - 2) + '" height="' + (H - 2) + '" opacity=".25"/>';
  if (T.origin) pts.forEach(q => { if (q !== T.origin) s += '<line x1="' + sx(T.origin) + '" y1="' + sy(T.origin) + '" x2="' + sx(q) + '" y2="' + sy(q) + '" opacity=".25" stroke-dasharray="3 4"/>'; });
  pts.forEach(q => {
    const x = sx(q), y = sy(q), cur = q === p;
    s += q.category === "commission" ? '<rect x="' + (x - 4) + '" y="' + (y - 4) + '" width="8" height="8" fill="' + (cur ? "currentColor" : "none") + '"/>' : '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="' + (cur ? "currentColor" : "none") + '"/>';
    if (cur) s += '<circle cx="' + x + '" cy="' + y + '" r="11"/>';
  });
  return '<div class="sec"><b>05</b> Location</div><div class="loc">' + s + '</svg><div class="row"><span>□ origin · ○ piece</span><button class="btn">Open map →</button></div></div>';
}
