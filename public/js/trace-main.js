// Look-Seite: lädt den Look, ergänzt die Punkte, baut die Szene und steuert Routing und Tastatur.
// Adressen: /trace/<id>  (Ebene 1)  ·  #net  (Ebene 2)  ·  #p/<pointId>  (Ebene 3).  ?point=<id> springt direkt zum Piece.
const T = { trace: null, points: [], links: [], looks: [], origin: null, code: "", name: "", n: 0, spots: {} };

function haversineKm(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const shortName = p => (p.title || TYPE[p.category]).replace(/^COMM?ISSION PIECE\s*-\s*/i, "").replace(/\s+/g, " ").trim();

function showMessage(html) { const m = document.getElementById("message"); m.innerHTML = html; m.hidden = false; }

function prepare(trace, lookList) {
  const match = trace.title.replace(/\s+/g, " ").trim().match(/^(TRCE-\d+)[-\s]+(.+)$/i);
  T.trace = trace;
  T.looks = lookList;
  T.n = lookList.findIndex(l => l.id === trace.id) + 1;
  T.code = match ? match[1].toUpperCase() : "LOOK";
  T.name = match ? match[2].replace(/-/g, " ") : trace.title;
  const prefix = "L" + pad(T.n || 1);
  T.origin = trace.points.find(p => p.category === "commission") || null;
  T.points = trace.points.map((p, j) => {
    const images = p.media.filter(m => m.kind === "image");
    return {
      ...p, idx: j, ref: prefix + ".P" + pad(j + 1), name: shortName(p),
      km: T.origin && p.id !== T.origin.id ? haversineKm(T.origin, p) : null,
      img: images[0] && images[0].url, nImg: images.length,
      nModel: p.media.filter(m => m.kind === "model").length, nAudio: p.media.filter(m => m.kind === "audio").length,
    };
  });
  T.origin = T.points.find(p => p.category === "commission") || null;
  // Verlinkungen einmal pro Paar (beide Seiten führen auf denselben Link)
  const seen = new Set(); T.links = [];
  T.points.forEach(p => p.links.forEach(link => {
    if (seen.has(link.id)) return; seen.add(link.id);
    const other = T.points.find(x => x.id === link.point_id);
    if (other) T.links.push({ a: p, b: other });
  }));
  // Hotspots: gespeicherte Position, sonst automatisch nach Körperzone
  const auto = autoSpots(T.points);
  T.spots = {};
  T.points.forEach(p => { T.spots[p.id] = p.hotspot && Number.isFinite(p.hotspot.x) ? { x: p.hotspot.x, y: p.hotspot.y } : auto[p.id]; });
}

/* ----- Routing über den Hash ----- */
function parseHash() {
  const h = location.hash;
  if (h.startsWith("#p/")) {
    const idx = T.points.findIndex(p => p.id === decodeURIComponent(h.slice(3)));
    return idx >= 0 ? { cam: 2, sel: idx } : { cam: 1 };
  }
  return h === "#net" ? { cam: 1 } : { cam: 0 };
}
function route() {
  if (!W) return;
  closeMap(); closeLightbox();
  const r = parseHash();
  camera(r.cam, r.sel);
}

/* ----- Bedienung ----- */
document.getElementById("mapBtn").onclick = () => openMap(W && W.sel != null && W.cam === 2 ? T.points[W.sel] : null);
document.getElementById("mapX").onclick = closeMap;
setupThemeToggle(document.getElementById("themeBtn"));

document.addEventListener("keydown", e => {
  if (!W || e.target.tagName === "INPUT") return;
  if (e.key === "Escape") {
    if (document.getElementById("lightbox").classList.contains("active")) closeLightbox();
    else if (document.getElementById("map").classList.contains("on")) closeMap();
    else if (W.cam === 2) go("#net");
    else if (W.cam === 1) go("#");
    else location.href = "/";
    return;
  }
  if (W.cam === 2 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    const target = T.points[W.sel + (e.key === "ArrowRight" ? 1 : -1)];
    if (target) go("#p/" + target.id);
  }
  if (e.key === "Enter" && W.cam === 0 && T.points.length) go("#net");
});
addEventListener("hashchange", route);
addEventListener("resize", () => kick(300));

async function initTrace() {
  const id = decodeURIComponent(location.pathname.split("/")[2] || "");
  const preview = location.search.includes("preview");
  let trace;
  try {
    trace = await api("/api/traces/" + encodeURIComponent(id) + (preview ? "?admin=1" : ""));
  } catch (error) {
    showMessage('This look could not be found.<br><br><a class="btn" href="/">Back to all looks</a>');
    return;
  }
  const lookList = await api("/api/traces" + (preview ? "?all=1" : "")).catch(() => []);
  prepare(trace, lookList);
  document.title = trace.title + " — Cutting from Memory";

  document.getElementById("stage").replaceChildren(buildScene());
  document.getElementById("message").hidden = true;

  // Über die Trace-ID (?point=…) geht es direkt zum Kleidungsstück.
  const wanted = new URLSearchParams(location.search).get("point");
  if (wanted && T.points.some(p => p.id === wanted) && !location.hash) history.replaceState(null, "", location.pathname + location.search.replace(/[?&]point=[^&]*/, "").replace(/^&/, "?") + "#p/" + encodeURIComponent(wanted));
  const r = parseHash();
  requestAnimationFrame(() => camera(r.cam, r.sel, true));
  // Medien der ersten Ebene vorladen, damit der Flug durch die Ebenen ohne Nachladen läuft.
  T.points.forEach(p => { if (p.img) new Image().src = p.img; });
}
initTrace().catch(error => { console.error(error); showMessage("Could not load this look.<br><br><a class=\"btn\" href=\"/\">Back to all looks</a>"); });
