// Admin: Werkstatt-Editor eines Punkts — Fotos per Ziehen frei auf einer Fläche platzieren.
// "raw" = unbearbeitete Pieces, "change" = Änderungen. Position als 0..1-Anteil, wie auf der Website.

function buildWorkshopCanvas(point, kind, label) {
  const wrap = h("div", { class: "section" });
  let entries = [];

  function startDrag(event, entry, node, canvas) {
    if (event.target.classList.contains("x")) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    function onMove(move) {
      entry.x = Math.max(0, Math.min(1, (move.clientX - rect.left) / rect.width));
      entry.y = Math.max(0, Math.min(1, (move.clientY - rect.top) / rect.height));
      node.style.left = (entry.x * 100) + "%";
      node.style.top = (entry.y * 100) + "%";
    }
    async function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      await api("/api/workshop/" + entry.id, { method: "PUT", body: JSON.stringify({ x: entry.x, y: entry.y }) });
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function render() {
    const canvas = h("div", { class: "ws-edit" });
    entries.forEach(entry => {
      const node = h("div", { class: "ws-photo", style: "left:" + entry.x * 100 + "%;top:" + entry.y * 100 + "%" },
        h("img", { src: entry.image_url, alt: "" }),
        h("div", {
          class: "x",
          onclick: async (event) => {
            event.stopPropagation();
            await api("/api/workshop/" + entry.id, { method: "DELETE" });
            entries = entries.filter(e => e.id !== entry.id);
            render();
          },
        }, "×"));
      node.addEventListener("pointerdown", (event) => startDrag(event, entry, node, canvas));
      canvas.append(node);
    });

    const captions = entries.map(entry => {
      const input = h("textarea", { value: entry.caption || "", style: "min-height:52px" });
      input.addEventListener("change", async () => {
        entry.caption = input.value;
        await api("/api/workshop/" + entry.id, { method: "PUT", body: JSON.stringify({ caption: entry.caption }) });
        setStatus("Saved.");
      });
      return h("div", { class: "row" }, h("div", { class: "thumb-box square" }, h("img", { src: entry.image_url, alt: "" })), h("div", { class: "grow" }, input));
    });

    wrap.replaceChildren(
      h("div", { class: "section-title" }, h("span", { class: "label" }, label)),
      h("p", { class: "hint" }, "Drag the photos to place them."),
      canvas,
      ...captions,
      h("input", {
        type: "file", accept: "image/*", multiple: true,
        onchange: async (event) => {
          await uploadFiles(event.target.files, async (url) => {
            const x = 0.25 + Math.random() * 0.5, y = 0.25 + Math.random() * 0.5;
            const created = await api("/api/points/" + point.id + "/workshop", {
              method: "POST", body: JSON.stringify({ kind, image_url: url, x, y }),
            });
            entries.push({ id: created.id, kind, image_url: url, caption: "", x, y });
          });
          render();
        },
      })
    );
  }

  api("/api/points/" + point.id + "/workshop")
    .then(all => { entries = all.filter(e => e.kind === kind); render(); })
    .catch(error => { console.error(error); wrap.innerText = "Could not load."; });
  return wrap;
}

function buildWorkshopEditor(point) {
  return h("div", {},
    buildWorkshopCanvas(point, "raw", "Workshop — unprocessed pieces"),
    buildWorkshopCanvas(point, "change", "Workshop — changes"));
}
