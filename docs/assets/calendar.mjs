const fixedHolidays = {
  '01-01': ['Confraternização Universal', 1949],
  '04-21': ['Tiradentes', 1950],
  '05-01': ['Dia do Trabalho', 1949],
  '09-07': ['Independência do Brasil', 1949],
  '10-12': ['Nossa Senhora Aparecida', 1980],
  '11-02': ['Finados', 2003],
  '11-15': ['Proclamação da República', 1949],
  '11-20': ['Dia Nacional de Zumbi e da Consciência Negra', 2024],
  '12-25': ['Natal', 1949]
};
const datedHolidays = { '2026-10-04': 'Eleições gerais — primeiro turno' };
const calendarFilters = [
  '',
  'recorded',
  'weekend',
  'holiday',
  'off_schedule',
  'medical',
  'not_applicable'
];
function nationalHoliday(date) {
  const year = Number(date.slice(0, 4)),
    fixed = fixedHolidays[date.slice(5)];
  return datedHolidays[date] || (fixed && year >= fixed[1] ? fixed[0] : null);
}
function effectiveSchedule(date, schedules = []) {
  return (
    schedules
      .filter((schedule) => schedule.effective_date <= date)
      .sort((a, b) => a.effective_date.localeCompare(b.effective_date))
      .at(-1) || null
  );
}
function calendarContext(date, schedules = []) {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay(),
    isWeekend = weekday === 0 || weekday === 6,
    holidayName = nationalHoliday(date),
    schedule = effectiveSchedule(date, schedules);
  const weekdays = schedule
    ? Array.isArray(schedule.weekdays)
      ? schedule.weekdays
      : JSON.parse(schedule.weekdays)
    : null;
  const isScheduledDay = weekdays ? weekdays.includes(weekday) : null,
    outsideSchedule = isScheduledDay === null ? null : !isScheduledDay;
  const calendarKind = holidayName
    ? 'holiday'
    : isScheduledDay === true
      ? 'regular'
      : isWeekend
        ? 'weekend'
        : outsideSchedule === true
          ? 'off_schedule'
          : 'regular';
  return {
    isWeekend,
    isHoliday: !!holidayName,
    holidayName,
    isScheduledDay,
    outsideSchedule,
    calendarKind,
    scheduleEffectiveDate: schedule?.effective_date || null
  };
}
function enrichCalendar(row, schedules = []) {
  const context = calendarContext(row.date, schedules),
    hasPunches = row.times.length > 0;
  const occurrenceLabel =
    row.status === 'weekend'
      ? row.source === 'import'
        ? 'Fim de semana (planilha)'
        : 'Fim de semana (ocorrência)'
      : null;
  return {
    ...row,
    ...context,
    hasPunches,
    virtual: row.virtual === true,
    ...(occurrenceLabel ? { occurrenceLabel } : {}),
    ...(row.status === 'weekend' && !hasPunches && context.calendarKind === 'regular'
      ? { label: 'Sem marcações' }
      : {})
  };
}
function projectMonth(rows, month, schedules = [], today) {
  const dates = new Map(
    rows
      .filter((row) => row.date.startsWith(month + '-'))
      .map((row) => [row.date, enrichCalendar(row, schedules)])
  );
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  for (let day = 1; day <= last; day++) {
    const date = month + '-' + String(day).padStart(2, '0');
    if (date > today || dates.has(date)) continue;
    const context = calendarContext(date, schedules);
    if (context.calendarKind === 'regular') continue;
    const label = {
      holiday: 'Feriado nacional',
      weekend: 'Fim de semana',
      off_schedule: 'Fora da escala'
    }[context.calendarKind];
    dates.set(date, {
      date,
      status: context.calendarKind,
      times: [],
      source: 'calendar',
      created_at: null,
      version: 0,
      minutes: 0,
      incomplete: false,
      label,
      ...context,
      hasPunches: false,
      virtual: true
    });
  }
  return [...dates.values()].sort((a, b) => b.date.localeCompare(a.date));
}
function matchesCalendarFilter(row, status) {
  if (!status) return true;
  if (status === 'recorded') return row.hasPunches;
  if (status === 'holiday') return row.isHoliday;
  if (status === 'weekend') return row.isWeekend && row.isScheduledDay !== true;
  if (status === 'off_schedule') return row.outsideSchedule === true;
  return row.status === status;
}
function calendarSummary(rows) {
  const summary = {
    minutes: 0,
    days: 0,
    pending: 0,
    medical: 0,
    holidayWorkedMinutes: 0,
    offScheduleWorkedMinutes: 0,
    weekendOffScheduleWorkedMinutes: 0,
    holidayDays: 0,
    offScheduleDays: 0,
    weekendOffScheduleDays: 0,
    holidayWorkedDays: 0,
    offScheduleWorkedDays: 0,
    weekendOffScheduleWorkedDays: 0
  };
  for (const row of rows) {
    const hasPunches = row.hasPunches ?? row.times.length > 0,
      off = row.outsideSchedule === true,
      weekendOff = row.isWeekend && off;
    summary.minutes += row.minutes;
    summary.days += Number(hasPunches);
    summary.pending += Number(row.incomplete);
    summary.medical += Number(row.status === 'medical');
    for (const [kind, match] of [
      ['holiday', row.isHoliday],
      ['offSchedule', off],
      ['weekendOffSchedule', weekendOff]
    ]) {
      summary[kind + 'Days'] += Number(!!match);
      summary[kind + 'WorkedDays'] += Number(!!match && hasPunches);
      if (match) summary[kind + 'WorkedMinutes'] += row.minutes;
    }
  }
  return summary;
}
const clock = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const yesNo = (value) => (value === null ? 'Sem escala cadastrada' : value ? 'Sim' : 'Não');
function calendarCsv(rows) {
  const escape = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const labels = {
    regular: 'Dia normal',
    weekend: 'Fim de semana',
    holiday: 'Feriado nacional',
    off_schedule: 'Fora da escala'
  };
  const lines = [
    [
      'Data',
      'Marcações',
      'Situação',
      'Horas trabalhadas',
      'Origem',
      'Calendário',
      'Feriado nacional',
      'Dia previsto na escala',
      'Fora da escala',
      'Horas em feriado',
      'Horas fora da escala',
      'Horas em FDS fora da escala'
    ]
  ];
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date)))
    lines.push([
      row.date.split('-').reverse().join('/'),
      row.times.map((time) => time.slice(0, 5)).join(' | '),
      row.label,
      clock(row.minutes),
      row.source,
      labels[row.calendarKind],
      row.holidayName || '',
      yesNo(row.isScheduledDay),
      yesNo(row.outsideSchedule),
      clock(row.isHoliday ? row.minutes : 0),
      clock(row.outsideSchedule === true ? row.minutes : 0),
      clock(row.isWeekend && row.outsideSchedule === true ? row.minutes : 0)
    ]);
  return '﻿' + lines.map((row) => row.map(escape).join(';')).join('\r\n');
}
export {
  calendarContext,
  calendarCsv,
  calendarFilters,
  calendarSummary,
  effectiveSchedule,
  enrichCalendar,
  matchesCalendarFilter,
  nationalHoliday,
  projectMonth
};
