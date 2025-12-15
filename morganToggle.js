function isMorganEnabled() {
  const v = (process.env.MORGAN_ENABLED || 'true').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

module.exports = { isMorganEnabled };
