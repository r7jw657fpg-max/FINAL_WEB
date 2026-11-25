// Szene eines Looks: Foto mit Hotspots (Ebene 1), Piece-Netzwerk (Ebene 2), Detail-Panel (Ebene 3).
// Eine einzige DOM-Szene; die "Kamera" (data-cam 0/1/2) wechselt per CSS-Transition zwischen den Ebenen.
let W = null, raf = 0, until = 0;
const SVG = "http://www.w3.org/2000/svg";
const svgEl = tag => document.createElementNS(SVG, tag);
const isMobile = () => matchMedia("(max-width: 860px)").matches;
const hud = (left, right) => { document.getElementById("hudL").innerHTML = left; if (right !== undefined) document.getElementById("hudR").innerHTML = right; };
const go = hash => { location.hash = hash; };

/* Zielpositionen der Knoten: Kamera 0 = Spalten links/rechts neben dem Foto, Kamera 1/2 = Ring um das Look-Bild. */
function ringPositions(n) {
  return Array.from({ length: n }, (_, i) => { const a = Math.PI + i * 2 * Math.PI / n; return { x: 50 + 38 * Math.cos(a), y: 50 + 29 * Math.sin(a) }; });
}
function columnPositions(points, spots) {
  const order = points.map((p, i) => ({ i, hx: spots[p.id].x, hy: spots[p.id].y })).sort((a, b) => a.hy - b.hy);
  const left = order.filter(o => o.hx < 50), right = order.filter(o => o.hx >= 50), out = {};
  const place = (list, x) => list.forEach((o, k) => { out[o.i] = { x, y: list.length === 1 ? 50 : 16 + k * (68 / (list.length - 1)) }; });
  place(left, isMobile() ? 12 : 11); place(right, isMobile() ? 88 : 89);
  return out;
}

