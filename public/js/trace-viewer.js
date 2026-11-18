// Overlay ("Fenster im Fenster") mit der Detailansicht eines Punkts.
// Tabs je Punkttyp: Hauptansicht, Werkstatt (Lost & Found / Commission), Bibliothek (Scan).
const Viewer = (() => {
  const overlay = document.getElementById("overlay");
  const kicker = document.getElementById("sheetKicker");
  const title = document.getElementById("sheetTitle");
  const tabsEl = document.getElementById("sheetTabs");
  const body = document.getElementById("sheetBody");
  const foot = document.getElementById("sheetFoot");
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightboxImage");

  const sheet = overlay.querySelector(".sheet");
  const workshopCache = {};
  let point = null;
  let ctx = null;
  let activeTab = "main";

  function setExpanded(on) { sheet.classList.toggle("expanded", on); }

  // Bottom-Sheet am Handy: am Griff oder Kopf ziehen. Hoch = größer, runter = kleiner,
  // aus der kleinen Stellung weiter runter = zurück zur Karte. Antippen des Griffs wechselt die Größe.
  (function setupSheetGestures() {
    let active = false, moved = false, startY = 0, dy = 0, fromGrip = false;
    [document.getElementById("sheetGrip"), sheet.querySelector(".sheet-head")].forEach(handle => {
      handle.addEventListener("pointerdown", (event) => {
        if (layoutMode() !== "bottom" || event.target.closest("button")) return;
        active = true; moved = false; dy = 0; startY = event.clientY; fromGrip = handle.id === "sheetGrip";
        try { handle.setPointerCapture(event.pointerId); } catch (e) { /* Zeiger schon weg: Geste läuft trotzdem weiter */ }
        sheet.classList.add("dragging");
      });
      handle.addEventListener("pointermove", (event) => {
        if (!active) return;
        dy = event.clientY - startY;
        if (Math.abs(dy) > 6) moved = true;
        sheet.style.transform = dy > 0 ? "translateY(" + dy + "px)" : "";
      });
      const end = () => {
        if (!active) return;
        active = false;
        sheet.classList.remove("dragging");
        sheet.style.transform = "";
        if (!moved) { if (fromGrip) setExpanded(!sheet.classList.contains("expanded")); return; }
        if (dy < -50) setExpanded(true);
        else if (dy > 50) { if (sheet.classList.contains("expanded")) setExpanded(false); else if (ctx) ctx.onBack(); }
      };
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    });
  })();

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.innerText = text;
    return node;
  }

  function openLightbox(url) {
    lightboxImage.src = url;
    lightbox.classList.remove("zoomed");
    lightbox.scrollTo(0, 0);
    lightbox.classList.add("active");
  }
  function closeLightbox() {
    lightbox.classList.remove("active", "zoomed");
    lightboxImage.removeAttribute("src");
  }
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  lightboxImage.addEventListener("click", () => {
    const zoomed = lightbox.classList.toggle("zoomed");
    // Beim Vergrößern in die Bildmitte springen, nicht in die obere linke Ecke.
    if (zoomed) requestAnimationFrame(() => lightbox.scrollTo((lightbox.scrollWidth - lightbox.clientWidth) / 2, (lightbox.scrollHeight - lightbox.clientHeight) / 2));
  });
  lightbox.addEventListener("click", (event) => { if (event.target === lightbox && !lightbox.classList.contains("zoomed")) closeLightbox(); });

  /* ----- Hauptansicht: Medien links, Text und Audio rechts ----- */

  function renderMain() {
    const visual = point.media.filter(m => m.kind !== "audio");
    const audio = point.media.filter(m => m.kind === "audio");

    const grid = el("div", "main-grid");
    const mediaPane = el("div", "media-pane");
    const stage = el("div", "stage");
    const caption = el("div", "media-caption");
    const thumbs = el("div", "thumbs");
    mediaPane.append(stage, caption);

    function show(index) {
      stage.innerHTML = "";
      const item = visual[index];
      caption.innerText = item ? item.caption : "";
      if (!item) {
        stage.append(el("div", "empty", "No media"));
      } else if (item.kind === "image") {
        const img = el("img");
        img.src = item.url;
        img.alt = item.caption || point.title;
        img.addEventListener("click", () => openLightbox(item.url));
        stage.append(img);
      } else if (item.kind === "video") {
        const video = el("video");
        video.src = item.url;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        stage.append(video);
      } else {
        const viewer = document.createElement("model-viewer");
        viewer.setAttribute("src", item.url);
        viewer.setAttribute("camera-controls", "");
        viewer.setAttribute("auto-rotate", "");
        viewer.setAttribute("exposure", "1");
        viewer.setAttribute("zoom-sensitivity", "2.5");
        const loading = el("div", "empty", "Loading model …");
        loading.style.position = "absolute";
        viewer.addEventListener("load", () => loading.remove());
        viewer.addEventListener("error", () => { loading.innerText = "Model could not be loaded"; });
        stage.append(viewer, loading);
        if (layoutMode() !== "window") {
          // Am Handy dreht seitliches Wischen das Modell, senkrechtes Wischen scrollt weiter das Fenster
          // (sonst bliebe der Finger im Modell "hängen").
          viewer.setAttribute("touch-action", "pan-y");
          const hint = el("div", "stage-hint", "Swipe sideways to rotate · pinch to zoom");
          stage.append(hint);
          viewer.addEventListener("camera-change", (event) => { if (event.detail && event.detail.source === "user-interaction") hint.classList.add("gone"); }, { once: true });
          setTimeout(() => hint.classList.add("gone"), 6000);
        }
      }
      [...thumbs.children].forEach((thumb, i) => thumb.classList.toggle("active", i === index));
    }

    if (visual.length > 1) {
      visual.forEach((item, index) => {
        const thumb = el("button", "thumb");
        if (item.kind === "image") {
          const img = el("img");
          img.src = item.url;
          img.alt = "";
          thumb.append(img);
        } else {
          thumb.innerText = item.kind === "video" ? "VIDEO" : "3D";
        }
        thumb.addEventListener("click", () => show(index));
        thumbs.append(thumb);
      });
      mediaPane.append(thumbs);
    }
    show(0);

    const textPane = el("div", "text-pane");
    if (point.text) textPane.append(el("div", "point-text", point.text));
    audio.forEach(item => {
      const wrap = el("div", "audio-item");
      if (item.caption) wrap.append(el("div", "label", item.caption));
      const player = el("audio");
      player.src = item.url;
      player.controls = true;
      player.preload = "metadata";
      wrap.append(player);
      textPane.append(wrap);
    });

    grid.append(mediaPane, textPane);
    body.append(grid);
  }

  /* ----- Werkstatt: Rohteile links, Änderungen rechts, frei platziert ----- */

  function renderWorkshopColumn(label, entries, comment) {
    const column = el("div", "ws-col");
    column.append(el("div", "label", label));
    if (comment) column.append(el("div", "ws-comment", comment));
    const compact = layoutMode() !== "window";
    // Am Handy als Liste in der Reihenfolge der Platzierung (oben nach unten, dann links nach rechts).
    const ordered = compact ? [...entries].sort((a, b) => (a.y - b.y) || (a.x - b.x)) : entries;
    const canvas = el("div", compact ? "ws-canvas ws-flow" : "ws-canvas");
    if (!entries.length) canvas.append(el("div", "ws-empty", "Nothing here yet."));
    ordered.forEach(entry => {
      const item = el("div", compact ? "ws-card" : "ws-item");
      if (!compact) {
        item.style.left = (entry.x * 100) + "%";
        item.style.top = (entry.y * 100) + "%";
      }
      const img = el("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = entry.image_url;
      img.alt = entry.caption || "";
      img.addEventListener("click", () => openLightbox(entry.image_url));
      item.append(img);
      if (entry.caption) item.append(el("div", "", entry.caption));
      canvas.append(item);
    });
    column.append(canvas);
    return column;
  }

  async function renderWorkshop() {
    body.append(el("div", "ws-empty", "Loading …"));
    const requested = point;
    try {
      if (!workshopCache[requested.id]) workshopCache[requested.id] = await api("/api/points/" + requested.id + "/workshop?trace_id=" + encodeURIComponent(ctx.traceId));
    } catch (error) {
      console.error(error);
      if (point === requested) { body.innerHTML = ""; body.append(el("div", "ws-empty", "Could not load the workshop.")); }
      return;
    }
    if (point !== requested || activeTab !== "workshop") return;
    const entries = workshopCache[requested.id];
    const grid = el("div", "ws");
    grid.append(
      renderWorkshopColumn("Unprocessed pieces", entries.filter(e => e.kind === "raw"), requested.item_comment),
      renderWorkshopColumn("Changes", entries.filter(e => e.kind === "change"), "")
    );
    body.innerHTML = "";
    body.append(grid);
  }

  /* ----- Bibliothek: nur bereits angesehene Punkte (kein Spoilern) ----- */

  function renderLibrary() {
    const seen = ctx.points.filter(p => ctx.viewed.has(p.id) && p.category !== "commission");
    if (!seen.length) {
      body.append(el("div", "ws-empty", "Nothing collected yet. Explore the map."));
      return;
    }
    const grid = el("div", "lib-grid");
    seen.forEach(p => {
      const tile = el("button", "lib-tile");
      const thumb = el("div", "lib-thumb");
      const firstImage = p.media.find(m => m.kind === "image");
      if (firstImage) {
        const img = el("img");
        img.src = firstImage.url;
        img.alt = "";
        thumb.append(img);
      } else {
        thumb.innerHTML = categoryIconSvg(p.category, 28);
      }
      tile.append(thumb, el("div", "lib-name", p.title || CATEGORY_LABELS[p.category]));
      tile.addEventListener("click", () => ctx.onSelect(p.id));
      grid.append(tile);
    });
    body.append(grid);
  }

  /* ----- Verlinkte Punkte: Vorschau + Begründung, Klick springt zum Punkt ----- */

  function renderLinked() {
    const list = el("div", "link-list");
    point.links.forEach(link => {
      const other = ctx.points.find(p => p.id === link.point_id);
      if (!other) return;
      const thumb = el("div", "link-thumb");
      const firstImage = other.media.find(m => m.kind === "image");
      if (firstImage) {
        const img = el("img");
        img.src = firstImage.url;
        img.alt = "";
        thumb.append(img);
      } else {
        thumb.innerHTML = categoryIconSvg(other.category, 32);
      }
      const info = el("div", "link-info");
      info.append(el("div", "label", CATEGORY_LABELS[other.category]), el("div", "link-name", other.title || CATEGORY_LABELS[other.category]));
      if (link.note) info.append(el("div", "link-note", link.note));
      info.append(el("div", "link-open", "Open →"));

      const card = el("button", "link-card");
      card.append(thumb, info);
      card.addEventListener("click", () => ctx.onSelect(other.id));
      list.append(card);
    });
    body.append(list);
  }

  /* ----- Aufbau ----- */

  function tabsFor(p) {
    const tabs = [{ id: "main", label: p.category === "commission" ? "Commission" : "Scan" }];
    if (p.links && p.links.length) tabs.push({ id: "linked", label: "Linked" });
    const hasWorkshop = p.workshop_count > 0 || !!p.item_comment;
    // Ein eingebundener Fundort zeigt die Werkstatt nur, wenn es dazu etwas gibt (unbearbeitete Fotos oder eigene Änderungen).
    if ((p.category === "lost_and_found" && (!p.shared || hasWorkshop)) || (p.category === "commission" && hasWorkshop)) {
      tabs.push({ id: "workshop", label: "Workshop" });
    }
    if (p.category === "scan") tabs.push({ id: "library", label: "Scan library" });
    return tabs;
  }

  function renderTabs() {
    tabsEl.innerHTML = "";
    const tabs = tabsFor(point);
    if (tabs.length < 2) return;
    tabs.forEach(tab => {
      const button = el("button", "tab" + (tab.id === activeTab ? " active" : ""), tab.label);
      button.addEventListener("click", () => {
        activeTab = tab.id;
        // Werkstatt, Bibliothek und Verlinkungen brauchen am Handy mehr Platz als die kleine Stellung.
        if (layoutMode() === "bottom") setExpanded(tab.id !== "main");
        render();
      });
      tabsEl.append(button);
    });
  }

  function renderFoot() {
    foot.innerHTML = "";
    const back = el("button", "btn", "Back to map");
    back.addEventListener("click", () => ctx.onBack());
    foot.append(back);

    if (point.category === "commission") {
      const explore = el("button", "btn primary", "Explore the trace →");
      explore.addEventListener("click", () => ctx.onExplore());
      foot.append(explore);
    } else if (ctx.next(point)) {
      const next = el("button", "btn primary", "Next →");
      next.addEventListener("click", () => ctx.onNext(point));
      foot.append(next);
    }
  }

  function render() {
    body.innerHTML = "";
    body.scrollTop = 0;
    renderTabs();
    renderFoot();
    if (activeTab === "workshop") renderWorkshop();
    else if (activeTab === "library") renderLibrary();
    else if (activeTab === "linked") renderLinked();
    else renderMain();
  }

  function open(nextPoint, nextCtx) {
    point = nextPoint;
    ctx = nextCtx;
    activeTab = "main";
    setExpanded(false);
    kicker.innerText = (CATEGORY_LABELS[point.category] || "") + " · Trace-ID " + traceIdOf(point);
    title.innerText = point.title || "";
    render();
    overlay.classList.add("open");
  }

  function close() {
    overlay.classList.remove("open");
    point = null;
    // Medien anhalten (Audio/Video laufen sonst hinter dem geschlossenen Fenster weiter).
    setTimeout(() => { if (!point) { body.innerHTML = ""; setExpanded(false); } }, 320);
  }

  document.getElementById("sheetClose").addEventListener("click", () => { if (ctx) ctx.onBack(); });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (lightbox.classList.contains("active")) closeLightbox();
    else if (point && ctx) ctx.onBack();
  });

  return { open, close, isOpen: () => !!point };
})();
