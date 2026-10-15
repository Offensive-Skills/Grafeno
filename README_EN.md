Español | [English](./README_EN.md)

# Grafeno

![Grafeno logo](./images/logo_grafeno.png)

Grafeno is an automation tool for deploying environments built around **penetration testing** challenges. With Grafeno, you get access to hundreds of cybersecurity challenges, either individually or as part of the training offered on the [Offensive Skills](https://offs.es) platform.

> All practice environments are deployed locally, letting you work through pen testing offline and sharpen your cybersecurity skills on your own machine.

---

## Installation

Download the `.deb` package from the [GitHub releases page](https://github.com/Offensive-Skills/Grafeno/releases) or from [offs.es/tools](https://offs.es/tools) — both provide the same binary — to install Grafeno quickly and easily on Debian/Ubuntu-based systems.

> For an illustrated step-by-step installation guide (screenshots, first login, and deploying your first challenge), see [`install_grafeno_EN.md`](./install_grafeno_EN.md).

### Prerequisites

- **Docker:** Grafeno requires Docker to be installed and running on your system. We recommend updating your system before proceeding:

  > ***Note:***
  > If you don't have Docker installed, run:
  > ```bash
  > sudo ./setup_docker.sh
  > ```
  >
  > Alternatively, follow the instructions in the [official Docker documentation](https://docs.docker.com/get-docker/).

- Keep your repositories and packages up to date:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

### Installing the package

1. Go to the [GitHub releases page](https://github.com/Offensive-Skills/Grafeno/releases) or [offs.es/tools](https://offs.es/tools) and download the `.deb` file for the version you wish to install.
2. Install the downloaded package by running the following in a terminal:
   ```bash
   sudo dpkg -i grafeno-x.y.z.deb
   ```
   *(Replace `grafeno-x.y.z.deb` with the name of the downloaded file.)*
3. If any dependencies are missing after the install, fix them with:
   ```bash
   sudo apt install -f
   ```

---

## Running Grafeno

Once installed, you can launch Grafeno directly from your system's application menu or from a terminal:

```bash
grafeno
```

> ***Important:***
> You need valid **credentials** to access Grafeno. To get them:
> 1. Sign up at [offs.es/register](https://offs.es/register) and log in.
> 2. Visit the [API Tokens page](https://offs.es/dashboard/api-token) to obtain your token.
>
> **Fields requested at login:**
> - `usuario` (username): your [Offensive Skills](https://offs.es) username.
> - `api-token`: the token associated with your account, available on the [API Tokens page](https://offs.es/dashboard/api-token).

---

## Development

### Running Grafeno in development mode

To run Grafeno from the source code in development mode:

```bash
npm start
```

### Opening developer tools

To open the Chromium DevTools (element inspector, console, etc.), run:

```bash
GRAFENO_DEVTOOLS=1 npm start
```

The `GRAFENO_DEVTOOLS=1` environment variable automatically opens the developer tools when the application starts.

---

## Additional notes

- Make sure Docker is working properly before running Grafeno.
- By using Docker to manage environments, Grafeno delivers a consistent experience across different operating systems.

---

## License

Grafeno © 2024 by Offensive Skills is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.

See the [`LICENSE`](./LICENSE.md) file for more details.
