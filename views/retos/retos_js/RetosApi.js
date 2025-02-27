// modules/RetosApi.js
const api = require('../../../controllers/apiEndpoints');

class RetosApi {
  static async fetchChallenges(token, level, topic, type) {
    const challenges = await api.getChallenges({ token, level, topic, type });
    return challenges;
  }
}

module.exports = RetosApi;
