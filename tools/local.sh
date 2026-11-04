#!/usr/bin/env bash
# Works with macOS's built-in Bash 3.2. No PHP or Node is required to run the app.
set -euo pipefail
task_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$task_root"
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.docker/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
task_action=${1:-start}
case "$task_action" in start|stop|logs) ;; *) echo "Usage: bash tools/local.sh [start|stop|logs]" >&2; exit 2 ;; esac

fail() { echo "$*" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || fail 'Install and open Docker Desktop first: https://www.docker.com/products/docker-desktop/'
task_system=$(uname -s)
if [ "$task_system" = Darwin ]; then
    docker_cli=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --context desktop-linux)
else
    docker_cli=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
fi
if ! "${docker_cli[@]}" info >/dev/null 2>&1; then
    if [ "$task_action" = stop ]; then echo 'Docker is stopped; GraphOnline is not running.'; exit 0; fi
    if [ "$task_system" = Darwin ]; then
        echo 'Starting Docker Desktop…'
        open -a Docker || fail 'Open Docker Desktop manually and run this command again.'
        for ((local_attempt=0; local_attempt<60; local_attempt++)); do
            if "${docker_cli[@]}" info >/dev/null 2>&1; then break; fi
            sleep 2
        done
    fi
    "${docker_cli[@]}" info >/dev/null 2>&1 || fail 'Docker is not ready. Open Docker Desktop and try again.'
fi
"${docker_cli[@]}" compose version >/dev/null 2>&1 || fail 'Docker Compose is required; update Docker Desktop.'
task_suffix=$(printf '%s' "$task_root" | cksum | awk '{print $1}')
task_project="graphonline-$task_suffix"
export GRAPHONLINE_UID="$(id -u)"
export GRAPHONLINE_GID="$(id -g)"
compose() { "${docker_cli[@]}" compose --project-name "$task_project" --file "$task_root/compose.yaml" "$@"; }
if [ "$task_action" = stop ]; then compose stop web; echo 'GraphOnline stopped. Your saved graphs are kept.'; exit 0; fi
if [ "$task_action" = logs ]; then compose logs --tail=60 web; exit 0; fi

test -s script/dist/core.js && test -s script/dist/main.css && test -s service-worker.js || fail 'Built files are missing. Use the complete release archive, or run npm ci && npm run build.'
command -v curl >/dev/null 2>&1 || fail 'curl is required to check application readiness.'
valid_port() { case "$1" in ''|*[!0-9]*) return 1 ;; esac; [ "$1" -ge 1024 ] && [ "$1" -le 65535 ]; }
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }
task_current=$(compose port web 8080 2>/dev/null | sed -n '1s/.*://p' || true)
task_port=${GRAPHONLINE_PORT:-}
if [ -z "$task_port" ] && valid_port "$task_current"; then task_port=$task_current; fi
if [ -z "$task_port" ] && [ -f .graphonline-port ]; then IFS= read -r task_port < .graphonline-port || true; fi
if [ -n "$task_port" ]; then
    valid_port "$task_port" || fail 'GRAPHONLINE_PORT must be a number between 1024 and 65535.'
    if [ "$task_port" != "$task_current" ] && port_busy "$task_port"; then
        fail "Port $task_port is in use. Stop its application, or choose another port: GRAPHONLINE_PORT=8090 bash tools/local.sh start"
    fi
else
    task_port=8080
    while port_busy "$task_port" && [ "$task_port" -lt 8090 ]; do task_port=$((task_port + 1)); done
    port_busy "$task_port" && fail 'Ports 8080–8090 are busy. Set GRAPHONLINE_PORT explicitly.'
fi
export GRAPHONLINE_PORT=$task_port
echo 'Starting GraphOnline. The first run downloads the official PHP image.'
compose up -d web
printf '%s\n' "$task_port" > .graphonline-port
task_check=$(mktemp "${TMPDIR:-/tmp}/graphonline.XXXXXX")
trap 'rm -f "$task_check"' EXIT
task_ready=false
for ((local_attempt=0; local_attempt<30; local_attempt++)); do
    if curl --noproxy '127.0.0.1,localhost' -fsS --max-time 2 "http://127.0.0.1:$task_port/" > "$task_check" 2>/dev/null && grep -Fq 'script/dist/core.js' "$task_check"; then
        task_ready=true; break
    fi
    sleep 1
done
if [ "$task_ready" != true ]; then compose logs --tail=30 web; fail 'GraphOnline did not become ready; see the logs above.'; fi
echo "GraphOnline is ready: http://localhost:$task_port"
echo 'Stop: bash tools/local.sh stop'
if [ "$task_system" = Darwin ]; then open "http://localhost:$task_port" || true; fi
