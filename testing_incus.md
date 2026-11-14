# Pruebas de integración con Incus

Este documento define el procedimiento oficial para probar Grafeno. A partir de ahora, las pruebas de integración y la validación de artefactos se ejecutan en VMs reales de Incus, no en contenedores ni en quickemu.

El objetivo es que cualquier persona pueda reproducir una prueba desde cero: construir una release candidata, instalar los paquetes en Ubuntu y Fedora, comprobar el arranque de la aplicación, validar Docker y probar el flujo de actualización.

---

## Requisitos y límites

- Host NixOS con Incus 7 o superior.
- El usuario debe pertenecer al grupo `incus`; el cliente queda confinado al proyecto `user-1000`.
- **Nunca** ejecutar `sudo incus` ni usar el grupo `incus-admin`.
- Imágenes oficiales:
  - Ubuntu: `images:ubuntu/26.04/cloud`
  - Fedora: `images:fedora/44/cloud`
- Son VMs reales (KVM). Un `incus launch` sin `--vm` crea un contenedor y no es válido para estas pruebas.
- Límites: máximo 3 VMs simultáneas, 2 vCPU, 4 GiB de RAM y 25 GiB de disco por VM.
- Red: DHCP propio, DNS/NAT e Internet público. La LAN, la VPN, las redes Docker y las IPs de producción están bloqueadas. No cambiar el firewall ni las rutas.
- El gateway `10.164.42.1` no responde a ICMP a propósito.
- Los snapshots caducan a los 2 días. Restaurar requiere `sudo`, así que si hace falta volver atrás se crea una VM nueva.
- No hay autostart: un reinicio del host no levanta las VMs.

---

## Convenciones de la ejecución

Usa un directorio de trabajo por ejecución para guardar hashes, logs y capturas:

```bash
export RUN_DIR="/tmp/opencode/grafeno-incus-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN_DIR"
```

Nombres de VM recomendados, con marca de tiempo para no reutilizar una VM contaminada:

```bash
STAMP=$(date +%s)
export UBUNTU_VM="grafeno-test-ubuntu-$STAMP"
export FEDORA_VM="grafeno-test-fedora-$STAMP"
printf '%s\n%s\n' "$UBUNTU_VM" "$FEDORA_VM" > "$RUN_DIR/vms.txt"
```

Los usuarios de las imágenes cloud son `ubuntu` y `fedora`, respectivamente. Ambos tienen `sudo` sin contraseña. Para que el flujo de contraseña de Grafeno siga siendo válido, se puede introducir cualquier valor en la ventana de prueba: el `sudo` de la VM no lo valida.

No guardes tokens reales de Grafeno, contraseñas reales ni credenciales de producción en logs, capturas o comandos documentados.

---

## 1. Pruebas de unidad en el host

Las pruebas que no necesitan una VM se ejecutan en el host antes de construir artefactos:

```bash
npm test
bash -n setup_docker.sh
nix-shell -p shellcheck --run 'shellcheck -S warning setup_docker.sh'
```

`npm test` cubre la lógica de actualizaciones, política de instalación, metadatos, i18n y asignación de redes Docker. El resultado esperado es `34/34` en la versión actual del repositorio.

Si se modifica el workflow de release, valida también con `actionlint`.

---

## 2. Construir una release candidata

Las pruebas de instalación necesitan paquetes reales. `dist/` está ignorado por git; no se commitea ningún artefacto.

### 2.1. Guardar la versión base

```bash
BASE_VERSION=$(node -p "require('./package.json').version")
TEST_VERSION="2.2.1-test.2"   # Incrementar el sufijo en cada ejecución
```

### 2.2. Cambiar la versión temporalmente

```bash
npm version "$TEST_VERSION" --no-git-tag-version
```

### 2.3. Compilar

En CI se usa `npm run dist:linux:x64`. En NixOS, el `fpm` empaquetado por electron-builder espera `/bin/bash` y falla; hay que usar el `fpm` del entorno Nix:

```bash
nix-shell -p fpm dpkg rpm --run 'USE_SYSTEM_FPM=true npm run dist:linux:x64'
```

Salida esperada en `dist/`:

```text
grafeno_<TEST_VERSION>_amd64.deb
grafeno_<TEST_VERSION>_x86_64.rpm
grafeno_<TEST_VERSION>_x86_64.AppImage
latest-linux.yml
```

