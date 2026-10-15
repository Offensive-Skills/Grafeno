English | [Español](./install_grafeno.md)

# Installing Grafeno

Grafeno is available on the [Offensive Skills tools page](https://offs.es/tools).

Download the installer binary from the [Offensive Skills tools page](https://offs.es/tools) and select the right download for your system:

![](images/installation/seleccionar_correcto_grafeno.png)

Once the `.deb` file has been downloaded, install it with the following command:

```bash
sudo dpkg -i grafeno_2.0.2_amd64.deb
```

![](images/installation/comando_dpkg_grafeno.png)

As soon as the command finishes, Grafeno is installed. You can launch it by running `grafeno` in a terminal, or by opening it from your system's application menu.

## First login

The first time you open Grafeno, you will see the following screen:

![](images/installation/login_grafeno.png)

You need to enter:

- Username
- API token

To get those credentials, first [**sign up on the Offensive Skills website**](https://offs.es/register): fill in the registration form and validate your email. Then go to the [**API token page**](https://offs.es/dashboard/api-token) and generate a new token.

![](images/installation/api-token-page.png)

Once the token has been generated, enter it in Grafeno together with your username and log in.

## Main window

After logging in, you will see a window like the one below:

![](images/installation/main_grafeno.png)

The two main sections are:

- **Retos (Challenges)**: the collection of Jeopardy-style CTF challenges we have been building over the years.
- **Cursos (Courses)**: the core of the training content, with dedicated machines for each stage of learning a vulnerability.

## Deploying your first challenge

To deploy a challenge — for example, an LFI one — open the LFI course, enter one of its modules, and use the Docker management buttons to launch the container, as shown in the following image:

![](images/installation/deploy_container.png)
