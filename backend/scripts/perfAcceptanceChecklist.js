/**
 * Lightweight acceptance helper for public-event performance gates.
 * Run against a deployed or local base URL:
 *   node scripts/perfAcceptanceChecklist.js https://momoevent.up.railway.app <eventId>
 */
const baseUrl = String(process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const eventId = String(process.argv[3] || "").trim();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

async function main() {
  if (!eventId) {
    fail("Usage: node scripts/perfAcceptanceChecklist.js <baseUrl> <eventId>");
    return;
  }

  const healthRes = await fetch(`${baseUrl}/api/health`);
  const health = await healthRes.json();
  if (!healthRes.ok || !health.ok) fail(`healthcheck not ready (${healthRes.status})`);
  else ok(`healthcheck ready (mongo readyState=${health.mongo?.readyState})`);

  const started = Date.now();
  const eventRes = await fetch(`${baseUrl}/api/public/event/${eventId}`);
  const totalMs = Date.now() - started;
  const raw = await eventRes.text();
  const bytes = Buffer.byteLength(raw);
  const cacheControl = eventRes.headers.get("cache-control") || "";
  const serverTiming = eventRes.headers.get("server-timing") || "";

  if (!eventRes.ok) {
    fail(`public event status ${eventRes.status}`);
    return;
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    fail("public event response is not JSON");
    return;
  }

  if (bytes > 20 * 1024) fail(`metadata bytes ${bytes} exceed 20KB target`);
  else ok(`metadata bytes ${bytes} (<= 20KB)`);

  if (String(json?.event?.imageDataUrl || "").startsWith("data:image/")) {
    fail("public JSON still embeds base64 imageDataUrl");
  } else {
    ok("no base64 cover in public JSON");
  }

  if (!cacheControl.includes("max-age=")) fail(`missing short cache policy: ${cacheControl}`);
  else ok(`cache-control: ${cacheControl}`);

  if (!serverTiming) fail("missing Server-Timing header");
  else ok(`server-timing: ${serverTiming}`);

  ok(`warm fetch total ${totalMs}ms (target warm TTFB < 500ms; measure via HAR/Network)`);

  const coverUrl = json?.event?.cover?.url || json?.event?.cover?.variants?.["480"];
  if (coverUrl) {
    const coverStarted = Date.now();
    const coverRes = await fetch(coverUrl);
    const coverBuf = Buffer.from(await coverRes.arrayBuffer());
    const coverMs = Date.now() - coverStarted;
    if (!coverRes.ok) fail(`cover URL status ${coverRes.status}`);
    else if (coverBuf.length > 300 * 1024) fail(`cover bytes ${coverBuf.length} exceed 300KB`);
    else ok(`cover bytes ${coverBuf.length} in ${coverMs}ms`);
  } else {
    ok("event has no cover URL (acceptable for no-cover cases)");
  }

  console.log(
    JSON.stringify(
      {
        type: "acceptance_summary",
        baseUrl,
        eventId,
        bytes,
        totalMs,
        cacheControl,
        serverTiming,
        hasCover: Boolean(coverUrl)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  fail(error.message);
});
