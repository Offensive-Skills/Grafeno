{
  description = "Grafeno - entorno de desarrollo en NixOS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          name = "grafeno";

          packages = with pkgs; [
            nodejs_20
            # electron_41-bin: binario pre-compilado, parcheado por nixpkgs para NixOS
            electron_41-bin
            # Herramientas para los scripts de Docker
            docker
            bash
            git
          ];

          shellHook = ''
            # Apunta el paquete npm 'electron' al binario de nixpkgs (ya parcheado)
            export ELECTRON_OVERRIDE_DIST_PATH="${pkgs.electron_41-bin}/bin"

            echo "[+]  Entorno Grafeno listo"
            echo "   node  : $(node --version)"
            echo "   npm   : $(npm --version)"
            echo "   electron: $(electron --version 2>/dev/null || echo 'usa ELECTRON_OVERRIDE_DIST_PATH')"
          '';
        };
      }
    );
}
