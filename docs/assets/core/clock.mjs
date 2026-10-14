function createClock(state) {
  function currentParts() {
    return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: state.timezone }).formatToParts(new Date(Date.now() + state.clockOffset)).map((p) => [p.type, p.value]));
  }
  function currentMonth() {
    const p = currentParts();
    return `${p.year}-${p.month}`;
  }
  function syncTime(serverTime) {
    if (serverTime) state.clockOffset = new Date(serverTime).getTime() - Date.now();
  }
  return { currentParts, currentMonth, syncTime };
}
export {
  createClock
};
