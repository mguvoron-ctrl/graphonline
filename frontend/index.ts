export { History } from './history';
export { DraftStore } from './documents';
export { parseGraphML, exportGraphML } from './graphml';
export { AlgorithmRunner } from './runner';
export { Timeline } from './timeline';
export { GraphIndex, traversalSteps } from './graph-index';
export { initialLayout } from './layout';
export { LayoutRunner } from './layout-runner';
export { translate, status, download } from './ui';
import { DraftStore } from './documents';
export const drafts = new DraftStore();

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]!);
}
