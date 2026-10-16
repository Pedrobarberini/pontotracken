import { journeyDemo } from "./journey.mjs?v=overtime-total-1";
import { provenanceDemo } from "./provenance.mjs?v=overtime-total-1";
import { peopleDemo, demoActors } from "./people.mjs?v=overtime-total-1";
import { createHrDemo } from "./hr.mjs?v=overtime-total-1";
import { createDevelopmentDemo } from "./development.mjs?v=overtime-total-1";
import { calendarContext, enrichCalendar, projectMonth, matchesCalendarFilter, calendarFilters, calendarCsv } from "../calendar.mjs?v=overtime-total-1";
import { attendanceSummary } from "../vendor/journey-metrics.mjs?v=overtime-total-1";
const hrDemo = createHrDemo({peopleDemo});
const developmentDemo = createDevelopmentDemo({peopleDemo, hrDemo, getJourneyReport: ({people,from,to}) =>
  journeyDemo('demo-attendance-report',{data:{people,from,to},query:'',dateNow,days,parseCell,actorUid:'presentation'})});
const MONTHS = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, MAIO: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
const LABELS = { recorded: "Registrado", weekend: "Fim de semana", not_applicable: "Não se aplica", medical: "Atestado" };
let loggedIn = false, preview = null;
const days = /* @__PURE__ */ new Map(), requests = /* @__PURE__ */ new Map();
function error(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
function nowParts(now = /* @__PURE__ */ new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).formatToParts(now).map((p) => [p.type, p.value]));
}
function dateNow() {
  const p = nowParts();
  return `${p.year}-${p.month}-${p.day}`;
}
function timeNow() {
  const p = nowParts();
  return `${p.hour}:${p.minute}:${p.second}`;
}
const seconds = (t) => {
  const [h, m, s = 0] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};
