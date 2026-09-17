// Gemeinsame Helfer für index.html und admin/index.html
const MAPBOX_TOKEN = "pk.eyJ1IjoibGVvbnJvY2EiLCJhIjoiY21wYmY1Yjl6MDNxczJxc2U0MzByNHA3OCJ9.-BaGJWtZCr3lKDKP1o9THQ";

function parseCoordinates(value) {
  let result = value;
  let tries = 0;
  while (typeof result === "string" && tries < 5) {
    try { result = JSON.parse(result); } catch (e) { break; }
    tries++;
  }
  return result;
}

function markerIconSvg(type) {
  if (type === "scan") {
    return '<svg width="18" height="18" viewBox="0 0 32 32"><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 10 L11 7 L14 7"/><path d="M21 10 L21 7 L18 7"/><path d="M11 22 L11 25 L14 25"/><path d="M21 22 L21 25 L18 25"/><line x1="9" y1="16" x2="23" y2="16"/></g></svg>';
  }
  if (type === "commission") {
    return '<svg width="18" height="18" viewBox="0 0 32 32"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="5" width="16" height="20" rx="1" stroke-width="1.8"/><line x1="10" y1="10" x2="22" y2="10" stroke-width="1.1"/><line x1="10" y1="14" x2="22" y2="14" stroke-width="1.1"/><line x1="10" y1="18" x2="17" y2="18" stroke-width="1.1"/><g transform="translate(18,20) rotate(38)"><rect x="-1" y="-19" width="2" height="5" rx="0.6" fill="#fff" stroke="none"/><line x1="-1.7" y1="-16" x2="-1.7" y2="-11" stroke-width="0.6"/><line x1="0" y1="-14" x2="0" y2="-1" stroke-width="1"/><path d="M-1 -1 L1 -1 L0 3 Z" fill="#fff" stroke="none"/></g></g></svg>';
  }
  return '<svg width="18" height="18" viewBox="0 0 32 32"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"><path d="M16 14 L16 9 Q16 6.5 13.5 6.5 Q11 6.5 11 9" stroke-width="1.8"/><path d="M16 14 L7 24 Q5.5 26 8 26 L24 26 Q26.5 26 25 24 Z" stroke-width="2"/><line x1="10" y1="26" x2="22" y2="26" stroke-width="1.2"/></g></svg>';
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.innerText = str || "";
  return div.innerHTML;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error("API-Fehler: " + response.status);
  return response.status === 204 ? null : response.json();
}
