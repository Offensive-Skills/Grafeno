#!/bin/bash
# setup_docker.sh - Script de instalación para la aplicación Grafeno, de Offensive Skills

# Descripción:
# - Instala Docker en el equipo (Ubuntu, Debian y Kali Linux).
# - Instala o actualiza Docker Engine y docker-compose-plugin a las versiones mínimas requeridas por Grafeno.
# - Elimina paquetes incompatibles de la distribución (docker-compose, docker-compose-v2, docker-buildx, podman-docker) que chocan con los oficiales.
# - Añade al usuario actual al grupo 'docker'.
# - Detecta la distribución mediante /etc/os-release (sin depender de lsb_release).
# - Puede ejecutarse de forma segura con: bash setup_docker.sh  (sin pipe de red)

set -euo pipefail  # Detiene el script ante cualquier error y falla si un pipe falla

# gw_priority necesita Docker Engine 28.0.0+ y Compose 2.33.1+.
MIN_ENGINE_VERSION="28.0.0"
MIN_COMPOSE_VERSION="2.33.1"

# Funciones para formatear la salida
function echo_info() {
    echo -e "\e[34m[INFO]\e[0m $1"
}

function echo_success() {
    echo -e "\e[32m[SUCCESS]\e[0m $1"
}

function echo_error() {
    echo -e "\e[31m[ERROR]\e[0m $1"
}

function print_separator() {
    echo -e "\e[90m------------------------------------------------------------\e[0m"
}

function print_banner() {
    clear
    echo -e "\e[35m==================================================="
    echo -e "      Instalador de Grafeno - Offensive Skills"
    echo -e "===================================================\e[0m"
    echo
}

function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

function version_ge() {
    # Devuelve 0 (ok) si $1 >= $2 en formato X.Y.Z
    local parts_a parts_b a b
    readarray -t parts_a < <(tr '.' '\n' <<< "$1")
    readarray -t parts_b < <(tr '.' '\n' <<< "$2")
    for i in 0 1 2; do
        a="${parts_a[i]:-0}"
        b="${parts_b[i]:-0}"
        if [ "$a" -gt "$b" ]; then return 0; fi
        if [ "$a" -lt "$b" ]; then return 1; fi
    done
    return 0
}

function detect_os() {
    # Detecta ID y codename desde /etc/os-release (presente en todas las distros objetivo)
    if [ ! -r /etc/os-release ]; then
        echo_error "No se pudo leer /etc/os-release. Distribución no soportada."
        exit 1
    fi
    . /etc/os-release
    local distro_id="${ID:-unknown}"
    local codename="${VERSION_CODENAME:-}"

    case "$distro_id" in
        kali)
            echo_info "Distribución detectada: Kali Linux"
            DOCKER_REPO_URL="https://download.docker.com/linux/debian"
            DOCKER_CODENAME="bookworm"
            ;;
        debian)
            echo_info "Distribución detectada: Debian ($codename)"
            DOCKER_REPO_URL="https://download.docker.com/linux/debian"
            DOCKER_CODENAME="$codename"
            ;;
        ubuntu|linuxmint|pop)
            echo_info "Distribución detectada: $NAME ($codename)"
            # Mint/Pop derivan de Ubuntu: priorizar UBUNTU_CODENAME (el codename de Mint no existe en el repo de Docker)
            DOCKER_REPO_URL="https://download.docker.com/linux/ubuntu"
            DOCKER_CODENAME="${UBUNTU_CODENAME:-${codename:-}}"
            if [ -z "$DOCKER_CODENAME" ]; then
                echo_error "No se pudo determinar el codename de Ubuntu base para $NAME."
                exit 1
            fi
            ;;
        *)
            echo_error "Distribución no soportada: '$distro_id'. Instala Docker manualmente: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac
}

function configure_docker_repo() {
    echo_info "Instalando paquetes base (ca-certificates, curl)..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg

    echo_info "Configurando el repositorio oficial de Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "${DOCKER_REPO_URL}/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] ${DOCKER_REPO_URL} ${DOCKER_CODENAME} stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null

    echo_info "Actualizando índices de paquetes..."
    apt-get update -y
}

function compose_plugin_ok() {
    if ! docker compose version >/dev/null 2>&1; then
        return 1
    fi
    local version
    version=$(docker compose version --short 2>/dev/null | tr -d 'v')
    [ -n "$version" ] && version_ge "$version" "$MIN_COMPOSE_VERSION"
}

function docker_cli_version() {
    docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1
}

function docker_cli_ok() {
    local version
    version=$(docker_cli_version) || return 1
    [ -n "$version" ] && version_ge "$version" "$MIN_ENGINE_VERSION"
}