function minutes(times) {
  let total = 0;
  for (let i = 0; i + 1 < times.length; i += 2) total += seconds(times[i + 1]) - seconds(times[i]);
  return Math.floor(total / 60);
}
function parseCell(value) {
  const raw = String(value).trim(), upper = raw.toUpperCase();
  if (["FDS", "N/A", "ATESTADO"].includes(upper)) return { status: { FDS: "weekend", "N/A": "not_applicable", ATESTADO: "medical" }[upper], times: [] };
  if (!/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*\|\s*\d{1,2}:\d{2}(?::\d{2})?)*$/.test(raw)) error("Use horários separados por |, FDS, N/A ou ATESTADO.");
  const times = [];
  for (const part of raw.split("|")) {
    const [h, m, s = 0] = part.trim().split(":").map(Number);
    if (h > 23 || m > 59 || s > 59) error("Horário fora do intervalo válido.");
    const t = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
    if (times.length && t <= times.at(-1)) error("Os horários precisam estar em ordem crescente no mesmo dia.");
    times.push(t);
  }
  if (times.length > 12) error("O limite é de 12 marcações por dia.");
  return { status: "recorded", times };
}
function decorate(row) {
  return { ...row, times: [...row.times], minutes: minutes(row.times), incomplete: row.times.length % 2 === 1, label: row.times.length % 2 === 1 ? "Em aberto" : LABELS[row.status] };
}
function seed() {
  if (days.size) return;
  const p = nowParts(), year = Number(p.year), month = Number(p.month);
  for (let d = 1; d < Number(p.day); d++) {
    const date = `${year}-${p.month}-${String(d).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    days.set(date, { date, status: weekend ? "weekend" : "recorded", times: weekend ? [] : ["09:00:00", "16:00:00"], source: "demo" });
  }
}
function validateZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 67324752) error("O arquivo não é uma planilha XLSX válida.");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 101010256) {
    end = i;
    break;
  }
  if (end < 0) error("O arquivo não é uma planilha XLSX válida.");
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true), total = 0;
  if (entries > 1e3) error("A planilha tem arquivos internos demais.");
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 33639248) error("O arquivo não é uma planilha XLSX válida.");
    const size = view.getUint32(offset + 24, true);
    total += size;
    if (size > 15 * 1024 * 1024 || total > 30 * 1024 * 1024) error("A planilha é grande demais após descompactar.");
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
}
async function parseSpreadsheet(file, year) {
  if (!Number.isInteger(year) || year < 2e3 || year > 2100) error("Informe o ano da primeira coluna, entre 2000 e 2100.");
  const extension = file.name.split(".").at(-1).toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(extension)) error("Envie um arquivo .xlsx, .xls ou .csv.");
  if (file.size > 5 * 1024 * 1024) error("O arquivo deve ter no máximo 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === "xlsx") validateZip(bytes);
  if (!globalThis.XLSX) error("Não foi possível carregar o leitor de Excel. Atualize a página.");
  let book;
  try {
    book = globalThis.XLSX.read(bytes, { type: "array", sheetRows: 80, sheets: 0, cellFormula: true, cellStyles: false, cellDates: false });
  } catch {
    error("Não foi possível ler a planilha. Tente salvar novamente como .xlsx.");
  }
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) error("A primeira aba está vazia.");
  const at = (r, c) => sheet[globalThis.XLSX.utils.encode_cell({ r, c })];
  let header = -1, columns = [];
  for (let r = 0; r < 15; r++) {
    const found = [];
    for (let c = 0; c < 40; c++) {
      const month = MONTHS[String(at(r, c)?.v ?? "").trim().toUpperCase()];
      if (month) found.push({ c, month });
    }
    if (found.length > columns.length) {
      header = r;
      columns = found;
    }
  }
  if (!columns.length) error("Não encontrei a linha de meses. Use cabeçalhos como SET, OUT, NOV, DEZ, JAN.");
  if (columns.length > 13) error("O modelo aceita até 13 colunas de meses.");
  let previous = 0, currentYear = year;
  for (const col of columns) {
    if (col.month <= previous) currentYear++;
    col.year = currentYear;
    previous = col.month;
  }
  let dayColumn = null;
  for (let c = 0; c < columns[0].c; c++) {
    const label = String(at(header, c)?.v ?? "").trim().toUpperCase();
    if (["DIA", "DIAS"].includes(label)) {
      dayColumn = c;
      break;
    }
    let numeric = 0;
    for (let r = header + 1; r <= header + 6; r++) {
      const value = at(r, c)?.v;
      if (value !== void 0 && value !== "" && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 31) numeric++;
    }
    if (numeric >= 3) dayColumn = c;
  }
  const rows = [], warnings = [], seen = /* @__PURE__ */ new Set();
  for (let r = header + 1; r < 80; r++) {
    const rawDay = dayColumn === null ? r - header : at(r, dayColumn)?.v;
    if (rawDay === void 0 || rawDay === "" || !Number.isInteger(Number(rawDay))) continue;
    const day = Number(rawDay);
    if (day < 1 || day > 31) continue;
    for (const col of columns) {
      const data = at(r, col.c);
      if (!data || !data.f && (data.v === void 0 || String(data.v).trim() === "")) continue;
      const raw = data.f ? "=" + data.f : String(data.v).trim(), cell = globalThis.XLSX.utils.encode_cell({ r, c: col.c });
      const date = `${col.year}-${String(col.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const d = new Date(Date.UTC(col.year, col.month - 1, day));
      if (d.getUTCMonth() + 1 !== col.month) {
        if (raw.toUpperCase() !== "N/A") warnings.push({ cell, value: raw, message: "Este dia não existe nesse mês." });
        continue;
      }
      try {
        if (data.f || raw.startsWith("=")) error("Fórmulas não são importadas. Cole os horários como valores.");
        const record = parseCell(raw);
        if (record.times.length && (date > dateNow() || date === dateNow() && record.times.at(-1) > timeNow())) error("Horários futuros não são importados.");
        if (seen.has(date)) error("Data repetida na planilha.");
        seen.add(date);
        rows.push({ ...record, date, cell, raw, minutes: minutes(record.times), label: LABELS[record.status], exists: days.has(date) });
      } catch (e) {
        warnings.push({ cell, value: raw, message: e.message });
      }
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length && !warnings.length) error("Não encontrei registros preenchidos abaixo dos meses.");
  return { rows, warnings, periods: columns.map((c) => ({ year: c.year, month: c.month })), header_row: header + 1, filename: file.name.slice(0, 180), id: crypto.randomUUID() };
}
async function demoApi(action, { data = null, query = "" } = {}) {
  if (action === "session") return { user: loggedIn ? peopleDemo.sessionUser() : null, csrf: "presentation-only", demoAllowed: true, firebaseReady: false, firebase: null, timezone: "America/Sao_Paulo", features: { registryPreparation: false } };
  if (action === "demo") {
    loggedIn = true;
    seed();
    provenanceDemo.seed(days);
    return { ok: true, csrf: "presentation-only" };
  }
  if (action === "login") error("O login Firebase ainda não está configurado nesta apresentação.", 503);
  if (!loggedIn) error("Abra a demonstração para continuar.", 401);
  if (action === "demo-persona") return {user:peopleDemo.select(data?.uid)};
  if (action.startsWith("admin-") && peopleDemo.sessionUser().role !== "admin") error("Acesso restrito ao administrador.",403);
  if (action.startsWith("people-")) return peopleDemo.request(action,{data:data||{},query});
  if (action.startsWith("hr-")) return hrDemo.request(action,{data:data||{},query});
  if (action.startsWith("development-")) return developmentDemo.request(action,{data:data||{},query});
  const context = { data: data || {}, query, dateNow, days, parseCell, actorUid:peopleDemo.sessionUser().uid };
  const users = () => journeyDemo("admin-users", { ...context, actorUid:"presentation", query: "" }).users;
  const registry = provenanceDemo(action, { ...context, ...["admin-registry", "admin-registry-save", "admin-record-provenance", "record-provenance"].includes(action) ? { users: users() } : {} });
  if (registry) return registry;
  const before = action === "admin-correct" ? structuredClone(days.get(data.date) || null) : null;
  if (action === "admin-history") {
    const params = new URLSearchParams(query.replace(/^&/, "")), uid = params.get("uid"), offset = Number(params.get("offset") || 0), team = users(), email = team.find((user) => user.uid === uid)?.email;
    const history = [];
    for (let start = 0; start <= 1e4; start += 50) {
      const pageParams = new URLSearchParams(params);
      pageParams.set("offset", String(start));
      const page = journeyDemo(action, { ...context, query: "&" + pageParams });
      history.push(...page.events);
      if (page.events.length < 50) break;
    }
    const all = [...history, ...provenanceDemo.audit()].filter((event) => !uid || event.target_email === email).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    return { events: all.slice(offset, offset + 50), nextOffset: all.length > offset + 50 ? offset + 50 : null };
  }
  const journey = journeyDemo(action, context);
  if (journey) {
    if (action === "admin-correct") provenanceDemo.observeCorrection({ uid: data.uid, date: data.date, before, after: journey.record, reason: data.reason, users: users() });
    return journey;
  }
  if (action === "logout") {
    loggedIn = false;
    preview = null;
    return { ok: true };
  }
  if (action === "records") {
    const params = new URLSearchParams(query.replace(/^&/, "")), month = params.get("month") || dateNow().slice(0, 7), status = params.get("status") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) error("Mês inválido.");
    if (!calendarFilters.includes(status)) error("Situação inválida.");
    const schedules = journeyDemo("demo-calendar", context).schedules;
    const rows = projectMonth([...days.values()].map(decorate), month, schedules, dateNow()).filter((row) => matchesCalendarFilter(row, status));
    return { rows, today: days.has(dateNow()) ? enrichCalendar(decorate(days.get(dateNow())), schedules) : null, todayContext: calendarContext(dateNow(), schedules), summary: attendanceSummary(rows, schedules) };
  }
  if (action === "punch") {
    const schedules = journeyDemo("demo-calendar", context).schedules;
    if (requests.has(data.requestId)) return { record: enrichCalendar(decorate(requests.get(data.requestId)), schedules) };
    const date = dateNow(), row = days.get(date) || { date, status: "recorded", times: [], source: "demo" };
    if (!["recorded", "weekend"].includes(row.status)) error("Este dia já tem uma ocorrência importada. Confira seu espelho de ponto.", 409);
    const count = row.times.length;
    if (!(data.type === "entry" && count === 0 || data.type === "exit" && count % 2 === 1 || data.type === "return" && count >= 2 && count % 2 === 0) || count >= 12) error("A sequência de marcações mudou. Atualize a página.", 409);
    let time = timeNow();
    if (count && time <= row.times.at(-1)) {
      const next = seconds(row.times.at(-1)) + 1;
      if (next >= 86400) error("O dia terminou. Atualize a página.", 409);
      time = [Math.floor(next / 3600), Math.floor(next % 3600 / 60), next % 60].map((n) => String(n).padStart(2, "0")).join(":");
    }
    const saved = { ...row, status: "recorded", times: [...row.times, time] };
    days.set(date, saved);
    requests.set(data.requestId, saved);
    await provenanceDemo.observePunch({ record: saved, type: data.type, requestId: data.requestId });
    return { record: enrichCalendar(decorate(saved), schedules) };
  }
  if (action === "import-preview") {
    preview = await parseSpreadsheet(data.get("file"), Number(data.get("year")));
    preview.expires = Date.now() + 9e5;
    return preview;
  }
  if (action === "import-commit") {
    if (!preview || preview.id !== data.id || preview.expires < Date.now()) error("A prévia expirou. Selecione a planilha novamente.", 409);
    let saved = 0, skipped = 0;
    const imported = [];
    for (const row of preview.rows) {
      if (days.has(row.date)) {
        skipped++;
        continue;
      }
      const record = { date: row.date, status: row.status, times: [...row.times], source: "import" };
      days.set(row.date, record);
      imported.push(record);
      saved++;
    }
    provenanceDemo.observeImport({ rows: imported, filename: preview.filename });
    preview = null;
    return { saved, skipped };
  }
  error("Ação indisponível na demonstração.", 404);
}
function saveBlob(blob, name) {
  const href = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1e3);
}
async function demoDownload(url) {
  if (!loggedIn) error("Abra a demonstração para continuar.", 401);
  const params = new URL(url, location.href).searchParams;
  if (params.get("action") === "people-event-term") {
    const file = await peopleDemo.downloadTerm(params.get("id"));
    saveBlob(file.blob,file.filename);
    return;
  }
  if (params.get("action") === "people-file-download") {
    const file = peopleDemo.download(params.get("id"));
    saveBlob(file.blob,file.filename);
    return;
  }
  if (params.get("action") === "template") {
    const values = [["Dia", "SET", "OUT", "NOV", "DEZ", "JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET"]];
    for (let d = 1; d <= 31; d++) values.push([d]);
    values.push([], [], ["Preencha com 09:00 | 16:00, FDS, N/A ou ATESTADO."], ["Informe o ano da primeira coluna SET ao importar."]);
    const sheet = XLSX.utils.aoa_to_sheet(values);
    sheet["!cols"] = [{ wch: 10 }, ...Array.from({ length: 13 }, () => ({ wch: 19 }))];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Ponto");
    const bytes = XLSX.write(book, { bookType: "xlsx", type: "array" });
    saveBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "modelo-ponto.xlsx");
    return;
  }
  if (params.get("action") === "export") {
    const month = params.get("month");
    const { rows } = await demoApi("records", { query: `&${params.toString()}` });
    saveBlob(new Blob([calendarCsv(rows)], { type: "text/csv;charset=utf-8" }), `ponto-${month}.csv`);
    return;
  }
  error("Download indisponível.");
}
export {
  demoActors,
  demoApi,
  demoDownload,
  minutes,
  parseCell,
  parseSpreadsheet
};
