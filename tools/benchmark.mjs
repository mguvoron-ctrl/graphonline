import {chromium} from '@playwright/test';

// Run against a local development server. No documents are saved or published.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const origin = new URL(baseURL).origin;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
let timedOut = false;
const watchdog = setTimeout(() => { timedOut = true; void browser.close(); }, 40_000);
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, serviceWorkers: 'block'});
  await context.route('**/*', route => {
    const url = route.request().url();
    return url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  await page.goto(baseURL, {timeout: 15_000});
  await page.waitForFunction(() => typeof editor !== 'undefined' && editor.application.ready && g_AlgorithmIds.length === 25, null, {timeout: 15_000});
  const measurements = await page.evaluate(() => {
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const results = [];
    for (const n of [50, 100, 400, 1000]) {
      const graph = new Graph();
      for (let i = 0; i < n; i++) {
        const vertex = new BaseVertex(50 + i, 100, null);
        graph.AddNewVertex(vertex); vertex.mainText = String(i);
      }
      for (let i = 0; i < n; i++) for (let jump = 1; jump <= 4; jump++) {
        graph.edges.push(new BaseEdge(graph.vertices[i], graph.vertices[(i + jump) % n], true, jump));
      }
      const matrixTimes = [], traversalTimes = [];
      for (let repeat = 0; repeat < 3; repeat++) {
        let start = performance.now();
        const matrix = graph.GetAdjacencyMatrix();
        matrixTimes.push(performance.now() - start);
        if (matrix[0][1] !== 1) throw new Error('Unexpected matrix');
        const algorithm = new BFSAlgorithm(graph, {redrawGraph() {}});
        start = performance.now(); algorithm.selectVertex(graph.vertices[0]);
        traversalTimes.push(performance.now() - start); algorithm.cleanup();
        if (algorithm.traversalSteps.length !== n) throw new Error('Incomplete traversal');
      }
      results.push({vertices: n, edges: graph.edges.length,
        matrixMedianMs: Math.round(median(matrixTimes) * 100) / 100,
        traversalMedianMs: Math.round(median(traversalTimes) * 100) / 100});
    }
    return results;
  });
  console.log(JSON.stringify(measurements, null, 2));
} catch (error) {
  console.error(timedOut ? 'Benchmark exceeded its 40 second limit.' : error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog); await browser.close();
}
