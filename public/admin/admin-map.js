// Admin: Karte mit den Punkten des gerade bearbeiteten Looks.
const AdminMap = (() => {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  const map = new mapboxgl.Map({ container: "map", style: MAP_STYLE, center: [8.5417, 47.3769], zoom: 12 });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

  const markers = {};
  let placeHandler = null;

  function clear() {
    Object.values(markers).forEach(marker => marker.remove());
    Object.keys(markers).forEach(id => delete markers[id]);
  }

  // handlers: { onSelect(id), onMoved(id, lng, lat) }
  function show(points, handlers) {
    clear();
    points.forEach(point => {
      let dragged = false;
      const element = h("button", { class: "admin-pin" + (point.category === "commission" ? " start" : "") });
      element.innerHTML = categoryIconSvg(point.category, 18);
      element.addEventListener("click", () => { if (!dragged) handlers.onSelect(point.id); });
      const marker = new mapboxgl.Marker({ element, draggable: true }).setLngLat([point.lng, point.lat]).addTo(map);
      marker.on("dragstart", () => { dragged = true; });
      marker.on("dragend", () => {
        const position = marker.getLngLat();
        handlers.onMoved(point.id, position.lng, position.lat);
        setTimeout(() => { dragged = false; }, 50);
      });
      markers[point.id] = marker;
    });
  }

  function select(id) {
    Object.entries(markers).forEach(([markerId, marker]) =>
      marker.getElement().classList.toggle("selected", markerId === id));
  }

  function focus(points) {
    if (!points.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    points.forEach(p => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 460, right: 80 }, maxZoom: 16, duration: 800 });
  }

  function flyTo(lng, lat) {
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 700 });
  }

  // Der nächste Klick auf die Karte ruft callback(lng, lat) auf.
  function startPlacing(callback) {
    stopPlacing();
    placeHandler = (event) => { stopPlacing(); callback(event.lngLat.lng, event.lngLat.lat); };
    map.getCanvas().style.cursor = "crosshair";
    map.once("click", placeHandler);
  }
  function stopPlacing() {
    if (placeHandler) map.off("click", placeHandler);
    placeHandler = null;
    map.getCanvas().style.cursor = "";
  }

  return { show, clear, select, focus, flyTo, startPlacing, stopPlacing, isPlacing: () => !!placeHandler };
})();
