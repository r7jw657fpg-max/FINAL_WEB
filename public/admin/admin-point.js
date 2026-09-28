// Admin: Editor für einen Punkt (Kategorie, Texte, Medien, Werkstatt).

function pointPayload(point) {
  return {
    category: point.category, title: point.title, text: point.text, item_comment: point.item_comment,
    lng: point.lng, lat: point.lat,
  };
}

// Speichert Änderungen; bei einem Fehler (z.B. zweite Commission) wird zurückgesetzt.
async function savePoint(point, patch) {
  const before = { ...point };
  Object.assign(point, patch);
  try {
    await api("/api/points/" + point.id, { method: "PUT", body: JSON.stringify(pointPayload(point)) });
    setStatus("Saved.");
    return true;
  } catch (error) {
    Object.assign(point, before);
    setStatus(error.message);
    alert(error.message);
    return false;
  }
}

function buildMediaList(point) {
  const holder = h("div");

  async function persistOrder() {
    await api("/api/points/" + point.id + "/media/reorder", {
      method: "POST", body: JSON.stringify({ ids: point.media.map(m => m.id) }),
    });
  }

  function render() {
    const rows = point.media.map((item, index) => {
      const caption = h("input", { type: "text", value: item.caption || "", placeholder: "Caption (optional)" });
      caption.addEventListener("change", async () => {
        item.caption = caption.value;
        await api("/api/media/" + item.id, { method: "PUT", body: JSON.stringify({ caption: item.caption }) });
        setStatus("Saved.");
      });
      const move = async (delta) => { if (moveInArray(point.media, index, delta)) { await persistOrder(); render(); } };
      return h("div", { class: "row" },
        h("div", { class: "thumb-box square" }, item.kind === "image" ? h("img", { src: item.url, alt: "" }) : item.kind.toUpperCase()),
        h("div", { class: "grow" }, caption),
        h("button", { class: "icon-btn", disabled: index === 0, onclick: () => move(-1) }, "↑"),
        h("button", { class: "icon-btn", disabled: index === point.media.length - 1, onclick: () => move(1) }, "↓"),
        h("button", {
          class: "icon-btn",
          onclick: async () => {
            if (!confirm("Remove this media?")) return;
            await api("/api/media/" + item.id, { method: "DELETE" });
            point.media = point.media.filter(m => m.id !== item.id);
            render();
          },
        }, "×"));
    });

    holder.replaceChildren(
      ...rows,
      h("input", {
        type: "file", accept: "image/*,video/*,audio/*,.glb,.gltf", multiple: true,
        onchange: async (event) => {
          await uploadFiles(event.target.files, async (url, file) => {
            const kind = mediaKindFromFile(file);
            const created = await api("/api/points/" + point.id + "/media", {
              method: "POST", body: JSON.stringify({ kind, url }),
            });
            point.media.push({ id: created.id, point_id: point.id, kind, url, caption: "" });
          });
          render();
        },
      })
    );
  }
  render();
  return holder;
}

