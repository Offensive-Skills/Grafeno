# Publicar una nueva versión de Grafeno

Este documento describe el proceso completo para publicar una nueva release: desde la preparación del código hasta la distribución automática de los paquetes.

---

## Cómo funciona el proceso

Al hacer push de un tag `v*` a GitHub, el workflow de CI/CD (`.github/workflows/release.yml`) se lanza automáticamente y:

- Compila para **Linux x64** y **Linux arm64**: `.deb`, `.AppImage`, `.rpm`
- Compila para **macOS arm64**: `.dmg`
- Sube los binarios y los metadatos de control (`latest-linux.yml`, `latest-linux-arm64.yml` y `latest-mac.yml`) como artefactos del workflow
- En un **job de publicación único**, verifica que los tres metadatos existen, crea o actualiza el borrador de Release y sube todos los assets de una sola vez
- Vuelve a verificar contra la Release que los tres `latest*.yml` están presentes

Así ninguna release puede quedar publicada sin sus metadatos de auto-actualización.

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

> `npm version` actualiza `package.json` y `package-lock.json`, hace commit y crea el tag automáticamente. Si lo haces así, **salta directamente al paso 5**.


### 3. Commit con la nueva versión

Si has editado `package.json` manualmente:

```bash
npm install --package-lock-only
git add package.json package-lock.json
git commit -m "chore: bump version to X.Y.Z"
```

### 4. Crear el tag de versión

```bash
git tag vX.Y.Z
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
3. Se crean **3 jobs de build en paralelo**:
   - `build-linux (x64)` — Ubuntu latest
   - `build-linux (arm64)` — Ubuntu latest (cross-compile)
   - `build-mac` — macOS 15 (Apple Silicon)
4. Cada job de build compila con `-p never` y sube sus binarios y sus `latest*.yml` como artefactos del workflow.
5. Cuando terminan los tres, se ejecuta el job **`publish`**:
   - Descarga todos los artefactos.
   - Ejecuta `scripts/verifyUpdateMetadata.js`, que comprueba versión, ficheros, tamaños y `sha512` de `latest-linux.yml`, `latest-linux-arm64.yml` y `latest-mac.yml`.
   - Crea el borrador de Release si no existe y sube todos los assets con `gh release upload --clobber`.
   - Verifica contra la Release que los tres metadatos están subidos; si falta alguno, el workflow falla.
6. La Release queda como **Draft**. No hace falta tocar los assets a mano: solo añadir notas si se desea y publicar.

> ![Note] Draft Release
> No se sube directamente la release como pública, pero si pinchas dentro de las Releases de Grafeno, se puede ver que se ha creado la etiqueta como _Draft_ (Borrador), y que tiene todos los artefactos de macOS y Linux (x64 y arm64) y sus metadatos. Solo hay que darle a "Editar", añadir notas si es que lo deseamos, y publicar.

> **WARNING:** No reemplaces un binario de una Release a mano sin regenerar y volver a subir su `latest*.yml`. El yml incluye `sha512` y `size` del binario; si no coinciden, `electron-updater` rechaza la actualización. Si tienes que rehacer un paquete, vuelve a lanzar el workflow del tag o sube también el yml generado por `electron-builder` para ese binario.

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

## Actualización manual y clientes antiguos

- Si la actualización automática falla, descarga el `.deb`, `.AppImage` o `.dmg` de la Release e instálalo manualmente. En Linux:
  ```bash
  sudo apt install ./grafeno_X.Y.Z_amd64.deb
  ```
- Las versiones **≤ 1.0.8** usan `electron-updater` 6.3.9, que no tiene fallback a `sudo` si no encuentra `gksudo`, `kdesudo`, `pkexec` ni `beesu`. En esos sistemas la instalación automática del `.deb` falla; hay que actualizar a mano una vez. La 2.2.0 ya usa 6.8.3, que sí tiene fallback.
- La release **v2.2.0** no tiene `latest-linux.yml` para x64 (se perdió al reemplazar los binarios a mano). Los clientes anteriores a 2.2.0 no verán esa versión; la siguiente Release publicada con el workflow nuevo incluirá todos los metadatos y se actualizarán directamente a ella.

## macOS: actualización manual

La autoactualización está **desactivada en macOS** a propósito. Los usuarios de macOS deben descargar el `.dmg` de la Release e instalarlo manualmente.

El workflow sigue generando `latest-mac.yml` porque `electron-builder` lo crea al empaquetar, pero Grafeno no lo usa para actualizarse. Para habilitar la autoactualización en macOS en el futuro haría falta:

- añadir el target `zip` al build de macOS (Squirrel.Mac no instala DMGs);
- firmar y notarizar la app con un Apple Developer ID (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, etc.).

Sin firma, aunque hubiera zip, Squirrel.Mac rechazaría la actualización.