Para probar una actualización hace falta un paquete de destino con una versión superior. Se puede compilar solo el target necesario:

```bash
npm version 2.2.1-test.3 --no-git-tag-version
nix-shell -p fpm dpkg rpm --run 'USE_SYSTEM_FPM=true npx electron-builder --linux deb --x64 -p never'
# o --linux rpm --x64 para Fedora
```

### 2.4. Restaurar la versión y comprobar el árbol

```bash
npm version "$BASE_VERSION" --no-git-tag-version
git status --short
git diff --exit-code
```

El árbol debe quedar limpio. Si había cambios funcionales pendientes, deben estar commiteados antes de esta fase. No dejes nunca una versión de prueba en `package.json`.

### 2.5. Verificar integridad

```bash
sha256sum dist/grafeno_${TEST_VERSION}_* dist/latest-linux.yml | tee "$RUN_DIR/hashes.txt"
```

Comprueba que el instalador de Docker empaquetado es el del repositorio:

```bash
sha256sum setup_docker.sh dist/linux-unpacked/resources/app.asar.unpacked/setup_docker.sh
```

Los dos hashes deben coincidir.

---

## 3. Crear las VMs

```bash
incus launch images:ubuntu/26.04/cloud "$UBUNTU_VM" --vm
incus launch images:fedora/44/cloud "$FEDORA_VM" --vm
incus list
```

`RUNNING` no significa que el agente esté listo. Espera al agente (máximo 5 minutos por VM):

```bash
for vm in "$UBUNTU_VM" "$FEDORA_VM"; do
  echo "[*] Esperando agente en $vm"
  timeout 300 bash -c "until incus exec '$vm' -- true 2>/dev/null; do sleep 2; done"
  incus exec "$vm" -- uname -r
  incus exec "$vm" -- nproc
  incus exec "$vm" -- free -m | sed -n '1,2p'
done
```

Comprueba que existen los usuarios y que `sudo` funciona:

```bash
incus exec "$UBUNTU_VM" -- su - ubuntu -c 'id; sudo -n true && echo SUDO_OK'
incus exec "$FEDORA_VM" -- su - fedora -c 'id; sudo -n true && echo SUDO_OK'
```

---

## 4. Transferir artefactos

Copia los paquetes a `/tmp` de cada VM y verifica el hash en ambos lados:

```bash
incus file push "dist/grafeno_${TEST_VERSION}_amd64.deb" "$UBUNTU_VM/tmp/grafeno.deb"
incus file push "dist/grafeno_${TEST_VERSION}_x86_64.rpm" "$FEDORA_VM/tmp/grafeno.rpm"

incus exec "$UBUNTU_VM" -- sha256sum /tmp/grafeno.deb
incus exec "$FEDORA_VM" -- sha256sum /tmp/grafeno.rpm
```

Compara con `hashes.txt`. Si el destino ya existe y es propiedad de root, usa un nombre nuevo o elimínalo primero:

```bash
incus exec "$UBUNTU_VM" -- rm -f /tmp/grafeno.deb
```

---

## 5. Instalar los paquetes

### 5.1. Ubuntu: `.deb`

```bash
incus exec "$UBUNTU_VM" -- bash -c '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y /tmp/grafeno.deb
'
```

Verifica versión y dependencias:

```bash
incus exec "$UBUNTU_VM" -- dpkg-query -W -f='${Package} ${Version} ${Status}\n' grafeno
incus exec "$UBUNTU_VM" -- dpkg-deb -f /tmp/grafeno.deb Depends
```

El paquete debe declarar `libasound2` y `libgbm1`, además de las dependencias de GTK y Electron. Una instalación limpia de Ubuntu cloud debe instalar `libasound2t64` automáticamente.

Para repetir la prueba de dependencias desde cero:

```bash
incus exec "$UBUNTU_VM" -- bash -c '
  apt-get purge -y grafeno
  apt-get remove -y libasound2t64
  apt-get install -y /tmp/grafeno.deb
'
```

Después comprueba que `libasound2t64` volvió a quedar instalado y que la app arranca.

### 5.2. Fedora: `.rpm`

```bash
incus exec "$FEDORA_VM" -- bash -c '
  dnf -y makecache
  dnf install -y /tmp/grafeno.rpm
'
```

