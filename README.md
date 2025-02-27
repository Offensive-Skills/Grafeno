
# Introducción

![image](./images/Grafeno.png)

Grafeno es una herramienta de automatización para el despliegue de entornos destinados a retos de **pentesting** y pruebas de penetración. Con Grafeno, tendrás acceso a centenares de desafíos de ciberseguridad, tanto de manera individual como en el marco de los cursos ofrecidos en la plataforma [offs.es](https://offs.es).

> Todos los entornos de prueba se despliegan localmente, lo que te permite realizar pruebas de penetración offline y perfeccionar tus **skills** en **ciberseguridad**.

# Instalación

La instalación de Grafeno es sencilla, ya que únicamente requiere que tengas **Docker** instalado en tu sistema. Se recomienda actualizar tu sistema antes de proceder:

```bash
sudo apt update && sudo apt upgrade -y
```

Luego, sigue las instrucciones oficiales para instalar Docker desde [la documentación de Docker](https://docs.docker.com/get-docker/).

> También se puede usar el fichero setup.sh ubicado en este repositorio.

Una vez esta listo, debemos instalarnos la herramienta:

```bash
sudo dpkg -i grafeno.deb
```
Para utilizar la herramienta necesitamos tener **credenciales válidas**:

Donde:
- `usuario`: es tu nombre de usuario.
- `api-token`: es el token asociado a tu cuenta.

Si aún no dispones de un token o no estás registrado, visita [offs.es](https://offs.es) para crear una cuenta.

# Notas adicionales

- Verifica que Docker esté funcionando correctamente antes de ejecutar Grafeno.
- Al gestionar todas las dependencias a través de Docker, Grafeno garantiza una experiencia homogénea en diferentes sistemas operativos.

---

# License

Grafeno © 2024 by Offensive Skills is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.

Puedes consultar más detalles sobre la licencia en el archivo [`LICENSE`](./LICENSE.md).
