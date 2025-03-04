#!/bin/bash
# setup.sh - Script de instalación para la aplicación Grafeno, de Offensive Skills

# Descripción:
# - Instala Docker en el equipo.
# - Añade al usuario actual al grupo 'docker'.
# - Mejora la visualización de los mensajes para facilitar la lectura y el seguimiento del proceso.

set -e  # Detiene el script ante cualquier error

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

# Mostrar banner inicial
print_banner

# Verificar si se está ejecutando como root
if [ "$EUID" -ne 0 ]; then
    echo_error "Por favor, ejecuta este script como root o usando sudo."
    exit 1
fi

# Detectar el usuario no root que invocó sudo
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    USER_NAME="$SUDO_USER"
    USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6)
else
    echo_error "No se pudo identificar un usuario no root. Asegúrate de ejecutar el script con sudo desde una cuenta de usuario no root."
    exit 1
fi

print_separator
echo_info "Usuario identificado: $USER_NAME"
echo_info "Directorio home: $USER_HOME"

# Detectar el directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo_info "Directorio del script: $SCRIPT_DIR"
print_separator

# Función para verificar si un comando existe
function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Paso 1: Instalación de Docker
echo_info "Verificando instalación de Docker..."
if command_exists docker; then
    echo_success "Docker ya está instalado en el sistema."
else
    OS=$(lsb_release -is)
    if [ "$OS" = "Kali" ]; then
        echo_info "Instalando Docker en Kali Linux..."
        apt-get install -y ca-certificates curl
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    else
        echo_info "Instalando Docker para Ubuntu..."
        apt-get install -y ca-certificates curl
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    fi

    echo_info "Actualizando índices de paquetes..."
    apt-get update -y

    echo_info "Instalando Docker Engine y componentes..."
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Verificar la instalación de Docker
    if command_exists docker; then
        echo_success "Docker instalado correctamente."
    else
        echo_error "Fallo al instalar Docker."
        exit 1
    fi
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
