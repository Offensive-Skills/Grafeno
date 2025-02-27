// controllers/dockerController.js
const { spawn } = require('child_process');
const harbor = "harbor.offs.es"
module.exports = {
  loginToDocker: async (username, apiToken) => {
    return new Promise((resolve, reject) => {
      // Llamamos a 'docker login harbor.offs.es -u USER -p TOKEN'
      const dockerLogin = spawn('docker', [
        'login',
        harbor,
        '-u',
        username,
        '-p',
        apiToken
      ]);

      dockerLogin.stdout.on('data', (data) => {
        console.log(`STDOUT: ${data}`);
      });

      dockerLogin.stderr.on('data', (data) => {
        console.error(`STDERR: ${data}`);
      });

      dockerLogin.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(false);
        }
      });
    });
  }
};
