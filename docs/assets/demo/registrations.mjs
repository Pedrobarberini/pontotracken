function createRegistrationsDemo({ peopleDemo, listUsers, getActor, onAudit = () => {
}, clock = () => new Date() }) {
  const rows = new Map(), mutations = new Map();
  const now = () => new Date(clock()).toISOString();
  const fail = (message, status = 400) => {
    throw Object.assign(new Error(message), { status });
  };
  const text = (value, min, max) => {
    if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) fail("Confira os campos do pré-cadastro.");
    return value.trim();
  };
  return async function registrationsDemo(action, { data = {}, query = "" } = {}) {
    if (!["admin-registrations", "admin-registration-save", "admin-registration-link", "admin-registration-archive"].includes(action)) return null;
    const actor = getActor();
    if (actor.role !== "admin") fail("Acesso restrito ao ADMIN.", 403);
    if (action === "admin-registrations") {
      const params = new URLSearchParams(query.replace(/^&/, "")), status = params.get("status") || "open", q = (params.get("q") || "").toLowerCase(), offset = Number(params.get("offset") || 0);
      if (!["open", "linked", "archived"].includes(status) || !Number.isInteger(offset) || offset < 0 || offset % 50) fail("Filtro inválido.");
      const matches = [...rows.values()].filter((row) => row.status === status && `${row.name} ${row.email}`.toLowerCase().includes(q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return { rows: structuredClone(matches.slice(offset, offset + 50)), nextOffset: matches.length > offset + 50 ? offset + 50 : null };
    }
    if (typeof data.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(data.requestId)) fail("Identificador de envio inválido.");
    const key = `${actor.uid}:${action}:${data.requestId}`, signature = JSON.stringify(Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b))));
    if (mutations.has(key)) {
      const saved = mutations.get(key);
      if (saved.signature !== signature) fail("Envio já usado com outros dados.", 409);
      return structuredClone(saved.result);
    }
    text(data.reason, 10, 1e3);
    let record = data.id ? rows.get(data.id) : null;
    const before = structuredClone(record);
    if (data.id && !record) fail("Pré-cadastro não encontrado.", 404);
    if (record && (record.status !== "open" || record.version !== data.version)) fail("Pré-cadastro atualizado ou já concluído. Recarregue a lista.", 409);
    if (action === "admin-registration-save") {
      if (!record && data.version !== 0) fail("Versão inválida.", 409);
      const name = text(data.name, 2, 180), email = text(data.email, 3, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Informe um e-mail válido.");
      if ([...rows.values()].some((row) => row.id !== record?.id && row.status === "open" && row.email === email)) fail("Já existe pré-cadastro aberto para este e-mail.", 409);
      record = { ...record || { id: crypto.randomUUID(), status: "open", linkedUid: null, createdAt: now() }, name, email, employeeNumber: text(data.employeeNumber || "", 0, 40), jobTitle: text(data.jobTitle || "", 0, 120), department: text(data.department || "", 0, 120), version: data.version + 1, updatedAt: now() };
    } else {
      if (!record) fail("Informe o pré-cadastro.");
      if (action === "admin-registration-link") {
        const matches = listUsers().filter((user) => user.email.toLowerCase().trim() === record.email);
        if (matches.length !== 1 || matches[0].uid !== data.uid || !["pending", "active"].includes(matches[0].status) || matches[0].accessRevoked) fail("Login único com o mesmo e-mail não encontrado.", 409);
        if ([...rows.values()].some((row) => row.status === "linked" && row.linkedUid === data.uid)) fail("Este login já possui pré-cadastro vinculado.", 409);
        const { profile } = await peopleDemo.request("people-profile", { query: `&uid=${encodeURIComponent(data.uid)}` });
        if (profile.version !== data.profileVersion) fail("A ficha foi atualizada. Reabra o vínculo.", 409);
        const updates = Object.fromEntries(["employeeNumber", "jobTitle", "department"].filter((field) => !profile[field] && record[field]).map((field) => [field, record[field]]));
        await peopleDemo.request("people-profile-save", { data: { uid: data.uid, version: profile.version, reason: data.reason, ...updates } });
        record = { ...record, status: "linked", linkedUid: data.uid, version: record.version + 1, updatedAt: now() };
      } else record = { ...record, status: "archived", version: record.version + 1, updatedAt: now() };
    }
    rows.set(record.id, record);
    const target = record.linkedUid ? listUsers().find((user) => user.uid === record.linkedUid) : actor;
    onAudit({ id: crypto.randomUUID(), action: { "admin-registration-save": "registration:save", "admin-registration-archive": "registration:archive", "admin-registration-link": "registration:link" }[action], actor_uid: actor.uid, actor_name: actor.name, actor_email: actor.email, target_uid: target.uid, target_name: target.name, target_email: target.email, reason: data.reason, before, after: structuredClone(record), created_at: now() });
    const result = { record: structuredClone(record) };
    mutations.set(key, { signature, result: structuredClone(result) });
    return result;
  };
}
export {
  createRegistrationsDemo
};
