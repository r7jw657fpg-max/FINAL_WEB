// Trace-Seite: lädt den Look, baut Karte und Marker auf und steuert den Ablauf.
// Ablauf: Einflug zum Commission-Startpunkt -> Overlay -> "Explore the trace" -> Übersicht -> Punkte anklicken.
const state = { trace: null, points: [], viewed: new Set() };

function showMessage(html) {
  const message = document.getElementById("message");
  message.innerHTML = html;
  message.hidden = false;
}

function preloadMedia(points) {
  // Startpunkt zuerst; 3D-Modelle bewusst nicht vorladen (model-viewer streamt sie selbst).
  const ordered = [...points].sort((a, b) => (a.category === "commission" ? -1 : 0) - (b.category === "commission" ? -1 : 0));
  ordered.forEach(point => point.media.forEach(item => {
    if (item.kind === "image") new Image().src = item.url;
    else if (item.kind === "audio" && point.category === "commission") fetch(item.url).catch(() => {});
  }));
}

function nextPoint(point) {
  const index = state.points.findIndex(p => p.id === point.id);
  return state.points[index + 1] || null;
}

async function goToOverview() {
  Viewer.close();
  document.getElementById("hint").hidden = false;
  await TraceMap.overview();
}

let openToken = 0;
async function openPoint(id, { fly = true } = {}) {
  const point = state.points.find(p => p.id === id);
  if (!point) return;
  const token = ++openToken;
  document.getElementById("hint").hidden = true;
  if (fly) await TraceMap.flyToPoint(point);
  if (token !== openToken) return;

  state.viewed.add(id);
  TraceMap.markViewed(id);
  Viewer.open(point, {
    points: state.points,
    viewed: state.viewed,
    next: nextPoint,
    onNext: (current) => openPoint(nextPoint(current).id),
    onBack: goToOverview,
    onExplore: goToOverview,
    onSelect: (selectedId) => openPoint(selectedId),
  });
}

async function initTrace() {
  const id = decodeURIComponent(location.pathname.split("/")[2] || "");
  let trace;
  try {
    trace = await api("/api/traces/" + encodeURIComponent(id) + (location.search.includes("preview") ? "?admin=1" : ""));
  } catch (error) {
    showMessage('This look could not be found.<br><br><a class="btn" href="/">Back to all looks</a>');
    return;
  }

  state.trace = trace;
  state.points = trace.points;
  document.title = trace.title + " — Cutting from Memory";
  document.getElementById("traceTitle").innerText = trace.title;
  preloadMedia(state.points);

  await TraceMap.create(state.points);
  state.points.forEach(point => TraceMap.addPin(point, (pointId) => openPoint(pointId)));

  const overviewButton = document.getElementById("overviewButton");
  overviewButton.hidden = false;
  overviewButton.addEventListener("click", goToOverview);

  const start = state.points.find(p => p.category === "commission");
  if (start) {
    await TraceMap.flyIn(start);
    openPoint(start.id, { fly: false });
  } else {
    document.getElementById("hint").hidden = state.points.length === 0;
  }
}

initTrace().catch(error => console.error(error));
