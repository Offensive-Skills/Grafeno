[English](./README_EN.md) | Español

# Grafeno

![image](./images/logo_grafeno.png)

Grafeno es una herramienta de automatización para el despliegue de entornos destinados a retos de **pentesting** y pruebas de penetración. Con Grafeno, tendrás acceso a centenares de desafíos de ciberseguridad, tanto de manera individual como en el marco de los cursos ofrecidos en la plataforma de [`Offensive Skills`](https://offs.es).

> Todos los entornos de prueba se despliegan localmente, lo que te permite realizar pruebas de penetración offline y perfeccionar tus **skills** en **ciberseguridad**.

---

## Instalación

Descarga el paquete `.deb` desde la [página de releases de GitHub](https://github.com/Offensive-Skills/Grafeno/releases) o desde [offs.es/tools](https://offs.es/tools) — ambas ofrecen el mismo binario — para instalar Grafeno de forma rápida y sencilla en sistemas basados en Debian/Ubuntu.

> Para una guía de instalación ilustrada paso a paso (con capturas, primer login y despliegue de tu primer reto), consulta [`install_grafeno.md`](./install_grafeno.md).

### Requisitos previos

- **Docker:** Grafeno requiere Docker Engine 28.0.0 o superior y el plugin Docker Compose 2.33.1 o superior (`docker compose`, no el antiguo `docker-compose`). Se recomienda actualizar tu sistema antes de proceder:

  > ***Nota:***
  > Si no tienes Docker instalado (o tu versión es anterior a la mínima), ejecuta el instalador:
  > ```bash
  > curl -fsSL 'https://raw.githubusercontent.com/Offensive-Skills/Grafeno/main/setup_docker.sh' | sudo bash -s
  > ```
  >
  > El instalador integrado soporta **Ubuntu, Debian y Kali Linux**. En **Fedora** instala Docker Engine manualmente desde el [repositorio oficial de Docker](https://docs.docker.com/engine/install/fedora/); Grafeno detectará Docker y el plugin `docker compose` una vez instalados.
  >
  > O sigue las instrucciones en [la documentación de Docker](https://docs.docker.com/get-docker/).

- Actualiza tus repositorios y paquetes:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

### Instalación del paquete

1. Dirígete a la [página de releases de GitHub](https://github.com/Offensive-Skills/Grafeno/releases) o a [offs.es/tools](https://offs.es/tools) y descarga el archivo `.deb` correspondiente a la versión que deseas instalar.
2. Instala el paquete descargado ejecutando en una terminal:
   ```bash
   sudo dpkg -i grafeno-x.y.z.deb
   ```
   *(Reemplaza `grafeno-x.y.z.deb` por el nombre del archivo descargado.)*
3. Si durante la instalación faltan dependencias, corrígelas con:
   ```bash
   sudo apt install -f
   ```

---

## Ejecución

Una vez instalado Grafeno, puedes ejecutarlo directamente desde el menú de aplicaciones de tu sistema o desde la terminal con el comando:

```bash
grafeno
```

> ***Nota Importante:***
> Necesitas tener **credenciales** válidas para poder acceder a Grafeno. Para obtenerlas:
> 1. Regístrate en [offs.es/register](https://offs.es/register) e inicia sesión.
> 2. Accede a la [gestión de API Tokens](https://offs.es/dashboard/api-token) para obtener tu token.
>
> **Campos solicitados al iniciar sesión:**
> - `usuario`: Tu nombre de usuario en [Offensive Skills](https://offs.es)
> - `api-token`: El token asociado a tu cuenta, visible en la [página de API Tokens](https://offs.es/dashboard/api-token).

---

## Desarrollo

### Ejecutar Grafeno en modo desarrollo

Para ejecutar Grafeno desde el código fuente en modo desarrollo:

```bash
npm start
```

### Abrir herramientas de desarrollador

Para abrir las DevTools de Chromium (Inspector de elementos, consola, etc.), ejecuta:

```bash
GRAFENO_DEVTOOLS=1 npm start
```

La variable de entorno `GRAFENO_DEVTOOLS=1` abre automáticamente las herramientas de desarrollador al iniciar la aplicación.

---

## Notas adicionales

- Verifica que Docker esté funcionando correctamente antes de ejecutar Grafeno.
- Al utilizar Docker para gestionar los entornos, Grafeno garantiza una experiencia homogénea en diferentes sistemas operativos.

---

## Actualizaciones

- **Linux:** Grafeno comprueba actualizaciones al arrancar, cada 6 horas y desde **Configuración > Actualizaciones**. La descarga se puede cancelar y, en `.deb`/`.rpm`, la instalación pide la contraseña sudo.
- **macOS:** la actualización automática está desactivada. Descarga el `.dmg` de la release e instálalo manualmente.
- Si la actualización automática falla, descarga el paquete de la release e instálalo manualmente.

---

## License

Grafeno © 2024 by Offensive Skills is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.

Consulta más detalles sobre la licencia en el archivo [`LICENSE`](./LICENSE.md).
