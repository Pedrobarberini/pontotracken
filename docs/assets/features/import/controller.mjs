import { $, escapeHTML as esc } from "../../shared/dom.mjs?v=phases34-1";
function createSpreadsheetImport({ state, api, busy, toast, download, recordsTable, loadHome, switchView }) {
  $("#template").onclick = () => download("api?action=template");
  function invalidatePreview() {
    state.preview = null;
    $("#preview-panel").hidden = true;
  }
  function setFile(file) {
    invalidatePreview();
    state.file = null;
    if (!file) {
      $("#file-label").textContent = "Clique para selecionar sua planilha";
      $("#preview-button").disabled = true;
      return;
    }
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast("Selecione um arquivo XLSX, XLS ou CSV.", true);
      $("#preview-button").disabled = true;
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("O arquivo deve ter no máximo 5 MB.", true);
      $("#preview-button").disabled = true;
      return;
    }
    state.file = file;
    $("#file-label").textContent = file.name;
    $("#preview-button").disabled = false;
  }
  $("#file-input").onchange = () => setFile($("#file-input").files[0]);
  $("#import-year").oninput = invalidatePreview;
  $("#dropzone").ondragover = (event) => {
    event.preventDefault();
    $("#dropzone").classList.add("dragover");
  };
  $("#dropzone").ondragleave = () => $("#dropzone").classList.remove("dragover");
  $("#dropzone").ondrop = (event) => {
    event.preventDefault();
    $("#dropzone").classList.remove("dragover");
    setFile(event.dataTransfer.files[0]);
  };
  $("#import-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!state.file) return;
    invalidatePreview();
    try {
      await busy($("#preview-button"), async () => {
        const data = new FormData();
        data.append("file", state.file);
        data.append("year", $("#import-year").value);
        const result = await api("import-preview", { method: "POST", data });
        state.preview = result;
        const existing = result.rows.filter((r) => r.exists).length;
        const newRows = result.rows.length - existing;
        $("#preview-summary").textContent = `${newRows} novos registros · ${existing} existentes serão preservados · ${result.filename}`;
        $("#preview-table").innerHTML = recordsTable(result.rows, { preview: true });
        $("#commit-button").disabled = newRows === 0;
        $("#import-warnings").hidden = !result.warnings.length;
        $("#import-warnings").innerHTML = result.warnings.length ? `<details open><summary>${result.warnings.length} ${result.warnings.length === 1 ? "célula não será importada" : "células não serão importadas"}. Confira os avisos.</summary><ul>${result.warnings.map((w) => `<li><strong>${esc(w.cell)}</strong> (${esc(w.value)}): ${esc(w.message)}</li>`).join("")}</ul></details>` : "";
        $("#preview-panel").hidden = false;
        $("#preview-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      }, "Lendo planilha…");
    } catch (error) {
      toast(error.message, true);
    }
  };
  $("#commit-button").onclick = async () => {
    if (!state.preview) return;
    try {
      await busy($("#commit-button"), async () => {
        const newRows = state.preview.rows.filter((row) => !row.exists);
        const focusRow = newRows.filter((row) => row.times.length).at(-1) || newRows.at(-1);
        const result = await api("import-commit", { method: "POST", data: { id: state.preview.id } });
        if (focusRow) {
          state.month = focusRow.date.slice(0, 7);
          $("#history-month").value = state.month;
        }
        invalidatePreview();
        toast(`${result.saved} registros importados. ${result.skipped} existentes preservados.`);
        await loadHome();
        switchView("espelho");
      }, "Salvando…");
    } catch (error) {
      toast(error.message, true);
    }
  };
  return { invalidatePreview };
}
export {
  createSpreadsheetImport
};