Los paquetes locales de Grafeno no están firmados con GPG. DNF acepta un paquete local de `@commandline`, pero para actualizaciones se usa `rpm -U --nosignature`, que es exactamente lo que hace Grafeno.

Verifica versión y dependencias:

```bash
incus exec "$FEDORA_VM" -- rpm -q grafeno
incus exec "$FEDORA_VM" -- rpm -qR grafeno | grep -E 'alsa-lib|mesa-libgbm|gtk3|nss'
```

El paquete debe declarar `alsa-lib` y `mesa-libgbm`.

### 5.3. Dependencias para pruebas headless

La app es Electron; en una imagen cloud sin escritorio hay que instalar un servidor X virtual:

```bash
incus exec "$UBUNTU_VM" -- bash -c '
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y xvfb xauth xdotool dbus-x11 scrot
'

incus exec "$FEDORA_VM" -- bash -c '
  dnf install -y xorg-x11-server-Xvfb xorg-x11-xauth xdotool dbus-x11 scrot
'
```

`scrot` es opcional; sirve para conservar una captura. En algunos entornos Fedora + Xvfb la captura puede salir en negro; en ese caso la fuente de verdad es el título de la ventana y el log de la app.

---

## 6. Smoke test de la aplicación

El objetivo es comprobar que el binario empaquetado arranca, detecta Docker y no muere por una dependencia que falte.

Crea este script dentro de la VM (o pásalo con `incus file push`):

```bash
cat >/tmp/grafeno-app-smoke.sh <<'EOF'
#!/bin/bash
set -u

APP_BIN="${APP_BIN:-/opt/Grafeno/grafeno}"
APP_EXTRA_ARGS="${APP_EXTRA_ARGS:-}"
app_pid=""
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/tmp/xvfb-grafeno.log 2>&1 &
xvfb_pid=$!

cleanup() {
  [ -n "$app_pid" ] && kill -TERM -- "-$app_pid" 2>/dev/null || true
  kill "$xvfb_pid" 2>/dev/null || true
  [ -n "$app_pid" ] && wait "$app_pid" 2>/dev/null || true
  wait "$xvfb_pid" 2>/dev/null || true
}
trap cleanup EXIT

sleep 2
export DISPLAY=:99
# shellcheck disable=SC2086
setsid dbus-run-session -- "$APP_BIN" $APP_EXTRA_ARGS --no-sandbox --disable-gpu \
  >/tmp/grafeno-app.log 2>&1 &
app_pid=$!
sleep 12

if kill -0 "$app_pid" 2>/dev/null; then
  echo "[+] APP_RUNNING pid=$app_pid"
else
  echo "[-] APP_EXITED"
fi

echo "--- ventanas"
xdotool search --name '.*' getwindowname %@ 2>/dev/null | sed -n '1,20p' || true
scrot /tmp/grafeno-app.png >/dev/null 2>&1 || true

echo "--- log"
sed -n '1,120p' /tmp/grafeno-app.log
EOF
chmod +x /tmp/grafeno-app-smoke.sh
```

Ejecútalo como el usuario de la VM, no como root:

```bash
incus exec "$UBUNTU_VM" -- su - ubuntu -c 'bash /tmp/grafeno-app-smoke.sh'
incus exec "$FEDORA_VM" -- su - fedora -c 'bash /tmp/grafeno-app-smoke.sh'
```

Resultados esperados:

- Sin Docker: ventana `Grafeno - Docker no encontrado` y ausencia de la línea `[docker]`.
- Con Docker: ventana `Grafeno` y línea de log:

```text
[docker] Engine 29.9.3 | Compose 5.7.1
```

Los avisos de `libva`, `xdg-desktop-portal` y VA-API en una VM sin GPU son normales.

Para probar el AppImage sin FUSE (habitual en cloud):

```bash
incus file push "dist/grafeno_${TEST_VERSION}_x86_64.AppImage" \
  "$UBUNTU_VM/tmp/grafeno.AppImage"
incus exec "$UBUNTU_VM" -- chmod +x /tmp/grafeno.AppImage
incus exec "$UBUNTU_VM" -- su - ubuntu -c '
  APP_BIN=/tmp/grafeno.AppImage APP_EXTRA_ARGS=--appimage-extract-and-run \
    bash /tmp/grafeno-app-smoke.sh
'
```