function buildScene() {
  const points = T.points, n = points.length;
  const spots = T.spots, cols = columnPositions(points, spots), ring = ringPositions(n);
  const root = el("section", "scene snap");

  // Kopf: Look-Titel, Ebenen-Schalter, Wechsel zu anderen Looks
  const head = el("div", "lh"), title = el("div", "", '<div class="code">' + esc(T.code) + (T.n ? " / " + pad(T.n) : "") + "</div><h1>" + esc(T.name) + "</h1>");
  const right = el("div", "right"), steps = el("div", "steps");
  [["1 Look", "#"], ["2 Pieces", "#net"], ["3 Detail", null]].forEach((s, i) => {
    const b = el("button", "", s[0]); b.dataset.c = i;
    b.onclick = () => go(s[1] || "#p/" + points[W.sel != null ? W.sel : 0].id);
    if (i === 2 && !n) b.disabled = true;
    steps.append(b);
  });
  right.append(steps);
  if (T.looks.length > 1) {
    const sw = el("div", "switch");
    T.looks.forEach((look, i) => { const b = el("button", look.id === T.trace.id ? "on" : "", pad(i + 1)); b.title = look.title; b.onclick = () => { location.href = "/trace/" + encodeURIComponent(look.id); }; sw.append(b); });
    right.append(sw);
  }
  head.append(title, right);

  // Welt: Ringe, Look-Foto mit Hotspots, Knoten
  const net = el("div", "net"), world = el("div", "world");
  world.insertAdjacentHTML("beforeend", '<svg class="rings" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="38" ry="29"/><ellipse cx="50" cy="50" rx="22" ry="17"/><ellipse cx="50" cy="50" rx="55" ry="42" opacity=".6"/></svg>');
  const wrap = el("div", "hero-wrap"); wrap.insertAdjacentHTML("beforeend", "<i></i><i></i><i></i><i></i>");
  const hero = el("button", "hero"); hero.setAttribute("aria-label", "Look");
  if (T.trace.look_image_url) { const im = el("img"); im.src = T.trace.look_image_url; im.alt = T.name; hero.append(im); }
  wrap.append(hero);
  const strands = svgEl("svg"); strands.setAttribute("class", "strands");
  const layer = el("div", "z2");

  const items = points.map((p, i) => {
    const org = p.category === "commission" ? " org" : "";
    const hs = el("button", "hs" + org); hs.style.left = spots[p.id].x + "%"; hs.style.top = spots[p.id].y + "%";
    hs.innerHTML = '<span class="tip">' + p.ref + " · " + esc(p.name) + "</span>"; hs.setAttribute("aria-label", p.name); wrap.append(hs);

    const nd = el("button", "nd" + org);
    nd.style.setProperty("--x0", cols[i].x + "%"); nd.style.setProperty("--y0", cols[i].y + "%");
    nd.style.setProperty("--x1", ring[i].x + "%"); nd.style.setProperty("--y1", ring[i].y + "%");
    const th = el("div", "nth"); th.append(thumbEl(p));
    const lab = el("div", "nlab", '<div class="ref">' + p.ref + (org ? '<span class="tag">Origin</span>' : "") + '</div><div class="nm">' + esc(p.name) + "</div>");

    // Satelliten: Sprungmarken zu Datenblatt, Prozess und Ort
    const sats = el("div", "sats"), out = Math.atan2(ring[i].y - 50, ring[i].x - 50), radius = isMobile() ? 38 : 66;
    [["spec", "SP", -.62], ["process", "PR", 0], ["loc", "GPS", .62]].forEach(([section, label, turn]) => {
      const a = out + turn, dx = Math.cos(a) * radius, dy = Math.sin(a) * radius;
      sats.insertAdjacentHTML("beforeend", '<svg><line x1="0" y1="0" x2="' + dx + '" y2="' + dy + '"/></svg>');
      const sb = el("button", "sat", label); sb.style.setProperty("--dx", dx + "px"); sb.style.setProperty("--dy", dy + "px"); sb.title = section;
      sb.onclick = e => { e.stopPropagation(); W.pendingSection = section; if (W.cam === 2 && W.sel === i) scrollToSection(section); else go("#p/" + p.id); };
      sats.append(sb);
    });
    nd.append(sats, th, lab); layer.append(nd);

    const g = svgEl("g"), base = svgEl("path"), pulse = svgEl("path");
    base.setAttribute("class", "base"); pulse.setAttribute("class", "pulse"); g.append(base, pulse); strands.append(g);
    return { p, hs, nd, th, g, base, pulse };
  });
  const links = T.links.map(link => { const path = svgEl("path"); path.setAttribute("class", "lnk"); strands.append(path); return { a: link.a.idx, b: link.b.idx, path }; });

  const centerLabel = el("div", "centerlbl code", esc(T.code) + " · Look");
  world.append(wrap, layer);
  const panel = el("aside", "panel");
  const cap = el("div", "cap l", n ? "Hover a hotspot — the strands light up" : "No pieces yet");
  net.append(world, strands, centerLabel, panel, cap);
  root.append(head, net);

  W = { root, net, world, wrap, hero, strands, items, links, panel, steps, cam: 0, sel: null, pendingSection: null, cap };

  // Hover und Klick: Strang leuchtet, Foto-Hotspot und Knoten gehören zusammen.
  const light = (i, on) => {
    items.forEach((it, k) => { const lit = on && k === i; it.g.classList.toggle("on", lit); it.hs.classList.toggle("on", lit); it.nd.classList.toggle("on", lit); });
    strands.classList.toggle("dimmed", on); kick();
  };
  items.forEach((it, i) => {
    const p = it.p;
    const over = () => { light(i, true); hud("<b>" + p.ref + "</b> &nbsp; " + esc(p.name) + (p.km != null ? " &nbsp; " + p.km.toFixed(1) + " km from origin" : " &nbsp; origin")); };
    const away = () => { light(i, false); camHud(); };
    [it.hs, it.nd].forEach(target => { target.onmouseenter = over; target.onmouseleave = away; target.onfocus = over; target.onblur = away; });
    it.hs.onclick = () => go("#p/" + p.id);
    it.nd.onclick = () => go("#p/" + p.id);
  });
  hero.onclick = () => { if (W.cam === 0) go("#net"); else if (W.cam === 1) go("#"); };
  wrap.onclick = e => { if (W.cam === 1 && e.target === wrap) go("#"); };
  new ResizeObserver(() => kick()).observe(net);
  return root;
}

