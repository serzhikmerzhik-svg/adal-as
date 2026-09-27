/*
 * Adal As — тағам термометрі / термометр для блюд (ESP32 + DS18B20)
 *
 * Как работает:
 *   1. Повар в приложении (/kitchen) нажимает «Термометрмен өлшеу» у блюда.
 *   2. Устройство каждые 2 с спрашивает сервер (GET) и, увидев «ожидание замера», мигает светодиодом.
 *   3. Повар опускает датчик в блюдо и нажимает кнопку BOOT на плате.
 *   4. Устройство отправляет температуру (POST) — сервер записывает её в журнал этого блюда,
 *      сверяет с нормой (суп ≥75 °C, второе ≥65 °C) и отвечает: OK / VIOLATION / SAVED.
 *   5. Светодиод: горит 2 с — норма, частое мигание — нарушение, 2 медленных — сохранено без блюда.
 *
 * Режим холодильника (FRIDGE_MODE = true): устройство само отправляет показания каждые 5 минут;
 * если 3 показания подряд выше 6 °C, СЭС и столовая сразу получают красную тревогу.
 *
 * Библиотеки (Arduino IDE → Library Manager): «OneWire» (Paul Stoffregen), «DallasTemperature» (Miles Burton).
 * Плата: «ESP32 Dev Module» (пакет esp32 от Espressif).
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ---------- Настройки ----------
const char* WIFI_SSID = "ИМЯ_СЕТИ";        // на защите можно раздать Wi‑Fi с телефона
const char* WIFI_PASS = "ПАРОЛЬ_СЕТИ";
const char* API_URL = "https://ВАШ-САЙТ.vercel.app/api/device/readings";
const char* DEVICE_KEY = "adk_...";         // ключ устройства: .env → DEMO_DEVICE_KEY или /kitchen → «Құрылғылар» → «Кілт алу»

const int SENSOR_PIN = 4;   // DS18B20: DATA (жёлтый) → GPIO4, резистор 4,7 кОм между DATA и 3V3
const int BUTTON_PIN = 0;   // кнопка BOOT на плате ESP32
const int LED_PIN = 2;      // встроенный светодиод (на большинстве плат GPIO2)

const bool FRIDGE_MODE = false;                         // true — датчик холодильника
const unsigned long FRIDGE_PERIOD_MS = 5UL * 60UL * 1000UL;  // раз в 5 минут
// --------------------------------

OneWire oneWire(SENSOR_PIN);
DallasTemperature sensors(&oneWire);

float readTemperature() {
  sensors.requestTemperatures();
  return sensors.getTempCByIndex(0);  // -127 означает, что датчик не подключён
}

// HTTPS без проверки сертификата — допустимо для демо; в продакшене добавляется корневой сертификат.
int request(const char* method, const String& payload, String& response) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, API_URL);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_KEY);
  http.addHeader("Content-Type", "application/json");
  int code = strcmp(method, "POST") == 0 ? http.POST(payload) : http.GET();
  response = http.getString();
  http.end();
  return code;
}

String jsonValue(const String& body, const char* key) {
  String needle = String("\"") + key + "\":\"";
  int i = body.indexOf(needle);
  if (i < 0) return "";
  i += needle.length();
  return body.substring(i, body.indexOf('"', i));
}

void blink(int times, int ms) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(ms);
    digitalWrite(LED_PIN, LOW);
    delay(ms);
  }
}

void sendReading(float celsius) {
  String response;
  int code = request("POST", String("{\"value\":") + String(celsius, 1) + "}", response);
  String status = jsonValue(response, "status");
  Serial.printf("POST %.1f °C -> %d %s\n", celsius, code, response.c_str());
  if (code == 200 && status == "OK") {
    digitalWrite(LED_PIN, HIGH);
    delay(2000);
    digitalWrite(LED_PIN, LOW);
  } else if (status == "VIOLATION") {
    blink(10, 100);
  } else {
    blink(2, 400);  // SAVED (блюдо не выбрано) или ошибка сети/ключа
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  sensors.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());
}

unsigned long lastPoll = 0;
unsigned long lastFridge = 0;
bool armed = false;

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
    return;
  }

  if (FRIDGE_MODE) {
    if (lastFridge == 0 || millis() - lastFridge > FRIDGE_PERIOD_MS) {
      float c = readTemperature();
      if (c > -100) sendReading(c);
      lastFridge = millis();
    }
    delay(1000);
    return;
  }

  // Термометр для блюд: раз в 2 с узнаём, ждёт ли приложение замера (повар нажал «Өлшеу»).
  if (millis() - lastPoll > 2000) {
    String response;
    int code = request("GET", "", response);
    armed = code == 200 && response.indexOf("\"armed\":{") >= 0;
    Serial.printf("%.1f °C · %s\n", readTemperature(), armed ? "ждёт замера" : "ожидание");
    lastPoll = millis();
  }
  digitalWrite(LED_PIN, armed && (millis() / 250) % 2 ? HIGH : LOW);

  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(50);  // защита от дребезга
    if (digitalRead(BUTTON_PIN) == LOW) {
      float c = readTemperature();
      if (c < -100) {
        Serial.println("Датчик не найден: проверьте провод DATA и резистор 4,7 кОм");
        blink(5, 80);
      } else {
        sendReading(c);
      }
      while (digitalRead(BUTTON_PIN) == LOW) delay(10);
    }
  }
  delay(10);
}
