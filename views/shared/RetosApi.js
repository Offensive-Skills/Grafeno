// shared/RetosApi.js
class RetosApi {
  static async fetchChallenges(token, level, topic, type) {
    const challenges = await api.getChallenges({ token, level, topic, type });
    return challenges;
  }
}

window.RetosApi = RetosApi;
