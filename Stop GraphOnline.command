#!/bin/bash
task_root=$(cd "$(dirname "$0")" && pwd)
bash "$task_root/tools/local.sh" stop
task_status=$?
if [ "$task_status" -ne 0 ]; then read -r -p 'Press Enter to close this window.'; fi
exit "$task_status"
