// Admin: Tab "Looks" — Liste aller Looks und der Editor für einen Look mit seinen Punkten.
const app = { traces: [], trace: null, pointId: null };

function refreshTraceMap() {
  AdminMap.show(app.trace.points, {
    onSelect: (id) => go(showPoint, id),
    onMoved: async (id, lng, lat) => {
      const point = app.trace.points.find(p => p.id === id);
      await savePoint(point, { lng, lat });
      if (app.pointId === id) go(showPoint, id);
    },
  });
  if (app.pointId) AdminMap.select(app.pointId);
}

async function showLooks() {
  app.trace = null;
  AdminMap.clear();
  app.traces = await api("/api/traces?all=1");

  async function move(index, delta) {
    if (!moveInArray(app.traces, index, delta)) return;
    await api("/api/traces/reorder", { method: "POST", body: JSON.stringify({ ids: app.traces.map(t => t.id) }) });
    go(showLooks);
  }

  const rows = app.traces.map((trace, index) => h("div", { class: "row clickable", onclick: () => go(showTrace, trace.id) },
    h("div", { class: "thumb-box" }, trace.look_image_url ? h("img", { src: trace.look_image_url, alt: "" }) : "no image"),
    h("div", { class: "grow" },
      h("div", { class: "row-title" }, trace.title || "Untitled"),
      h("div", { class: "row-meta" }, trace.visible ? "Visible" : "Hidden")),
    h("button", { class: "icon-btn", disabled: index === 0, onclick: (e) => { e.stopPropagation(); move(index, -1); } }, "↑"),
    h("button", { class: "icon-btn", disabled: index === app.traces.length - 1, onclick: (e) => { e.stopPropagation(); move(index, 1); } }, "↓")));

  return h("div", {},
    h("div", { class: "view-head" },
      h("h2", { class: "view-title" }, "Looks"),
      h("button", {
        class: "btn small",
        onclick: async () => {
          const title = prompt("Title of the new look?");
          if (!title) return;
          const { id } = await api("/api/traces", { method: "POST", body: JSON.stringify({ title }) });
          go(showTrace, id);
        },
      }, "+ New look")),
    h("p", { class: "hint" }, "The website shows up to 10 looks in this order. New looks stay hidden until you switch them to visible."),
    rows.length ? rows : h("p", { class: "hint" }, "No looks yet.")
  );
}

// Kurzer Hinweis in der Punktliste: eingebundener Fundort bzw. in welchen Looks der Punkt sonst vorkommt.
function pointUsageNote(point) {
  if (point.shared) return " · from " + (point.home_title || "another look");
  if (point.shared_in && point.shared_in.length) return " · also in " + point.shared_in.map(s => s.title).join(", ");
  return "";
}

// Fundorte aus anderen Looks, die hier zusätzlich eingebunden werden können (derselbe Punkt, kein Duplikat).
function buildSharedPicker(trace) {
  const holder = h("div", {}, h("p", { class: "hint" }, "Loading …"));
  api("/api/shareable?trace_id=" + encodeURIComponent(trace.id)).then(list => {
    if (!list.length) {
      holder.replaceChildren(h("p", { class: "hint" }, "No Lost & Found points from other looks available yet."));
      return;
    }
    holder.replaceChildren(...list.map(item => h("div", { class: "row" },
      h("div", { class: "thumb-box square" }, item.thumb ? h("img", { src: item.thumb, alt: "" }) : "L&F"),
      h("div", { class: "grow" },
        h("div", { class: "row-title" }, item.title || "Untitled"),
        h("div", { class: "row-meta" }, "From " + item.home_title)),
      h("button", {
        class: "btn small",
        onclick: async () => {
          await api("/api/traces/" + trace.id + "/shared", { method: "POST", body: JSON.stringify({ point_id: item.id }) });
          setStatus("Point added to this look.");
          go(showTrace, trace.id);
        },
      }, "Add"))));
  }).catch(error => { console.error(error); holder.replaceChildren(h("p", { class: "hint" }, "Could not load.")); });
  return holder;
}

