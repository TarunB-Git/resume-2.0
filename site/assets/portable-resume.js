(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResumePortable = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const escapeHtml = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const dataBlock = (value) =>
    JSON.stringify(value, null, 2)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  function base64(bytes) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const chunks = [];
    for (let start = 0; start < bytes.length; start += 12288) {
      let text = "";
      for (let i = start; i < Math.min(start + 12288, bytes.length); i += 3) {
        const a = bytes[i],
          b = bytes[i + 1],
          c = bytes[i + 2];
        const n = (a << 16) | ((b || 0) << 8) | (c || 0);
        text +=
          alphabet[(n >>> 18) & 63] +
          alphabet[(n >>> 12) & 63] +
          (b === undefined ? "=" : alphabet[(n >>> 6) & 63]) +
          (c === undefined ? "=" : alphabet[n & 63]);
      }
      chunks.push(text);
    }
    return chunks.join("");
  }
  function extract(html, kind = "json") {
    if (typeof html !== "string" || html.length > 50 * 1024 * 1024)
      throw new Error("Portable résumé exceeds the 50 MB reading limit.");
    if (!["source", "json"].includes(kind)) throw new Error("Choose json or source data.");
    const id = kind === "source" ? "resume20-source" : "resume-data";
    let result;
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const attrs = match[1];
      if (!new RegExp("(?:^|\\s)id\\s*=\\s*[\"']" + id + "[\"']", "i").test(attrs)) continue;
      if (!/(?:^|\s)type\s*=\s*["']application\/json["']/i.test(attrs))
        throw new Error("Résumé data must be an application/json block.");
      const value = JSON.parse(match[2]);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Résumé data must be a JSON object.");
      if (result) throw new Error("Duplicate " + id + " JSON blocks.");
      result = value;
    }
    if (result) return result;
    throw new Error("No " + id + " JSON block found.");
  }
  function linkedData(data) {
    const basics = data.basics || {},
      person = { "@context": "https://schema.org", "@type": "Person", name: basics.name || "" };
    for (const [key, value] of Object.entries({
      jobTitle: basics.label,
      email: basics.email,
      telephone: basics.phone,
      url: basics.url,
    }))
      if (value) person[key] = value;
    if (basics.location?.city)
      person.homeLocation = {
        "@type": "Place",
        name: [basics.location.city, basics.location.region, basics.location.countryCode]
          .filter(Boolean)
          .join(", "),
      };
    return person;
  }
  function viewer() {
    const $ = (selector) => document.querySelector(selector);
    const raw = $("#resume-data").textContent;
    const data = JSON.parse(raw),
      manifest = JSON.parse($("#resume-manifest").textContent);
    const frame = $("#human-frame");
    let pdfUrl;
    $("#json-content").textContent = JSON.stringify(data, null, 2);
    const pdf = () => {
      if (!pdfUrl) {
        const binary = atob($("#resume-pdf").textContent.trim()),
          bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        pdfUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      }
      return pdfUrl;
    };
    const show = (mode) => {
      if (!["human", "pdf", "json"].includes(mode)) mode = "human";
      document.querySelectorAll("[data-view]").forEach((node) => {
        node.hidden = node.dataset.view !== mode;
      });
      document.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-selected", String(button.dataset.mode === mode));
        button.tabIndex = button.dataset.mode === mode ? 0 : -1;
      });
      if (mode === "pdf" && !$("#pdf-frame").getAttribute("src")) $("#pdf-frame").src = pdf();
      try {
        history.replaceState(null, "", "#" + mode);
      } catch {}
    };
    document
      .querySelectorAll("[data-mode]")
      .forEach((button) => button.addEventListener("click", () => show(button.dataset.mode)));
    $("#view-tabs").addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...document.querySelectorAll("[data-mode]")];
      let i = buttons.indexOf(document.activeElement);
      i =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? 2
            : (i + (event.key === "ArrowRight" ? 1 : 2)) % 3;
      buttons[i].click();
      buttons[i].focus();
    });
    const download = (url, name) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
    };
    $("#download-json").addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json;charset=utf-8" }));
      download(url, manifest.filename + ".json");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $("#download-pdf").addEventListener("click", () => download(pdf(), manifest.filename + ".pdf"));
    $("#copy-json").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(raw);
        $("#copy-status").textContent = "JSON copied.";
      } catch {
        $("#copy-status").textContent = "Clipboard unavailable. Use Download JSON.";
      }
    });
    $("#print-resume").addEventListener("click", () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    });
    $("#reader-theme").addEventListener("change", (event) => {
      document.documentElement.dataset.theme = event.target.value;
    });
    addEventListener("beforeunload", () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    });
    show(location.hash.slice(1));
  }
  function build({ model, jsonResume, documentHtml, pdfBytes, filename = "resume" }) {
    if (
      !model ||
      !jsonResume ||
      typeof documentHtml !== "string" ||
      !(pdfBytes instanceof Uint8Array)
    )
      throw new Error("A portable résumé needs its source, JSON Resume data, HTML and PDF.");
    const title = model.basics?.name || "Résumé";
    const stem =
      String(filename)
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(0, 100) || "resume";
    const manifest = {
      format: "resume20.document",
      version: 1,
      filename: stem,
      data: {
        id: "resume-data",
        mediaType: "application/json",
        schema: "https://jsonresume.org/schema",
      },
      source: { id: "resume20-source", mediaType: "application/json" },
      presentation: {
        html: "human-frame",
        pdf: { id: "resume-pdf", mediaType: "application/pdf", encoding: "base64" },
      },
    };
    const human = documentHtml
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
      .replace(
        "</head>",
        "<style>@media screen and (max-width:600px){.resume-paper{width:100%;margin:0;padding:26px 22px}.resume-paper[data-template=executive]{display:block}.resume-aside,.resume-main{padding:24px}.resume-contact{flex-wrap:wrap;overflow-wrap:anywhere}}@media print{.resume-paper{margin:0}}</style></head>",
      );
    return `<!doctype html><html lang="en" data-theme="system"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src 'self' blob:; object-src blob:; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title)} — Résumé</title><style>
:root {
  color-scheme: light;
  --bg: #edf1f6;
  --panel: #fff;
  --text: #17212b;
  --line: #d9e0e8;
  --muted: #586575;
  --accent: #125fd1;
}
* {
  box-sizing: border-box;
}
body {
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr) auto;
  height: 100vh;
  height: 100dvh;
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font:
    14px/1.5 system-ui,
    sans-serif;
}
button,
select,
a {
  font: inherit;
}
button,
select {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  min-height: 44px;
  padding: 8px 12px;
  cursor: pointer;
}
button:hover {
  border-color: var(--accent);
}
button:focus-visible,
select:focus-visible,
a:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
header {
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
h1 {
  font-size: 17px;
  line-height: 1.2;
  margin: 0;
}
.identity {
  min-width: 0;
  overflow-wrap: anywhere;
  margin-right: auto;
}
.identity p {
  font-size: 12px;
  color: var(--muted);
  margin: 4px 0 0;
}
nav,
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
nav {
  background: var(--bg);
  padding: 3px;
  border-radius: 10px;
}
nav button {
  border-color: transparent;
  background: transparent;
}
nav [aria-selected="true"] {
  background: var(--panel);
  color: var(--accent);
  box-shadow: 0 1px 4px #0002;
}
main {
  min-width: 0;
  width: 100%;
  margin: 16px auto;
  max-width: 1180px;
  padding: 0 16px;
}
[data-view] {
  height: 100%;
  min-height: 360px;
}
[hidden] {
  display: none !important;
}
iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: white;
}
.json-view {
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: auto;
  background: var(--panel);
  padding: 20px;
}
.json-head {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.json-head p {
  margin: 0;
  color: var(--muted);
  flex: 1;
}
pre {
  font:
    12px/1.7 ui-monospace,
    Consolas,
    monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 20px 0;
}
footer {
  padding: 0 24px 12px;
  font-size: 12px;
  color: var(--muted);
}
.reader-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #171b22;
  --panel: #222833;
  --text: #e8edf5;
  --line: #414b5a;
  --muted: #b5c0d0;
  --accent: #90baff;
}
@media (prefers-color-scheme: dark) {
  html[data-theme="system"] {
    color-scheme: dark;
    --bg: #171b22;
    --panel: #222833;
    --text: #e8edf5;
    --line: #414b5a;
    --muted: #b5c0d0;
    --accent: #90baff;
  }
}
@media (max-width: 650px) {
  header {
    padding: 12px;
    gap: 10px;
  }
  .identity {
    width: 100%;
  }
  main {
    padding: 0 8px;
    margin: 8px auto;
  }
  .actions {
    gap: 4px;
  }
  button,
  select {
    padding: 8px;
  }
  .json-view {
    padding: 14px;
  }
  footer {
    padding: 8px 12px;
  }
}
@media print {
  header,
  footer,
  [data-view="pdf"],
  [data-view="json"] {
    display: none;
  }
  main {
    height: auto;
    margin: 0;
    padding: 0;
  }
  iframe {
    border: 0;
    height: 100vh;
  }
}
</style>
</head>
<body><header><div class="identity"><h1>${escapeHtml(title)}</h1><p>One résumé · human presentation and structured data</p></div><nav id="view-tabs" role="tablist" aria-label="Résumé view"><button id="human-tab" data-mode="human" role="tab" aria-controls="human-view" aria-selected="true">Human</button><button id="pdf-tab" data-mode="pdf" role="tab" aria-controls="pdf-view" aria-selected="false" tabindex="-1">PDF</button><button id="json-tab" data-mode="json" role="tab" aria-controls="json-view" aria-selected="false" tabindex="-1">JSON</button></nav><div class="actions"><label class="reader-label" for="reader-theme">Reader theme</label><select id="reader-theme" aria-label="Reader theme"><option value="system">System theme</option><option value="light">Light</option><option value="dark">Dark</option></select><button id="download-pdf">Download PDF</button><button id="download-json">Download JSON</button><button id="print-resume">Print</button></div></header>
<main><section id="human-view" data-view="human" role="tabpanel" aria-labelledby="human-tab"><iframe id="human-frame" title="Human-readable résumé" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals" srcdoc="${escapeHtml(human)}"></iframe></section><section id="pdf-view" data-view="pdf" role="tabpanel" aria-labelledby="pdf-tab" hidden><iframe id="pdf-frame" title="PDF résumé"></iframe><noscript>Download the PDF from the editor to view it separately.</noscript></section><section id="json-view" class="json-view" data-view="json" role="tabpanel" aria-labelledby="json-tab" hidden><div class="json-head"><p>JSON Resume data. Compatible readers can extract this directly; no OCR is needed.</p><button id="copy-json">Copy JSON</button><span id="copy-status" role="status"></span></div><pre id="json-content" tabindex="0" aria-label="Résumé JSON"></pre></section></main>
<footer>Works offline. Viewing this file does not send résumé content or analytics to a server.</footer>
<script type="application/json" id="resume-manifest">${dataBlock(manifest)}</script>
<script type="application/json" id="resume-data">${dataBlock(jsonResume)}</script>
<script type="application/json" id="resume20-source">${dataBlock(model)}</script>
<script type="application/ld+json" id="resume-person">${dataBlock(linkedData(jsonResume))}</script>
<script type="application/octet-stream" id="resume-pdf">${base64(pdfBytes)}</script>
<script>(${viewer.toString()})();</script></body></html>`;
  }
  return { build, extract, linkedData };
});
