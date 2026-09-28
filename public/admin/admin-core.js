// Admin: kleine Helfer (DOM-Bau, Status, Upload).

// h("div", { class: "x", onclick: fn }, "Text", childNode, [weitere]) -> Element
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  children.flat().forEach(child => {
    if (child === null || child === undefined || child === false) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

const statusEl = document.getElementById("status");
function setStatus(text) { statusEl.innerText = text; }

// iPhone-Fotos kommen oft als HEIC/HEIF, das kein Browser anzeigt: vor dem Upload zu JPEG wandeln.
async function convertHeicIfNeeded(file) {
  const isHeic = /\.hei[cf]$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif";
  if (!isHeic) return file;
  setStatus("Converting HEIC photo …");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const jpeg = Array.isArray(converted) ? converted[0] : converted;
  return new File([jpeg], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
}

// Lädt eine Datei direkt nach R2 (bzw. lokal über den Worker) und gibt die öffentliche URL zurück.
async function uploadFile(file) {
  file = await convertHeicIfNeeded(file);
  const { uploadUrl, publicUrl } = await api("/api/upload-url", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: file.type ? { "Content-Type": file.type } : {},
    body: file,
  });
  if (!response.ok) throw new Error("Upload failed: " + response.status);
  return publicUrl;
}

// Mehrere Dateien nacheinander hochladen; callback(url, file) pro fertiger Datei.
async function uploadFiles(fileList, callback) {
  const files = [...fileList];
  for (let i = 0; i < files.length; i++) {
    setStatus("Uploading " + (i + 1) + " / " + files.length + " …");
    try {
      await callback(await uploadFile(files[i]), files[i]);
    } catch (error) {
      console.error(error);
      setStatus("Upload failed: " + error.message);
      return;
    }
  }
  setStatus("Done.");
}

// Ein beschriftetes Formularfeld.
function field(label, control) {
  return h("label", { class: "field" }, h("span", { class: "label" }, label), control);
}

function moveInArray(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return false;
  [list[index], list[target]] = [list[target], list[index]];
  return true;
}
