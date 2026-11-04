"use strict";
(() => {
  // frontend/algorithm-worker.ts
  var scope = globalThis;
  var processAlgorithm;
  scope.Module = {
    locateFile: (filename) => new URL("../features/graphoffline/" + filename, scope.location.href).href,
    onRuntimeInitialized: () => {
      processAlgorithm = scope.Module.cwrap("ProcessAlgorithm", "string", ["string"]);
      scope.postMessage({ ready: true });
    },
    onAbort: () => scope.postMessage({ error: "Algorithm engine could not initialize" })
  };
  scope.onmessage = (event) => {
    const { id, input } = event.data;
    try {
      if (!processAlgorithm) throw new Error("Engine is not ready");
      scope.postMessage({ id, result: processAlgorithm(input) });
    } catch (error) {
      scope.postMessage({ id, error: error instanceof Error ? error.message : "Algorithm failed" });
    }
  };
  scope.importScripts(new URL("../features/graphoffline/Graphoffline.Emscripten.js", scope.location.href).href);
})();
//# sourceMappingURL=algorithm-worker.js.map
