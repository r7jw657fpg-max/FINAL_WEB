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

// Medientyp aus Dateityp bzw. Endung ableiten (.glb/.gltf = 3D-Modell).
function mediaKindFromFile(file) {
  const name = (file.name || "").toLowerCase();
  if (/\.(glb|gltf)$/.test(name)) return "model";
  if ((file.type || "").startsWith("video/") || /\.(mp4|mov|m4v|webm)$/.test(name)) return "video";
  if ((file.type || "").startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg)$/.test(name)) return "audio";
  return "image";
}
