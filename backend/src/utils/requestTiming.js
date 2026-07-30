export function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

export function setServerTiming(res, parts = {}) {
  const tokens = Object.entries(parts)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .map(([name, value]) => `${name};dur=${Math.max(0, Math.round(Number(value)))}`);
  if (!tokens.length) return;
  res.setHeader("Server-Timing", tokens.join(", "));
}

export function logPerf(event, payload = {}) {
  console.log(
    JSON.stringify({
      type: "perf",
      event,
      ts: new Date().toISOString(),
      ...payload
    })
  );
}
