#!/bin/bash

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <title> <version>"
    exit 1
fi

TITTLE=$1
VERSION=$2
NAME="${TITTLE}${VERSION}"

if docker ps --format '{{.Names}}' | grep -w "^$NAME$" > /dev/null; then
    # Contenedor activo, obtener la IP
    container_ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$NAME")
    echo "$container_ip"  # Devuelve la IP del contenedor
else
    echo "Inactive"  # No se encontró el contenedor activo
fi
