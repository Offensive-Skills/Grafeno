// controllers/apiEndpoints.js

const BASE_URL = 'https://grafeno.offs.es';

/**
 * Función genérica para enviar peticiones POST con cuerpo JSON.
 * @param {string} endpoint - El endpoint (ruta) de la API.
 * @param {object} data - Objeto con los parámetros a enviar en el body.
 * @returns {Promise<any>} - La respuesta en JSON.
 */
async function postRequest(endpoint, data) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
}


async function postRequestBlob(endpoint, data) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response;
  } catch (error) {
    throw error;
  }
}


/**
 * Obtiene los retos (challenges) sin módulos.
 * @param {object} params - { token, level, topic, type }
 */
async function getChallenges({ token, level, topic, type }) {
  return postRequest('/get_challenges', { token, level, topic, type });
}

/**
 * Descarga el writeup de un reto.
 * @param {object} params - { token, challengeID }
 */
async function getWriteup({ token, challengeID }) {
  return postRequest('/get_writeup_md', { token, challengeID });
}

/**
 * Obtiene el reto seasonal.
 * @param {object} params - { token }
 */
async function getSeasonalChallenge({ token }) {
  return postRequest('/seasonal_challenge', { token });
}

/**
 * Obtiene el mensaje de warning.
 * No requiere parámetros ya que se utiliza en GET o POST sin body.
 */
async function getWarningNotification() {
  return postRequest('/warningNotification', {}); 
}

/**
 * Verifica el token.
 * @param {object} params - { token }
 */
async function checkToken({ token }) {
  return postRequest('/check_token', { token });
}

/**
 * Obtiene los retos asociados a un módulo.
 * @param {object} params - { token, moduleID }
 */
async function getChallengesModules({ token, moduleID }) {
  return postRequest('/get_challenges_modules', { token, moduleID });
}

/**
 * Envía la flag para completar un reto.
 * @param {object} params - { token, challengeID, flag }
 */
async function submitChallenge({ token, challengeID, flag }) {
  return postRequest('/submit_challenge', { token, challengeID, flag });
}

/**
 * Obtiene los cursos.
 * @param {object} params - { token }
 */
async function getCourses({ token }) {
  return postRequest('/get_courses', { token });
}

/**
 * Obtiene los módulos de un curso.
 * @param {object} params - { token, courseID }
 */
async function getModules({ token, courseID }) {
  return postRequest('/get_modules', { token, courseID });
}

/**
 * Obtiene las estadísticas (grafeno).
 * @param {object} params - { token }
 */
async function getStats({ token }) {
  return postRequest('/get_stats_grafeno', { token });
}

/**
 * Función auxiliar para realizar peticiones GET y obtener la respuesta en formato Blob.
 * @param {string} path - Ruta del endpoint.
 * @param {object} params - Parámetros (en este caso no se usan)
 * @returns {Promise<Blob>}
 */
async function getRequestBlob(path, params) {
  const url = BASE_URL + path;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include' // O ajusta según la configuración de CORS/autenticación
  });
  return response.blob();
}

/**
 * Descarga el ranking (top 20).
 * @returns {Promise<Blob>}
 */
async function getRanking() {
  return getRequestBlob('/get_ranking', {});
}

/**
 * Obtiene los puntos del usuario actual.
 * @param {string} token - Api token del usuario.
 * @returns {Promise<Blob>}
 */
async function getUserPoints(token) {
  // Se envía el token como parámetro GET
  const url = BASE_URL + '/get_user_points?token=' + encodeURIComponent(token);
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include'
  });
  return response.blob();
}

/**
 * Descarga el archivo asociado a un reto.
 * @param {object} params - { token, challengeID }
 */
async function getFiles({ token, challengeID }) {
  return postRequestBlob('/get_files', { token, challengeID });
}


module.exports = {
  getRanking,
  getRequestBlob,
};

module.exports = {
  getChallenges,
  getWriteup,
  getSeasonalChallenge,
  getWarningNotification,
  checkToken,
  getChallengesModules,
  submitChallenge,
  getCourses,
  getModules,
  getStats,
  getFiles,
  getRanking,
  getUserPoints,
  // También se exporta BASE_URL si se requiere en otros módulos
  BASE_URL
};