---

## 7. Instalar Docker desde Grafeno

Con la app instalada y Docker ausente, el script empaquetado debe instalar Docker Engine y el plugin Compose. Se ejecuta igual que lo hace la app: con `sudo` desde el usuario no root.

```bash
incus exec "$UBUNTU_VM" -- su - ubuntu -c '
  sudo bash /opt/Grafeno/resources/app.asar.unpacked/setup_docker.sh
'

incus exec "$FEDORA_VM" -- su - fedora -c '
  sudo bash /opt/Grafeno/resources/app.asar.unpacked/setup_docker.sh
'
```

Verifica versiones, daemon, grupo y funcionamiento real:

```bash
for vm in "$UBUNTU_VM" "$FEDORA_VM"; do
  user=$([ "$vm" = "$UBUNTU_VM" ] && echo ubuntu || echo fedora)
  echo "== $vm =="
  incus exec "$vm" -- su - "$user" -c '
    docker --version
    docker compose version --short
    systemctl is-active docker
    id -nG | tr " " "\n" | grep -x docker
    docker run --rm hello-world
  '
done
```

Requisitos mínimos de Grafeno:

- Docker Engine `>= 28.0.0`.
- Plugin Docker Compose `>= 2.33.1`.
- `docker compose version --short` debe funcionar.
- `docker info --format '{{.ServerVersion}}'` debe responder.

Repite el script una segunda vez. La salida debe indicar que Docker ya cumple los mínimos y que el usuario ya está en el grupo `docker`; no debe reinstalar nada.

Notas:

- El script mantiene Podman instalado en Fedora. Solo elimina `podman-docker` y paquetes Docker incompatibles.
- Si la sesión SSH/Incus se abrió antes de añadir el usuario al grupo, hay que abrir una sesión nueva (`su - usuario`) para que el grupo esté activo.
- El script soporta Ubuntu, Debian, Kali Linux y Fedora 43 o superior. Fedora 44 es la imagen de prueba.

---

## 8. Probar actualizaciones con un feed local

La release pública no siempre existe durante el desarrollo. Para probar el flujo completo sin GitHub, se usa un proveedor `generic` local. Esto valida la descarga, el hash, el diálogo, la ventana de contraseña y la instalación; no valida el proveedor de GitHub.

### 8.1. Preparar el paquete de destino

Compila un paquete con versión superior, por ejemplo `2.2.1-test.3`, para el mismo tipo de paquete que la app instalada. El `latest-linux.yml` generado debe corresponder a ese paquete:

```bash
# Para Ubuntu: solo .deb
npm version 2.2.1-test.3 --no-git-tag-version
nix-shell -p fpm dpkg rpm --run 'USE_SYSTEM_FPM=true npx electron-builder --linux deb --x64 -p never'

# Para Fedora: solo .rpm
# nix-shell -p fpm dpkg rpm --run 'USE_SYSTEM_FPM=true npx electron-builder --linux rpm --x64 -p never'

npm version "$BASE_VERSION" --no-git-tag-version
git status --short
```

El build de destino sobrescribe `dist/linux-unpacked` y `dist/latest-linux.yml`. El último build que se ejecute debe ser el candidato que se va a publicar, no el paquete de destino usado para probar la actualización.

Copia el paquete de destino y el `latest-linux.yml` generado a la VM:

```bash
# Ubuntu
incus file push "dist/grafeno_2.2.1-test.3_amd64.deb" "$UBUNTU_VM/tmp/grafeno-target.deb"
incus file push dist/latest-linux.yml "$UBUNTU_VM/tmp/latest-linux.yml"

# Fedora
# incus file push "dist/grafeno_2.2.1-test.3_x86_64.rpm" "$FEDORA_VM/tmp/grafeno-target.rpm"
# incus file push dist/latest-linux.yml "$FEDORA_VM/tmp/latest-linux.yml"
```

### 8.2. Montar el feed dentro de la VM

```bash
incus exec "$UBUNTU_VM" -- bash -c '
  rm -rf /tmp/update-feed
  mkdir -p /tmp/update-feed
  cp /tmp/grafeno-target.deb /tmp/update-feed/
  cp /tmp/latest-linux.yml /tmp/update-feed/
  chmod -R 755 /tmp/update-feed
  cd /tmp/update-feed
  nohup python3 -m http.server 8000 >/tmp/update-feed.log 2>&1 &
  echo $! >/tmp/update-feed.pid
  sleep 1
  curl -fsS http://127.0.0.1:8000/latest-linux.yml | sed -n "1,6p"
'
```

