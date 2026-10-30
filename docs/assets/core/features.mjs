export const ATTENDANCE_VIEWS = Object.freeze(["registro", "espelho", "importar", "jornada"]);

const attendanceActions = new Set([
  "records", "export", "template", "punch", "record-provenance", "admin-record-provenance",
  "import-preview", "import-commit", "journey", "presence", "overtime-register", "overtime-start",
  "overtime-stop", "overtime-assign", "admin-team", "admin-schedule", "admin-overtime",
  "admin-overtime-review", "admin-records", "admin-correct", "admin-account-transfer-preview",
  "admin-account-transfer", "admin-registry", "admin-registry-save"
]);

// The individual server capability is authoritative; demo personas never enable attendance.
export function attendanceEnabled(state) {
  return Boolean(state?.session?.user && state?.demo !== true &&
    state.session.user.demo !== true && state.session.features?.attendance === true);
}

export const isAttendanceAction = action => attendanceActions.has(action);
export const defaultView = state => state?.peopleContext?.canManagePeople ? "gestao" : "ficha";
