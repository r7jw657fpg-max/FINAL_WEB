// Admin: Tab "Site" — Intro-Text, Logo und Hintergrundbild der Landing Page.

async function saveSetting(key, value) {
  await api("/api/settings/" + key, { method: "PUT", body: JSON.stringify({ value }) });
  setStatus("Saved.");
}

// Bild-Einstellung mit Vorschau, Upload und Entfernen.
function imageSetting(label, key, settings) {
  const holder = h("div");
  function render() {
    holder.replaceChildren(
      settings[key] ? h("img", { class: "preview-img", src: settings[key], alt: "" }) : h("p", { class: "hint" }, "Nothing set."),
      h("input", {
        type: "file", accept: "image/*",
        onchange: async (event) => {
          await uploadFiles(event.target.files.length ? [event.target.files[0]] : [], async (url) => {
            settings[key] = url;
            await saveSetting(key, url);
          });
          render();
        },
      }),
      settings[key] ? h("button", {
        class: "btn small", style: "margin-top:8px",
        onclick: async () => { settings[key] = ""; await saveSetting(key, ""); render(); },
      }, "Remove") : null
    );
  }
  render();
  return h("section", { class: "section" }, h("div", { class: "section-title" }, h("span", { class: "label" }, label)), holder);
}

async function showSite() {
  AdminMap.stopPlacing();
  AdminMap.clear();
  const settings = await api("/api/settings");

  const intro = h("textarea", { value: settings.intro, style: "min-height:150px" });
  intro.addEventListener("change", () => saveSetting("intro", intro.value));

  return h("div", {},
    h("div", { class: "view-head" }, h("h2", { class: "view-title" }, "Site")),
    h("section", { class: "section" },
      field("Intro text (landing page header, English)", intro)),
    imageSetting("Logo (leave empty for the placeholder)", "logo_url", settings),
    imageSetting("Landing page background image", "background_url", settings)
  );
}
