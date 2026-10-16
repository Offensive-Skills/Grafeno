#!/bin/bash
set -euo pipefail

usage() {
    printf 'Usage: %s <domain> <title> <version> <mode>\n' "$0" >&2
    exit 2
}

PHASE=validate
STATUS_EMITTED=0
OUTPUT_FILE=$(mktemp)
trap 'code=$?; if [[ "$STATUS_EMITTED" -eq 0 ]]; then printf "GRAFENO_STATUS=error phase=%s reason=script_failed\\n" "$PHASE"; fi; rm -f "$OUTPUT_FILE"; exit "$code"' EXIT

[[ "$#" -eq 4 ]] || usage
DOMAIN=$1
TITLE=$2
VERSION=$3
MODE=$4
[[ "$TITLE" =~ ^[a-zA-Z0-9_-]+$ && "$VERSION" =~ ^[a-zA-Z0-9._-]+$ ]] || usage
[[ "$MODE" == 0 || "$MODE" == 1 ]] || usage

IMAGE="${DOMAIN}${TITLE}:${VERSION}"
CONTAINER_NAME="${TITLE}${VERSION}"

run_step() {
    PHASE=$1
    shift
    : > "$OUTPUT_FILE"
    set +e
    "$@" 2>&1 | tee "$OUTPUT_FILE"
    pipeline_status=("${PIPESTATUS[@]}")
    set -e
    command_status=${pipeline_status[0]}
    tee_status=${pipeline_status[1]:-1}
    if [[ "$command_status" -ne 0 || "$tee_status" -ne 0 ]]; then
        if grep -Eqi '401|unauthorized|authentication required|denied: requested access' "$OUTPUT_FILE"; then
            reason=unauthorized
        else
            reason=command_failed
        fi
        printf 'GRAFENO_STATUS=error phase=%s reason=%s\n' "$PHASE" "$reason"
        STATUS_EMITTED=1
        return "$command_status"
    fi
    return 0
}

container_exists() {
    docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1
}

container_running() {
    [[ "$(docker inspect --format='{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null)" == "true" ]]
}

if [[ "$MODE" == 0 ]]; then
    run_step pull docker pull "$IMAGE" || exit $?
    if container_exists; then
        run_step down docker rm -f "$CONTAINER_NAME" || exit $?
    fi
    run_step up docker run -d --name "$CONTAINER_NAME" "$IMAGE" || exit $?
else
    PHASE=down
    if container_running; then
        run_step down docker stop "$CONTAINER_NAME" || exit $?
    fi
fi

printf 'GRAFENO_STATUS=ok\n'
STATUS_EMITTED=1
