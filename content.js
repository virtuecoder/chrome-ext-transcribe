const BTN_CLASS = "jk-yt-transcribe-btn";
const STATUS_TOAST_ID = "jk-yt-transcribe-toast";
const OPERATION_TIMEOUT_MS = 30 * 60 * 1000;

function micSvg(size) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("width", String(size)); s.setAttribute("height", String(size));
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "#fff");
  s.setAttribute("stroke-width", "2");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  const d1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  d1.setAttribute("d", "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z");
  s.appendChild(d1);
  const d2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  d2.setAttribute("d", "M19 10v2a7 7 0 0 1-14 0v-2");
  s.appendChild(d2);
  const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  l1.setAttribute("x1", "12"); l1.setAttribute("y1", "19");
  l1.setAttribute("x2", "12"); l1.setAttribute("y2", "23");
  s.appendChild(l1);
  const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  l2.setAttribute("x1", "8"); l2.setAttribute("y1", "23");
  l2.setAttribute("x2", "16"); l2.setAttribute("y2", "23");
  s.appendChild(l2);
  return s;
}

function checkSvg() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("width", "24"); s.setAttribute("height", "24");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "#4caf50");
  s.setAttribute("stroke-width", "3");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  p.setAttribute("points", "20 6 9 17 4 12");
  s.appendChild(p);
  return s;
}

function getVideoUrl(el) {
  try {
    const anchor =
      el.closest("a.ytLockupViewModelContentImage") ||
      el.closest("a#thumbnail") ||
      el.closest("a[href*='watch?v=']");
    if (!anchor) return null;
    const href = anchor.getAttribute("href");
    if (!href) return null;
    const url = new URL(href, location.origin);
    const videoId = url.pathname === "/watch" && url.searchParams.get("v");
    return videoId ? "https://www.youtube.com/watch?v=" + videoId : null;
  } catch { return null; }
}

function getCurrentVideoUrl() {
  try {
    const url = new URL(location.href);
    const videoId = url.pathname === "/watch" && url.searchParams.get("v");
    return videoId ? "https://www.youtube.com/watch?v=" + videoId : null;
  } catch { return null; }
}

let toastTimer = null;

function showToast(message, isError) {
  let t = document.getElementById(STATUS_TOAST_ID);
  if (!t) {
    t = document.createElement("div");
    t.id = STATUS_TOAST_ID;
    t.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:99999;" +
      "padding:10px 18px;border-radius:8px;" +
      "font:500 14px/1.4 system-ui,sans-serif;" +
      "transition:opacity .3s;pointer-events auto;cursor:pointer";
    t.style.width = "auto";
    t.title = "Click to dismiss";
    t.style.cursor = "pointer";
    // Add copy button for error messages
    if (isError) {
      const copyBtn = document.createElement("span");
      copyBtn.style.cssText =
        "float:right;cursor:pointer;margin-left:8px;padding:2px 6px;font-size:12px;" +
        "background:rgba(255,255,255,.2);border-radius:3px;";
      copyBtn.title = "Copy error";
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(message).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
        });
      });
      copyBtn.textContent = "Copy";
      t.appendChild(copyBtn);
    }
    t.addEventListener("click", () => {
      t.style.opacity = "0";
    });
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.style.background = isError ? "rgba(200,0,0,.9)" : "rgba(0,0,0,.85)";
  t.style.color = "#fff";
  t.style.opacity = "1";
  clearTimeout(toastTimer);
  if (isError) {
    toastTimer = null;
  } else {
    toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 4000);
  }
}

function resetBtn(btn) {
  delete btn.dataset.transcribing;
  btn.style.transform = "";
  btn.style.background = "rgba(0,0,0,.3)";
  btn.setAttribute("aria-label", "Transcribe");
  btn.title = "Transcribe";
  btn.replaceChildren(micSvg(24));
}

function spinnerEl() {
  const styleId = "jk-yt-transcribe-spinner-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent =
      "@keyframes jk-yt-transcribe-spin { to { transform: rotate(360deg); } }";
    (document.head || document.documentElement).appendChild(style);
  }

  const spinner = document.createElement("span");
  spinner.style.cssText =
    "display:block;width:20px;height:20px;border:3px solid rgba(255,255,255,.35);" +
    "border-top-color:#fff;border-radius:50%;" +
    "animation:jk-yt-transcribe-spin .8s linear infinite;";
  return spinner;
}

