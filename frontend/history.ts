interface Checkpoint<T> { value: T; bytes: number }

export class History<T> {
  private past: Checkpoint<T>[] = [];
  private future: Checkpoint<T>[] = [];
  private bytes = 0;
  constructor(
    private readonly limit = 100,
    private readonly byteBudget = 16 * 1024 * 1024,
    private readonly estimate: (value: T) => number = value => typeof value === 'string' ? value.length * 2 : 1
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(byteBudget) || byteBudget < 0) throw new RangeError('Invalid history budget');
  }
  // XML is conservatively estimated as UTF-16 content; this is not a JS heap measurement.
  private checkpoint(value: T): Checkpoint<T> {
    const bytes = this.estimate(value);
    if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError('Invalid checkpoint size');
    return {value, bytes: Math.ceil(bytes)};
  }
  private trim(): void {
    while (this.past.length + this.future.length > this.limit || this.bytes > this.byteBudget) {
      // Keep the nearest redo states when reclaiming the far end of the future stack.
      const discarded = this.past.length ? this.past.shift() : this.future.shift();
      if (!discarded) break;
      this.bytes -= discarded.bytes;
    }
  }
  push(snapshot: T): void {
    const checkpoint = this.checkpoint(snapshot);
    for (const state of this.future) this.bytes -= state.bytes;
    this.future = [];
    this.past.push(checkpoint); this.bytes += checkpoint.bytes;
    this.trim();
  }
  undo(current: T): T | null {
    if (!this.past.length) return null;
    const checkpoint = this.checkpoint(current), previous = this.past.pop()!;
    this.bytes += checkpoint.bytes - previous.bytes;
    this.future.push(checkpoint); this.trim();
    return previous.value;
  }
  redo(current: T): T | null {
    if (!this.future.length) return null;
    const checkpoint = this.checkpoint(current), next = this.future.pop()!;
    this.bytes += checkpoint.bytes - next.bytes;
    this.past.push(checkpoint); this.trim();
    return next.value;
  }
  clear(): void { this.past = []; this.future = []; this.bytes = 0; }
  get estimatedBytes(): number { return this.bytes; }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
}