function docker_engine_ok() {
    local version
    version=$(docker version --format '{{.Server.Version}}' 2>/dev/null) || return 1
    [ -n "$version" ] && version_ge "$version" "$MIN_ENGINE_VERSION"
}

function docker_needs_update() {
    if ! docker_cli_ok || ! compose_plugin_ok; then
        return 0
    fi
    if docker info >/dev/null 2>&1 && ! docker_engine_ok; then
        return 0
    fi
    return 1
}

function remove_conflicting_packages() {
    local pkg
    for pkg in docker-compose-v2 docker-compose docker-buildx docker-doc podman-docker; do
        if dpkg -s "$pkg" >/dev/null 2>&1; then
            echo_info "Eliminando paquete incompatible: $pkg"
            apt-get remove -y "$pkg"
        fi
    done
    if ! dpkg -s docker-compose >/dev/null 2>&1 && command_exists docker-compose; then
        echo_info "Aviso: existe un docker-compose fuera de apt. El plugin oficial se instalará igualmente y Grafeno usará 'docker compose'."
    fi
    if dpkg -s docker.io >/dev/null 2>&1; then
        echo_info "El paquete docker.io se sustituirá por el paquete oficial docker-ce."
    fi
    if command_exists snap && snap list docker >/dev/null 2>&1; then
        echo_info "Aviso: Docker está instalado como snap y puede tener prioridad sobre el paquete oficial. Desinstálalo con 'sudo snap remove docker' si Grafeno sigue detectando una versión antigua."
    fi
}

# Mostrar banner inicial
print_banner

# Verificar si se está ejecutando como root
if [ "$EUID" -ne 0 ]; then
    echo_error "Por favor, ejecuta este script como root o usando sudo."
    exit 1
fi

# Detectar el usuario no root que invocó sudo
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    USER_NAME="$SUDO_USER"
    USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6)
else
    echo_error "No se pudo identificar un usuario no root. Asegúrate de ejecutar el script con sudo desde una cuenta de usuario no root."
    exit 1
fi

print_separator
echo_info "Usuario identificado: $USER_NAME"
echo_info "Directorio home: $USER_HOME"
print_separator

detect_os
print_separator

# Paso 1: Configurar el repositorio de Docker cuando Docker Engine o el plugin Compose no cumplen el mínimo.
# Una vez configurado, apt instala tanto Docker Engine como el plugin desde el mismo repo.
if docker_needs_update; then
    if command_exists docker; then
        echo_info "Docker está instalado, pero no cumple los mínimos (Docker ${MIN_ENGINE_VERSION}+ y plugin Compose ${MIN_COMPOSE_VERSION}+). Se actualizará."
    else
        echo_info "Docker no está instalado. Se instalará Docker Engine junto con el plugin Compose."
    fi
    configure_docker_repo
    remove_conflicting_packages

    echo_info "Instalando Docker Engine y componentes..."
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    if docker_cli_ok && compose_plugin_ok; then
        if docker info >/dev/null 2>&1 && ! docker_engine_ok; then
            echo_error "Docker Engine sigue por debajo de la versión mínima ${MIN_ENGINE_VERSION}."
            exit 1
        fi
        echo_success "Docker y el plugin Compose se han instalado/actualizado correctamente (Docker ${MIN_ENGINE_VERSION}+, Compose ${MIN_COMPOSE_VERSION}+)."
    else
        echo_error "Fallo al instalar Docker o el plugin Compose."
        exit 1
    fi
else
    echo_success "Docker y el plugin Compose ya cumplen los mínimos (Docker ${MIN_ENGINE_VERSION}+, Compose ${MIN_COMPOSE_VERSION}+)."
fi
print_separator

# Paso 2: Añadir el usuario al grupo docker
echo_info "Verificando si el usuario '$USER_NAME' ya pertenece al grupo 'docker'..."
if id -nG "$USER_NAME" | grep -qw "docker"; then
    echo_success "El usuario '$USER_NAME' ya está en el grupo 'docker'."
else
    echo_info "Añadiendo al usuario '$USER_NAME' al grupo 'docker'..."
    usermod -aG docker "$USER_NAME"
    # Comprobación tras añadir
    if id -nG "$USER_NAME" | grep -qw "docker"; then
        echo_success "Usuario '$USER_NAME' añadido al grupo 'docker' correctamente."
        echo_info "Para aplicar los cambios sin reiniciar, ejecuta 'newgrp docker' en tu terminal actual."
        echo_info "O cierra sesión y vuelve a iniciarla."
    else
        echo_error "Fallo al añadir el usuario '$USER_NAME' al grupo 'docker'."
        echo_info "Intenta cerrar la sesión y volver a iniciarla para que los cambios surtan efecto."
    fi
fi
print_separator

echo_success "Instalación completada. ¡Listo para usar Grafeno!"
