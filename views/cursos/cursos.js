// views/cursos/cursos.js
const api = require('../../controllers/apiEndpoints');

const RetosApi = {
    // Función para obtener cursos usando fetch; se asume que la BASE_URL está definida en ApiEndpoints.js (o se usa directamente la URL)
    async getCourses({ token }) {

      const cursos = await api.getCourses({ token });
      return cursos;

    }
  };
  
  class Cursos {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
    }
    
    async loadCourses(token) {
      try {
        const courses = await RetosApi.getCourses({ token });
        this.renderCourses(courses);
      } catch (error) {
        console.error(error);
        this.container.innerHTML = `<p class="error">Error al cargar cursos. Revisa la consola para más detalles.</p>`;
      }
    }
    
    renderCourses(courses) {
      this.container.innerHTML = '';
      // Creamos una cuadrícula que se ajusta automáticamente al ancho
      const grid = document.createElement('div');
      grid.classList.add('cursos-grid');
      
      courses.forEach(course => {
        const card = document.createElement('div');
        card.classList.add('curso-card');
        
        const title = document.createElement('h2');
        title.textContent = course.name;
        
        const level = document.createElement('p');
        level.classList.add('curso-level');
        level.textContent = `Nivel: ${course.level}`;
        
        const desc = document.createElement('p');
        desc.classList.add('curso-description');
        desc.textContent = course.description;
        
        card.appendChild(title);
        card.appendChild(level);
        card.appendChild(desc);
        
        // Al hacer click en el curso, guardar el curso completo y redirigir a la vista de módulos
        card.addEventListener('click', () => {
          localStorage.setItem('currentCourse', JSON.stringify(course));
          window.location.href = '../modulos/modulos.html';
        });
        
        grid.appendChild(card);
      });
      
      this.container.appendChild(grid);
    }
  }
  
  window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('apiToken') || 'TU_API_TOKEN';
    const cursos = new Cursos('cursos-list');
    cursos.loadCourses(token);
    
    const btnAtras = document.getElementById('btn-atras');
    btnAtras.addEventListener('click', () => {
      window.location.href = '../main/mainMenu.html';
    });
  });
  