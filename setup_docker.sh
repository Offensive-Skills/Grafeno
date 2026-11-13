#!/bin/bash
# setup_docker.sh - Script de instalación para la aplicación Grafeno, de Offensive Skills

# Descripción:
# - Instala Docker en el equipo (Ubuntu, Debian, Kali Linux y Fedora 43+).
# - Instala o actualiza Docker Engine y docker-compose-plugin a las versiones mínimas requeridas por Grafeno.
# - Elimina paquetes incompatibles de la distribución que chocan con los oficiales.
# - Añade al usuario actual al grupo 'docker'.
# - Detecta la distribución mediante /etc/os-release (sin depender de lsb_release).
# - Puede ejecutarse de forma segura con: bash setup_docker.sh  (sin pipe de red)

set -euo pipefail  # Detiene el script ante cualquier error y falla si un pipe falla

# gw_priority necesita Docker Engine 28.0.0+ y Compose 2.33.1+.
MIN_ENGINE_VERSION="28.0.0"
MIN_COMPOSE_VERSION="2.33.1"

DISTRO_FAMILY=""
DOCKER_REPO_URL=""
DOCKER_CODENAME=""
DOCKER_REPO_FILE=""

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
    clear 2>/dev/null || true
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
    local version_id="${VERSION_ID:-}"

    case "$distro_id" in
        kali)
            DISTRO_FAMILY="apt"
            echo_info "Distribución detectada: Kali Linux"
            DOCKER_REPO_URL="https://download.docker.com/linux/debian"
            DOCKER_CODENAME="bookworm"
            ;;
        debian)
            DISTRO_FAMILY="apt"
            echo_info "Distribución detectada: Debian ($codename)"
            DOCKER_REPO_URL="https://download.docker.com/linux/debian"
            DOCKER_CODENAME="$codename"
            ;;
        ubuntu|linuxmint|pop)
            DISTRO_FAMILY="apt"
            echo_info "Distribución detectada: $NAME ($codename)"
            # Mint/Pop derivan de Ubuntu: priorizar UBUNTU_CODENAME (el codename de Mint no existe en el repo de Docker)
            DOCKER_REPO_URL="https://download.docker.com/linux/ubuntu"
            DOCKER_CODENAME="${UBUNTU_CODENAME:-${codename:-}}"
            if [ -z "$DOCKER_CODENAME" ]; then
                echo_error "No se pudo determinar el codename de Ubuntu base para $NAME."
                exit 1
            fi
            ;;
        fedora)
            DISTRO_FAMILY="dnf"
            local fedora_major="${version_id%%.*}"
            if ! [[ "$fedora_major" =~ ^[0-9]+$ ]] || (( fedora_major < 43 )); then
                echo_error "Fedora ${version_id:-desconocida} no está soportada. Se requiere Fedora 43 o superior."
                exit 1
            fi
            echo_info "Distribución detectada: Fedora $version_id"
            DOCKER_REPO_FILE="https://download.docker.com/linux/fedora/docker-ce.repo"
            ;;
        *)
            echo_error "Distribución no soportada: '$distro_id'. Instala Docker manualmente: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac
}

function configure_docker_repo_apt() {
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

function configure_docker_repo_dnf() {
    echo_info "Instalando paquetes base (ca-certificates, curl)..."
    dnf install -y ca-certificates curl

    echo_info "Configurando el repositorio oficial de Docker..."
    if ! dnf config-manager addrepo --from-repofile "$DOCKER_REPO_FILE" >/dev/null 2>&1; then
        echo_info "dnf config-manager no está disponible; descargando el repositorio directamente..."
        curl -fsSL "$DOCKER_REPO_FILE" -o /etc/yum.repos.d/docker-ce.repo
    fi
}

function configure_docker_repo() {
    case "$DISTRO_FAMILY" in
        apt)
            configure_docker_repo_apt
            ;;
        dnf)
            configure_docker_repo_dnf
            ;;
        *)
            echo_error "Gestor de paquetes no soportado: '$DISTRO_FAMILY'."
            exit 1
            ;;
    esac
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

function remove_conflicting_packages_apt() {
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

function remove_conflicting_packages_dnf() {
    local pkg
    for pkg in docker docker-client docker-client-latest docker-common \
               docker-latest docker-latest-logrotate docker-logrotate \
               docker-selinux docker-engine-selinux docker-engine \
               podman-docker; do
        if rpm -q "$pkg" >/dev/null 2>&1; then
            echo_info "Eliminando paquete incompatible: $pkg"
            dnf remove -y "$pkg"
        fi
    done
}

function remove_conflicting_packages() {
    case "$DISTRO_FAMILY" in
        apt)
            remove_conflicting_packages_apt
            ;;
        dnf)
            remove_conflicting_packages_dnf
            ;;
        *)
            echo_error "Gestor de paquetes no soportado: '$DISTRO_FAMILY'."
            exit 1
            ;;
    esac
}

function install_docker_packages() {
    case "$DISTRO_FAMILY" in
        apt)
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        dnf)
            dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        *)
            echo_error "Gestor de paquetes no soportado: '$DISTRO_FAMILY'."
            exit 1
            ;;
    esac
}

function ensure_docker_daemon() {
    echo_info "Iniciando el servicio de Docker..."
    systemctl enable --now docker || true

    if ! systemctl is-active --quiet docker; then
        if command_exists journalctl && journalctl -u docker --no-pager -n 100 2>/dev/null | grep -qi "failed to find iptables"; then
            echo_info "Ajustando iptables a nft para que Docker pueda arrancar..."
            alternatives --set iptables /usr/bin/iptables-nft || true
            systemctl restart docker || true
        fi
    fi

    if ! docker info >/dev/null 2>&1; then
        echo_error "Docker se ha instalado pero el daemon no responde. Revisa 'systemctl status docker'."
        exit 1
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
# Una vez configurado, el gestor de paquetes instala tanto Docker Engine como el plugin desde el mismo repo.
if docker_needs_update; then
    if command_exists docker; then
        echo_info "Docker está instalado, pero no cumple los mínimos (Docker ${MIN_ENGINE_VERSION}+ y plugin Compose ${MIN_COMPOSE_VERSION}+). Se actualizará."
    else
        echo_info "Docker no está instalado. Se instalará Docker Engine junto con el plugin Compose."
    fi
    configure_docker_repo
    remove_conflicting_packages

    echo_info "Instalando Docker Engine y componentes..."
    install_docker_packages
    ensure_docker_daemon

    if docker_cli_ok && compose_plugin_ok && docker_engine_ok; then
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
