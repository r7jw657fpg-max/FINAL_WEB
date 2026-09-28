// Admin: Navigation zwischen den Ansichten (Looks, Look-Editor, Punkt-Editor, Site).

// Baut eine Ansicht (Funktion, die ein Element liefert) und zeigt sie in der Seitenleiste.
async function go(viewFn, ...args) {
  AdminMap.stopPlacing();
  app.pointId = viewFn === showPoint ? args[0] : null;
  try {
    const node = await viewFn(...args);
    document.getElementById("view").replaceChildren(node);
    document.querySelectorAll(".side-tab").forEach(tab =>
      tab.classList.toggle("active", tab.dataset.tab === (viewFn === showSite ? "site" : "looks")));
  } catch (error) {
    console.error(error);
    setStatus("Error: " + error.message);
  }
}

document.querySelectorAll(".side-tab").forEach(tab =>
  tab.addEventListener("click", () => go(tab.dataset.tab === "site" ? showSite : showLooks)));

go(showLooks);
