"use strict";
var GraphOnline = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // frontend/index.ts
  var index_exports = {};
  __export(index_exports, {
    AlgorithmRunner: () => AlgorithmRunner,
    Autosave: () => Autosave,
    DraftStore: () => DraftStore,
    FrameScheduler: () => FrameScheduler,
    FullscreenController: () => FullscreenController,
    GraphIndex: () => GraphIndex,
    History: () => History,
    LayoutRunner: () => LayoutRunner,
    Timeline: () => Timeline,
    clampZoom: () => clampZoom,
    download: () => download,
    drafts: () => drafts,
    escapeHtml: () => escapeHtml,
    exportGraphML: () => exportGraphML,
    initialLayout: () => initialLayout,
    parseGraphML: () => parseGraphML,
    status: () => status,
    translate: () => translate,
    traversalSteps: () => traversalSteps,
    wheelZoomFactor: () => wheelZoomFactor
  });

  // frontend/history.ts
  var History = class {
    constructor(limit = 100, byteBudget = 16 * 1024 * 1024, estimate = (value) => typeof value === "string" ? value.length * 2 : 1) {
      this.limit = limit;
      this.byteBudget = byteBudget;
      this.estimate = estimate;
      if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(byteBudget) || byteBudget < 0) throw new RangeError("Invalid history budget");
    }
    past = [];
    future = [];
    bytes = 0;
    // XML is conservatively estimated as UTF-16 content; this is not a JS heap measurement.
    checkpoint(value) {
      const bytes = this.estimate(value);
      if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError("Invalid checkpoint size");
      return { value, bytes: Math.ceil(bytes) };
    }
    trim() {
      while (this.past.length + this.future.length > this.limit || this.bytes > this.byteBudget) {
        const discarded = this.past.length ? this.past.shift() : this.future.shift();
        if (!discarded) break;
        this.bytes -= discarded.bytes;
      }
    }
    push(snapshot) {
      const checkpoint = this.checkpoint(snapshot);
      for (const state of this.future) this.bytes -= state.bytes;
      this.future = [];
      this.past.push(checkpoint);
      this.bytes += checkpoint.bytes;
      this.trim();
    }
    undo(current) {
      if (!this.past.length) return null;
      const checkpoint = this.checkpoint(current), previous = this.past.pop();
      this.bytes += checkpoint.bytes - previous.bytes;
      this.future.push(checkpoint);
      this.trim();
      return previous.value;
    }
    redo(current) {
      if (!this.future.length) return null;
      const checkpoint = this.checkpoint(current), next = this.future.pop();
      this.bytes += checkpoint.bytes - next.bytes;
      this.past.push(checkpoint);
      this.trim();
      return next.value;
    }
    clear() {
      this.past = [];
      this.future = [];
      this.bytes = 0;
    }
    get estimatedBytes() {
      return this.bytes;
    }
    get canUndo() {
      return this.past.length > 0;
    }
    get canRedo() {
      return this.future.length > 0;
    }
  };

  // frontend/documents.ts
  var DraftStore = class {
    pending = Promise.resolve();
    async database() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("graphonline-documents", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("documents");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async transaction(mode, action) {
      const db = await this.database();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("documents", mode);
        const request = action(tx.objectStore("documents"));
        tx.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        tx.onabort = tx.onerror = () => {
          db.close();
          reject(tx.error || request.error);
        };
      });
    }
    save(draft) {
      const operation = this.pending.catch(() => {
      }).then(() => this.transaction("readwrite", (store) => store.put(draft, "draft")));
      this.pending = operation;
      return operation.then(() => {
      });
    }
    async load() {
      await this.pending.catch(() => {
      });
      return this.transaction("readonly", (store) => store.get("draft"));
    }
    clear() {
      const operation = this.pending.catch(() => {
      }).then(() => this.transaction("readwrite", (store) => store.delete("draft")));
      this.pending = operation;
      return operation.then(() => {
      });
    }
  };

  // frontend/graphml.ts
  function parseGraphML(text) {
    if (text.length > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("Invalid graph document");
    const xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.querySelector("parsererror") || xml.documentElement.localName !== "graphml") throw new Error("Invalid GraphML");
    const children = (element, name) => Array.from(element.children).filter((e) => e.localName === name);
    const graphs = children(xml.documentElement, "graph");
    if (graphs.length !== 1) throw new Error("Expected one graph");
    const graph = graphs[0];
    const keys = children(xml.documentElement, "key");
    const data = (element, name) => {
      const key = keys.find((key2) => key2.getAttribute("attr.name") === name);
      return key ? children(element, "data").find((value) => value.getAttribute("key") === key.id)?.textContent ?? void 0 : void 0;
    };
    const metadata = (element, name, allowed) => {
      const raw = data(element, name);
      if (!raw) return;
      const record = JSON.parse(raw);
      if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Invalid graph metadata");
      for (const [key, value] of Object.entries(record)) if (allowed.includes(key) && typeof value === "string") element.setAttribute(key, value);
    };
    metadata(graph, "graphonline.graph", ["uidGraph", "uidEdge"]);
    const nodes = children(graph, "node");
    const edgeElements = children(graph, "edge");
    if (nodes.length > 1e3 || edgeElements.length > 1e4) throw new Error("Graph exceeds limits");
    const ids = /* @__PURE__ */ new Set();
    const mapping = /* @__PURE__ */ new Map();
    const used = new Set(nodes.map((node) => node.getAttribute("id")).filter((id) => /^(?:0|[1-9]\d*)$/.test(id) && Number(id) < 1e4));
    let available = 0;
    let nextVertex = 0;
    for (const node of nodes) {
      metadata(node, "graphonline.node", ["upText", "ownStyles", "size"]);
      for (const [key, attribute] of [["label", "mainText"], ["x", "positionX"], ["y", "positionY"]]) {
        const value = data(node, key);
        if (value !== void 0) node.setAttribute(attribute, value);
      }
      const id = node.getAttribute("id");
      if (!id || ids.has(id)) throw new Error("Missing or duplicate vertex identifier");
      ids.add(id);
      let canonical = id;
      if (!used.has(id)) {
        while (used.has(String(available))) available++;
        canonical = String(available++);
        used.add(canonical);
      }
      mapping.set(id, canonical);
      if (!node.hasAttribute("mainText")) node.setAttribute("mainText", id);
      node.setAttribute("id", canonical);
      nextVertex = Math.max(nextVertex, Number(canonical) + 1);
    }
    const weightKey = keys.find((key) => key.getAttribute("attr.name") === "weight" && ["edge", "all"].includes(key.getAttribute("for") || "all"));
    const edgeIds = /* @__PURE__ */ new Set();
    let nextEdge = 1e4;
    for (const edge of edgeElements) {
      const id = edge.getAttribute("id");
      if (id) {
        if (edgeIds.has(id)) throw new Error("Duplicate edge identifier");
        edgeIds.add(id);
        if (/^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) < 2147483647) nextEdge = Math.max(nextEdge, Number(id) + 1);
      }
    }
    const edges = edgeElements.map((element) => {
      metadata(element, "graphonline.edge", ["text", "upText", "arrayStyleStart", "arrayStyleFinish", "ownStyles", "model_width", "model_type", "model_curveValue", "model_default"]);
      const originalSource = element.getAttribute("source") ?? element.getAttribute("vertex1") ?? element.getAttribute("graph1") ?? "";
      const originalTarget = element.getAttribute("target") ?? element.getAttribute("vertex2") ?? element.getAttribute("graph2") ?? "";
      if (!ids.has(originalSource) || !ids.has(originalTarget)) throw new Error("Unknown edge endpoint");
      const source = mapping.get(originalSource), target = mapping.get(originalTarget);
      element.setAttribute("source", source);
      element.setAttribute("target", target);
      element.removeAttribute("vertex1");
      element.removeAttribute("vertex2");
      const standardWeight = weightKey && children(element, "data").find((data2) => data2.getAttribute("key") === weightKey.id)?.textContent;
      const raw = element.getAttribute("weight") ?? standardWeight ?? (weightKey && children(weightKey, "default")[0]?.textContent) ?? null;
      const weight = raw === null ? 1 : Number(raw);
      if (!Number.isFinite(weight)) throw new Error("Invalid edge weight");
      let id = element.getAttribute("id");
      if (!id || !/^\d+$/.test(id) || Number(id) < 1e4 || Number(id) >= 2147483647) {
        while (edgeIds.has(String(nextEdge))) nextEdge++;
        id = String(nextEdge++);
        edgeIds.add(id);
      }
      element.setAttribute("id", id);
      return { element, source, target, id, weight, weighted: element.hasAttribute("useWeight") ? element.getAttribute("useWeight") === "true" : raw !== null };
    });
    const savedVertex = Number(graph.getAttribute("uidGraph"));
    const savedEdge = Number(graph.getAttribute("uidEdge"));
    if (Number.isSafeInteger(savedVertex) && savedVertex < 1e4) nextVertex = Math.max(nextVertex, savedVertex);
    if (Number.isSafeInteger(savedEdge) && savedEdge < 2147483647) nextEdge = Math.max(nextEdge, savedEdge);
    return {
      nodes,
      edges,
      nextVertex,
      nextEdge,
      directed: graph.getAttribute("edgedefault") === "directed",
      additional: data(graph, "graphonline.settings") ?? children(xml.documentElement, "additional")[0]?.getAttribute("data") ?? ""
    };
  }
  function exportGraphML(text) {
    const imported = parseGraphML(text);
    const namespace = "http://graphml.graphdrawing.org/xmlns";
    const xml = document.implementation.createDocument(namespace, "graphml", null);
    const root = xml.documentElement;
    const create = (name, attributes2 = {}) => {
      const element = xml.createElementNS(namespace, name);
      for (const [key, value] of Object.entries(attributes2)) element.setAttribute(key, value);
      return element;
    };
    const definitions = [
      ["weight", "edge", "double"],
      ["label", "node", "string"],
      ["x", "node", "double"],
      ["y", "node", "double"],
      ["graphonline.node", "node", "string"],
      ["graphonline.edge", "edge", "string"],
      ["graphonline.graph", "graph", "string"],
      ["graphonline.settings", "graph", "string"]
    ];
    for (const [name, scope, type] of definitions) root.append(create("key", { id: name, for: scope, "attr.name": name, "attr.type": type }));
    const add = (element, key, value) => {
      const field = create("data", { key });
      field.textContent = value;
      element.append(field);
    };
    const attributes = (element, names) => JSON.stringify(Object.fromEntries(names.filter((name) => element.hasAttribute(name)).map((name) => [name, element.getAttribute(name)])));
    const graph = create("graph", { id: "Graph", edgedefault: imported.directed ? "directed" : "undirected" });
    root.append(graph);
    add(graph, "graphonline.graph", JSON.stringify({ uidGraph: String(imported.nextVertex), uidEdge: String(imported.nextEdge) }));
    add(graph, "graphonline.settings", imported.additional);
    for (const node of imported.nodes) {
      const element = create("node", { id: node.getAttribute("id") });
      add(element, "label", node.getAttribute("mainText") ?? node.getAttribute("id"));
      for (const [key, attribute] of [["x", "positionX"], ["y", "positionY"]]) {
        const value = node.getAttribute(attribute);
        if (value !== null && Number.isFinite(Number(value))) add(element, key, value);
      }
      add(element, "graphonline.node", attributes(node, ["upText", "ownStyles", "size"]));
      graph.append(element);
    }
    for (const record of imported.edges) {
      const directed = record.element.getAttribute("directed") ?? record.element.getAttribute("isDirect") ?? String(imported.directed);
      const element = create("edge", { id: record.id, source: record.source, target: record.target, directed });
      add(element, "weight", String(record.weighted ? record.weight : 1));
      add(element, "graphonline.edge", attributes(record.element, ["text", "upText", "arrayStyleStart", "arrayStyleFinish", "ownStyles", "model_width", "model_type", "model_curveValue", "model_default"]));
      graph.append(element);
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(xml);
  }

  // frontend/runner.ts
  var AlgorithmRunner = class {
    constructor(url) {
      this.url = url;
      this.start();
    }
    worker;
    pending = /* @__PURE__ */ new Map();
    sequence = 0;
    waiting = 0;
    ready;
    rejectReady;
    initializationTimer;
    get busy() {
      return this.waiting > 0 || this.pending.size > 0;
    }
    start() {
      const worker = this.worker = new Worker(this.url);
      this.ready = new Promise((resolve, reject) => {
        this.rejectReady = reject;
        worker.onmessage = (event) => {
          const { id, result, error, ready } = event.data;
          if (ready) {
            clearTimeout(this.initializationTimer);
            resolve();
            return;
          }
          if (!id && error) {
            reject(new Error(error));
            return;
          }
          const task = this.pending.get(id);
          if (!task) return;
          clearTimeout(task.timer);
          this.pending.delete(id);
          error ? task.reject(new Error(error)) : task.resolve(result);
        };
        worker.onerror = () => {
          const error = new Error("Algorithm worker failed");
          reject(error);
          this.fail(error);
        };
      });
      this.ready.catch(() => {
      });
      this.initializationTimer = setTimeout(() => {
        const error = new Error("Algorithm initialization timed out");
        this.rejectReady?.(error);
        this.fail(error);
      }, 15e3);
    }
    fail(reason) {
      clearTimeout(this.initializationTimer);
      this.worker?.terminate();
      this.worker = void 0;
      for (const task of this.pending.values()) {
        clearTimeout(task.timer);
        task.reject(reason);
      }
      this.pending.clear();
    }
    async run(input) {
      if (!this.worker) this.start();
      const ready = this.ready;
      this.waiting++;
      try {
        await ready;
      } finally {
        this.waiting--;
      }
      if (ready !== this.ready || !this.worker) throw new DOMException("Cancelled", "AbortError");
      const id = ++this.sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => this.fail(new Error("Algorithm time limit exceeded")), 3e4);
        this.pending.set(id, { resolve, reject, timer });
        this.worker.postMessage({ id, input });
      });
    }
    cancel() {
      const error = new DOMException("Cancelled", "AbortError");
      this.rejectReady?.(error);
      this.fail(error);
    }
  };

  // frontend/timeline.ts
  var Timeline = class {
    constructor(frames, render) {
      this.frames = frames;
      this.render = render;
      if (!frames.length) throw new Error("A timeline needs an initial frame");
    }
    index = 0;
    timer;
    get playing() {
      return this.timer !== void 0;
    }
    refresh() {
      this.render(this.frames[this.index], this.index);
    }
    next() {
      if (this.index < this.frames.length - 1) this.index++;
      else this.pause();
      this.refresh();
    }
    back() {
      this.pause();
      this.index = Math.max(0, this.index - 1);
      this.refresh();
    }
    play(milliseconds = 500) {
      this.pause();
      if (this.index === this.frames.length - 1) this.index = 0;
      this.timer = setInterval(() => this.next(), Math.max(100, milliseconds));
      this.refresh();
    }
    pause() {
      clearInterval(this.timer);
      this.timer = void 0;
    }
  };

  // frontend/graph-index.ts
  var GraphIndex = class {
    vertices = /* @__PURE__ */ new Map();
    order = /* @__PURE__ */ new Map();
    adjacency = /* @__PURE__ */ new Map();
    orderedNeighbors = /* @__PURE__ */ new Map();
    constructor(vertices, edges) {
      vertices.forEach((vertex, index) => {
        this.vertices.set(String(vertex.id), vertex);
        this.order.set(String(vertex.id), index);
      });
      for (const edge of edges) {
        const from = String(edge.vertex1.id), to = String(edge.vertex2.id);
        if (!this.vertices.has(from) || !this.vertices.has(to)) continue;
        const weight = edge.GetWeight();
        this.connect(from, to, edge, weight);
        if (!edge.isDirect && from !== to) this.connect(to, from, edge, weight);
      }
    }
    connect(from, to, edge, weight) {
      let row = this.adjacency.get(from);
      if (!row) {
        row = /* @__PURE__ */ new Map();
        this.adjacency.set(from, row);
      }
      const existing = row.get(to);
      if (!existing) row.set(to, { first: edge, minimum: weight < Infinity ? edge : void 0, weight: weight < Infinity ? weight : Infinity });
      else if (weight < existing.weight) {
        existing.weight = weight;
        existing.minimum = edge;
      }
    }
    minimum(from, to) {
      return this.adjacency.get(String(from))?.get(String(to))?.minimum;
    }
    neighbors(id) {
      const key = String(id);
      let result = this.orderedNeighbors.get(key);
      if (!result) {
        const ordered = Array.from(this.adjacency.get(key) || [], ([target, value]) => ({ vertex: this.vertices.get(target), edge: value.first }));
        ordered.sort((a, b) => this.order.get(String(a.vertex.id)) - this.order.get(String(b.vertex.id)));
        result = ordered;
        this.orderedNeighbors.set(key, result);
      }
      return result;
    }
  };
  function traversalSteps(index, start, depthFirst = false) {
    const steps = [{ vertex: start }];
    const seen = /* @__PURE__ */ new Set([String(start.id)]);
    const frontier = [{ vertex: start, next: 0 }];
    let head = 0;
    while (depthFirst ? frontier.length > 0 : head < frontier.length) {
      const frame = frontier[depthFirst ? frontier.length - 1 : head];
      const neighbors = index.neighbors(frame.vertex.id);
      if (frame.next >= neighbors.length) {
        if (depthFirst) frontier.pop();
        else head++;
        continue;
      }
      const visit = neighbors[frame.next++];
      if (seen.has(String(visit.vertex.id))) continue;
      seen.add(String(visit.vertex.id));
      steps.push(visit);
      frontier.push({ vertex: visit.vertex, next: 0 });
    }
    return steps;
  }

  // frontend/layout.ts
  function validate(input) {
    if (input.nodes.length > 1e3 || input.edges.length > 1e4 || !Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) {
      throw new Error("Invalid layout dimensions or graph size");
    }
    const ids = /* @__PURE__ */ new Set();
    for (const node of input.nodes) {
      if (ids.has(node.id) || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.diameter) || node.diameter <= 0 || Math.abs(node.x) > 1e9 || Math.abs(node.y) > 1e9) {
        throw new Error("Invalid layout node");
      }
      ids.add(node.id);
    }
    for (const edge of input.edges) if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error("Invalid layout edge");
  }
  function initialLayout(input) {
    validate(input);
    const moving = input.nodes.filter((node) => !node.fixed);
    const width = Math.min(input.width, 1e6), height = Math.min(input.height, 1e6);
    const margin = Math.min(Math.max(30, ...moving.map((node) => node.diameter)), width / 2, height / 2);
    return moving.map((node, index) => {
      const angle = 2 * Math.PI * index / moving.length - Math.PI / 2;
      return {
        id: node.id,
        x: width / 2 + (moving.length > 1 ? Math.max(0, width / 2 - margin) * Math.cos(angle) : 0),
        y: height / 2 + (moving.length > 1 ? Math.max(0, height / 2 - margin) * Math.sin(angle) : 0)
      };
    });
  }
  function validateLayoutResult(input, value) {
    const expected = new Set(input.nodes.filter((node) => !node.fixed).map((node) => node.id));
    if (!Array.isArray(value) || value.length !== expected.size) throw new Error("Incomplete layout result");
    for (const point of value) {
      if (!point || !expected.delete(point.id) || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1e9 || Math.abs(point.y) > 1e9) throw new Error("Invalid layout position");
    }
  }

  // frontend/layout-runner.ts
  var LayoutRunner = class {
    constructor(url) {
      this.url = url;
    }
    active;
    get busy() {
      return !!this.active;
    }
    run(input, progress = () => {
    }) {
      this.cancel();
      return new Promise((resolve, reject) => {
        const worker = new Worker(this.url);
        const finish = (error, positions) => {
          if (this.active?.worker !== worker) return;
          clearTimeout(this.active.timer);
          worker.terminate();
          this.active = void 0;
          error ? reject(error) : resolve(positions);
        };
        const timer = setTimeout(() => finish(new Error("Layout time limit exceeded")), 3e4);
        this.active = { worker, timer, reject };
        worker.onerror = () => finish(new Error("Layout worker failed"));
        worker.onmessage = (event) => {
          if (this.active?.worker !== worker) return;
          try {
            const data = event.data;
            if (data.error) throw new Error(data.error);
            if (data.positions) {
              validateLayoutResult(input, data.positions);
              finish(void 0, data.positions);
            } else if (Number.isFinite(data.progress)) progress(Math.max(0, Math.min(100, data.progress)));
          } catch (error) {
            finish(error instanceof Error ? error : new Error("Invalid layout response"));
          }
        };
        try {
          worker.postMessage(input);
        } catch (error) {
          finish(error instanceof Error ? error : new Error("Could not start layout"));
        }
      });
    }
    cancel() {
      if (!this.active) return;
      const task = this.active;
      this.active = void 0;
      clearTimeout(task.timer);
      task.worker.terminate();
      task.reject(new DOMException("Cancelled", "AbortError"));
    }
  };

  // frontend/frame.ts
  var FrameScheduler = class {
    constructor(render, request = requestAnimationFrame, cancel = cancelAnimationFrame) {
      this.render = render;
      this.request = request;
      this.cancel = cancel;
    }
    frame;
    invalidate() {
      if (this.frame !== void 0) return;
      this.frame = this.request(() => {
        this.frame = void 0;
        this.render();
      });
    }
    flush() {
      if (this.frame === void 0) return;
      this.cancel(this.frame);
      this.frame = void 0;
      this.render();
    }
  };

  // frontend/autosave.ts
  var Autosave = class {
    constructor(read, write, onError, delay = 400) {
      this.read = read;
      this.write = write;
      this.onError = onError;
      this.delay = delay;
    }
    revision = 0;
    savedRevision = -1;
    snapshot;
    timer;
    writing;
    get dirty() {
      return this.revision !== this.savedRevision;
    }
    get currentRevision() {
      return this.revision;
    }
    changed() {
      this.revision++;
    }
    notePersisted(snapshot) {
      this.snapshot = { ...snapshot };
    }
    schedule() {
      if (!this.dirty) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush().catch(this.onError), this.delay);
    }
    async flush(force = false) {
      clearTimeout(this.timer);
      this.timer = void 0;
      if (this.writing) {
        await this.writing;
        return this.flush(force);
      }
      if (!force && !this.dirty) return;
      const revision = this.revision, snapshot = this.read();
      if (snapshot.xml === this.snapshot?.xml && snapshot.reference === this.snapshot.reference) {
        this.savedRevision = revision;
        return;
      }
      this.writing = this.write(snapshot);
      try {
        await this.writing;
        this.notePersisted(snapshot);
        this.savedRevision = revision;
      } finally {
        this.writing = void 0;
      }
    }
  };

  // frontend/viewport.ts
  function clampZoom(scale) {
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Invalid zoom");
    return Math.min(20, Math.max(0.01, scale));
  }
  function wheelZoomFactor(deltaY, mode = 0, pinch = false) {
    if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
    const pixels = deltaY * (mode === 1 ? 16 : mode === 2 ? 800 : 1);
    return Math.exp(-Math.max(-100, Math.min(100, pixels)) * (pinch ? 0.01 : 2e-3));
  }

  // frontend/fullscreen.ts
  var FullscreenController = class {
    constructor(document2, changed, issue) {
      this.document = document2;
      this.changed = changed;
      this.issue = issue;
      document2.addEventListener("fullscreenchange", () => this.sync());
      document2.addEventListener("webkitfullscreenchange", () => this.sync());
      document2.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.expanded) void this.toggle();
      });
      this.sync();
    }
    expanded = false;
    fallback = false;
    changing = false;
    initialized = false;
    get nativeElement() {
      return this.document.fullscreenElement || this.document.webkitFullscreenElement;
    }
    sync() {
      const expanded = this.nativeElement === this.document.documentElement || this.fallback;
      const notify = !this.initialized || this.expanded !== expanded;
      this.expanded = expanded;
      this.initialized = true;
      this.document.documentElement.classList.toggle("graphonline-fullscreen", this.expanded);
      if (notify) this.changed(this.expanded);
    }
    async toggle() {
      if (this.changing) return;
      this.changing = true;
      try {
        if (this.expanded) {
          this.fallback = false;
          if (this.nativeElement === this.document.documentElement) {
            const exit = this.document.exitFullscreen || this.document.webkitExitFullscreen;
            try {
              if (!exit) throw new Error("Exit fullscreen unavailable");
              await exit.call(this.document);
            } catch {
              if (this.nativeElement === this.document.documentElement) this.issue("fullscreenExitError");
            }
          }
        } else {
          const root = this.document.documentElement;
          const request = root.requestFullscreen || root.webkitRequestFullscreen;
          try {
            if (!request) throw new Error("Fullscreen unavailable");
            await request.call(root);
          } catch {
            this.fallback = true;
            this.issue("fullscreenFallback");
          }
        }
        this.sync();
      } finally {
        this.changing = false;
      }
    }
  };

  // frontend/ui.ts
  var messages = {
    fullscreen: ["\u041D\u0430 \u0432\u0435\u0441\u044C \u044D\u043A\u0440\u0430\u043D", "Enter fullscreen"],
    exitFullscreen: ["\u0412\u044B\u0439\u0442\u0438 \u0438\u0437 \u043F\u043E\u043B\u043D\u043E\u044D\u043A\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430", "Exit fullscreen"],
    fullscreenFallback: ["\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u043B \u043F\u043E\u043B\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D. \u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D \u043D\u0430 \u0432\u0441\u044E \u0432\u043A\u043B\u0430\u0434\u043A\u0443.", "The browser did not allow fullscreen. The editor fills this tab."],
    fullscreenExitError: ["\u0414\u043B\u044F \u0432\u044B\u0445\u043E\u0434\u0430 \u0438\u0437 \u043F\u043E\u043B\u043D\u043E\u044D\u043A\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 Esc.", "Press Esc to leave fullscreen."],
    layout: ["\u0420\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0438\u0442\u044C \u0432\u0435\u0440\u0448\u0438\u043D\u044B", "Arrange vertices"],
    layoutRunning: ["\u0420\u0430\u0441\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u043C \u0432\u0435\u0440\u0448\u0438\u043D\u044B\u2026", "Arranging vertices\u2026"],
    layoutCancel: ["\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0443", "Stop layout"],
    layoutError: ["\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435. \u041A\u0440\u0443\u0433\u043E\u0432\u0430\u044F \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430.", "Could not improve the layout. The circular layout is kept."],
    negativeCycle: ["\u0412 \u0433\u0440\u0430\u0444\u0435 \u0435\u0441\u0442\u044C \u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0446\u0438\u043A\u043B: \u043A\u0440\u0430\u0442\u0447\u0430\u0439\u0448\u0438\u0435 \u0440\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u044B.", "The graph has a negative cycle: shortest distances are undefined."],
    computing: ["\u0412\u044B\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0435\u2026", "Computing\u2026"],
    saving: ["\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C\u2026", "Saving\u2026"],
    saved: ["\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435", "Saved on this device"],
    published: ["\u0421\u0441\u044B\u043B\u043A\u0430 \u0433\u043E\u0442\u043E\u0432\u0430", "Link ready"],
    saveError: ["\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C. \u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435.", "Could not save. Your local draft is kept."],
    storageError: ["\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A. \u0421\u043A\u0430\u0447\u0430\u0439\u0442\u0435 \u0444\u0430\u0439\u043B \u0433\u0440\u0430\u0444\u0430.", "Could not save the draft. Download a graph file."],
    loadError: ["\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0433\u0440\u0430\u0444. \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0433\u0440\u0430\u0444 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D.", "Could not open the graph. The current graph is kept."],
    algorithmError: ["\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C.", "The algorithm could not complete."],
    cancelled: ["\u0412\u044B\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0435 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E", "Computation cancelled"],
    cancel: ["\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u044B\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0435", "Cancel computation"],
    redo: ["\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C", "Redo"],
    pause: ["\u041F\u0430\u0443\u0437\u0430", "Pause"],
    play: ["\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C", "Play"],
    step: ["\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0448\u0430\u0433", "Next step"],
    back: ["\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u0448\u0430\u0433", "Previous step"]
  };
  function translate(key) {
    const entry = messages[key];
    return entry ? entry[document.documentElement.lang === "ru" ? 0 : 1] : key;
  }
  function status(key, error = false) {
    let element = document.getElementById("document-status");
    if (!element) {
      element = document.createElement("div");
      element.id = "document-status";
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
      element.style.cssText = "padding:4px 0;font-size:0.875rem";
      (document.getElementById("canvasSection") || document.body).prepend(element);
    }
    element.textContent = translate(key);
    element.style.color = error ? "#b42318" : "#475569";
  }
  function download(data, type, name) {
    const blob = typeof data === "string" ? new Blob([data], { type }) : data;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
  }

  // frontend/index.ts
  var drafts = new DraftStore();
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=core.js.map
