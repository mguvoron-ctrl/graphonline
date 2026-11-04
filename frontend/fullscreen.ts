type ScreenDocument = Document & {webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void | Promise<void>};
type ScreenRoot = HTMLElement & {webkitRequestFullscreen?: () => void | Promise<void>};

// Fullscreen the document root so body-level menus and modal dialogs remain visible.
export class FullscreenController {
  active = false;
  private changing = false;
  private initialized = false;
  constructor(private readonly document: ScreenDocument,
    private readonly changed: (active: boolean) => void,
    private readonly issue: (key: string) => void) {
    document.addEventListener('fullscreenchange', () => this.sync());
    document.addEventListener('webkitfullscreenchange', () => this.sync());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.active) void this.toggle();
    });
    this.sync();
  }
  private get nativeElement(): Element | undefined | null {
    return this.document.fullscreenElement || this.document.webkitFullscreenElement;
  }
  private sync(): void {
    const active = this.nativeElement === this.document.documentElement;
    const notify = !this.initialized || this.active !== active;
    this.active = active; this.initialized = true;
    if (notify) this.changed(this.active);
  }
  async toggle(): Promise<void> {
    if (this.changing) return;
    this.changing = true;
    try {
      if (this.active) {
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
          this.issue('fullscreenUnavailable');
        }
      }
      this.sync();
    } finally { this.changing = false; }
  }
}
