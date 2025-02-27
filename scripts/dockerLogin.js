// scripts/dockerLogin.js
const dockerController = require('../controllers/dockerController');
async function attemptDockerLogin(username, apiToken) {
  try {
    const result = await dockerController.loginToDocker(
      username,
      apiToken,
    );
    return result;
  } catch (error) {
    return false;
  }
}

module.exports = {
  attemptDockerLogin
};