/* ----- Kamera: 0 Look, 1 Netzwerk, 2 Piece ----- */
function camHud() {
  if (!W) return;
  const p = W.sel != null ? T.points[W.sel] : null;
  hud(
    W.cam === 0 ? "Layer 1 / 3 &nbsp;·&nbsp; the look and its hidden network" : W.cam === 1 ? "Layer 2 / 3 &nbsp;·&nbsp; the network of pieces" : (p ? "<b>" + p.ref + "</b> &nbsp; " + coord(p) : ""),
    W.cam === 0 ? "esc index &nbsp;·&nbsp; click a hotspot or the look" : W.cam === 1 ? "esc look &nbsp;·&nbsp; click a node or a satellite" : "esc network &nbsp;·&nbsp; ← → pieces"
  );
}
function camera(cam, sel, snap) {
  if (!W) return;
  const root = W.root;
  root.classList.toggle("snap", !!snap);
  W.cam = cam; root.dataset.cam = cam;
  if (cam === 2 && sel != null) { W.sel = sel; fillPanel(T.points[sel]); }
  W.items.forEach((it, i) => { const on = cam === 2 && i === W.sel; it.nd.classList.toggle("sel", on); it.g.classList.toggle("sel", on); });
  [...W.steps.children].forEach(b => b.classList.toggle("on", +b.dataset.c === cam));
  W.cap.style.visibility = cam === 0 ? "visible" : "hidden";
  crumbs(); camHud(); kick(snap ? 80 : 1500);
  if (snap) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("snap")));
}
function crumbs() {
  const c = document.getElementById("crumbs"); c.innerHTML = "";
  const add = (text, href, current) => { if (c.children.length) c.append(el("span", "", "/")); const a = el(href ? "a" : "span", current ? "cur" : "", text); if (href) a.href = href; c.append(a); };
  add("Index", "/");
  add(T.n ? "L" + pad(T.n) : T.code, "#", W.cam === 0);
  if (W.cam >= 1) add("Pieces", "#net", W.cam === 1);
  if (W.cam === 2 && W.sel != null) add(T.points[W.sel].ref, null, true);
}

/* ----- Stränge folgen den Elementen, solange etwas in Bewegung ist ----- */
function kick(ms = 1400) { until = Math.max(until, performance.now() + ms); if (!raf) raf = requestAnimationFrame(loop); }
function loop() { raf = 0; tick(); if (performance.now() < until) raf = requestAnimationFrame(loop); }
function tick() {
  if (!W || !W.net.isConnected) return;
  const nr = W.net.getBoundingClientRect();
  W.strands.setAttribute("viewBox", "0 0 " + nr.width + " " + nr.height);
  const centre = node => { const r = node.getBoundingClientRect(); return [r.left + r.width / 2 - nr.left, r.top + r.height / 2 - nr.top]; };
  W.items.forEach(it => {
    const [sx, sy] = centre(it.hs), [ex, ey] = centre(it.th), dx = ex - sx;
    const d = "M" + sx + "," + sy + " C" + (sx + dx * .5) + "," + sy + " " + (ex - dx * .5) + "," + ey + " " + ex + "," + ey;
    it.base.setAttribute("d", d); it.pulse.setAttribute("d", d);
  });
  W.links.forEach(link => {
    const [ax, ay] = centre(W.items[link.a].th), [bx, by] = centre(W.items[link.b].th);
    const cx = (ax + bx) / 2 * .6 + nr.width / 2 * .4, cy = (ay + by) / 2 * .6 + nr.height / 2 * .4;
    link.path.setAttribute("d", "M" + ax + "," + ay + " Q" + cx + "," + cy + " " + bx + "," + by);
  });
}
