// Landing Page: Header, Look-Raster und Lupe (Hover am Desktop, Tippen und Halten am Handy).
const LENS_ZOOM = 3;

function applyLens(frame, img, lens, clientX, clientY, isTouch) {
  const rect = frame.getBoundingClientRect();
  if (!img.naturalWidth) return;
  const radius = lens.offsetWidth / 2;

  // object-fit: cover nachrechnen, damit die Lupe exakt den sichtbaren Ausschnitt vergrößert.
  const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
  const shownW = img.naturalWidth * scale, shownH = img.naturalHeight * scale;
  const offsetX = (rect.width - shownW) / 2, offsetY = (rect.height - shownH) / 2;

  const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
  const y = Math.min(rect.height, Math.max(0, clientY - rect.top));

  lens.style.left = (x - radius) + "px";
  // Am Handy schwebt die Lupe über dem Finger, damit er sie nicht verdeckt.
  lens.style.top = (y - radius - (isTouch ? radius + 30 : 0)) + "px";
  lens.style.backgroundSize = (shownW * LENS_ZOOM) + "px " + (shownH * LENS_ZOOM) + "px";
  lens.style.backgroundPosition = (radius - (x - offsetX) * LENS_ZOOM) + "px " + (radius - (y - offsetY) * LENS_ZOOM) + "px";
  lens.classList.add("on");
}

function attachLens(link, frame, img, lens) {
  let timer = null, active = false, suppressClick = false, startX = 0, startY = 0;
  const hide = () => lens.classList.remove("on");

  frame.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") { applyLens(frame, img, lens, event.clientX, event.clientY, false); return; }
    if (active) applyLens(frame, img, lens, event.clientX, event.clientY, true);
    else if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) clearTimeout(timer);
  });
  frame.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") hide(); });

  frame.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    startX = event.clientX; startY = event.clientY;
    timer = setTimeout(() => {
      active = true;
      applyLens(frame, img, lens, startX, startY, true);
      if (navigator.vibrate) navigator.vibrate(8);
    }, 350);
  });
  const endTouch = () => {
    clearTimeout(timer);
    if (!active) return;
    active = false;
    hide();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 400);
  };
  frame.addEventListener("pointerup", endTouch);
  frame.addEventListener("pointercancel", endTouch);

  // Solange die Lupe aktiv ist, darf die Seite nicht mitscrollen.
  frame.addEventListener("touchmove", (event) => { if (active) event.preventDefault(); }, { passive: false });
  frame.addEventListener("contextmenu", (event) => event.preventDefault());
  link.addEventListener("click", (event) => { if (suppressClick) event.preventDefault(); });
}

function buildLook(trace) {
  const link = document.createElement("a");
  link.className = "look";
  link.href = "/trace/" + encodeURIComponent(trace.id);

  const frame = document.createElement("div");
  frame.className = "look-frame";
  if (trace.look_image_url) {
    const img = document.createElement("img");
    img.src = trace.look_image_url;
    img.alt = trace.title;
    img.draggable = false;
    const lens = document.createElement("div");
    lens.className = "lens";
    lens.style.backgroundImage = 'url("' + trace.look_image_url + '")';
    frame.append(img, lens);
    attachLens(link, frame, img, lens);
  } else {
    frame.classList.add("no-image");
    frame.innerText = "No image";
  }

  const title = document.createElement("div");
  title.className = "look-title";
  title.innerText = trace.title;
  link.append(frame, title);
  return link;
}

// Logo als Bild, solange keins hochgeladen ist als Schrift-Platzhalter.
function buildLogo(url, placeholderClass) {
  if (url) {
    const img = document.createElement("img");
    img.className = "logo-img";
    img.src = url;
    img.alt = "Cutting from Memory";
    img.draggable = false;
    return img;
  }
  const text = document.createElement("span");
  text.className = placeholderClass;
  text.innerHTML = "Cutting<br>from<br>Memory";
  return text;
}

/* ===== Start-Logo: bildschirmfüllend; Hover vergrößert (Lupe ohne sichtbaren Rand), Klick blendet aus ===== */

function setupSplash(logoUrl) {
  const splash = document.getElementById("splash");
  if (document.documentElement.classList.contains("no-splash")) { splash.remove(); return; }

  const lens = document.getElementById("splashLens");
  document.getElementById("splashBase").append(buildLogo(logoUrl, "logo-placeholder-big"));
  document.getElementById("splashZoom").append(buildLogo(logoUrl, "logo-placeholder-big"));
  document.documentElement.classList.add("splash-open");

  let startX = 0, startY = 0, moved = false;
  const show = (x, y) => {
    splash.style.setProperty("--x", x + "px");
    splash.style.setProperty("--y", y + "px");
    lens.classList.add("on");
  };

  splash.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") { show(event.clientX, event.clientY); return; }
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) moved = true;
    show(event.clientX, event.clientY);
  });
  splash.addEventListener("pointerdown", (event) => {
    startX = event.clientX; startY = event.clientY; moved = false;
    if (event.pointerType !== "mouse") show(event.clientX, event.clientY);
  });
  const hide = () => lens.classList.remove("on");
  splash.addEventListener("pointerleave", hide);
  splash.addEventListener("pointerup", (event) => { if (event.pointerType !== "mouse") hide(); });
  splash.addEventListener("pointercancel", hide);

  function leave() {
    if (splash.classList.contains("leaving")) return;
    splash.classList.add("leaving");
    document.documentElement.classList.remove("splash-open");
    setTimeout(() => splash.remove(), 1000);
  }
  // Ein Wischen am Handy (Lupe bewegen) zählt nicht als Klick.
  splash.addEventListener("click", () => { if (moved) { moved = false; return; } leave(); });
  splash.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); leave(); }
  });
  splash.focus({ preventScroll: true });
}

/* ===== Trace-ID: die GPS-Nummer des Fundorts führt direkt zum Kleidungsstück ===== */

function setupTraceIdForm() {
  const form = document.getElementById("idForm");
  const input = document.getElementById("idInput");
  const error = document.getElementById("idError");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;
    if (!input.value.trim()) return;
    try {
      const result = await api("/api/lookup?id=" + encodeURIComponent(input.value.trim()));
      location.href = "/trace/" + encodeURIComponent(result.trace_id) + "?point=" + encodeURIComponent(result.point_id);
    } catch (err) {
      error.innerText = err.message;
      error.hidden = false;
    }
  });
}

async function initLanding() {
  setupTraceIdForm();
  const [settings, traces] = await Promise.all([api("/api/settings"), api("/api/traces")]);

  setupSplash(settings.logo_url);
  const logo = document.getElementById("logo");
  const headerLogo = buildLogo(settings.logo_url, "logo-placeholder");
  logo.appendChild(headerLogo);
  document.getElementById("intro").innerText = settings.intro || "";

  if (settings.background_url) {
    const bg = document.getElementById("bg");
    bg.style.backgroundImage = 'url("' + settings.background_url + '")';
    bg.classList.add("has-image");
  }

  const looks = document.getElementById("looks");
  traces.forEach(trace => looks.appendChild(buildLook(trace)));
  document.getElementById("empty").hidden = traces.length > 0;
}

initLanding().catch(error => {
  console.error(error);
  document.getElementById("splash").remove();
  document.documentElement.classList.remove("splash-open");
});
