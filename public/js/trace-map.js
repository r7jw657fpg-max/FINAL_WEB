// Karte der Trace-Seite: Marker mit Vorschau und die Kamerafahrten.
const TraceMap = (() => {
  let map = null;
  let bounds = null;
  const pins = {};

  function overviewPadding() {
    const small = window.innerWidth <= 720;
    return { top: small ? 70 : 90, bottom: small ? 50 : 70, left: small ? 40 : 90, right: small ? 40 : 90 };
  }

  // Raum, den das Detailfenster verdeckt: Der gewählte Punkt soll im sichtbaren Teil der Karte landen.
  function sheetPadding() {
    const zero = { top: 0, bottom: 0, left: 0, right: 0 };
    const mode = layoutMode();
    if (mode === "bottom") return { ...zero, top: 56, bottom: Math.round(window.innerHeight * 0.62) };
    if (mode === "side") return { ...zero, right: Math.round(Math.min(window.innerWidth * 0.58, 560)) };
    return zero;
  }

  async function create(points) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    bounds = new mapboxgl.LngLatBounds();
    points.forEach(p => bounds.extend([p.lng, p.lat]));

    map = new mapboxgl.Map({
      container: "map",
      style: MAP_STYLE,
      center: bounds.isEmpty() ? [8.5417, 47.3769] : bounds.getCenter(),
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    await new Promise(resolve => map.once("load", resolve));
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: overviewPadding(), maxZoom: 15, animate: false });
  }

  function addPin(point, onClick) {
    const wrap = document.createElement("div");
    wrap.className = "pin-wrap" + (point.category === "commission" ? " start" : "");

    const button = document.createElement("button");
    button.className = "pin";
    button.setAttribute("aria-label", point.title || CATEGORY_LABELS[point.category]);
    const firstImage = point.media.find(m => m.kind === "image");
    if (firstImage) {
      const img = document.createElement("img");
      img.decoding = "async";
      img.src = firstImage.url;
      img.alt = "";
      button.append(img);
    } else {
      button.innerHTML = categoryIconSvg(point.category, 20);
    }
    const dot = document.createElement("span");
    dot.className = "pin-dot";
    const tip = document.createElement("span");
    tip.className = "pin-tip";
    tip.innerText = point.title || CATEGORY_LABELS[point.category];
    button.append(dot, tip);
    button.addEventListener("click", () => onClick(point.id));
    wrap.append(button);

    new mapboxgl.Marker({ element: wrap }).setLngLat([point.lng, point.lat]).addTo(map);
    pins[point.id] = wrap;
  }

  function markViewed(id) {
    if (pins[id]) pins[id].classList.add("viewed");
  }

  // Löst auf, sobald die Kamera angekommen ist (mit Sicherheits-Timeout).
  function whenIdle(timeoutMs) {
    return new Promise(resolve => {
      const done = () => { clearTimeout(timer); map.off("moveend", done); resolve(); };
      const timer = setTimeout(done, timeoutMs);
      map.on("moveend", done);
    });
  }

  function flyToPoint(point, duration = 1100) {
    map.flyTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 16.5), padding: sheetPadding(), duration, essential: true });
    return whenIdle(duration + 600);
  }

  function overview(duration = 1400) {
    if (!bounds || bounds.isEmpty()) return Promise.resolve();
    map.fitBounds(bounds, { padding: overviewPadding(), maxZoom: 15, duration, essential: true });
    return whenIdle(duration + 600);
  }

  // Verkürzter Einflug: aus der Übersicht heraus zum Startpunkt.
  function flyIn(startPoint) {
    map.setZoom(Math.max(2, map.getZoom() - 1.6));
    map.flyTo({ center: [startPoint.lng, startPoint.lat], zoom: 17, padding: sheetPadding(), duration: 2600, essential: true });
    return whenIdle(3400);
  }

  return { create, addPin, markViewed, flyToPoint, overview, flyIn };
})();