Para Fedora, sustituye `grafeno-target.deb` por `grafeno-target.rpm` y usa `/home/fedora` en los comandos que limpian la caché. El `latest-linux.yml` debe contener el paquete del tipo correcto (`.deb` para Ubuntu, `.rpm` para Fedora) con su `sha512` y `size` reales.

### 8.3. Apuntar la app al feed local

La app instalada lee `/opt/Grafeno/resources/app-update.yml`. Después de instalar o actualizar el paquete, ese fichero vuelve a apuntar a GitHub; hay que modificarlo de nuevo para cada prueba local:

```bash
incus exec "$UBUNTU_VM" -- bash -c '
  cat >/opt/Grafeno/resources/app-update.yml <<EOF
provider: generic
url: http://127.0.0.1:8000/
updaterCacheDirName: grafeno-updater
EOF
'
```

Limpia la caché y el log de actualización antes de cada intento:

```bash
incus exec "$UBUNTU_VM" -- bash -c '
  rm -rf /home/ubuntu/.cache/grafeno-updater
  rm -f /home/ubuntu/.config/grafeno/logs/updater.log
'
```

En Fedora cambia `/home/ubuntu` por `/home/fedora`.

### 8.4. Ejecutar y observar

La app comprueba actualizaciones al arrancar, descarga automáticamente y muestra un diálogo nativo. Para que la interacción sea reproducible, usa un único script dentro de la VM que arranca Xvfb, la app, pulsa el diálogo, rellena la contraseña y recoge la evidencia.

```bash
cat >/tmp/grafeno-update-smoke.sh <<'EOF'
#!/bin/bash
set -u

APP_BIN="${APP_BIN:-/opt/Grafeno/grafeno}"
app_pid=""
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/tmp/xvfb-update.log 2>&1 &
xvfb_pid=$!

cleanup() {
  [ -n "$app_pid" ] && kill -TERM -- "-$app_pid" 2>/dev/null || true
  kill "$xvfb_pid" 2>/dev/null || true
  [ -n "$app_pid" ] && wait "$app_pid" 2>/dev/null || true
  wait "$xvfb_pid" 2>/dev/null || true
}
trap cleanup EXIT

sleep 2
export DISPLAY=:99
setsid dbus-run-session -- "$APP_BIN" --no-sandbox --disable-gpu \
  >/tmp/grafeno-update-smoke.log 2>&1 &
app_pid=$!

dialog_id=""
for _ in $(seq 1 40); do
  dialog_id=$(xdotool search --name 'Update ready' 2>/dev/null | head -n1 || true)
  [ -n "$dialog_id" ] || dialog_id=$(xdotool search --name 'Actualización lista' 2>/dev/null | head -n1 || true)
  [ -n "$dialog_id" ] && break
  sleep 1
done

echo "--- diálogo: ${dialog_id:-none}"
if [ -n "$dialog_id" ]; then
  xdotool key --window "$dialog_id" Return 2>/dev/null || true
fi
sleep 3

pw_id=""
while IFS= read -r id; do
  name=$(xdotool getwindowname "$id" 2>/dev/null || true)
  case "$name" in
    *Install*|*Instalar*|*actualiz*|*Actualiz*|*update*|*Update*)
      pw_id="$id"
      break
      ;;
  esac
done < <(xdotool search --name '.*' 2>/dev/null || true)

echo "--- ventana de contraseña: ${pw_id:-none}"
if [ -n "$pw_id" ]; then
  xdotool windowactivate --sync "$pw_id" 2>/dev/null || true
fi
# En las VMs cloud sudo es NOPASSWD; el valor no es una credencial real.
xdotool type --delay 50 'test' 2>/dev/null || true
xdotool key Return 2>/dev/null || true
sleep 15

echo "--- app log"
sed -n '1,160p' /tmp/grafeno-update-smoke.log
echo "--- updater log"
cat "$HOME/.config/grafeno/logs/updater.log" 2>/dev/null || true
echo "--- versión instalada"
if command -v dpkg-query >/dev/null 2>&1; then
  dpkg-query -W -f='${Package} ${Version}\n' grafeno
else
  rpm -q grafeno
fi
EOF
chmod +x /tmp/grafeno-update-smoke.sh
```

