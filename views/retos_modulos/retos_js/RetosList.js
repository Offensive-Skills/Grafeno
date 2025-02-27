// modules/RetosList.js
class RetosList {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }
  renderList(challenges, onChallengeClick) {
    this.container.innerHTML = '';
    challenges.forEach(challenge => {
      const item = document.createElement('div');
      item.classList.add('challenge-item');
      item.setAttribute('data-name', challenge.name);
      if (challenge.completed) {
        item.classList.add('challenge-completed');
      } else {
        item.classList.add('challenge-pending');
      }
      item.textContent = challenge.name;
      item.addEventListener('click', () => onChallengeClick(challenge));
      this.container.appendChild(item);
    });
  }
}

module.exports = RetosList;
