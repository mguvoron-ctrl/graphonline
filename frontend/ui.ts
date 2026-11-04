const messages: Record<string, [string, string]> = {
  layout: ['Расположить вершины', 'Arrange vertices'],
  layoutRunning: ['Расставляем вершины…', 'Arranging vertices…'],
  layoutCancel: ['Остановить раскладку', 'Stop layout'],
  layoutError: ['Не удалось улучшить расположение. Круговая раскладка сохранена.', 'Could not improve the layout. The circular layout is kept.'],
  negativeCycle: ['В графе есть отрицательный цикл: кратчайшие расстояния не определены.', 'The graph has a negative cycle: shortest distances are undefined.'],
  computing: ['Вычисление…', 'Computing…'],
  saving: ['Сохраняем…', 'Saving…'], saved: ['Сохранено на устройстве', 'Saved on this device'],
  published: ['Ссылка готова', 'Link ready'], saveError: ['Не удалось сохранить. Черновик остаётся на устройстве.', 'Could not save. Your local draft is kept.'],
  storageError: ['Не удалось сохранить черновик. Скачайте файл графа.', 'Could not save the draft. Download a graph file.'],
  loadError: ['Не удалось открыть граф. Текущий граф сохранён.', 'Could not open the graph. The current graph is kept.'],
  algorithmError: ['Не удалось выполнить алгоритм.', 'The algorithm could not complete.'],
  cancelled: ['Вычисление отменено', 'Computation cancelled'], cancel: ['Отменить вычисление', 'Cancel computation'],
  redo: ['Повторить', 'Redo'], pause: ['Пауза', 'Pause'], play: ['Продолжить', 'Play'],
  step: ['Следующий шаг', 'Next step'], back: ['Предыдущий шаг', 'Previous step']
};
export function translate(key: string): string {
  const entry = messages[key];
  return entry ? entry[document.documentElement.lang === 'ru' ? 0 : 1] : key;
}
export function status(key: string, error = false): void {
  let element = document.getElementById('document-status');
  if (!element) {
    element = document.createElement('div'); element.id = 'document-status';
    element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite');
    element.style.cssText = 'padding:4px 0;font-size:0.875rem';
    (document.getElementById('canvasSection') || document.body).prepend(element);
  }
  element.textContent = translate(key); element.style.color = error ? '#b42318' : '#475569';
}
export function download(data: string | Blob, type: string, name: string): void {
  const blob = typeof data === 'string' ? new Blob([data], {type}) : data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
