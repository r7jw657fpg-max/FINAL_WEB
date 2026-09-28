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

  const workshopCache = {};
  let point = null;
  let ctx = null;
  let activeTab = "main";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.innerText = text;
    return node;
  }

  function openLightbox(url) {
    lightboxImage.src = url;
    lightbox.classList.add("active");
  }
  function closeLightbox() {
    lightbox.classList.remove("active");
    lightboxImage.removeAttribute("src");
  }
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });

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
    const canvas = el("div", "ws-canvas");
    if (!entries.length) canvas.append(el("div", "ws-empty", "Nothing here yet."));
    entries.forEach(entry => {
      const item = el("div", "ws-item");
      item.style.left = (entry.x * 100) + "%";
      item.style.top = (entry.y * 100) + "%";
      const img = el("img");
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
      if (!workshopCache[requested.id]) workshopCache[requested.id] = await api("/api/points/" + requested.id + "/workshop");
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
    if (p.category === "lost_and_found" || (p.category === "commission" && hasWorkshop)) {
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
      button.addEventListener("click", () => { activeTab = tab.id; render(); });
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
    kicker.innerText = CATEGORY_LABELS[point.category] || "";
    title.innerText = point.title || "";
    render();
    overlay.classList.add("open");
  }

  function close() {
    overlay.classList.remove("open");
    point = null;
    // Medien anhalten (Audio/Video laufen sonst hinter dem geschlossenen Fenster weiter).
    setTimeout(() => { if (!point) body.innerHTML = ""; }, 320);
  }

  document.getElementById("sheetClose").addEventListener("click", () => { if (ctx) ctx.onBack(); });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (lightbox.classList.contains("active")) closeLightbox();
    else if (point && ctx) ctx.onBack();
  });

  return { open, close, isOpen: () => !!point };
})();
