#!/bin/bash
set -uo pipefail

if [[ "$#" -ne 1 || ! "$1" =~ ^[0-9]+$ ]]; then
    printf 'Usage: %s <challenge_id>\n' "$0" >&2
    exit 2
fi

PROJECT="grafeno_$1"
CONTAINERS=$(docker ps -q \
    --filter "label=com.docker.compose.project=$PROJECT" \
    --filter 'label=grafeno.main=true' \
    --filter status=running)

if [[ -z "$CONTAINERS" ]]; then
    printf 'Inactive\n'
    exit 0
fi

readarray -t CONTAINER_IDS <<< "$CONTAINERS"
if [[ "${#CONTAINER_IDS[@]}" -ne 1 ]]; then
    printf 'Se esperaba exactamente un servicio principal activo para %s.\n' "$PROJECT" >&2
    printf 'Inactive\n'
    exit 0
fi

CONTAINER=${CONTAINER_IDS[0]}
MAIN_NETWORK=$(docker inspect --format '{{ index .Config.Labels "grafeno.main_network" }}' "$CONTAINER")
if [[ "$MAIN_NETWORK" == "<no value>" || "$MAIN_NETWORK" == "<nil>" ]]; then
    MAIN_NETWORK=
fi
NETWORKS=$(docker inspect --format '{{range $name, $network := .NetworkSettings.Networks}}{{printf "%s\t%s\n" $name $network.IPAddress}}{{end}}' "$CONTAINER")
BRIDGE_COUNT=0
SELECTED_IP=

while IFS=$'\t' read -r network_name ip_address; do
    [[ -n "$network_name" ]] || continue
    driver=$(docker network inspect --format '{{ .Driver }}' "$network_name" 2>/dev/null) || continue
    logical_name=$(docker network inspect --format '{{ index .Labels "com.docker.compose.network" }}' "$network_name" 2>/dev/null) || continue
    [[ "$driver" == "bridge" ]] || continue
    BRIDGE_COUNT=$((BRIDGE_COUNT + 1))
    if [[ -n "$MAIN_NETWORK" && "$logical_name" == "$MAIN_NETWORK" ]]; then
        SELECTED_IP=$ip_address
    elif [[ -z "$MAIN_NETWORK" ]]; then
        SELECTED_IP=$ip_address
    fi
done <<< "$NETWORKS"

if [[ -n "$MAIN_NETWORK" ]]; then
    if [[ -z "$SELECTED_IP" ]]; then
        printf 'La red principal configurada no está activa o no es bridge.\n' >&2
        printf 'Inactive\n'
        exit 0
    fi
elif [[ "$BRIDGE_COUNT" -ne 1 ]]; then
    printf 'No se puede desambiguar la red bridge del servicio principal.\n' >&2
    printf 'Inactive\n'
    exit 0
fi

printf '%s\n' "${SELECTED_IP:-Inactive}"
