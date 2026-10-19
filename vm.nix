{ pkgs }:

pkgs.mkShell {
  name = "grafeno-vm";

  packages = with pkgs; [
    quickemu
    openssh
  ];

  shellHook = ''
    echo "[+] Entorno para pruebas de Grafeno en Ubuntu"

    if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
      echo "    KVM: dispositivo accesible"
    else
      echo "    AVISO: /dev/kvm no existe o no tienes acceso."
      echo "    Este entorno no modifica la configuración del sistema."
    fi

    echo ""
    echo "    Crear:   quickget ubuntu 24.04"
    echo "    Arrancar: quickemu --vm ubuntu-24.04.conf --display sdl"
  '';
}