// Verlinkungen: ein Eintrag gilt für beide Punkte, die Begründung wird an beiden angezeigt.
function buildLinkEditor(point) {
  const holder = h("div");

  function otherPoint(link) { return app.trace.points.find(p => p.id === link.point_id); }
  // Den Link im lokalen Zustand beider Punkte nachführen.
  function forBothSides(link, fn) {
    [point, otherPoint(link)].forEach(p => { if (p) p.links.filter(l => l.id === link.id).forEach(fn); });
  }

  function render() {
    const linkedIds = point.links.map(l => l.point_id);
    const available = app.trace.points.filter(p => p.id !== point.id && !linkedIds.includes(p.id));

    const rows = point.links.map(link => {
      const other = otherPoint(link);
      const firstImage = other && other.media.find(m => m.kind === "image");
      const note = h("textarea", { value: link.note, placeholder: "Why are these two linked? (shown on both points)", style: "min-height:64px" });
      note.addEventListener("change", async () => {
        await api("/api/links/" + link.id, { method: "PUT", body: JSON.stringify({ note: note.value }) });
        forBothSides(link, l => { l.note = note.value; });
        setStatus("Saved.");
      });
      return h("div", { class: "row" },
        h("div", { class: "thumb-box square" }, firstImage ? h("img", { src: firstImage.url, alt: "" }) : (other ? CATEGORY_LABELS[other.category] : "?")),
        h("div", { class: "grow" },
          h("div", { class: "row-title" }, other ? (other.title || CATEGORY_LABELS[other.category]) : "Removed point"),
          note),
        h("button", {
          class: "icon-btn",
          onclick: async () => {
            if (!confirm("Remove this link?")) return;
            await api("/api/links/" + link.id, { method: "DELETE" });
            [point, other].forEach(p => { if (p) p.links = p.links.filter(l => l.id !== link.id); });
            render();
          },
        }, "×"));
    });

    const select = h("select", {},
      available.map(p => h("option", { value: p.id }, (p.title || "Untitled") + " — " + CATEGORY_LABELS[p.category])));
    const add = h("button", {
      class: "btn small",
      onclick: async () => {
        const created = await api("/api/points/" + point.id + "/links", {
          method: "POST", body: JSON.stringify({ target_id: select.value, note: "" }),
        });
        const other = app.trace.points.find(p => p.id === select.value);
        point.links.push({ id: created.id, point_id: other.id, note: "" });
        other.links.push({ id: created.id, point_id: point.id, note: "" });
        render();
      },
    }, "Link");

    holder.replaceChildren(
      ...rows,
      available.length
        ? h("div", { class: "row" }, h("div", { class: "grow" }, select), add)
        : h("p", { class: "hint" }, app.trace.points.length > 1 ? "All other points are already linked." : "Add more points to link them."));
  }
  render();
  return holder;
}

function showPoint(pointId) {
  const point = app.trace.points.find(p => p.id === pointId);
  AdminMap.select(pointId);
  AdminMap.flyTo(point.lng, point.lat);

  const commissionElsewhere = app.trace.points.some(p => p.category === "commission" && p.id !== point.id);
  const category = h("select", {},
    Object.keys(CATEGORY_LABELS).map(key => h("option", {
      value: key, selected: key === point.category, disabled: key === "commission" && commissionElsewhere,
    }, CATEGORY_LABELS[key] + (key === "commission" ? " (start point, only one)" : ""))));
  category.addEventListener("change", async () => {
    if (await savePoint(point, { category: category.value })) { refreshTraceMap(); go(showPoint, pointId); }
    else category.value = point.category;
  });

  const title = h("input", { type: "text", value: point.title });
  title.addEventListener("change", () => savePoint(point, { title: title.value }));
  const text = h("textarea", { value: point.text, style: "min-height:120px" });
  text.addEventListener("change", () => savePoint(point, { text: text.value }));
  const comment = h("textarea", { value: point.item_comment });
  comment.addEventListener("change", () => savePoint(point, { item_comment: comment.value }));

  const hasWorkshop = point.category === "lost_and_found" || point.category === "commission";
  return h("div", {},
    h("button", { class: "link-back", onclick: () => go(showTrace, app.trace.id) }, "← " + app.trace.title),
    h("div", { class: "view-head" }, h("h2", { class: "view-title" }, point.title || CATEGORY_LABELS[point.category])),
    h("section", { class: "section" },
      field("Type", category),
      field("Title", title),
      field("Text", text),
      h("div", { class: "coords" }, "GPS: " + point.lat.toFixed(6) + ", " + point.lng.toFixed(6) + " — drag the marker on the map to move it.")),
    h("section", { class: "section" },
      h("div", { class: "section-title" }, h("span", { class: "label" }, "Media (images, video, 3D .glb, audio)")),
      buildMediaList(point)),
    h("section", { class: "section" },
      h("div", { class: "section-title" }, h("span", { class: "label" }, "Linked points")),
      h("p", { class: "hint" }, "E.g. a Lost & Found piece used to repair a commission piece. The link shows on both points."),
      buildLinkEditor(point)),
    hasWorkshop ? h("section", { class: "section" },
      field("Workshop comment", comment),
      buildWorkshopEditor(point)) : null,
    h("section", { class: "section" },
      h("button", {
        class: "btn danger small",
        onclick: async () => {
          if (!confirm("Delete this point with all its media?")) return;
          await api("/api/points/" + point.id, { method: "DELETE" });
          app.trace.points = app.trace.points.filter(p => p.id !== point.id);
          refreshTraceMap();
          go(showTrace, app.trace.id);
        },
      }, "Delete point"))
  );
}
