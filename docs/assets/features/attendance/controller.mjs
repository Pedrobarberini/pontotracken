import { $, escapeHTML as esc } from "../../shared/dom.mjs?v=phase2-finish-1";
import { todayCalendarNote } from "../calendar/presentation.mjs?v=phase2-finish-1";
function createAttendance({ state, api, busy, toast, hours, currentParts, currentMonth, monthLabel, recordsTable, showDataError }) {
  function updateClock() {
    if (!state.session?.user) return;
    const now = new Date(Date.now() + state.clockOffset);
    const parts = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: state.timezone }).formatToParts(now);
    const get = (type) => parts.find((p2) => p2.type === type).value;
    $("#live-clock").innerHTML = `${get("hour")}:${get("minute")}<span>:${get("second")}</span>`;
    $("#today-date").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: state.timezone }).format(now);
    $("#header-date").textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: state.timezone }).format(now);
    const p = currentParts();
    const day = `${p.year}-${p.month}-${p.day}`;
    if (state.loadedDay && state.loadedDay !== day) {
      state.loadedDay = day;
      loadHome();
    }
  }
  function renderToday(day, context = {}) {
    state.todayContext = context;
    state.today = day;
    const times = day?.times || [];
    const count = times.length;
    const occurrence = day && !day.virtual && !["recorded", "weekend"].includes(day.status);
    const active = count % 2 === 1;
    const note = todayCalendarNote(context);
    if ($("#punch-calendar-note")) {
      $("#punch-calendar-note").textContent = note;
      $("#punch-calendar-note").hidden = !note;
    }
    $("#punch-state").textContent = occurrence ? day.label : count === 0 ? "Jornada não iniciada" : active ? "Jornada em andamento" : "Saída registrada";
    $("#punch-hint").textContent = occurrence ? "Confira a ocorrência no seu espelho." : count === 0 ? "Tudo pronto para começar seu dia." : active ? "Lembre de registrar sua saída." : "Uma nova entrada inicia outro período.";
    $("#punch span").textContent = active ? "Registrar saída" : "Registrar entrada";
    $("#punch").disabled = Boolean(occurrence || count >= 12);
    $("#today-total").textContent = hours(day?.minutes || 0);
    if (occurrence) {
      $("#today-timeline").innerHTML = `<p class="timeline-empty">${esc(day.label)}${day.source === "import" ? "<br>Ocorrência importada da planilha." : ""}</p>`;
      return;
    }
    const timeline = times.map((time, i) => `<div class="timeline-item"><span class="timeline-dot"></span><div><span>${i % 2 === 0 ? "Entrada" : "Saída"}</span><strong>${esc(time.slice(0, 5))}</strong></div></div>`);
    if (count === 0 || active) timeline.push(`<div class="timeline-item"><span class="timeline-dot empty"></span><div><span class="muted">${active ? "Saída pendente" : "Entrada ainda não registrada"}</span><strong class="muted">—</strong></div></div>`);
    $("#today-timeline").innerHTML = timeline.join("");
  }
  async function loadHome() {
    if (!state.session?.user) return;
    $("#data-error").hidden = true;
    $("#punch").disabled = true;
    try {
      const result = await api("records", { query: `&month=${currentMonth()}` });
      const p = currentParts();
      state.loadedDay = `${p.year}-${p.month}-${p.day}`;
      renderToday(result.today, result.todayContext);
      $("#summary-month").textContent = monthLabel(currentMonth());
      $("#stat-days").innerHTML = `${result.summary.days} <small>dias</small>`;
      $("#stat-hours").innerHTML = `${Math.floor(result.summary.minutes / 60).toString().padStart(2, "0")}<small>h</small> ${(result.summary.minutes % 60).toString().padStart(2, "0")}<small>m</small>`;
      $("#stat-pending").innerHTML = `${result.summary.pending} <small>dias</small>`;
      $("#stat-medical").innerHTML = `${result.summary.medical} <small>dias</small>`;
      $("#recent-table").innerHTML = recordsTable(result.rows.slice(0, 5));
    } catch (error) {
      showDataError(error.message);
    }
  }
  $("#punch").onclick = () => {
    const count = state.today?.times.length || 0;
    state.nextPunch = count === 0 ? "entry" : count % 2 === 1 ? "exit" : "return";
    $("#confirm-title").textContent = count % 2 === 1 ? "Registrar saída?" : "Registrar entrada?";
    $("#punch-confirm").showModal();
  };
  $("#cancel-punch").onclick = () => $("#punch-confirm").close();
  $("#confirm-punch").onclick = async () => {
    $("#cancel-punch").disabled = true;
    try {
      await busy($("#confirm-punch"), async () => {
        if (!state.punchRequest || state.punchRequest.type !== state.nextPunch) state.punchRequest = { type: state.nextPunch, requestId: crypto.randomUUID() };
        const result = await api("punch", { method: "POST", data: state.punchRequest });
        state.punchRequest = null;
        $("#punch-confirm").close();
        renderToday(result.record, state.todayContext);
        toast(`Ponto registrado às ${result.record.times.at(-1).slice(0, 5)}.`);
        await loadHome();
      }, "Registrando…");
    } catch (error) {
      if (error.status && error.status < 500) state.punchRequest = null;
      $("#punch-confirm").close();
      toast(error.message, true);
      await loadHome();
    } finally {
      $("#cancel-punch").disabled = false;
    }
  };
  return { loadHome, updateClock, renderToday };
}
export {
  createAttendance
};
