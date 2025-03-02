

# Grafeno

![image](./images/logo_grafeno.png)

Grafeno es una herramienta de automatización para el despliegue de entornos destinados a retos de **pentesting** y pruebas de penetración. Con Grafeno, tendrás acceso a centenares de desafíos de ciberseguridad, tanto de manera individual como en el marco de los cursos ofrecidos en la plataforma de [`Offensive Skills`](https://offs.es).

> Todos los entornos de prueba se despliegan localmente, lo que te permite realizar pruebas de penetración offline y perfeccionar tus **skills** en **ciberseguridad**.

---

## Instalación

Puedes descargar directamente el paquete `.deb` incluido en la [página de releases](https://github.com/Offensive-Skills/Grafeno/releases) para instalar Grafeno de forma rápida y sencilla en sistemas basados en Debian/Ubuntu.

### Requisitos previos

- **Docker:** Grafeno requiere que Docker esté instalado y funcionando en tu sistema. Se recomienda actualizar tu sistema antes de proceder:

  > ***Nota:***
  > Si no tienes Docker instalado, ejecuta:
  > ```bash
  > sudo ./setup_docker.sh
  > ```
  >
  > O sigue las instrucciones en [la documentación de Docker](https://docs.docker.com/get-docker/).

- Actualiza tus repositorios y paquetes:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

### Instalación del paquete

1. Dirígete a la [página de releases](https://github.com/Offensive-Skills/Grafeno/releases) y descarga el archivo `.deb` correspondiente a la versión que deseas instalar.
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
> 1. Regístrate o inicia sesión en la [página de Offensive Skills](https://offs.es/escritorio).
> 2. Accede a la [gestión de API Tokens](https://offs.es/escritorio/api-token) para obtener tu token.
>
> **Campos solicitados al iniciar sesión:**
> - `usuario`: Tu nombre de usuario en [Offensive Skills](https://offs.es/escritorio)
> - `api-token`: El token asociado a tu cuenta, visible en la [página de API Tokens](https://offs.es/escritorio/api-token).

---

## Notas adicionales

- Verifica que Docker esté funcionando correctamente antes de ejecutar Grafeno.
- Al utilizar Docker para gestionar los entornos, Grafeno garantiza una experiencia homogénea en diferentes sistemas operativos.

---

## License

Grafeno © 2024 by Offensive Skills is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.

Consulta más detalles sobre la licencia en el archivo [`LICENSE`](./LICENSE.md).

