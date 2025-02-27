#!/bin/bash

# Redirigir stdout y stderr a /dev/null
devnull="/dev/null"

# Obtener lista de contenedores con imágenes de harbor.offs.es
containers=$(docker ps -a --format "{{.ID}} {{.Image}}" | grep "harbor.offs.es" | awk '{print $1}')

# Detener y eliminar los contenedores
for container_id in $containers; do
    docker stop "$container_id" > "$devnull" 2>&1
    docker rm "$container_id" > "$devnull" 2>&1
done

# Obtener lista de imágenes de harbor.offs.es
images=$(docker images --format "{{.ID}} {{.Repository}}" | grep "harbor.offs.es" | awk '{print $1}')

# Eliminar las imágenes
for image_id in $images; do
    docker rmi -f "$image_id" > "$devnull" 2>&1
done
