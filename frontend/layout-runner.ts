import {validateLayoutResult, type LayoutInput, type LayoutPosition} from './layout';

export class LayoutRunner {
  private active?: {worker: Worker; timer: ReturnType<typeof setTimeout>; reject: (error: Error) => void};
  constructor(private readonly url: string) {}
  get busy(): boolean { return !!this.active; }
  run(input: LayoutInput, progress: (value: number) => void = () => {}): Promise<LayoutPosition[]> {
    this.cancel();
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.url);
      const finish = (error?: Error, positions?: LayoutPosition[]) => {
        if (this.active?.worker !== worker) return;
        clearTimeout(this.active.timer); worker.terminate(); this.active = undefined;
        error ? reject(error) : resolve(positions!);
      };
      const timer = setTimeout(() => finish(new Error('Layout time limit exceeded')), 30000);
      this.active = {worker, timer, reject};
      worker.onerror = () => finish(new Error('Layout worker failed'));
      worker.onmessage = event => {
        if (this.active?.worker !== worker) return;
        try {
          const data = event.data;
          if (data.error) throw new Error(data.error);
          if (data.positions) { validateLayoutResult(input, data.positions); finish(undefined, data.positions); }
          else if (Number.isFinite(data.progress)) progress(Math.max(0, Math.min(100, data.progress)));
        } catch (error) { finish(error instanceof Error ? error : new Error('Invalid layout response')); }
      };
      try { worker.postMessage(input); } catch (error) { finish(error instanceof Error ? error : new Error('Could not start layout')); }
    });
  }
  cancel(): void {
    if (!this.active) return;
    const task = this.active; this.active = undefined;
    clearTimeout(task.timer); task.worker.terminate(); task.reject(new DOMException('Cancelled', 'AbortError'));
  }
}
