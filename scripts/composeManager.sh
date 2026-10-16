#!/bin/bash
set -euo pipefail

usage() {
    printf 'Usage: %s <start|stop> <challenge_id> <compose_file>\n' "$0" >&2
    exit 2
}

PHASE=validate
STATUS_EMITTED=0
OUTPUT_FILE=$(mktemp)
trap 'code=$?; if [[ "$STATUS_EMITTED" -eq 0 ]]; then printf "GRAFENO_STATUS=error phase=%s reason=script_failed\\n" "$PHASE"; fi; rm -f "$OUTPUT_FILE"; exit "$code"' EXIT

[[ "$#" -eq 3 ]] || usage
MODE=$1
CHALLENGE_ID=$2
COMPOSE_FILE=$3
[[ "$MODE" == "start" || "$MODE" == "stop" ]] || usage
[[ "$CHALLENGE_ID" =~ ^[0-9]+$ ]] || usage
[[ -f "$COMPOSE_FILE" ]] || { printf 'Compose cache not found.\n' >&2; printf 'GRAFENO_STATUS=error phase=validate reason=missing_compose\n'; exit 2; }

PROJECT="grafeno_${CHALLENGE_ID}"

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
        elif grep -Eqi 'pool overlaps|overlaps with (an )?existing network|overlap.*subnet' "$OUTPUT_FILE"; then
            reason=network_conflict
        else
            reason=command_failed
        fi
        printf 'GRAFENO_STATUS=error phase=%s reason=%s\n' "$PHASE" "$reason"
        STATUS_EMITTED=1
        return "$command_status"
    fi
    return 0
}

compose=(docker compose -p "$PROJECT" -f "$COMPOSE_FILE")

if [[ "$MODE" == "start" ]]; then
    progress_args=()
    compose_help=$(docker compose --help 2>&1 || true)
    if [[ "$compose_help" == *--progress* ]]; then
        progress_args=(--progress plain)
    fi
    run_step pull docker compose "${progress_args[@]}" -p "$PROJECT" -f "$COMPOSE_FILE" pull || exit $?
    run_step down "${compose[@]}" down -v --remove-orphans || exit $?
    run_step up "${compose[@]}" up -d --remove-orphans || exit $?
else
    run_step down "${compose[@]}" down -v --remove-orphans || exit $?
fi

printf 'GRAFENO_STATUS=ok\n'
STATUS_EMITTED=1
