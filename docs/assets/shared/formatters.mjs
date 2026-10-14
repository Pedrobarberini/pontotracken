const dateObject = (date) => /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
const hours = (minutes) => `${Math.floor(minutes / 60).toString().padStart(2, "0")}h ${(minutes % 60).toString().padStart(2, "0")}m`;
function createDateFormatters(getTimezone) {
  const formatDate = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: getTimezone() }).format(dateObject(date));
  const monthLabel = (month) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: getTimezone() }).format(dateObject(month + "-01"));
  return { formatDate, monthLabel };
}
function formatInstant(value, timeStyle = "medium") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle, timeZone: "America/Sao_Paulo" }).format(date);
}
export {
  createDateFormatters,
  dateObject,
  formatInstant,
  hours
};
