const SAMPLE_RATE = 0.25;

function shouldSample() {
  if (typeof Math === "undefined") return false;
  return Math.random() < SAMPLE_RATE;
}

function safeRound(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

export function reportPublicPerf(metric, payload = {}) {
  if (!shouldSample()) return;
  try {
    const body = JSON.stringify({
      type: "public_perf",
      metric,
      ts: new Date().toISOString(),
      path: typeof window !== "undefined" ? window.location.pathname : "",
      ...payload
    });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/public/perf", blob);
      return;
    }
    fetch("/api/public/perf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    /* ignore telemetry failures */
  }
}

export function observePublicWebVitals({ eventId } = {}) {
  if (typeof PerformanceObserver === "undefined") return () => {};

  const observers = [];

  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          reportPublicPerf("fcp", { eventId, valueMs: safeRound(entry.startTime) });
        }
      }
    });
    paintObserver.observe({ type: "paint", buffered: true });
    observers.push(paintObserver);
  } catch {
    /* unsupported */
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (!last) return;
      reportPublicPerf("lcp", {
        eventId,
        valueMs: safeRound(last.startTime),
        size: safeRound(last.size)
      });
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    observers.push(lcpObserver);
  } catch {
    /* unsupported */
  }

  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) {
      reportPublicPerf("navigation", {
        eventId,
        ttfbMs: safeRound(nav.responseStart),
        domContentLoadedMs: safeRound(nav.domContentLoadedEventEnd),
        loadEventMs: safeRound(nav.loadEventEnd)
      });
    }
  } catch {
    /* ignore */
  }

  return () => {
    observers.forEach((observer) => {
      try {
        observer.disconnect();
      } catch {
        /* ignore */
      }
    });
  };
}
