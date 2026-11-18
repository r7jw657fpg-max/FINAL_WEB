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

// Handy-Fotos (3–6 MB, 4000 px) vor dem Upload auf max. 2400 px verkleinern: Besucher laden sie auf dem
// Smartphone sonst über Mobilfunk. 2400 px reichen auch für die 3×-Lupe. Nur JPEG; PNG (Logos) bleibt unberührt.
async function downscaleIfLarge(file) {
  if (file.type !== "image/jpeg" || file.size < 1200000) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: "image/jpeg" });
  } catch (error) {
    console.warn("Verkleinern nicht möglich, Original wird hochgeladen:", error);
    return file;
  }
}

// Lädt eine Datei direkt nach R2 (bzw. lokal über den Worker) und gibt die öffentliche URL zurück.
async function uploadFile(file) {
  file = await convertHeicIfNeeded(file);
  file = await downscaleIfLarge(file);
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
