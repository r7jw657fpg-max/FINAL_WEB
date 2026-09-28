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

async function initLanding() {
  const [settings, traces] = await Promise.all([api("/api/settings"), api("/api/traces")]);

  const logo = document.getElementById("logo");
  if (settings.logo_url) {
    const logoImg = document.createElement("img");
    logoImg.className = "logo-img";
    logoImg.src = settings.logo_url;
    logoImg.alt = "Logo";
    logo.appendChild(logoImg);
  } else {
    logo.innerHTML = '<span class="logo-placeholder">Cutting<br>from<br>Memory</span>';
  }
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

initLanding().catch(error => console.error(error));
