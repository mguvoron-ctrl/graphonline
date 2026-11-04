"use strict";
(() => {
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
  function forceLayout(input, progress = () => {
  }) {
    const preview = initialLayout(input), initial = new Map(preview.map((point) => [point.id, point]));
    const count = input.nodes.length;
    if (!preview.length) return [];
    const indices = new Map(input.nodes.map((node, index) => [node.id, index]));
    const neighbors = Array.from({ length: count }, () => /* @__PURE__ */ new Set());
    for (const edge of input.edges) {
      const a = indices.get(edge.source), b = indices.get(edge.target);
      if (a !== b) {
        neighbors[a].add(b);
        neighbors[b].add(a);
      }
    }
    const x = new Float64Array(count), y = new Float64Array(count);
    const fx = new Float64Array(count), fy = new Float64Array(count);
    input.nodes.forEach((node, i) => {
      const point = initial.get(node.id) || node;
      x[i] = point.x;
      y[i] = point.y;
    });
    const width = Math.min(input.width, 1e6), height = Math.min(input.height, 1e6);
    const spacing = 3 * Math.min(1e3, Math.max(30, ...input.nodes.map((node) => node.diameter)));
    const repulsion = 10 * spacing * spacing, maxVelocity = spacing * 10;
    for (let iteration = 0; iteration < 1e3; iteration++) {
      fx.fill(0);
      fy.fill(0);
      for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
        if (input.nodes[a].fixed && input.nodes[b].fixed) continue;
        let dx = x[a] - x[b], dy = y[a] - y[b];
        if (dx === 0 && dy === 0) {
          dx = Math.cos(a + b + 1);
          dy = Math.sin(a + b + 1);
        }
        const distanceSquared = Math.max(1, dx * dx + dy * dy);
        const scale = repulsion / (distanceSquared * Math.sqrt(distanceSquared));
        if (!input.nodes[a].fixed) {
          fx[a] += dx * scale;
          fy[a] += dy * scale;
        }
        if (!input.nodes[b].fixed) {
          fx[b] -= dx * scale;
          fy[b] -= dy * scale;
        }
      }
      let changed = false;
      for (let a = 0; a < count; a++) {
        if (input.nodes[a].fixed) continue;
        for (const b of neighbors[a]) {
          const dx = x[b] - x[a], dy = y[b] - y[a], distance = Math.hypot(dx, dy);
          if (distance > spacing) {
            const scale2 = 10 / spacing * (distance - spacing) / distance;
            fx[a] += dx * scale2;
            fy[a] += dy * scale2;
          }
        }
        fx[a] += (width / 2 - x[a]) / spacing;
        fy[a] += (height / 2 - y[a]) / spacing;
        const velocity = Math.hypot(fx[a], fy[a]);
        const scale = velocity > maxVelocity ? maxVelocity / velocity : 1;
        fx[a] *= scale;
        fy[a] *= scale;
        changed ||= velocity >= 1;
      }
      for (let a = 0; a < count; a++) if (!input.nodes[a].fixed) {
        x[a] += fx[a];
        y[a] += fy[a];
      }
      if (iteration % 25 === 0) progress(Math.floor(iteration / 10));
      if (!changed) break;
    }
    const result = input.nodes.flatMap((node, i) => node.fixed ? [] : [{ id: node.id, x: x[i], y: y[i] }]);
    if (result.length === count) {
      const minX = Math.min(...x), maxX = Math.max(...x), minY = Math.min(...y), maxY = Math.max(...y);
      const margin = Math.min(spacing / 3, width / 4, height / 4);
      const scale = Math.min(1, (width - 2 * margin) / Math.max(1, maxX - minX), (height - 2 * margin) / Math.max(1, maxY - minY));
      for (const point of result) {
        point.x = width / 2 + (point.x - (minX + maxX) / 2) * scale;
        point.y = height / 2 + (point.y - (minY + maxY) / 2) * scale;
      }
    }
    validateLayoutResult(input, result);
    progress(100);
    return result;
  }
  function validateLayoutResult(input, value) {
    const expected = new Set(input.nodes.filter((node) => !node.fixed).map((node) => node.id));
    if (!Array.isArray(value) || value.length !== expected.size) throw new Error("Incomplete layout result");
    for (const point of value) {
      if (!point || !expected.delete(point.id) || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1e9 || Math.abs(point.y) > 1e9) throw new Error("Invalid layout position");
    }
  }

  // frontend/layout-worker.ts
  var scope = globalThis;
  scope.onmessage = (event) => {
    try {
      const positions = forceLayout(event.data, (progress) => scope.postMessage({ progress }));
      scope.postMessage({ positions });
    } catch (error) {
      scope.postMessage({ error: error instanceof Error ? error.message : "Layout failed" });
    }
  };
})();
//# sourceMappingURL=layout-worker.js.map
