// The compiled GraphOffline module remains isolated from the editor and DOM.
interface Engine { cwrap: (name: string, result: string, parameters: string[]) => (input: string) => string }
const scope = globalThis as unknown as {
  location: Location; Module: Engine & Record<string, unknown>;
  importScripts: (...urls: string[]) => void;
  postMessage: (message: unknown) => void;
  onmessage: (event: MessageEvent<{id: number; input: string}>) => void;
};
let processAlgorithm: ((input: string) => string) | undefined;
scope.Module = {
  locateFile: (filename: string) => new URL('../features/graphoffline/' + filename, scope.location.href).href,
  onRuntimeInitialized: () => {
    processAlgorithm = scope.Module.cwrap('ProcessAlgorithm', 'string', ['string']);
    scope.postMessage({ready: true});
  },
  onAbort: () => scope.postMessage({error: 'Algorithm engine could not initialize'})
} as unknown as Engine & Record<string, unknown>;
scope.onmessage = event => {
  const {id, input} = event.data;
  try {
    if (!processAlgorithm) throw new Error('Engine is not ready');
    scope.postMessage({id, result: processAlgorithm(input)});
  } catch (error) {
    scope.postMessage({id, error: error instanceof Error ? error.message : 'Algorithm failed'});
  }
};
scope.importScripts(new URL('../features/graphoffline/Graphoffline.Emscripten.js', scope.location.href).href);
export {};
