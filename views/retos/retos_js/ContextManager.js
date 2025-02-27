// modules/ContextManager.js
class ContextManager {
    static saveFilters(filters) {
      localStorage.setItem('challengeFilters', JSON.stringify(filters));
    }
    static getFilters() {
      const stored = localStorage.getItem('challengeFilters');
      return stored ? JSON.parse(stored) : { dificultad: "Facil", tematica: "Web", estado: "Todos" };
    }
    static saveSelectedChallenge(challengeName) {
      localStorage.setItem('selectedChallengeName', challengeName);
    }
    static getSelectedChallenge() {
      return localStorage.getItem('selectedChallengeName');
    }
    static saveRetosScroll(scroll) {
      localStorage.setItem('retosScroll', scroll);
    }
    static getRetosScroll() {
      return localStorage.getItem('retosScroll');
    }
  }
  
  module.exports = ContextManager;
  