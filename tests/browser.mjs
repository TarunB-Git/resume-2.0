import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { createServer } from "../scripts/serve.mjs";
const root = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });
const server = createServer(0);
await new Promise((resolve) => (server.listening ? resolve() : server.once("listening", resolve)));
const origin = "http://127.0.0.1:" + server.address().port;
const results = [];
async function checkViewport(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: 905 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.waitForSelector("#previewPages");
  assert.equal(await page.title(), "Résumé 2.0");
  assert.equal(await page.evaluate(() => resume.basics.name), "Tarun B");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "No viewport overflow",
  );
  const workspaceBounds = await page.locator(".workspace-content").boundingBox();
  assert.ok(
    workspaceBounds.y + workspaceBounds.height <= 905.5,
    "Workspace fits the visible height",
  );
  const headerOrder = await page
    .locator(".compile-actions")
    .evaluate((node) => [...node.children].map((child) => child.getBoundingClientRect().left));
  assert.ok(
    headerOrder[0] < headerOrder[1] && headerOrder[1] < headerOrder[2],
    "Compile, help, bug order",
  );
  for (const id of ["compileButton", "headerImportButton", "exportButton"]) {
    const bounds = await page.locator("#" + id).boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, id + " fits");
    if (width <= 900) assert.ok(bounds.height >= 44 && bounds.width >= 44, id + " touch target");
  }
  if (width <= 900) {
    await page.click("#mobileFilesButton");
    assert.equal(
      await page.locator(".main").evaluate((node) => node.classList.contains("files-hidden")),
      false,
    );
    await page.click("#sidebarCollapseButton");
    await page.click("#mobileSourceButton");
  } else {
    await page.click("#sidebarCollapseButton");
    assert.ok(await page.locator("#panelOutput").isVisible());
    await page.click("#sidebarCollapseButton");
  }
  const before = await page.evaluate(() => JSON.stringify(resume));
  for (let n = 0; n < 3; n++)
    for (const mode of ["markdown", "latex", "xml", "json"]) {
      await page.locator('.pane:visible [data-input="' + mode + '"]').click();
      assert.equal(
        await page.evaluate(() => JSON.stringify(resume)),
        before,
        "Mode switch is read-only",
      );
    }
  await page.locator('#panelJson [data-input="xml"]').click();
  const xml = await page.inputValue("#xmlEditor");
  await page.fill("#xmlEditor", xml.replace("Tarun B", "Tarun B edited"));
  assert.equal(await page.evaluate(() => resume.basics.name), "Tarun B edited");
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await page.evaluate(() => resume.basics.name), "Tarun B");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  assert.equal(await page.evaluate(() => resume.basics.name), "Tarun B edited");
  await page.fill("#xmlEditor", "<resume");
  await page.reload();
  await page.waitForSelector("#previewPages");
  if (width <= 900) await page.click("#mobileSourceButton");
  assert.equal(await page.inputValue("#xmlEditor"), "<resume", "Invalid source survives reload");
  assert.equal(
    await page.evaluate(() => resume.basics.name),
    "Tarun B edited",
    "Last valid preview survives",
  );
  await page.fill("#xmlEditor", xml);
  await page.locator('#panelXml [data-input="json"]').click();
  if (width <= 900) await page.click("#mobileDocumentButton");
  await page.locator('[data-mode="word"]').click();
  await page.waitForSelector("#wordEditor");
  await page.locator("#wordEditor").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("An editable line.");
  await page.locator('[data-mode="pdf"]').click();
  assert.ok(await page.evaluate(() => resume.layout?.richDocument?.includes("An editable line.")));
  const previousZoom = await page
    .locator("#previewPages")
    .evaluate((node) => Number(node.dataset.displayScale));
  const paperBefore = await page
    .locator(".preview-pages .resume-paper")
    .first()
    .evaluate((node) => ({ width: node.offsetWidth, height: node.offsetHeight }));
  await page.locator("#previewBody").hover();
  await page.keyboard.down("Control");
  try {
    await page.mouse.wheel(0, -40);
  } finally {
    await page.keyboard.up("Control");
  }
  await page.waitForFunction(
    (before) => Number(document.querySelector("#previewPages").dataset.displayScale) > before,
    previousZoom,
  );
  const nextZoom = await page
    .locator("#previewPages")
    .evaluate((node) => Number(node.dataset.displayScale));
  assert.ok(nextZoom > previousZoom && nextZoom <= 3);
  await page.keyboard.down("Control");
  try {
    await page.mouse.wheel(0, 80);
  } finally {
    await page.keyboard.up("Control");
  }
  await page.waitForFunction(
    (before) => Number(document.querySelector("#previewPages").dataset.displayScale) < before,
    nextZoom,
  );
  const smallerZoom = await page
    .locator("#previewPages")
    .evaluate((node) => Number(node.dataset.displayScale));
  assert.ok(smallerZoom < nextZoom && smallerZoom >= 0.25);
  assert.deepEqual(
    await page
      .locator(".preview-pages .resume-paper")
      .first()
      .evaluate((node) => ({ width: node.offsetWidth, height: node.offsetHeight })),
    paperBefore,
  );
  await page.locator('[data-mode="word"]').click();
  assert.ok(await page.locator("#previewZoom").isVisible());
  const wordZoom = await page
    .locator("#previewPages")
    .evaluate((node) => Number(node.dataset.displayScale));
  await page.locator("#paperSize").hover();
  await page.keyboard.down("Control");
  try {
    await page.mouse.wheel(0, -40);
  } finally {
    await page.keyboard.up("Control");
  }
  await page.waitForFunction(
    (before) => Number(document.querySelector("#previewPages").dataset.displayScale) > before,
    wordZoom,
  );
  await page.locator('[data-mode="pdf"]').click();
  if (width <= 900) {
    for (const link of [
      ".desktop-project-links a[href='https://tarunb.me']",
      ".desktop-project-links a[href*='github.com']",
    ])
      assert.ok(await page.locator(link).isVisible());
    const insert = await page.locator("#insertButton").boundingBox(),
      zoom = await page.locator("#previewZoom").boundingBox();
    assert.ok(Math.abs(insert.y - zoom.y) < 8, "Insert and zoom stay on one toolbar line");
    await page.click("#insertButton");
    assert.ok(await page.locator("#insertOptions").isVisible());
    await page.keyboard.press("Escape");
  } else {
    await page.evaluate(() => {
      for (const source of ["json", "xml", "latex", "markdown"]) panelWeights[source] = 84;
      panelWeights.output = 16;
      setPanelGrid();
    });
    const bounds = await page.locator("#panelOutput").boundingBox();
    const controls = await page.locator("#outputControls").boundingBox();
    assert.ok(
      controls.x >= bounds.x && controls.x + controls.width <= bounds.x + bounds.width,
      "Output controls stay inside a narrow pane",
    );
    await page.evaluate(() => {
      for (const source of ["json", "xml", "latex", "markdown"]) panelWeights[source] = 30;
      panelWeights.output = 70;
      setPanelGrid();
    });
  }
  await page.screenshot({
    path: path.join(artifacts, `workspace-${browser.browserType().name()}-${width}.png`),
    fullPage: true,
  });
  if (width === 1280) {
    await page.evaluate(() => {
      window.proofTextPaints = 0;
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        window.proofTextPaints++;
        return original.apply(this, args);
      };
    });
    await page.click("#inspectPdfButton");
    await page.waitForSelector("#proofStack canvas");
    await page.waitForFunction(() => document.querySelector("#pdfProofStatus").hidden);
    assert.ok(
      await page.evaluate(() => window.proofTextPaints > 10),
      "PDF preview paints text, not just backgrounds",
    );
    const proofZoom = await page
      .locator("#proofStack")
      .evaluate((node) => Number(node.dataset.displayScale));
    await page.locator("#pdfProofPages").hover();
    await page.keyboard.down("Control");
    try {
      await page.mouse.wheel(0, -40);
    } finally {
      await page.keyboard.up("Control");
    }
    await page.waitForFunction(
      (before) => Number(document.querySelector("#proofStack").dataset.displayScale) > before,
      proofZoom,
    );
    await page.click("#pdfProofClose");
    await page.click("#newFolderButton");
    await page.fill("#nameDialogInput", "Applications");
    await page.click(".name-dialog button[type=submit]");
    const folderId = await page.evaluate(
      () => workspace.folders.find((folder) => folder.name === "Applications").id,
    );
    await page
      .locator("[data-resume-file]")
      .first()
      .dragTo(page.locator(`[data-folder-id="${folderId}"]`));
    assert.equal(await page.evaluate(() => workspace.resumes[0].folderId), folderId);
    for (const format of [
      "pdf",
      "word",
      "json",
      "xml",
      "json-resume",
      "latex",
      "markdown",
      "html",
      "text",
      "zip",
    ]) {
      await page.click("#exportMenuToggle");
      const downloadPromise = page.waitForEvent("download");
      await page.click(`[data-export="${format}"]`);
      const download = await downloadPromise;
      const filename = path.join(artifacts, download.suggestedFilename());
      await download.saveAs(filename);
      assert.ok((await readFile(filename)).length > 0);
      await page.setInputFiles("#resumeImportFile", filename);
      if (format === "zip") {
        await page.waitForSelector("#confirmSessionImport");
        const count = await page.evaluate(() => workspace.resumes.length);
        await page.click("#confirmSessionImport");
        assert.ok(await page.evaluate((count) => workspace.resumes.length > count, count));
      } else {
        await page.waitForSelector("#importReviewJson");
        const parsed = JSON.parse(await page.inputValue("#importReviewJson"));
        assert.equal(parsed.basics.name, "Tarun B");
        await page.click("#cancelImport");
      }
    }
  }
  await page.goto(origin + "/#why-json");
  await page.waitForSelector('[data-walkthrough-format="json"]');
  assert.equal(await page.locator("[data-walkthrough-format]").count(), 3);
  await page.click("#comparisonXmlTab");
  assert.equal(await page.locator('[data-walkthrough-format="xml"]').count(), 1);
  assert.equal(await page.locator('[data-walkthrough-format="json"]').count(), 0);
  assert.equal(await page.locator("[data-walkthrough-format]").count(), 3);
  await page.click("#walkthroughStart");
  await page.screenshot({
    path: path.join(artifacts, `comparison-${browser.browserType().name()}-${width}.png`),
    fullPage: true,
  });
  assert.deepEqual(errors, [], "No uncaught browser errors");
  await context.close();
  results.push({ browser: browser.browserType().name(), width, status: "passed" });
}
try {
  for (const type of [chromium, webkit]) {
    const browser = await type.launch();
    try {
      for (const width of [320, 390, 768, 997, 1280]) await checkViewport(browser, width);
    } finally {
      await browser.close();
    }
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
}
