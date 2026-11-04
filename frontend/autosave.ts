export interface DocumentSnapshot { xml: string; reference: string }

// A completed older write must never mark a more recent edit as saved.
export class Autosave {
  private revision = 0;
  private savedRevision = -1;
  private snapshot?: DocumentSnapshot;
  private timer?: ReturnType<typeof setTimeout>;
  private writing?: Promise<void>;
  constructor(private readonly read: () => DocumentSnapshot,
    private readonly write: (snapshot: DocumentSnapshot) => Promise<void>,
    private readonly onError: (error: unknown) => void,
    private readonly delay = 400) {}
  get dirty(): boolean { return this.revision !== this.savedRevision; }
  get currentRevision(): number { return this.revision; }
  changed(): void { this.revision++; }
  notePersisted(snapshot: DocumentSnapshot): void { this.snapshot = {...snapshot}; }
  schedule(): void {
    if (!this.dirty) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush().catch(this.onError), this.delay);
  }
  async flush(force = false): Promise<void> {
    clearTimeout(this.timer); this.timer = undefined;
    if (this.writing) { await this.writing; return this.flush(force); }
    if (!force && !this.dirty) return;
    const revision = this.revision, snapshot = this.read();
    if (snapshot.xml === this.snapshot?.xml && snapshot.reference === this.snapshot.reference) {
      this.savedRevision = revision; return;
    }
    this.writing = this.write(snapshot);
    try {
      await this.writing;
      this.notePersisted(snapshot); this.savedRevision = revision;
    } finally { this.writing = undefined; }
  }
}
