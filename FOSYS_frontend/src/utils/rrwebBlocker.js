let rrwebDisabled = false;

export function disableRRWeb() {
  if (rrwebDisabled) return;
  rrwebDisabled = true;

  // If rrweb already injected, kill its fetch override
  if (window.record) window.record = () => {};

  // Restore original fetch if rrweb replaced it
  if (window.__RRWEB_FETCH_WRAPPED__) {
    window.fetch = window.__RRWEB_FETCH_ORIGINAL__;
  }

  console.warn("%cRRWeb disabled for Auth pages", "color: orange; font-weight: bold;");
}