function buildPointList() {
  const points = app.trace.points;
  const holder = h("div");

  async function move(index, delta) {
    if (!moveInArray(points, index, delta)) return;
    await api("/api/traces/" + app.trace.id + "/points/reorder", {
      method: "POST", body: JSON.stringify({ ids: points.map(p => p.id) }),
    });
    go(showTrace, app.trace.id);
  }

  points.forEach((point, index) => {
    const isStart = point.category === "commission";
    const afterStart = index === 1 && points[0].category === "commission";
    holder.append(h("div", { class: "row clickable", onclick: () => go(showPoint, point.id) },
      h("div", { class: "num" }, index + 1),
      h("div", { class: "grow" },
        h("div", { class: "row-title" }, point.title || "Untitled"),
        h("div", { class: "row-meta" }, CATEGORY_LABELS[point.category] + pointUsageNote(point))),
      h("button", { class: "icon-btn", disabled: isStart || index === 0 || afterStart, onclick: (e) => { e.stopPropagation(); move(index, -1); } }, "↑"),
      h("button", { class: "icon-btn", disabled: isStart || index === points.length - 1, onclick: (e) => { e.stopPropagation(); move(index, 1); } }, "↓")));
  });
  return holder;
}

// Hotspots: Punkte auf dem Look-Foto, von denen die Website die Stränge zu den Pieces zieht.
// Auto-place setzt sie nach Körperzone, danach lassen sie sich per Ziehen feinjustieren.
function buildHotspotEditor(trace) {
  const holder = h("div");
  if (!trace.look_image_url) { holder.append(h("p", { class: "hint" }, "Upload the look photo first.")); return holder; }
  if (!trace.points.length) { holder.append(h("p", { class: "hint" }, "Add points first — each one gets a hotspot.")); return holder; }

  const auto = autoSpots(trace.points);
  const spots = {};
  trace.points.forEach(p => { spots[p.id] = p.hotspot ? { x: p.hotspot.x, y: p.hotspot.y } : auto[p.id]; });
  let dirty = !trace.points.every(p => p.hotspot);

  const stage = h("div", { class: "hs-stage" }, h("img", { src: trace.look_image_url, alt: "", draggable: false }));
  const dots = trace.points.map((p, i) => {
    const dot = h("button", { class: "hs-dot" + (p.category === "commission" ? " org" : ""), title: p.title || CATEGORY_LABELS[p.category], type: "button" }, String(i + 1));
    const place = () => { dot.style.left = spots[p.id].x + "%"; dot.style.top = spots[p.id].y + "%"; };
    place();
    dot.addEventListener("pointerdown", (event) => {
      dot.setPointerCapture(event.pointerId); event.preventDefault();
      const move = (e) => {
        const rect = stage.getBoundingClientRect();
        spots[p.id] = { x: Math.max(2, Math.min(98, (e.clientX - rect.left) / rect.width * 100)), y: Math.max(2, Math.min(98, (e.clientY - rect.top) / rect.height * 100)) };
        place(); mark();
      };
      const stop = () => { dot.removeEventListener("pointermove", move); dot.removeEventListener("pointerup", stop); dot.removeEventListener("pointercancel", stop); };
      dot.addEventListener("pointermove", move); dot.addEventListener("pointerup", stop); dot.addEventListener("pointercancel", stop);
    });
    stage.append(dot);
    return { place };
  });

  const status = h("span", { class: "hint" });
  const save = h("button", { class: "btn small", type: "button" }, "Save hotspots");
  const mark = () => { dirty = true; save.classList.add("armed"); status.innerText = "Unsaved changes."; };
  const autoButton = h("button", { class: "btn small", type: "button", onclick: () => { Object.assign(spots, autoSpots(trace.points)); dots.forEach(d => d.place()); mark(); } }, "Auto-place by body zone");
  save.addEventListener("click", async () => {
    try {
      await api("/api/traces/" + trace.id + "/hotspots", { method: "PUT", body: JSON.stringify({ spots }) });
      trace.points.forEach(p => { p.hotspot = { ...spots[p.id] }; });
      dirty = false; save.classList.remove("armed"); status.innerText = ""; setStatus("Hotspots saved.");
    } catch (error) { setStatus(error.message); alert(error.message); }
  });
  if (dirty) { save.classList.add("armed"); status.innerText = "Suggested positions — adjust and save."; }

  holder.append(
    h("p", { class: "hint" }, "Drag each numbered dot onto its piece in the photo. Without saved positions the website places them by body zone."),
    stage, h("div", { class: "hs-actions" }, autoButton, save, status));
  return holder;
}

