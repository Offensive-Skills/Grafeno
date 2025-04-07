// views/modulos/modulos.js
const api = require('../../controllers/apiEndpoints');

// Función para enviar la petición POST para obtener los módulos de un curso
  async function getModules({ token, courseID }) {

  const modulos = await api.getModules({ token, courseID});

   return modulos;
 }
  
  window.addEventListener('DOMContentLoaded', async () => {
    const btnAtras = document.getElementById('btn-atras');
    btnAtras.addEventListener('click', () => {
      window.location.href = '../cursos/cursos.html';
    });
    
    const token = localStorage.getItem('apiToken') || 'TU_API_TOKEN';
    const currentCourse = JSON.parse(localStorage.getItem('currentCourse') || '{}');
    if (!currentCourse.id) {
      document.getElementById('modulos-list').innerHTML = `<p class="error">No se ha seleccionado un curso.</p>`;
      return;
    }

    const courseTitleElem = document.getElementById('course-title');
    if (currentCourse && currentCourse.name && courseTitleElem) {
      courseTitleElem.textContent = currentCourse.name;
    }
    
    try {
      const modules = await getModules({ token, courseID: currentCourse.id });
      renderModules(modules);
    } catch (error) {
      console.error(error);
      document.getElementById('modulos-list').innerHTML = `<p class="error">Error al cargar módulos. Revisa la consola.</p>`;
    }
  });
  
  // Renderiza la lista de módulos en una cuadrícula
  function renderModules(modules) {
    const container = document.getElementById('modulos-list');
    container.innerHTML = '';
    
    modules.forEach(module => {
      const card = document.createElement('div');
      card.classList.add('modulo-card');
      
      const title = document.createElement('h2');
      title.textContent = module.name;
  
      
      const desc = document.createElement('p');
      desc.classList.add('modulo-description');
      desc.textContent = module.description;
      
      card.appendChild(title);
      card.appendChild(desc);
      
      // Al hacer click en el módulo, guarda el módulo actual y redirige a la siguiente página
      card.addEventListener('click', () => {
        localStorage.setItem('currentModuleId', JSON.stringify(module.id));
        // Por ahora, redirigimos a una página que contendrá el listado de retos del módulo
        window.location.href = '../retos_modulos/retos_modulos.html';
      });
      
      container.appendChild(card);
    });
  }
  