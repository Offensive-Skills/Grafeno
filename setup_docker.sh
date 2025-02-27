#!/bin/bash

# setup.sh - Script de instalación para la aplicación Grafeno, de Offensive Skills

# Qué hace este script:
# - Instala Docker en el equipo
# - Añade al usuario actual al grupo 'docker'

# Función para mostrar mensajes informativos
function echo_info() {
    echo -e "\e[34m[INFO]\e[0m $1"
}

# Función para mostrar mensajes de éxito
function echo_success() {
    echo -e "\e[32m[SUCCESS]\e[0m $1"
}

# Función para mostrar mensajes de error
function echo_error() {
    echo -e "\e[31m[ERROR]\e[0m $1"
}

# Verificar si se está ejecutando como root
if [ "$EUID" -ne 0 ]; then
    echo_error "Por favor, ejecuta este script como root o usando sudo."
    exit 1
fi

# Función para verificar si un comando existe
function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Identificar el usuario no root que invocó sudo
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    USER_NAME="$SUDO_USER"
    USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6)
else
    echo_error "No se pudo identificar un usuario no root. Asegúrate de ejecutar el script con sudo desde una cuenta de usuario no root."
    exit 1
fi

echo_info "Usuario identificado: $USER_NAME con directorio home en $USER_HOME"

# Detectar el directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo_info "Directorio del script detectado: $SCRIPT_DIR"


# Instalar Docker
if command_exists docker; then
    echo_success "Docker ya está instalado."
else
    OS=$(lsb_release -is)
    if [ "$OS" = "Kali" ]; then
        echo_info "Instalando Docker en Kali Linux..."

        apt-get install -y ca-certificates curl

        install -m 0755 -d /etc/apt/keyrings

        curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc

        chmod a+r /etc/apt/keyrings/docker.asc

        echo \
            "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
            bookworm stable" | \
            sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

        # Actualizamos
        apt-get update -y

        # Instalamos Docker Engine
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    else
        echo_info "Instalando Docker para Ubuntu..."

        # Actualizar el índice de paquetes e instalar paquetes necesarios para usar el repositorio HTTPS
        apt-get install -y ca-certificates curl

        # Crear el directorio /etc/apt/keyrings
        install -m 0755 -d /etc/apt/keyrings        

        # Añadir la clave GPG oficial de Docker
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
        
        echo \
            "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
            $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
            sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

        # Actualizar el índice de paquetes
        apt-get update -y

        # Instalar Docker Engine
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi

    # Verificar la instalación de Docker
    if command_exists docker; then
        echo_success "Docker instalado correctamente."
    else
        echo_error "Fallo al instalar Docker."
        exit 1
    fi
fi

# 4. Añadir el usuario al grupo docker
if id -nG "$USER_NAME" | grep -qw "docker"; then
    echo_success "El usuario '$USER_NAME' ya está en el grupo 'docker'."
else
    echo_info "Añadiendo al usuario '$USER_NAME' al grupo 'docker'..."
    usermod -aG docker "$USER_NAME"
    if id -nG "$USER_NAME" | grep -qw "docker"; then
        echo_success "Usuario '$USER_NAME' añadido al grupo 'docker' correctamente."

        # Informar al usuario que debe aplicar los cambios de grupo
        echo_info "Para aplicar los cambios en el grupo 'docker' sin reiniciar, ejecuta 'newgrp docker' en tu terminal actual."
        echo_info "Si prefieres, puedes cerrar sesión y volver a iniciarla."
    else
        echo_error "Fallo al añadir el usuario '$USER_NAME' al grupo 'docker'."
        echo_info "Por favor, cierra la sesión y vuelve a iniciarla para que los cambios surtan efecto."
    fi
fi
