let port = null;
let model = "Muse Spark 1.3 Free";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // One-shot native-host queries (model list / get / set) for the popup.
  if (
    msg.action === "list_models" ||
    msg.action === "get_model" ||
    msg.action === "set_model"
  ) {
    chrome.runtime.sendNativeMessage(
      "com.jk.just_transcribe",
      msg,
      (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            status: "error",
            message: chrome.runtime.lastError.message,
          });
        } else {
          sendResponse(response);
        }
      },
    );
    return true;
  }

  if (msg.action === "transcribe") {
    if (port) {
      sendResponse({ status: "error", message: "Already transcribing" });
      return;
    }

    port = chrome.runtime.connectNative("com.jk.just_transcribe");
    let responded = false;

    port.onMessage.addListener((response) => {
      if (!responded) {
        responded = true;
        sendResponse(response);
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      if (chrome.runtime.lastError) {
        if (!responded) {
          responded = true;
          sendResponse({
            status: "error",
            message: chrome.runtime.lastError.message,
          });
        }
      }
    });

    port.postMessage({ url: msg.url, model: model });

    return true; // keep sendResponse channel open
  }
});