Ejecútalo como el usuario de la VM:

```bash
incus exec "$UBUNTU_VM" -- su - ubuntu -c 'bash /tmp/grafeno-update-smoke.sh'
incus exec "$FEDORA_VM" -- su - fedora -c 'bash /tmp/grafeno-update-smoke.sh'
```

En el log de la app deben aparecer, en orden:

```text
Found version 2.2.1-test.3
Downloading update from ...
New version 2.2.1-test.3 has been downloaded ...
```

Y en `~/.config/grafeno/logs/updater.log`:

```text
[... ] checking
[... ] available 2.2.1-test.3
[... ] downloading 2.2.1-test.3
[... ] downloaded 2.2.1-test.3
[... ] installing
[... ] installed 2.2.1-test.3
```

La versión instalada debe cambiar:

```bash
incus exec "$UBUNTU_VM" -- dpkg-query -W -f='${Version}\n' grafeno
incus exec "$FEDORA_VM" -- rpm -q grafeno
```

Para Fedora, el plan de instalación es `rpm -U --nosignature <fichero>`; no debe fallar por firma. Para Ubuntu, el plan es `dpkg -i` con fallback a `apt-get install -f -y`.

Si el script no encuentra el diálogo, revisa que la app instalada sea una versión inferior a la del feed y que `updater.log` tenga `available`. Si el diálogo aparece pero no se abre la ventana de contraseña, comprueba que `/opt/Grafeno/resources/app-update.yml` siga apuntando al feed local.

### 8.5. Limitaciones del feed local

- Solo prueba el proveedor `generic`; no prueba la resolución de releases de GitHub.
- El `latest-linux.yml` debe generarse para el target que se está probando. No mezcles un `.deb` con un yml de `.rpm`.
- La app debe estar instalada con una versión inferior a la del feed. Si ya está en la misma versión, no habrá actualización.
- El `app-update.yml` vuelve a GitHub después de instalar el paquete de destino; es normal.

---

## 9. Validar la actualización real desde GitHub

Esto solo se puede hacer cuando la nueva release ya está publicada con sus metadatos. La release `v2.2.0` no tiene `latest-linux.yml` x64, por lo que los clientes x64 muestran:

```text
No published versions on GitHub
```

Ese error es esperado con `v2.2.0` y no debe confundirse con un fallo del código actual.

Antes de probar:

```bash
gh release view vX.Y.Z --json assets --jq '.assets[].name'
```

Debe incluir `latest-linux.yml` y el paquete x64 correspondiente. Después:

1. Instala en la VM una versión anterior a la nueva release.
2. No modifiques `app-update.yml`.
3. Arranca Grafeno con el script de la sección 6 (o ejecuta el de la sección 8.4, que ya pulsa el diálogo y rellena la contraseña).
4. Comprueba `updater.log`: debe aparecer `checking`, `available`, `downloading` y `downloaded`.
5. Pulsa “Reiniciar ahora” y valida la instalación y el relanzado.

No se debe dar una release por validada hasta que este flujo funcione contra GitHub.

---

## 10. Evidencias y diagnóstico

Guarda en `RUN_DIR`:

- `hashes.txt`.
- Versiones instaladas (`dpkg-query` / `rpm -q`).
- Log de la app (`/tmp/grafeno-app.log`).
- Log del updater (`~/.config/grafeno/logs/updater.log`).
- Capturas opcionales (`scrot`).
- Salida de `docker --version`, `docker compose version --short` y `docker info`.
- Salida de `incus info "$vm" --show-log` si algo falla.

Para extraer ficheros de la VM:

```bash
incus file pull "$UBUNTU_VM/tmp/grafeno-app.log" "$RUN_DIR/ubuntu-app.log"
incus file pull "$UBUNTU_VM/home/ubuntu/.config/grafeno/logs/updater.log" \
  "$RUN_DIR/ubuntu-updater.log"
```

Si el agente no arranca o la prueba falla:

1. No borres la VM.
2. Ejecuta `incus info "$vm" --show-log`.
3. Ejecuta `incus console "$vm" --show-log`.
4. Conserva la salida y reporta el problema con el nombre de la VM.

