const { DateTime } = require("luxon");

function isBusinessHours() {
  const now = DateTime.now().setZone("America/New_York");
  const weekday = now.weekday;

  if (weekday < 1 || weekday > 5) {
    return false;
  }

  const minutes = now.hour * 60 + now.minute;
  const morningStart = 9 * 60; // 09:00
  const morningEnd = 13 * 60; // 13:00
  const afternoonStart = 14 * 60 + 30; // 14:30
  const afternoonEnd = 17 * 60; // 17:00

  const inMorning = minutes >= morningStart && minutes < morningEnd;
  const inAfternoon = minutes >= afternoonStart && minutes < afternoonEnd;

  return inMorning || inAfternoon;
}

module.exports = {
  isBusinessHours,
};
