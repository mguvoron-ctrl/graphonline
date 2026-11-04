export interface Draft { xml: string; reference: string; updatedAt: number }

// Serialize transactions so an older asynchronous save cannot replace a newer one.
export class DraftStore {
  private pending: Promise<unknown> = Promise.resolve();
  private async database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('graphonline-documents', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('documents');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  private async transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', mode);
      const request = action(tx.objectStore('documents'));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || request.error); };
    });
  }
  save(draft: Draft): Promise<void> {
    const operation = this.pending.catch(() => {}).then(() => this.transaction('readwrite', store => store.put(draft, 'draft')));
    this.pending = operation;
    return operation.then(() => {});
  }
  async load(): Promise<Draft | undefined> {
    await this.pending.catch(() => {});
    return this.transaction('readonly', store => store.get('draft'));
  }
  clear(): Promise<void> {
    const operation = this.pending.catch(() => {}).then(() => this.transaction('readwrite', store => store.delete('draft')));
    this.pending = operation;
    return operation.then(() => {});
  }
}
