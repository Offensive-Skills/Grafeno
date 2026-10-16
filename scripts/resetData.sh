#!/bin/bash
set -uo pipefail

log() {
    printf '%s\n' "$*" >&2
}

while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    project=$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$container_id" 2>/dev/null) || continue
    if [[ "$project" == grafeno_* ]]; then
        docker rm -f "$container_id" >/dev/null 2>&1 || log "No se pudo eliminar el contenedor Compose $container_id"
    fi
done < <(docker ps -aq --filter 'label=com.docker.compose.project')

while IFS= read -r network_id; do
    [[ -n "$network_id" ]] || continue
    project=$(docker network inspect --format '{{ index .Labels "com.docker.compose.project" }}' "$network_id" 2>/dev/null) || continue
    if [[ "$project" == grafeno_* ]]; then
        docker network rm "$network_id" >/dev/null 2>&1 || log "No se pudo eliminar la red Compose $network_id"
    fi
done < <(docker network ls -q --filter 'label=com.docker.compose.project')

while IFS= read -r volume_name; do
    [[ -n "$volume_name" ]] || continue
    project=$(docker volume inspect --format '{{ index .Labels "com.docker.compose.project" }}' "$volume_name" 2>/dev/null) || continue
    if [[ "$project" == grafeno_* ]]; then
        docker volume rm "$volume_name" >/dev/null 2>&1 || log "No se pudo eliminar el volumen Compose $volume_name"
    fi
done < <(docker volume ls -q --filter 'label=com.docker.compose.project')

cache_dir="$HOME/.cache/grafeno/compose"
rm -rf -- "$cache_dir"

while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    image=$(docker inspect --format '{{.Config.Image}}' "$container_id" 2>/dev/null) || continue
    if [[ "$image" == *harbor.offs.es* ]]; then
        docker rm -f "$container_id" >/dev/null 2>&1 || true
    fi
done < <(docker ps -aq)

while IFS= read -r image_id; do
    [[ -n "$image_id" ]] || continue
    repository=$(docker image inspect --format '{{range .RepoTags}}{{println .}}{{end}}' "$image_id" 2>/dev/null) || continue
    if [[ "$repository" == *harbor.offs.es* ]]; then
        docker rmi -f "$image_id" >/dev/null 2>&1 || true
    fi
done < <(docker images -q | sort -u)
