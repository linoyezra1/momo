import { normalizeUsPhone, buildUsWhatsAppSendUrl } from "../src/utils/usWhatsApp.js";

const cases = [
  { input: "+1 (555) 123-4567", expected: "15551234567" },
  { input: "15551234567", expected: "15551234567" },
  { input: "5551234567", expected: "15551234567" },
  { input: "+972-53-531-4055", expected: "972535314055" },
  { input: "9720535314055", expected: "972535314055" },
  { input: "0535314055", expected: "972535314055" },
  { input: "535314055", expected: "972535314055" },
  { input: "10535314055", expected: "972535314055" },
  { input: "+10535314055", expected: "972535314055" },
  { input: "972535314055", expected: "972535314055" }
];

let failed = 0;

for (const { input, expected } of cases) {
  const actual = normalizeUsPhone(input);
  if (actual !== expected) {
    failed += 1;
    console.error(`FAIL: "${input}" -> "${actual}" (expected "${expected}")`);
  } else {
    console.log(`OK: "${input}" -> "${actual}"`);
  }
}

const sampleUrl = buildUsWhatsAppSendUrl({
  phone: "+1 (555) 123-4567",
  guestName: "Sarah",
  event: { hostNames: "Bella & Mark" },
  slug: "demo",
  origin: "https://momoevents.up.railway.app"
});

if (!sampleUrl.startsWith("https://wa.me/15551234567?text=")) {
  failed += 1;
  console.error(`FAIL: URL format -> ${sampleUrl}`);
} else {
  console.log("OK: wa.me URL format");
}

if (failed > 0) {
  process.exit(1);
}

console.log(`\nAll ${cases.length + 1} checks passed.`);
