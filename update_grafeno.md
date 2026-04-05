# Publicar una nueva versión de Grafeno

Este documento describe el proceso completo para publicar una nueva release: desde la preparación del código hasta la distribución automática de los paquetes.

---

## Cómo funciona el proceso

Al hacer push de un tag `v*` a GitHub, el workflow de CI/CD (`.github/workflows/release.yml`) se lanza automáticamente y:

- Compila para **Linux x64** y **Linux arm64**: `.deb`, `.AppImage`, `.rpm`
- Compila para **macOS arm64**: `.dmg`
- Genera de forma automatizada una nueva Release en GitHub asociada al tag subido
- Sube los binarios de instalación junto con los metadatos de control (`latest-linux.yml` y `latest-mac.yml`) necesarios para el mecanismo de auto-actualización de `electron-updater`

`electron-updater` detectará el nuevo release en todos los equipos con Grafeno instalado la próxima vez que abran la aplicación.

---

## Pasos para publicar una nueva versión

### 1. Preparar el código

Asegúrate de tener todos los cambios listos y commiteados en `main`:

```bash
git status        # no debe haber cambios pendientes
git pull          # sincronizar con origin
```

### 2. Subir la versión en `package.json`

Edita `package.json` y actualiza el campo `version`. Sigue [semver](https://semver.org/):

- **Patch** (`1.0.7` → `1.0.8`): corrección de bugs
- **Minor** (`1.0.7` → `1.1.0`): nueva funcionalidad compatible
- **Major** (`1.0.7` → `2.0.0`): cambio que rompe compatibilidad

O usa npm para que lo haga automáticamente:

```bash
npm version patch   # bug fix
npm version minor   # nueva funcionalidad
npm version major   # cambio mayor
```

> `npm version` actualiza `package.json`, hace commit y crea el tag automáticamente. Si lo haces así, **salta al paso 4**.


### 3. Commit con la nueva versión

Si has editado `package.json` manualmente:

```bash
npm install --package-lock-only
git add package.json package-lock.json
git commit -m "chore: bump version to 1.0.X"
```

### 4. Crear el tag de versión

```bash
git tag v1.0.X
```

### 5. Hacer push del commit y del tag

```bash
git push
git push --tags
```

Al hacer push del tag, el workflow de GitHub Actions se lanza automáticamente.

---

## Seguimiento del build en GitHub Actions

1. Ve a [`https://github.com/Offensive-Skills/Grafeno/actions`](https://github.com/Offensive-Skills/Grafeno/actions)
2. Verás el workflow **"Build releases"** en ejecución
3. Se crean **3 jobs en paralelo**:
   - `linux (x64)` — Ubuntu latest
   - `linux (arm64)` — Ubuntu latest (cross-compile)
   - `mac` — macOS 14 (Apple Silicon)
4. Al finalizar, `electron-builder` emplea el token de GitHub para generar y publicar la Release automáticamente. No es necesaria ninguna intervención manual en la interfaz de GitHub. Los instaladores quedan publicados bajo la ruta `/releases/tag/v1.0.X`

> ![Note] Draft Release
> No se sube directamente la release como pública, pero si pinchas dentro de las Releases de Grafeno, se puede ver que se ha creado la etiqueta como _Draft_ (Borrador), y que tiene los artefactos de MAC y Linux (x64 y amd) correctos para publicar la release. Solo hay que darle a "Editar", añadir notas si es que lo deseamos, y publicar.

---

## Lanzar el workflow manualmente (sin tag)

El workflow también admite ejecución manual, útil para probar que el build funciona sin publicar un release:

1. Ve a `https://github.com/Offensive-Skills/Grafeno/actions/workflows/release.yml`
2. Haz clic en **"Run workflow"**
3. Selecciona la rama `main`
4. Haz clic en **"Run workflow"**

En este caso los artefactos se generan pero **no se publican** en ningún release (porque no hay tag `v*`). Se pueden descargar desde la pestaña "Artifacts" del run.

---

## Compilar localmente (sin GitHub Actions)

Solo necesario para pruebas locales. Los binarios se generan en `dist/` (carpeta ignorada por git).

```bash
npm install

# Linux x64 (.deb, .AppImage, .rpm)
npm run dist:linux:x64

# Linux arm64 (.deb, .AppImage, .rpm)
npm run dist:linux:arm64

# macOS arm64 (.dmg) — requiere ejecutarse en un Mac
npm run dist:mac:arm64
```

---

## Artefactos generados

| Plataforma | Archivo | Uso |
|---|---|---|
| Linux x64 | `grafeno_X.Y.Z_x64.deb` | Debian, Ubuntu, Kali (64-bit) |
| Linux x64 | `grafeno_X.Y.Z_x64.AppImage` | Cualquier distro Linux (64-bit) |
| Linux x64 | `grafeno_X.Y.Z_x64.rpm` | Fedora, RHEL, CentOS (64-bit) |
| Linux arm64 | `grafeno_X.Y.Z_arm64.deb` | Raspberry Pi, ARM Debian/Ubuntu |
| Linux arm64 | `grafeno_X.Y.Z_arm64.AppImage` | Cualquier distro Linux ARM |
| Linux arm64 | `grafeno_X.Y.Z_arm64.rpm` | Fedora/RHEL en ARM |
| macOS arm64 | `grafeno_X.Y.Z_mac_arm64.dmg` | Mac con Apple Silicon (M1/M2/M3) |

---

## Notas

- El `GITHUB_TOKEN` que usa el workflow es automático — no necesitas configurar ningún secreto adicional.
- `electron-updater` solo detecta el nuevo release si el usuario tiene Grafeno instalado desde un paquete (`.deb`, `.AppImage`, etc.). En modo desarrollo (`npm start`) las actualizaciones automáticas no se comprueban.
- El auto-updater compara la versión del release con la de `package.json` embebida en la app instalada. Por eso es importante no saltarse versiones ni reutilizar tags existentes.
- Si una Release se edita manualmente en GitHub para convertirla de "Published" a "Draft", `electron-updater` no la detectará. Los metadatos en `latest*.yml` deben coincidir estrictamente con una release pública.
