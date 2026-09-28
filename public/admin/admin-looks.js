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
        h("div", { class: "row-meta" }, CATEGORY_LABELS[point.category])),
      h("button", { class: "icon-btn", disabled: isStart || index === 0 || afterStart, onclick: (e) => { e.stopPropagation(); move(index, -1); } }, "↑"),
      h("button", { class: "icon-btn", disabled: isStart || index === points.length - 1, onclick: (e) => { e.stopPropagation(); move(index, 1); } }, "↓")));
  });
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
        lng, lat, sort_order: created.sort_order, media: [], links: [], workshop_count: 0,
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
      h("button", {
        class: "btn danger small",
        onclick: async () => {
          if (!confirm("Delete this look with all points and media?")) return;
          await api("/api/traces/" + trace.id, { method: "DELETE" });
          go(showLooks);
        },
      }, "Delete look"))
  );
}
