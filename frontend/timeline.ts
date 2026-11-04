export class Timeline<T> {
  index = 0;
  private timer?: ReturnType<typeof setInterval>;
  constructor(readonly frames: readonly T[], private readonly render: (frame: T, index: number) => void) {
    if (!frames.length) throw new Error('A timeline needs an initial frame');
  }
  get playing(): boolean { return this.timer !== undefined; }
  refresh(): void { this.render(this.frames[this.index], this.index); }
  next(): void { if (this.index < this.frames.length - 1) this.index++; else this.pause(); this.refresh(); }
  back(): void { this.pause(); this.index = Math.max(0, this.index - 1); this.refresh(); }
  play(milliseconds = 500): void {
    this.pause();
    if (this.index === this.frames.length - 1) this.index = 0;
    this.timer = setInterval(() => this.next(), Math.max(100, milliseconds)); this.refresh();
  }
  pause(): void { clearInterval(this.timer); this.timer = undefined; }
}
