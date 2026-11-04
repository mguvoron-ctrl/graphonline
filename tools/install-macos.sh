#!/usr/bin/env bash
# One-time, interactive macOS prerequisite installation.
set -euo pipefail
task_root=$(cd "$(dirname "$0")/.." && pwd)
export PATH="/opt/homebrew/opt/php@8.4/bin:/usr/local/opt/php@8.4/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[ "$(uname -s)" = Darwin ] || { echo 'Этот установщик предназначен для macOS.' >&2; exit 1; }
task_php=${GRAPHONLINE_PHP:-php}
if command -v "$task_php" >/dev/null 2>&1 && "$task_php" -r 'exit(PHP_VERSION_ID >= 80400 && extension_loaded("dom") && extension_loaded("zlib") ? 0 : 1);'; then
    echo 'PHP уже установлен. Запускаем GraphOnline.'
    exec bash "$task_root/tools/native.sh" start
fi
echo 'Для GraphOnline установим PHP 8.4 через Homebrew.'
echo 'Если Homebrew отсутствует, сначала запустится его официальный установщик.'
echo 'Первая установка скачивает инструменты и зависимости. Дальше повторять её не нужно.'
echo 'Установщик Homebrew может запросить пароль входа в Mac; при вводе символы не отображаются.'
if ! command -v brew >/dev/null 2>&1; then
    task_installer=$(mktemp "${TMPDIR:-/tmp}/graphonline-homebrew.XXXXXX")
    trap 'rm -f "$task_installer"' EXIT
    curl --fail --show-error --location --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$task_installer"
    /bin/bash "$task_installer"
fi
command -v brew >/dev/null 2>&1 || { echo 'Homebrew не установлен. Инструкция: https://brew.sh' >&2; exit 1; }
brew install php@8.4
bash "$task_root/tools/native.sh" start
