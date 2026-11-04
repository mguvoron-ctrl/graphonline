type ScreenDocument = Document & {webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void | Promise<void>};
type ScreenRoot = HTMLElement & {webkitRequestFullscreen?: () => void | Promise<void>};

// Fullscreen the document root so body-level menus and modal dialogs remain visible.
export class FullscreenController {
  expanded = false;
  private fallback = false;
  private changing = false;
  private initialized = false;
  constructor(private readonly document: ScreenDocument,
    private readonly changed: (expanded: boolean) => void,
    private readonly issue: (key: string) => void) {
    document.addEventListener('fullscreenchange', () => this.sync());
    document.addEventListener('webkitfullscreenchange', () => this.sync());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.expanded) void this.toggle();
    });
    this.sync();
  }
  private get nativeElement(): Element | undefined | null {
    return this.document.fullscreenElement || this.document.webkitFullscreenElement;
  }
  private sync(): void {
    const expanded = this.nativeElement === this.document.documentElement || this.fallback;
    const notify = !this.initialized || this.expanded !== expanded;
    this.expanded = expanded; this.initialized = true;
    this.document.documentElement.classList.toggle('graphonline-fullscreen', this.expanded);
    if (notify) this.changed(this.expanded);
  }
  async toggle(): Promise<void> {
    if (this.changing) return;
    this.changing = true;
    try {
      if (this.expanded) {
        this.fallback = false;
        if (this.nativeElement === this.document.documentElement) {
          const exit = this.document.exitFullscreen || this.document.webkitExitFullscreen;
          try {
            if (!exit) throw new Error('Exit fullscreen unavailable');
            await exit.call(this.document);
          } catch { if (this.nativeElement === this.document.documentElement) this.issue('fullscreenExitError'); }
        }
      } else {
        const root = this.document.documentElement as ScreenRoot;
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        try {
          if (!request) throw new Error('Fullscreen unavailable');
          await request.call(root);
        } catch {
          this.fallback = true; this.issue('fullscreenFallback');
        }
      }
      this.sync();
    } finally { this.changing = false; }
  }
}
