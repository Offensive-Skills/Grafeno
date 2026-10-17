// views/shared/i18n.js
// Motor de internacionalización para Grafeno (Vanilla JS, sin dependencias).
// Idioma por defecto: español. Persistencia en localStorage('grafeno_lang').

(function () {
  const STORAGE_KEY = 'grafeno_lang';

  const dict = {
    es: {
      // --- Login ---
      'login.title': 'Iniciar Sesión',
      'login.username': 'Usuario',
      'login.apiToken': 'API-TOKEN',
      'login.remember': 'Recordar credenciales',
      'login.btn': 'Login',
      'login.noCreds': '¿Aún no tienes credenciales para usar esta herramienta?',
      'login.accessOffs': 'Accede a offs.es',
      'login.scanQr': 'O escanea este QR para acceder:',
      'login.errorCreds': 'Usuario o API-TOKEN incorrectos',
      'login.errorConnect': 'Error al conectar con Docker',

      // --- Navegación / Menú ---
      'nav.retos': 'Retos',
      'nav.temporada': 'Temporada',
      'nav.cursos': 'Cursos',
      'nav.ranking': 'Ranking',
      'nav.config': 'Configuración',
      'menu.statsLabel': 'Progreso (%)',
      'menu.errorStats': 'Error al obtener estadísticas.',
      'menu.alertError': 'Error: ',

      // --- Retos / Filtros ---
      'difficulty.facil': 'Fácil',
      'difficulty.medio': 'Medio',
      'difficulty.dificil': 'Difícil',
      'difficulty.insano': 'Insano',
      'topic.web': 'Web',
      'topic.cripto': 'Criptografía',
      'topic.forense': 'Forense',
      'topic.privesc': 'Escalada de Privilegios',
      'topic.reversing': 'Reversing',
      'topic.estego': 'Esteganografía',
      'topic.misc': 'Miscelánea',
      'topic.pwn': 'PWN',
      'status.todos': 'Todos',
      'status.completado': 'Completado',
      'status.pendientes': 'Pendientes',
      'retos.btnSearch': 'Buscar',
      'retos.btnBack': 'Atrás',
      'retos.empty': 'No se encontraron retos con estos filtros',
      'retos.error': 'Error al obtener retos. Revisa la consola para más detalles.',

      // --- Cursos / Módulos ---
      'cursos.title': 'Cursos',
      'cursos.level': 'Nivel: {level}',
      'cursos.error': 'Error al cargar cursos. Revisa la consola para más detalles.',
      'cursos.noCourse': 'No se ha seleccionado un curso.',
      'cursos.noModules': 'Error al cargar módulos. Revisa la consola.',
      'modulos.title': 'Módulos del curso {name}',
      'modulos.prefix': 'Módulos del curso ',
      'modulos.noDesc': 'Sin descripción',
      'modulos.download': 'Descargar archivos del módulo',
      'modulos.noRetos': 'No se encontraron retos para este módulo',
      'retosModulos.noModule': 'No se ha definido el module_id',

      // --- Temporada ---
      'temporada.empty': 'No se encontraron retos de temporada',
      'temporada.error': 'Error al obtener retos de temporada. Revisa la consola para más detalles.',

      // --- Ranking ---
      'ranking.title': 'Ranking',
      'ranking.position': 'Posición',
      'ranking.user': 'Usuario',
      'ranking.points': 'Puntos',
      'ranking.error': 'Error al cargar el ranking',

      // --- Writeup ---
      'writeup.loading': 'Cargando writeup...',
      'writeup.error': 'Error al cargar el writeup. Revisa la consola para más detalles.',
      'writeup.copied': 'Copiado',

      // --- Configuración ---
      'config.title': 'Configuración',
      'config.downloads': 'Descargas de ficheros',
      'config.downloadsInfo': 'Especifica la ubicación en la que deseas que se guarden los archivos descargados de los retos. Si no se especifica, se guardarán en la carpeta de descargas por defecto.',
      'config.destPlaceholder': 'Ruta de destino (por defecto: Descargas)',
      'config.reset': 'Reseteo de información',
      'config.resetInfo': 'Pulsa el botón para resetear todos los datos de la aplicación. El proceso se mostrará a la derecha.',
      'config.btnReset': 'Resetear datos',
      'config.resetting': 'Eliminando contenido de la aplicación...',
      'config.resetDone': 'Reset de datos completado.',
      'config.resetError': 'Error al resetear datos.',
      'config.back': 'Atrás',

      // --- Docker Manager ---
      'docker.ipContainer': 'IP del contenedor: ',
      'docker.ipCompose': 'IP del servicio principal: ',
      'docker.inactive': 'Inactive',
      'docker.starting': 'Iniciando contenedor...',
      'docker.stopping': 'Deteniendo contenedor...',
      'docker.start': 'Iniciar',
      'docker.stop': 'Detener',
      'docker.restart': 'Reiniciar',
      'docker.downloading': 'Descargando imágenes...',
      'docker.downloadingPct': 'Descargando imagen... {percent}%',
      'docker.preparing': 'Preparando contenedor...',
      'docker.authenticating': 'Renovando sesión de Harbor...',
      'docker.errorOp': 'No se pudo completar la operación Docker.',
      'docker.composeError': 'No se pudo obtener la configuración Compose.',

      // --- Detalle de reto / módulo / temporada ---
      'detail.noDesc': 'Sin descripción',
      'detail.flagPlaceholder': 'Introduce la flag',
      'detail.sendFlag': 'Enviar flag',
      'detail.correct': '¡Flag correcta!',
      'detail.wrong': 'Flag incorrecta.',
      'detail.enterFlag': 'Introduce una flag.',
      'detail.sendError': 'Error al enviar la flag.',
      'detail.seeWriteup': 'Ver Writeup',
      'detail.download': 'Descargar archivos del reto',
      'detail.downloadModule': 'Descargar archivos del módulo',
      'detail.saved': 'Archivo guardado en: {path}',
      'detail.downloadError': 'Error al descargar archivos del reto.',
      'detail.noUrl': 'No hay URL disponible',
      'detail.httpError': 'Error HTTP: {status}',

      // --- Portapapeles ---
      'clipboard.copied': '¡Copiado al portapapeles!',

      // --- Errores Docker (error.js) ---
      'error.pageTitle': 'Docker no encontrado',
      'error.dockerMissing.title': 'Docker no está instalado',
      'error.dockerMissing.desc': 'Grafeno necesita Docker para funcionar. Puedes instalarlo directamente desde aquí.',
      'error.dockerMissing.btn': 'Instalar Docker',
      'error.composeMissing.title': 'Docker Compose v2 requiere instalación o actualización',
      'error.composeMissing.desc': 'Grafeno necesita Docker Compose v2.33.1 o superior. Puedes instalarlo o actualizarlo directamente desde aquí.',
      'error.composeMissing.btn': 'Instalar / actualizar Docker Compose',
      'error.permMissing.title': 'Tu usuario no pertenece al grupo docker',
      'error.permMissing.desc': 'Docker está instalado, pero tu usuario no tiene permisos para usarlo. Introduce tu contraseña para añadirlo al grupo docker.',
      'error.permMissing.btn': 'Añadir mi usuario al grupo docker',
      'error.daemonStopped.title': 'El servicio Docker no está iniciado',
      'error.daemonStopped.desc': 'Docker está instalado, pero su servicio no está en ejecución. Introduce tu contraseña para iniciarlo.',
      'error.daemonStopped.btn': 'Iniciar servicio Docker',
      'error.infoBoxDoc': 'La instalación automática solo está disponible para <strong>Ubuntu</strong>, <strong>Debian</strong> y <strong>Kali Linux</strong>.',
      'error.infoBoxOfficial': 'Para otros sistemas operativos, consulta la <a href="https://docs.docker.com/engine/install/">documentación oficial de Docker</a>.',
      'error.infoBoxScript': 'El script de instalación es público y sigue las instrucciones oficiales: <a href="https://github.com/Offensive-Skills/Grafeno/blob/main/setup_docker.sh">ver en GitHub</a>',
      'error.infoBoxPassword': 'La contraseña solo se utiliza para instalar los paquetes oficiales de Docker.',
      'error.composeInfoBox': 'Se añadirá el repositorio oficial de Docker y se instalará o actualizará el plugin <code>docker-compose-plugin</code>.',
      'error.permInfoBox': 'Se añadirá tu usuario al grupo <strong>docker</strong>. Después deberás cerrar y volver a iniciar la sesión para que el cambio surta efecto.',
      'error.daemonInfoBox': 'Se ejecutará <code>sudo systemctl start docker</code> para arrancar el servicio.',
      'error.sudoLabel': 'Contraseña de administrador (sudo):',
      'error.sudoPlaceholder': 'Contraseña sudo',
      'error.installBtn': 'Instalar Docker',
      'error.cancelBtn': 'Cancelar',
      'error.actionTitleRelogin': 'Cierra sesión y vuelve a iniciarla',
      'error.actionTextRelogin': 'Docker se ha instalado correctamente. Para que Grafeno pueda usarlo, el cambio de grupo <strong>docker</strong> necesita una nueva sesión de trabajo.',
      'error.actionTitleRestart': 'Reinicia Grafeno',
      'error.actionTextRestart': 'La operación se ha completado correctamente. Reinicia Grafeno para volver a comprobar Docker.',
      'error.step1': 'Cierra la sesión actual',
      'error.step2': 'Vuelve a iniciar sesión',
      'error.step3': 'Abre Grafeno',
      'error.closeGrafeno': 'Cerrar Grafeno',
      'error.restartGrafeno': 'Reiniciar Grafeno',
      'error.close': 'Cerrar',
      'error.retry': 'Reintentar',
      'error.cancelMsg': 'La instalación se ha cancelado. Inténtalo de nuevo cuando quieras.',
      'error.wrongPassword': 'La contraseña es incorrecta. Inténtalo de nuevo.',
      'error.installFail': 'La instalación no se pudo completar. Revisa el registro para más detalles.',
      'error.unexpected': 'Error inesperado: {msg}',
      'error.canceling': 'Cancelando...',
      'error.installing': 'Instalando Docker, esto puede tardar unos minutos...',
      'error.startingService': 'Iniciando el servicio Docker...',

      // --- Updater (main.js) ---
      'updater.title': 'Actualización disponible',
      'updater.message': 'La actualización se ha descargado. ¿Deseas reiniciar la aplicación para instalarla?',

      // --- Títulos de ventana (<title>) ---
      'title.login': 'Grafeno',
      'title.retos': 'Retos - Grafeno',
      'title.cursos': 'Cursos - Grafeno',
      'title.mainMenu': 'Grafeno - Menú Principal',
      'title.temporada': 'Temporada - Grafeno',
      'title.config': 'Configuración - Grafeno',
      'title.retosModulos': 'Retos Módulo - Grafeno',
      'title.ranking': 'Ranking - Grafeno',
      'title.error': 'Grafeno - Docker no encontrado',
      'title.modulos': 'Módulos - Grafeno',
      'title.writeup': 'Writeup - Grafeno'
    },

    en: {
      // --- Login ---
      'login.title': 'Sign In',
      'login.username': 'Username',
      'login.apiToken': 'API Token',
      'login.remember': 'Remember credentials',
      'login.btn': 'Login',
      'login.noCreds': "Don't have credentials yet?",
      'login.accessOffs': 'Go to offs.es',
      'login.scanQr': 'Or scan this QR to access:',
      'login.errorCreds': 'Wrong username or API token',
      'login.errorConnect': 'Error connecting to Docker',

      // --- Navegación / Menú ---
      'nav.retos': 'Challenges',
      'nav.temporada': 'Season',
      'nav.cursos': 'Courses',
      'nav.ranking': 'Ranking',
      'nav.config': 'Settings',
      'menu.statsLabel': 'Progress (%)',
      'menu.errorStats': 'Error fetching stats.',
      'menu.alertError': 'Error: ',

      // --- Retos / Filtros ---
      'difficulty.facil': 'Easy',
      'difficulty.medio': 'Medium',
      'difficulty.dificil': 'Hard',
      'difficulty.insano': 'Insane',
      'topic.web': 'Web',
      'topic.cripto': 'Cryptography',
      'topic.forense': 'Forensics',
      'topic.privesc': 'Privilege Escalation',
      'topic.reversing': 'Reversing',
      'topic.estego': 'Steganography',
      'topic.misc': 'Miscellaneous',
      'topic.pwn': 'PWN',
      'status.todos': 'All',
      'status.completado': 'Completed',
      'status.pendientes': 'Pending',
      'retos.btnSearch': 'Search',
      'retos.btnBack': 'Back',
      'retos.empty': 'No challenges found with these filters',
      'retos.error': 'Error fetching challenges. Check the console for details.',

      // --- Cursos / Módulos ---
      'cursos.title': 'Courses',
      'cursos.level': 'Level: {level}',
      'cursos.error': 'Error loading courses. Check the console for details.',
      'cursos.noCourse': 'No course selected.',
      'cursos.noModules': 'Error loading modules. Check the console.',
      'modulos.title': 'Modules of course {name}',
      'modulos.prefix': 'Modules of course ',
      'modulos.noDesc': 'No description',
      'modulos.download': 'Download module files',
      'modulos.noRetos': 'No challenges found for this module',
      'retosModulos.noModule': 'module_id is not defined',

      // --- Temporada ---
      'temporada.empty': 'No seasonal challenges found',
      'temporada.error': 'Error fetching seasonal challenges. Check the console for details.',

      // --- Ranking ---
      'ranking.title': 'Ranking',
      'ranking.position': 'Position',
      'ranking.user': 'User',
      'ranking.points': 'Points',
      'ranking.error': 'Error loading ranking',

      // --- Writeup ---
      'writeup.loading': 'Loading writeup...',
      'writeup.error': 'Error loading writeup. Check the console for details.',
      'writeup.copied': 'Copied',

      // --- Configuración ---
      'config.title': 'Settings',
      'config.downloads': 'File downloads',
      'config.downloadsInfo': 'Specify the location where you want the challenge files to be saved. If not specified, they will be saved in the default downloads folder.',
      'config.destPlaceholder': 'Destination path (default: Downloads)',
      'config.reset': 'Reset information',
      'config.resetInfo': 'Press the button to reset all application data. The process will be shown on the right.',
      'config.btnReset': 'Reset data',
      'config.resetting': 'Erasing application data...',
      'config.resetDone': 'Data reset complete.',
      'config.resetError': 'Error resetting data.',
      'config.back': 'Back',

      // --- Docker Manager ---
      'docker.ipContainer': 'Container IP: ',
      'docker.ipCompose': 'Main service IP: ',
      'docker.inactive': 'Inactive',
      'docker.starting': 'Starting container...',
      'docker.stopping': 'Stopping container...',
      'docker.start': 'Start',
      'docker.stop': 'Stop',
      'docker.restart': 'Restart',
      'docker.downloading': 'Downloading images...',
      'docker.downloadingPct': 'Downloading image... {percent}%',
      'docker.preparing': 'Preparing container...',
      'docker.authenticating': 'Renewing Harbor session...',
      'docker.errorOp': 'Could not complete the Docker operation.',
      'docker.composeError': 'Could not retrieve the Compose configuration.',

      // --- Detalle de reto / módulo / temporada ---
      'detail.noDesc': 'No description',
      'detail.flagPlaceholder': 'Enter the flag',
      'detail.sendFlag': 'Submit flag',
      'detail.correct': 'Correct flag!',
      'detail.wrong': 'Wrong flag.',
      'detail.enterFlag': 'Enter a flag.',
      'detail.sendError': 'Error submitting flag.',
      'detail.seeWriteup': 'View Writeup',
      'detail.download': 'Download challenge files',
      'detail.downloadModule': 'Download module files',
      'detail.saved': 'File saved to: {path}',
      'detail.downloadError': 'Error downloading challenge files.',
      'detail.noUrl': 'No URL available',
      'detail.httpError': 'HTTP Error: {status}',

      // --- Portapapeles ---
      'clipboard.copied': 'Copied to clipboard!',

      // --- Errores Docker (error.js) ---
      'error.pageTitle': 'Docker not found',
      'error.dockerMissing.title': 'Docker is not installed',
      'error.dockerMissing.desc': 'Grafeno needs Docker to run. You can install it right here.',
      'error.dockerMissing.btn': 'Install Docker',
      'error.composeMissing.title': 'Docker Compose v2 needs to be installed or updated',
      'error.composeMissing.desc': 'Grafeno needs Docker Compose v2.33.1 or higher. You can install or update it right here.',
      'error.composeMissing.btn': 'Install / update Docker Compose',
      'error.permMissing.title': 'Your user is not in the docker group',
      'error.permMissing.desc': 'Docker is installed but your user lacks permissions to use it. Enter your password to add it to the docker group.',
      'error.permMissing.btn': 'Add my user to the docker group',
      'error.daemonStopped.title': 'The Docker service is not running',
      'error.daemonStopped.desc': 'Docker is installed but its service is not running. Enter your password to start it.',
      'error.daemonStopped.btn': 'Start Docker service',
      'error.infoBoxDoc': 'Automatic installation is only available for <strong>Ubuntu</strong>, <strong>Debian</strong> and <strong>Kali Linux</strong>.',
      'error.infoBoxOfficial': 'For other operating systems, see the <a href="https://docs.docker.com/engine/install/">official Docker documentation</a>.',
      'error.infoBoxScript': 'The install script is public and follows the official instructions: <a href="https://github.com/Offensive-Skills/Grafeno/blob/main/setup_docker.sh">see on GitHub</a>',
      'error.infoBoxPassword': 'The password is only used to install the official Docker packages.',
      'error.composeInfoBox': 'The official Docker repository will be added and the <code>docker-compose-plugin</code> plugin will be installed or updated.',
      'error.permInfoBox': 'Your user will be added to the <strong>docker</strong> group. After that you must log out and back in for the change to take effect.',
      'error.daemonInfoBox': '<code>sudo systemctl start docker</code> will be run to start the service.',
      'error.sudoLabel': 'Administrator password (sudo):',
      'error.sudoPlaceholder': 'sudo password',
      'error.installBtn': 'Install Docker',
      'error.cancelBtn': 'Cancel',
      'error.actionTitleRelogin': 'Log out and log back in',
      'error.actionTextRelogin': 'Docker has been installed. For Grafeno to use it, the <strong>docker</strong> group change requires a new session.',
      'error.actionTitleRestart': 'Restart Grafeno',
      'error.actionTextRestart': 'The operation completed successfully. Restart Grafeno to re-check Docker.',
      'error.step1': 'Log out of the current session',
      'error.step2': 'Log back in',
      'error.step3': 'Open Grafeno',
      'error.closeGrafeno': 'Close Grafeno',
      'error.restartGrafeno': 'Restart Grafeno',
      'error.close': 'Close',
      'error.retry': 'Retry',
      'error.cancelMsg': 'Installation was cancelled. Try again whenever you want.',
      'error.wrongPassword': 'The password is incorrect. Try again.',
      'error.installFail': 'Installation could not be completed. Check the log for details.',
      'error.unexpected': 'Unexpected error: {msg}',
      'error.canceling': 'Cancelling...',
      'error.installing': 'Installing Docker, this may take a few minutes...',
      'error.startingService': 'Starting the Docker service...',

      // --- Updater (main.js) ---
      'updater.title': 'Update available',
      'updater.message': 'The update has been downloaded. Restart the application to install it?',

      // --- Títulos de ventana (<title>) ---
      'title.login': 'Grafeno',
      'title.retos': 'Challenges - Grafeno',
      'title.cursos': 'Courses - Grafeno',
      'title.mainMenu': 'Grafeno - Main Menu',
      'title.temporada': 'Season - Grafeno',
      'title.config': 'Settings - Grafeno',
      'title.retosModulos': 'Module Challenges - Grafeno',
      'title.ranking': 'Ranking - Grafeno',
      'title.error': 'Grafeno - Docker not found',
      'title.modulos': 'Modules - Grafeno',
      'title.writeup': 'Writeup - Grafeno'
    }
  };

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || 'es';
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang === 'en' ? 'en' : 'es');
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (m, key) => (vars[key] !== undefined ? vars[key] : m));
  }

  function t(key, vars) {
    const lang = getLang();
    const table = dict[lang] || dict.es;
    const value = table[key];
    if (value === undefined) return key;
    return interpolate(value, vars);
  }

  function applyTranslations(root) {
    const scope = root || document;
    const lang = getLang();

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = (dict[lang] && dict[lang][key]) || dict.es[key];
      if (val !== undefined) el.textContent = val;
    });

    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const val = (dict[lang] && dict[lang][key]) || dict.es[key];
      if (val !== undefined) el.innerHTML = val;
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = (dict[lang] && dict[lang][key]) || dict.es[key];
      if (val !== undefined) el.setAttribute('placeholder', val);
    });

    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const val = (dict[lang] && dict[lang][key]) || dict.es[key];
      if (val !== undefined) el.setAttribute('title', val);
    });
  }

  function updateLangLabels(root) {
    const scope = root || document;
    const lang = getLang();
    scope.querySelectorAll('.lang-pill, .lang-switch-wrap').forEach((wrap) => {
      wrap.querySelectorAll('.lang-label').forEach((label) => {
        label.classList.toggle('active', label.getAttribute('data-lang') === lang);
      });
    });
  }

  function bindLangSwitches(root) {
    const scope = root || document;
    const lang = getLang();
    scope.querySelectorAll('.lang-switch').forEach((el) => {
      if (el.dataset.bound === '1') return;
      el.dataset.bound = '1';
      el.checked = lang === 'en';
      el.addEventListener('change', () => {
        setLang(el.checked ? 'en' : 'es');
        applyTranslations();
        updateLangLabels();
        document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: getLang() } }));
      });
    });
    updateLangLabels(scope);
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    bindLangSwitches();
  });

  window.i18n = {
    t,
    getLang,
    setLang,
    applyTranslations,
    bindLangSwitches,
    dict
  };
})();
