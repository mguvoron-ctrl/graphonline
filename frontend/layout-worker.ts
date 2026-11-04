import {forceLayout, type LayoutInput} from './layout';
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<LayoutInput>) => void;
  postMessage: (message: unknown) => void;
};
scope.onmessage = event => {
  try {
    const positions = forceLayout(event.data, progress => scope.postMessage({progress}));
    scope.postMessage({positions});
  } catch (error) {
    scope.postMessage({error: error instanceof Error ? error.message : 'Layout failed'});
  }
};
