// Karte als zweite Instanz: Vollbild-Overlay mit allen Pieces des Looks. Mapbox lädt erst beim ersten Öffnen.
let MAP = null, MARKERS = [];

function loadMapbox() {
  return window.mapboxgl ? Promise.resolve() : new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.30.0/mapbox-gl.js";
    script.onload = resolve; script.onerror = reject;
    document.head.append(script);
  });
}

async function openMap(current) {
  document.getElementById("map").classList.add("on");
  document.getElementById("mapT").textContent = "Map — " + T.code;
  try { await loadMapbox(); } catch (e) { document.getElementById("mapT").textContent = "Map could not be loaded"; return; }
  mapboxgl.accessToken = MAPBOX_TOKEN;
  if (!MAP) MAP = new mapboxgl.Map({ container: "mapc", style: MAP_STYLE, center: [8.5417, 47.3769], zoom: 12 });
  MARKERS.forEach(m => m.remove()); MARKERS = [];
  const bounds = new mapboxgl.LngLatBounds();
  T.points.forEach(p => {
    const marker = document.createElement("button");
    marker.className = "mk" + (p === current ? " cur" : "") + (p.category === "commission" ? " org" : "");
    marker.textContent = "P" + pad(p.idx + 1); marker.title = p.name;
    marker.onclick = () => { closeMap(); go("#p/" + p.id); };
    MARKERS.push(new mapboxgl.Marker({ element: marker }).setLngLat([p.lng, p.lat]).addTo(MAP));
    bounds.extend([p.lng, p.lat]);
  });
  MAP.resize();
  if (!bounds.isEmpty()) MAP.fitBounds(bounds, { padding: { top: 110, bottom: 70, left: 60, right: 60 }, maxZoom: 16, duration: 0 });
}
function closeMap() { document.getElementById("map").classList.remove("on"); }
