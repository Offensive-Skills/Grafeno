#!/bin/bash
# setup_docker.sh - Script de instalación para la aplicación Grafeno, de Offensive Skills

# Descripción:
# - Instala Docker en el equipo (Ubuntu, Debian y Kali Linux).
# - Instala o actualiza docker-compose-plugin a la versión mínima requerida por Grafeno.
# - Añade al usuario actual al grupo 'docker'.
# - Detecta la distribución mediante /etc/os-release (sin depender de lsb_release).
# - Puede ejecutarse de forma segura con: bash setup_docker.sh  (sin pipe de red)

set -euo pipefail  # Detiene el script ante cualquier error y falla si un pipe falla

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

# Paso 1: Configurar el repositorio de Docker cuando el plugin Compose no cumple el mínimo.
# Una vez configurado, apt instala tanto Docker Engine como el plugin desde el mismo repo.
if ! compose_plugin_ok; then
    if command_exists docker; then
        echo_info "Docker ya está instalado, pero el plugin docker-compose v${MIN_COMPOSE_VERSION}+ no cumple el mínimo requerido por Grafeno. Se actualizará."
    else
        echo_info "Docker no está instalado. Se instalará Docker Engine junto con el plugin Compose."
    fi
    configure_docker_repo

    echo_info "Instalando Docker Engine y componentes..."
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    if command_exists docker && compose_plugin_ok; then
        echo_success "Docker instalado/actualizado correctamente junto al plugin Compose."
    else
        echo_error "Fallo al instalar Docker o el plugin Compose."
        exit 1
    fi
else
    echo_success "Docker ya está instalado y el plugin Compose cumple la v${MIN_COMPOSE_VERSION}."
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
