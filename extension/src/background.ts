import browser, { WebRequest } from "webextension-polyfill";
import { DRP_REFRESH_ALARM, DRP_REFRESH_PERIOD_MINUTES } from "./constants";
import { refreshDrpCache } from "./drpClient";
import { getRescue } from "./resolver";
import { buildFallbackMessage, showFallbackOverlay } from "./overlay";

/** Mirrors the error-response branch of Fallback.response. webRequest.onCompleted is non-blocking, so this can't rewrite the body directly. */
async function handleMainFrameResponse(
  details: WebRequest.OnCompletedDetailsType,
): Promise<void> {
  if (details.tabId < 0) return;

  const statusCode = details.statusCode;
  if (statusCode !== 404 && statusCode < 500) return;

  const rescue = await getRescue(details.url);
  const message = buildFallbackMessage(statusCode, rescue);
  await browser.scripting.executeScript({
    target: { tabId: details.tabId },
    func: showFallbackOverlay,
    args: [message],
  });
}

browser.webRequest.onCompleted.addListener(
  (details) => {
    void handleMainFrameResponse(details);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
);

browser.runtime.onInstalled.addListener(() => {
  void refreshDrpCache();
  browser.alarms.create(DRP_REFRESH_ALARM, {
    periodInMinutes: DRP_REFRESH_PERIOD_MINUTES,
  });
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DRP_REFRESH_ALARM) {
    void refreshDrpCache();
  }
});