---

## 11. Limpieza

Primero detén los procesos de prueba dentro de la VM. Evita `pkill -f` con un patrón que también aparezca en tu propia línea de comandos:

```bash
incus exec "$UBUNTU_VM" -- bash -c '
  [ -f /tmp/update-feed.pid ] && kill "$(cat /tmp/update-feed.pid)" 2>/dev/null || true
  rm -f /tmp/update-feed.pid
  pkill -TERM -f "/opt/[G]rafeno/grafeno" 2>/dev/null || true
  pkill -TERM Xvfb 2>/dev/null || true
  sleep 2
  pkill -KILL -f "/opt/[G]rafeno/grafeno" 2>/dev/null || true
  pkill -KILL Xvfb 2>/dev/null || true
'
```

Después borra solo las VMs creadas por ti, por nombre:

```bash
incus delete "$UBUNTU_VM" --force
incus delete "$FEDORA_VM" --force
incus list
```

No uses `incus delete --all`, `incus prune` ni borrados globales. Si una prueba ha fallado, conserva la VM hasta recoger las evidencias o hasta que se indique lo contrario.

---

## 12. Problemas conocidos

### Electron no arranca en Ubuntu cloud

Síntoma:

```text
error while loading shared libraries: libasound.so.2
```

El paquete `.deb` debe declarar `libasound2` y `libgbm1`. Ya se corrigió en `package.json`; si vuelve a aparecer, revisa que los artefactos se regeneraron después del cambio.

### `fpm` falla en NixOS

Síntoma:

```text
spawn .../fpm ENOENT
```

El binario de electron-builder usa `/bin/bash`. Usa el `fpm` de Nix con:

```bash
nix-shell -p fpm dpkg rpm --run 'USE_SYSTEM_FPM=true npm run dist:linux:x64'
```

### Fedora no verifica la firma del RPM

Grafeno no firma los RPM. Para actualizar manualmente:

```bash
sudo rpm -U --nosignature /ruta/grafeno_X.Y.Z_x86_64.rpm
```

El updater ya aplica `--nosignature`.

### La actualización local no aparece

Comprueba:

- La app instalada es una versión inferior a `latest-linux.yml`.
- El `latest-linux.yml` y el paquete están en `/tmp/update-feed`.
- El `latest-linux.yml` tiene el `sha512` y `size` correctos.
- `app-update.yml` apunta al feed local.
- La caché `~/.cache/grafeno-updater` está limpia.
- El servidor `python3 -m http.server 8000` sigue vivo.

### GitHub devuelve “No published versions on GitHub”

Revisa los assets de la release. Debe existir `latest-linux.yml` para x64. Si solo existe `latest-linux-arm64.yml`, los clientes x64 no ven actualizaciones.

### La ventana de contraseña no recibe texto

Asegúrate de que el diálogo nativo se cerró con “Reiniciar ahora” y de que la ventana `Instalar actualización` está activa. En una VM cloud el usuario tiene `sudo` NOPASSWD; cualquier texto no vacío sirve.

### Quedan procesos de Grafeno o Xvfb

Usa el patrón con corchetes (`"/opt/[G]rafeno/grafeno"`) para que `pkill` no coincida con su propia línea de comandos. Cierra también el servidor del feed por PID.

---

## 13. Checklist antes de publicar

- [ ] `npm test` pasa.
- [ ] `bash -n setup_docker.sh` y `shellcheck` pasan.
- [ ] Árbol de trabajo limpio y versión de `package.json` restaurada.
- [ ] Artefactos generados y hashes guardados.
- [ ] `.deb` instala en Ubuntu 26.04 cloud y arranca.
- [ ] `.rpm` instala en Fedora 44 cloud y arranca.
- [ ] Docker se instala desde el script empaquetado en ambas distros.
- [ ] `docker compose` y `docker run hello-world` funcionan.
- [ ] AppImage arranca con `--appimage-extract-and-run`.
- [ ] Actualización local `.deb` funciona de extremo a extremo.
- [ ] Actualización local `.rpm` funciona de extremo a extremo.
- [ ] `latest-linux.yml` incluye x64, `.deb`, `.rpm` y `.AppImage`.
- [ ] Tras publicar, la actualización real desde GitHub funciona.
- [ ] VMs y procesos de prueba eliminados o conservados con evidencia.
