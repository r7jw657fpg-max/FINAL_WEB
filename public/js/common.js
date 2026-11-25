// Gemeinsame Helfer für Landing, Trace-Seite und Admin.
const MAPBOX_TOKEN = "pk.eyJ1IjoibGVvbnJvY2EiLCJhIjoiY21wYmY1Yjl6MDNxczJxc2U0MzByNHA3OCJ9.-BaGJWtZCr3lKDKP1o9THQ";
const MAP_STYLE = "mapbox://styles/leonroca/cmu5b7jcz003g01sagg39fgfx";

const CATEGORY_LABELS = { commission: "Commission", lost_and_found: "Lost & Found", scan: "Scan" };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "API-Fehler: " + response.status);
  }
  return response.json();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.innerText = text || "";
  return div.innerHTML;
}

// Dünne Linien-Icons in currentColor, passend zum reduzierten Look.
function categoryIconSvg(category, size = 18) {
  const open = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';
  if (category === "scan") {
    return open + '<path d="M11 10V7h3M21 10V7h-3M11 22v3h3M21 22v3h-3"/><line x1="9" y1="16" x2="23" y2="16"/></svg>';
  }
  if (category === "commission") {
    return open + '<rect x="8" y="5" width="16" height="20" rx="1"/><line x1="11" y1="11" x2="21" y2="11"/><line x1="11" y1="15" x2="21" y2="15"/><line x1="11" y1="19" x2="17" y2="19"/></svg>';
  }
  return open + '<path d="M16 14V9q0-2.5-2.5-2.5T11 9"/><path d="M16 14 7 24q-1.500 2 1 2h16q2.500 0 1-2z"/></svg>';
}

// Theme: dunkel (Standard) oder hell. ?t=light|dark setzt es, die letzte Wahl bleibt gespeichert.
// Das Setzen vor dem ersten Zeichnen macht ein kleiner Inline-Schnipsel in den Seiten selbst.
function setupThemeToggle(button) {
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("cfm-theme", next); } catch (e) {}
  });
}

// Körperzonen für das automatische Platzieren der Hotspots (Prozent des Look-Fotos).
const ZONE_LABELS = { head: "Head", torso: "Torso", legs: "Legs", feet: "Feet", accessory: "Accessory" };
const ZONE_RULES = {
  head: [/cap|hat|beanie|helmet|mütze|kappe|hut/i, 11],
  torso: [/jacket|sweater|shirt|coat|poncho|blanket|hoodie|vest|top|jumper|pullover/i, 34],
  legs: [/pants|jeans|trouser|hose|skirt/i, 66],
  feet: [/shoe|sneaker|boot|sock|schuh/i, 91],
};

// Zone eines Pieces: im Admin gesetzt, sonst aus dem Titel geraten, sonst die des verlinkten Partners.
function zoneOf(point, points, depth = 0) {
  if (point.zone) return point.zone;
  const name = point.title || "";
  for (const zone in ZONE_RULES) if (ZONE_RULES[zone][0].test(name)) return zone;
  if (depth < 1) {
    for (const link of point.links || []) {
      const other = points.find(p => p.id === link.point_id);
      if (other) { const zone = zoneOf(other, points, 1); if (zone !== "accessory") return zone; }
    }
  }
  return "accessory";
}

// Automatische Hotspot-Positionen für alle Pieces eines Looks: { pointId: { x, y } } in Prozent.
function autoSpots(points) {
  const used = {}, out = {};
  points.forEach((p, i) => {
    const zone = zoneOf(p, points), k = used[zone] = (used[zone] || 0) + 1;
    if (zone === "accessory") { out[p.id] = { x: i % 2 ? 78 : 22, y: 46 + (i % 3) * 8 }; return; }
    const side = k % 2 ? -1 : 1, offset = Math.ceil((k - 1) / 2) * 20;
    out[p.id] = { x: Math.max(12, Math.min(88, 50 + (k === 1 ? 0 : side * offset))), y: ZONE_RULES[zone][1] + (k > 1 ? 4 : 0) };
  });
  return out;
}

// Die Trace-ID eines Kleidungsstücks ist die GPS-Nummer seines Fundorts.
function traceIdOf(point) {
  return Number(point.lat).toFixed(5) + ", " + Number(point.lng).toFixed(5);
}

// Medientyp aus Dateityp bzw. Endung ableiten (.glb/.gltf = 3D-Modell).
function mediaKindFromFile(file) {
  const name = (file.name || "").toLowerCase();
  if (/\.(glb|gltf)$/.test(name)) return "model";
  if ((file.type || "").startsWith("video/") || /\.(mp4|mov|m4v|webm)$/.test(name)) return "video";
  if ((file.type || "").startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg)$/.test(name)) return "audio";
  return "image";
}