async function showTrace(id) {
  app.trace = await api("/api/traces/" + encodeURIComponent(id) + "?admin=1");
  const trace = app.trace;
  refreshTraceMap();
  AdminMap.focus(trace.points);

  const title = h("input", { type: "text", value: trace.title });
  title.addEventListener("change", async () => {
    trace.title = title.value;
    await api("/api/traces/" + trace.id, { method: "PUT", body: JSON.stringify({ title: trace.title }) });
    setStatus("Saved.");
  });
  const visible = h("input", { type: "checkbox", checked: !!trace.visible });
  visible.addEventListener("change", async () => {
    trace.visible = visible.checked ? 1 : 0;
    await api("/api/traces/" + trace.id, { method: "PUT", body: JSON.stringify({ visible: visible.checked }) });
    setStatus(visible.checked ? "Look is visible on the website." : "Look is hidden.");
  });

  const imageHolder = h("div");
  function renderImage() {
    imageHolder.replaceChildren(
      trace.look_image_url ? h("img", { class: "preview-img", src: trace.look_image_url, alt: "" }) : h("p", { class: "hint" }, "No look photo yet (high resolution — the website magnifies it 3×)."),
      h("input", {
        type: "file", accept: "image/*",
        onchange: async (event) => {
          await uploadFiles(event.target.files.length ? [event.target.files[0]] : [], async (url) => {
            trace.look_image_url = url;
            await api("/api/traces/" + trace.id, { method: "PUT", body: JSON.stringify({ look_image_url: url }) });
          });
          renderImage();
        },
      }));
  }
  renderImage();

  const hasStart = trace.points.some(p => p.category === "commission");
  const placeButton = h("button", { class: "btn small" }, "+ Place point");
  placeButton.addEventListener("click", () => {
    if (AdminMap.isPlacing()) {
      AdminMap.stopPlacing();
      placeButton.classList.remove("armed");
      placeButton.innerText = "+ Place point";
      return;
    }
    placeButton.classList.add("armed");
    placeButton.innerText = "Click on the map … (cancel)";
    AdminMap.startPlacing(async (lng, lat) => {
      const category = trace.points.some(p => p.category === "commission") ? "lost_and_found" : "commission";
      const created = await api("/api/traces/" + trace.id + "/points", {
        method: "POST", body: JSON.stringify({ category, lng, lat }),
      });
      trace.points.push({
        id: created.id, trace_id: trace.id, category, title: "", text: "", item_comment: "",
        lng, lat, sort_order: created.sort_order, media: [], links: [], workshop_count: 0, shared: false, shared_in: [],
      });
      refreshTraceMap();
      go(showPoint, created.id);
    });
  });

  return h("div", {},
    h("button", { class: "link-back", onclick: () => go(showLooks) }, "← All looks"),
    h("div", { class: "view-head" },
      h("h2", { class: "view-title" }, trace.title || "Untitled"),
      h("a", { class: "btn small", href: "/trace/" + encodeURIComponent(trace.id) + "?preview", target: "_blank" }, "Preview ↗")),
    h("section", { class: "section" },
      field("Title", title),
      h("label", { class: "check" }, visible, "Visible on the website"),
      h("span", { class: "label" }, "Look photo"),
      imageHolder),
    h("section", { class: "section" },
      h("div", { class: "section-title" }, h("span", { class: "label" }, "Points"), placeButton),
      h("p", { class: "hint" }, hasStart
        ? "Click “Place point”, then click the map. Drag markers to move them."
        : "Start with the commission: click “Place point”, then click the map where the trace begins."),
      buildPointList()),
    h("section", { class: "section" },
      h("div", { class: "section-title" }, h("span", { class: "label" }, "Hotspots on the look photo")),
      buildHotspotEditor(trace)),
    h("section", { class: "section" },
      h("div", { class: "section-title" }, h("span", { class: "label" }, "Use an existing Lost & Found point")),
      h("p", { class: "hint" }, "Use a find location from another look here too. It is the same point: edits apply in every look that uses it."),
      buildSharedPicker(trace)),
    h("section", { class: "section" },
      h("button", {
        class: "btn danger small",
        onclick: async () => {
          const elsewhere = [...new Set(trace.points.flatMap(p => p.shared_in || []).map(s => s.title))];
          const warning = elsewhere.length ? "\n\nPoints of this look are also used in: " + elsewhere.join(", ") + ". They will disappear there too." : "";
          if (!confirm("Delete this look with all its own points and media?" + warning)) return;
          await api("/api/traces/" + trace.id, { method: "DELETE" });
          go(showLooks);
        },
      }, "Delete look"))
  );
}