function handleClick(btn, url) {
  if (btn.dataset.transcribing) return;
  btn.dataset.transcribing = "1";
  btn.style.transform = "scale(0.9)";
  btn.setAttribute("aria-label", "Transcribing");
  btn.title = "Transcribing";
  btn.replaceChildren(spinnerEl());

  try {
    if (!chrome.runtime?.id) {
      showToast("Extension context lost — reload the page", true);
      resetBtn(btn);
      return;
    }
  } catch {
    showToast("Extension context lost — reload the page", true);
    resetBtn(btn);
    return;
  }

  const timeout = setTimeout(() => {
    resetBtn(btn);
    showToast("Operation timed out after 30 minutes", true);
  }, OPERATION_TIMEOUT_MS);

  try {
    chrome.runtime.sendMessage(
      { action: "transcribe", url },
      (response) => {
        clearTimeout(timeout);
        resetBtn(btn);

        if (chrome.runtime.lastError || response?.status === "error") {
          showToast("Error: " + (response?.message || chrome.runtime.lastError?.message || "unknown"), true);
        } else {
          btn.replaceChildren(checkSvg());
          btn.style.background = "rgba(76,175,80,.9)";
          const modelName = response?.model_display || response?.model;
          const modelSuffix = modelName ? " · " + modelName : "";
          let msg = "Transcription done ✓";
          if (response?.summary_path) {
            msg = "Transcription + summary ✓" + modelSuffix;
            if (response?.model_fallback && response?.requested_model) {
              msg += " (requested " + response.requested_model + " unavailable)";
            }
            if (response?.html_error) {
              msg += " · HTML preview failed: " + response.html_error;
            }
          } else if (response?.summary_error) {
            msg = "Transcription ✓ · summary failed: " + response.summary_error;
          }
          showToast(msg, Boolean(response?.summary_error || response?.html_error));
          setTimeout(() => {
            resetBtn(btn);
          }, 2000);
        }
      },
    );
  } catch (e) {
    clearTimeout(timeout);
    resetBtn(btn);
    showToast("Extension error: " + (e.message || "context invalidated") + " — reload the page", true);
  }
}

function makeBtn(url) {
  const btn = document.createElement("button");
  btn.className = BTN_CLASS;
  btn.dataset.url = url;
  btn.setAttribute("aria-label", "Transcribe");
  btn.title = "Transcribe";
  btn.style.cssText =
    "all:unset;cursor:pointer;display:flex;" +
    "align-items:center;justify-content:center;" +
    "width:32px;height:32px;border-radius:50%;" +
    "background:rgba(0,0,0,.3);" +
    "transition:transform .2s,background .3s;";

  btn.appendChild(micSvg(24));

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleClick(btn, url);
  });
  return btn;
}

function showOnHover(btn, container) {
  btn.style.opacity = "0";
  btn.style.pointerEvents = "none";
  btn.style.transition = "opacity .15s,transform .2s,background .3s";

  const setVisible = (visible) => {
    btn.style.opacity = visible ? "1" : "0";
    btn.style.pointerEvents = visible ? "auto" : "none";
  };
  container.addEventListener("mouseenter", () => setVisible(true));
  container.addEventListener("mouseleave", () => setVisible(false));
}

function addToNewUi(overlay) {
  if (overlay.querySelector("." + BTN_CLASS)) return;
  const url = getVideoUrl(overlay);
  if (!url) return;

  overlay.closest("yt-lockup-view-model")
    ?.querySelector("[data-lockup-thumbnail='1']")
    ?.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "ytThumbnailHoverOverlayToggleActionsViewModelButton";
  const btn = makeBtn(url);
  wrapper.appendChild(btn);
  overlay.appendChild(wrapper);
}

function addToLockup(lockup) {
  const thumbnail = lockup.querySelector(
    "a.ytLockupViewModelContentImage, a[href*='watch?v=']",
  );
  if (!thumbnail) return;

  const overlay = lockup.querySelector(
    "yt-thumbnail-hover-overlay-toggle-actions-view-model",
  );
  const existing = thumbnail.querySelector("[data-lockup-thumbnail='1']");
  if (overlay) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const url = getVideoUrl(thumbnail);
  if (!url) return;

  const btn = makeBtn(url);
  btn.dataset.lockupThumbnail = "1";
  btn.style.position = "absolute";
  btn.style.top = "8px";
  btn.style.right = "8px";
  btn.style.zIndex = "10";
  thumbnail.style.position = "relative";
  thumbnail.appendChild(btn);
  showOnHover(btn, thumbnail);
}

function addToOldUi(overlaysEl) {
  if (overlaysEl.querySelector("." + BTN_CLASS)) return;
  const url = getVideoUrl(overlaysEl);
  if (!url) return;

  const btn = makeBtn(url);
  btn.style.position = "absolute";
  btn.style.bottom = "4px";
  btn.style.right = "4px";
  btn.style.zIndex = "10";
  overlaysEl.style.position = "relative";
  overlaysEl.appendChild(btn);

  const thumb = overlaysEl.closest("ytd-thumbnail");
  if (thumb) showOnHover(btn, thumb);
}

function addToWatchPlayer(player) {
  const url = getCurrentVideoUrl();
  if (!url) return;

  const existing = player.querySelector("[data-watch-player='1']");
  if (existing?.dataset.url === url) return;
  existing?.remove();

  const btn = makeBtn(url);
  btn.dataset.watchPlayer = "1";
  btn.style.position = "absolute";
  btn.style.top = "16px";
  btn.style.right = "16px";
  btn.style.zIndex = "1000";
  player.style.position = "relative";
  player.appendChild(btn);
  showOnHover(btn, player);
}

function scan() {
  document.querySelectorAll("yt-lockup-view-model").forEach(addToLockup);
  document.querySelectorAll("yt-thumbnail-hover-overlay-toggle-actions-view-model").forEach(addToNewUi);
  document.querySelectorAll("#overlays").forEach(addToOldUi);
  document.querySelectorAll("#movie_player").forEach(addToWatchPlayer);
}

const obs = new MutationObserver(() => scan());
obs.observe(document.body, { childList: true, subtree: true });
scan();
