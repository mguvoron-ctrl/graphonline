// Coalesce invalidations, while allowing exports to request a synchronous paint.
export class FrameScheduler {
  private frame?: number;
  constructor(private readonly render: () => void,
    private readonly request: (callback: FrameRequestCallback) => number = requestAnimationFrame,
    private readonly cancel: (id: number) => void = cancelAnimationFrame) {}
  invalidate(): void {
    if (this.frame !== undefined) return;
    this.frame = this.request(() => { this.frame = undefined; this.render(); });
  }
  flush(): void {
    if (this.frame === undefined) return;
    this.cancel(this.frame); this.frame = undefined; this.render();
  }
}
