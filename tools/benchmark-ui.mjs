import {chromium} from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const origin = new URL(baseURL).origin;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const watchdog = setTimeout(() => void browser.close(), 30000);
try {
  const context = await browser.newContext({deviceScaleFactor: 2, viewport: {width: 1280, height: 900}, serviceWorkers: 'block'});
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(baseURL, {timeout: 15000});
  await page.waitForFunction(() => typeof editor !== 'undefined' && editor.application.ready);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const graph = new Graph();
    for (let i = 0; i < 50; i++) { const v = new BaseVertex(80 + i % 10 * 60, 80 + Math.floor(i / 10) * 60, null); graph.AddNewVertex(v); v.mainText = String(i); }
    for (let i = 1; i < 50; i++) graph.AddNewEdgeSafe(graph.vertices[i - 1], graph.vertices[i], true, 1, false);
    editor.application.LoadNewGraphFromString(graph.SaveToXML(''));
    clearInterval(editor.application.autosaveTimer); // Measure interactions separately from the legacy safety audit.
    await new Promise(resolve => setTimeout(resolve, 700));
  });
  const result = await page.evaluate(async () => {
    const app = editor.application, counters = {paints: 0, typeChecks: 0, serializations: 0};
    for (const [name, counter] of [['_redrawGraphInWindow', 'paints'], ['GraphTypeChanged', 'typeChecks'], ['DocumentXML', 'serializations']]) {
      const original = app[name]; app[name] = function(...args) { counters[counter]++; return original.apply(this, args); };
    }
    const start = performance.now();
    for (let i = 0; i < 100; i++) app.multCanvasScale(i % 2 ? 1 / 1.001 : 1.001);
    const requestMs = performance.now() - start;
    await new Promise(resolve => setTimeout(resolve, 700));
    const view = {...counters, requestMs: Math.round(requestMs * 100) / 100};
    Object.keys(counters).forEach(key => counters[key] = 0);
    app.graph.vertices[0].mainText = 'Legacy edit'; app.redrawGraph();
    await new Promise(resolve => setTimeout(resolve, 700));
    const draft = await GraphOnline.drafts.load();
    return {vertices: 50, edges: 49, viewRequests: 100, view, legacyEdit: {...counters, recovered: draft.xml.includes('Legacy edit')}};
  });
  console.log(JSON.stringify(result, null, 2));
} finally {clearTimeout(watchdog); await browser.close();}
