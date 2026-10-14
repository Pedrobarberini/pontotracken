const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#${escapeHTML(name)}"/></svg>`;
async function busy(button, work, label = "Aguarde…") {
  const previous = button.innerHTML;
  button.disabled = true;
  button.textContent = label;
  try {
    return await work();
  } finally {
    button.innerHTML = previous;
    button.disabled = false;
  }
}
function createNotifications() {
  let timer;
  function toast(message, error = false) {
    clearTimeout(timer);
    const element = $("#toast");
    element.textContent = message;
    element.classList.toggle("error", error);
    element.hidden = false;
    timer = setTimeout(() => {
      element.hidden = true;
    }, error ? 9e3 : 6e3);
  }
  function showDataError(message) {
    $("#data-error span").textContent = message;
    $("#data-error").hidden = false;
  }
  return { toast, showDataError };
}
export {
  $,
  $$,
  busy,
  createNotifications,
  escapeHTML,
  icon
};
