// Құрылғы симуляторы: ESP32 термометрі жасайтын сұранысты жібереді (темірсіз тексеру үшін).
// Симулятор устройства: отправляет тот же запрос, что и ESP32 (проверка без железа).
//
//   node --env-file=.env scripts/device-sim.mjs 78.4                   # один замер (ключ из DEMO_DEVICE_KEY)
//   node --env-file=.env scripts/device-sim.mjs --state                # что ждёт приложение (GET)
//   BASE_URL=https://ваш-сайт.vercel.app node --env-file=.env scripts/device-sim.mjs 78.4
//   DEVICE_KEY=adk_... node scripts/device-sim.mjs --fridge 5.2 7.4 9.1 11.3   # серия для датчика холодильника
//
// Ключ никогда не печатается.

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const key = process.env.DEVICE_KEY || process.env.DEMO_DEVICE_KEY;
if (!key) {
  console.error("Нет ключа: задайте DEVICE_KEY или DEMO_DEVICE_KEY (.env)");
  process.exit(1);
}

const args = process.argv.slice(2);
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const url = `${base}/api/device/readings`;

async function send(value) {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ value }) });
  console.log(`POST ${value} °C → ${res.status}`, await res.text());
}

if (args[0] === "--state") {
  const res = await fetch(url, { headers });
  console.log(`GET → ${res.status}`, await res.text());
} else if (args[0] === "--fridge") {
  for (const value of args.slice(1).map(Number)) {
    await send(value);
    await new Promise((r) => setTimeout(r, 2000));
  }
} else {
  const value = Number(args[0]);
  if (!Number.isFinite(value)) {
    console.error("Укажите температуру, например: 78.4");
    process.exit(1);
  }
  await send(value);
}
