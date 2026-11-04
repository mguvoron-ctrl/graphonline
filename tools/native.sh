#!/usr/bin/env bash
# Native PHP launcher, compatible with macOS Bash 3.2.
set -euo pipefail
task_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$task_root"
export PATH="/opt/homebrew/opt/php@8.4/bin:/usr/local/opt/php@8.4/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
task_action=${1:-start}
task_state="$task_root/.graphonline-native"
task_pid=''
fail() { echo "$*" >&2; exit 1; }
valid_port() { case "$1" in ''|*[!0-9]*) return 1 ;; esac; [ "${#1}" -le 5 ] && [ "$1" -ge 1024 ] && [ "$1" -le 65535 ]; }
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }
server_running() {
    [ -f "$task_state/server.pid" ] || return 1
    IFS= read -r task_pid < "$task_state/server.pid" || return 1
    case "$task_pid" in ''|*[!0-9]*) return 1 ;; esac
    [ "$task_pid" -gt 1 ] || return 1
    local task_command
    task_command=$(ps -ww -p "$task_pid" -o command= 2>/dev/null) || return 1
    # Do not signal an unrelated process if the OS has reused a stale PID.
    case "$task_command" in *" -S 127.0.0.1:"*" -t $task_root $task_root/tools/router.php") return 0 ;; esac
    return 1
}
case "$task_action" in
    stop)
        if server_running; then
            kill "$task_pid"
            for ((task_attempt=0; task_attempt<30; task_attempt++)); do
                server_running || break
                sleep 0.1
            done
            if server_running; then fail 'Сервер ещё завершает работу. Повторите остановку через несколько секунд.'; fi
        fi
        rm -f "$task_state/server.pid"
        echo 'GraphOnline остановлен. Графы и черновики сохранены.'
        exit 0 ;;
    logs)
        if [ -f "$task_state/server.log" ]; then tail -n 60 "$task_state/server.log"; else echo 'Лог пока не создан.'; fi
        exit 0 ;;
    start) ;;
    *) fail 'Использование: bash tools/native.sh [start|stop|logs]' ;;
esac

command -v curl >/dev/null 2>&1 || fail 'Для проверки запуска нужен curl.'
test -s script/dist/core.js && test -s script/dist/main.css && test -s service-worker.js || fail 'Нет готовой сборки. Скачайте полный архив проекта или выполните npm ci && npm run build.'
task_existing=false
task_port=${GRAPHONLINE_PORT:-}
if server_running; then
    task_existing=true
    task_current=''
    IFS= read -r task_current < "$task_state/server.port" || true
    valid_port "$task_current" || fail 'Не удалось прочитать порт сервера. Сначала выполните bash tools/native.sh stop.'
    if [ -n "$task_port" ] && [ "$task_port" != "$task_current" ]; then fail 'Сначала остановите запущенный GraphOnline, затем выберите другой порт.'; fi
    task_port=$task_current
else
    task_php=${GRAPHONLINE_PHP:-php}
    command -v "$task_php" >/dev/null 2>&1 || fail 'Нужен PHP 8.4. На Mac откройте Install PHP.command: он установит нужные компоненты и запустит редактор. Инструкция: docs/macos.md'
    "$task_php" -r 'if (PHP_VERSION_ID < 80400) { fwrite(STDERR, "Нужен PHP 8.4 или новее. Установите: brew install php@8.4\n"); exit(1); } foreach (["dom", "zlib"] as $extension) { if (!extension_loaded($extension)) { fwrite(STDERR, "PHP: отсутствует расширение $extension. Используйте PHP из Homebrew.\n"); exit(1); } }'
    if [ -z "$task_port" ] && [ -f .graphonline-port ]; then IFS= read -r task_port < .graphonline-port || true; fi
    if [ -n "$task_port" ]; then
        valid_port "$task_port" || fail 'GRAPHONLINE_PORT должен быть числом от 1024 до 65535.'
        port_busy "$task_port" && fail "Порт $task_port занят. Остановите использующий его сервер или выберите другой: GRAPHONLINE_PORT=8090 bash tools/native.sh start"
    else
        task_port=8080
        while port_busy "$task_port" && [ "$task_port" -lt 8090 ]; do task_port=$((task_port + 1)); done
        port_busy "$task_port" && fail 'Порты 8080–8090 заняты. Укажите GRAPHONLINE_PORT.'
    fi
fi

mkdir -p "$task_state"
task_check=$(mktemp "${TMPDIR:-/tmp}/graphonline-native.XXXXXX")
task_starting=false
cleanup() {
    rm -f "$task_check"
    if [ "$task_starting" = true ]; then
        if server_running; then kill "$task_pid" 2>/dev/null || true; fi
        rm -f "$task_state/server.pid"
    fi
}
trap cleanup EXIT
if [ "$task_existing" != true ]; then
    # A single process keeps stop/restart predictable even if the user's shell sets this.
    unset PHP_CLI_SERVER_WORKERS
    nohup "$task_php" -d short_open_tag=On -S "127.0.0.1:$task_port" -t "$task_root" "$task_root/tools/router.php" > "$task_state/server.log" 2>&1 < /dev/null &
    task_pid=$!
    task_starting=true
    printf '%s\n' "$task_pid" > "$task_state/server.pid"
    printf '%s\n' "$task_port" > "$task_state/server.port"
fi
task_ready=false
for ((task_attempt=0; task_attempt<30; task_attempt++)); do
    server_running || break
    if curl --noproxy '127.0.0.1,localhost' -fsS --max-time 2 "http://127.0.0.1:$task_port/" > "$task_check" 2>/dev/null && grep -Fq 'script/dist/core.js' "$task_check"; then
        task_ready=true; break
    fi
    sleep 0.1
done
if [ "$task_ready" != true ]; then tail -n 30 "$task_state/server.log"; fail 'GraphOnline не запустился. См. лог выше.'; fi
printf '%s\n' "$task_port" > .graphonline-port
task_starting=false
echo "GraphOnline готов: http://localhost:$task_port"
echo 'Остановка: Stop GraphOnline.command или bash tools/native.sh stop'
if [ "$(uname -s)" = Darwin ]; then open "http://localhost:$task_port" || true; fi
