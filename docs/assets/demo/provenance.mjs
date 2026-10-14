const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
function createProvenanceDemo({ clock = () => /* @__PURE__ */ new Date() } = {}) {
  const events = [];
  const audits = [];
  const snapshots = /* @__PURE__ */ new Set();
  const requests = /* @__PURE__ */ new Set();
  let baseline = /* @__PURE__ */ new Map();
  const now = () => new Date(clock()).toISOString();
  const push = (kind, uid, date, payload, id = crypto.randomUUID()) => events.push({ kind, id, uid, date, createdAt: now(), payload: structuredClone(payload) });
  function ensureBaseline(uid, date) {
    const key = uid + ":" + date;
    const row = baseline.get(date);
    if (row && !snapshots.has(key)) {
      snapshots.add(key);
      push("historical_snapshot", uid, date, { source: "legacy_observed_state", state: row, observedAt: now() });
    }
  }
  function simulate(action, { query = "", dateNow = () => now().slice(0, 10), users = [], actorUid = "presentation" } = {}) {
    if (!["admin-record-provenance", "record-provenance"].includes(action)) return null;
    const actor = users.find((user2) => user2.uid === actorUid);
    if (!actor || actor.status !== "active") fail("Conta demonstrativa indisponível.", 403);
    if (action.startsWith("admin-") && actor.role !== "admin") fail("Acesso restrito ao administrador.", 403);
    const params = new URLSearchParams(query.replace(/^&/, ""));
    const uid = params.get("uid") || actorUid;
    if (uid.length > 128) fail("Funcionário inválido.");
    if (action === "record-provenance" && uid !== actorUid) fail("Você só pode consultar os próprios registros.", 403);
    const user = users.find((person) => person.uid === uid);
    if (!user) fail("Funcionário não encontrado.", 404);
    const date = params.get("date") || "";
    const month = params.get("month") || dateNow().slice(0, 7);
    const offset = Number(params.get("offset") || 0);
    if (date && (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + "T12:00:00Z")) || (/* @__PURE__ */ new Date(date + "T12:00:00Z")).toISOString().slice(0, 10) !== date)) fail("Data inválida.");
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1e4) fail("Filtro inválido.");
    if (date) ensureBaseline(uid, date);
    else for (const day of baseline.keys()) if (day.startsWith(month + "-")) ensureBaseline(uid, day);
    const selected = events.filter((event) => event.uid === uid && (date ? event.date === date : event.date.startsWith(month + "-"))).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return structuredClone({ user: { uid: user.uid, name: user.name, email: user.email }, events: selected.slice(offset, offset + 50).map(({ uid: uid2, ...event }) => event), nextOffset: selected.length > offset + 50 ? offset + 50 : null });
  }
  simulate.seed = (days) => {
    if (!baseline.size) baseline = new Map([...days].map(([date, row]) => [date, structuredClone(row)]));
  };
  simulate.observePunch = async ({ uid = "presentation", record, type, requestId }) => {
    const key = uid + ":" + requestId;
    if (requests.has(key)) return;
    requests.add(key);
    ensureBaseline(uid, record.date);
    const time = record.times.at(-1);
    push("original_event", uid, record.date, { time, occurredAt: (/* @__PURE__ */ new Date(record.date + "T" + time + "-03:00")).toISOString(), collector: "web", markType: type, requestId });
  };
  simulate.observeImport = ({ uid = "presentation", rows, filename }) => {
    for (const row of rows) {
      const key = uid + ":" + row.date;
      if (snapshots.has(key)) continue;
      snapshots.add(key);
      push("historical_snapshot", uid, row.date, { source: "import_baseline", state: row, filename, observedAt: now() });
    }
  };
  simulate.observeCorrection = ({ uid, date, before, after, reason, actorUid = "presentation", users = [] }) => {
    ensureBaseline(uid, date);
    const actor = users.find((user) => user.uid === actorUid);
    const target = users.find((user) => user.uid === uid);
    if (!actor || !target) return;
    push("treatment", uid, date, { actorUid, reason, before, after, changedAt: now() });
    audits.unshift({ id: crypto.randomUUID(), action: "record:correct", actor_name: actor.name, actor_email: actor.email, target_name: target.name, target_email: target.email, date, reason, before: structuredClone(before), after: structuredClone(after), created_at: now() });
  };
  simulate.audit = () => structuredClone(audits);
  return simulate;
}
const provenanceDemo = createProvenanceDemo();
export {
  createProvenanceDemo,
  provenanceDemo
};
