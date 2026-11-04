#!/bin/bash
task_root=$(cd "$(dirname "$0")" && pwd)
bash "$task_root/tools/install-macos.sh"
task_status=$?
if [ "$task_status" -ne 0 ]; then read -r -p 'Нажмите Enter, чтобы закрыть окно.'; fi
exit "$task_status"
