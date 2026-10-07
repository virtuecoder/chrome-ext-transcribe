const currentEl = document.getElementById("current");
const selectEl = document.getElementById("model");
const statusEl = document.getElementById("status");

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || "";
}

function send(action, extra) {
  return chrome.runtime.sendMessage({ action, ...(extra || {}) });
}

function optionLabel(entry) {
  return entry.display && entry.display !== entry.id
    ? `${entry.display} — ${entry.id}`
    : entry.id;
}

async function load() {
  setStatus("Loading free models…");
  selectEl.replaceChildren();
  try {
    const res = await send("list_models");
    if (!res || res.status === "error") {
      throw new Error(res?.message || "unknown error");
    }
    const models = res.models || [];
    if (!models.length) {
      currentEl.textContent = res.current || "unknown";
      throw new Error("No free models reported — is Pi installed?");
    }
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = `${m.provider}/${m.id}`;
      opt.textContent = optionLabel(m);
      selectEl.appendChild(opt);
    }
    currentEl.textContent = res.current || "unknown";
    const currentId = (res.current || "").split("/").slice(1).join("/") || res.current;
    const match = models.find((m) => m.id === currentId)
      || models.find((m) => `${m.provider}/${m.id}` === res.current);
    if (match) selectEl.value = `${match.provider}/${match.id}`;
    setStatus(`${models.length} free models. Transcription falls back automatically if one is gone.`, "ok");
  } catch (e) {
    setStatus("Error: " + (e.message || e), "error");
  }
}

document.getElementById("refresh").addEventListener("click", load);

document.getElementById("save").addEventListener("click", async () => {
  const value = selectEl.value;
  if (!value) {
    setStatus("Select a model first.", "error");
    return;
  }
  setStatus("Saving…");
  try {
    const res = await send("set_model", { model: value });
    if (!res || res.status === "error") {
      throw new Error(res?.message || "unknown error");
    }
    currentEl.textContent = res.current || value;
    setStatus("Now using " + (res.current || value), "ok");
  } catch (e) {
    setStatus("Error: " + (e.message || e), "error");
  }
});

load();
