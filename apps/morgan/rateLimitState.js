// rateLimitState.js
let lastVapi429At = 0;

function setLastVapi429At(ts) {
  lastVapi429At = ts;
}

function getLastVapi429At() {
  return lastVapi429At;
}

module.exports = {
  setLastVapi429At,
  getLastVapi429At,
};
