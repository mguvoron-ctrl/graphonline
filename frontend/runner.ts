type Pending = { resolve: (value: string) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> };

export class AlgorithmRunner {
  private worker?: Worker;
  private pending = new Map<number, Pending>();
  private sequence = 0;
  private waiting = 0;
  ready!: Promise<void>;
  private rejectReady?: (reason: Error) => void;
  private initializationTimer?: ReturnType<typeof setTimeout>;
  constructor(private readonly url: string) { this.start(); }
  get busy(): boolean { return this.waiting > 0 || this.pending.size > 0; }
  private start(): void {
    const worker = this.worker = new Worker(this.url);
    this.ready = new Promise((resolve, reject) => {
      this.rejectReady = reject;
      worker.onmessage = event => {
        const { id, result, error, ready } = event.data;
        if (ready) { clearTimeout(this.initializationTimer); resolve(); return; }
        if (!id && error) { reject(new Error(error)); return; }
        const task = this.pending.get(id);
        if (!task) return;
        clearTimeout(task.timer); this.pending.delete(id);
        error ? task.reject(new Error(error)) : task.resolve(result);
      };
      worker.onerror = () => { const error = new Error('Algorithm worker failed'); reject(error); this.fail(error); };
    });
    // Initialization failure is reported by run(), even before a user selects an algorithm.
    this.ready.catch(() => {});
    this.initializationTimer = setTimeout(() => {
      const error = new Error('Algorithm initialization timed out');
      this.rejectReady?.(error); this.fail(error);
    }, 15000);
  }
  private fail(reason: Error): void {
    clearTimeout(this.initializationTimer);
    this.worker?.terminate(); this.worker = undefined;
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(reason); }
    this.pending.clear();
  }
  async run(input: string): Promise<string> {
    if (!this.worker) this.start();
    const ready = this.ready;
    this.waiting++;
    try { await ready; } finally { this.waiting--; }
    // Cancellation while initializing must not enqueue work in a replacement worker.
    if (ready !== this.ready || !this.worker) throw new DOMException('Cancelled', 'AbortError');
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('Algorithm time limit exceeded')), 30000);
      this.pending.set(id, {resolve, reject, timer});
      this.worker!.postMessage({id, input});
    });
  }
  cancel(): void {
    const error = new DOMException('Cancelled', 'AbortError');
    this.rejectReady?.(error); this.fail(error);
  }
}
