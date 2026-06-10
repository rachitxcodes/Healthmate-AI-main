/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         HealthMate AI — ESP32 Firmware  (Final)             ║
 * ║  Sensors : MAX30102 | DS18B20 | MPU6050                     ║
 * ║  Display : SSD1306 OLED 128×64                              ║
 * ║  Network : WiFi → HTTP POST every 5s                        ║
 * ║  Power   : 5V adapter (not PC USB — avoids reset loop)      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

#include <Arduino.h>
#include <Wire.h>

// ── Kill brownout & watchdog resets ──────────────────────────────────────────
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_task_wdt.h"
#include "esp_log.h"

// ── Sensors ──────────────────────────────────────────────────────────────────
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <OneWire.h>
#include <DallasTemperature.h>

// ── Display ──────────────────────────────────────────────────────────────────
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ── Network ──────────────────────────────────────────────────────────────────
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ═══════════════════════════════════════════════════════════════════════════
//  ⚙️  USER CONFIG
//  OPTION A (Recommended): Phone hotspot — no captive portal, always works
//  OPTION B: GLA WiFi — connects but captive portal may block internet POSTs
//            (local IP 172.16.x.x backend may still work on same subnet)
// ═══════════════════════════════════════════════════════════════════════════

// ── Option A: Your phone hotspot ─────────────────────────────────────────────
#define WIFI_SSID      "Realme_5_pro"   // your phone hotspot name
#define WIFI_PASSWORD  "12341234"    // your phone hotspot password

// ── Option B: GLA campus WiFi (uncomment + comment out Option A) ─────────────
// #define WIFI_SSID      "GLA"
// #define WIFI_PASSWORD  "GLACAMPUS"

// Backend: your PC's LOCAL IP on whichever network you choose above
// Run: ipconfig → look for the adapter matching your chosen network
// Phone hotspot → "Wireless LAN adapter Local Area Connection*"
// GLA WiFi      → "Wireless LAN adapter Wi-Fi"  (probably 172.16.x.x)
#define BACKEND_URL    "http://192.168.27.142:8000/api3/vitals"
  
#define DEVICE_API_KEY "sk_test_nancy0125"
#define POST_INTERVAL  5000

// ═════════════════════════════════════════════════════════════════════════════
//  HARDWARE PINS
// ═════════════════════════════════════════════════════════════════════════════
#define ONE_WIRE_BUS   4       // DS18B20
#define MPU_ADDR       0x68    // MPU6050 I2C
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64

// ═════════════════════════════════════════════════════════════════════════════
//  GLOBALS
// ═════════════════════════════════════════════════════════════════════════════
Adafruit_SSD1306    display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
MAX30105            particleSensor;
OneWire             oneWire(ONE_WIRE_BUS);
DallasTemperature   tempSensor(&oneWire);

// MAX30102 buffers
#define BUFFER_SIZE 50
uint32_t irBuffer[BUFFER_SIZE], redBuffer[BUFFER_SIZE];
int32_t  spo2;       int8_t validSPO2;
int32_t  heartRate;  int8_t validHeartRate;

// Step counting
int16_t ax, ay, az;
int     stepCount    = 0;
bool    stepPeak     = false;
const float STEP_THR = 1.2f;

// State flags
bool maxAvailable = false;
bool wifiOK       = false;
unsigned long lastPostMs = 0;

// Demo values (random-walk when no real data)
float dHR = 72, dSpo2 = 98.5, dTemp = 36.6;

// ═════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════════════════════
void updateDemo() {
  dHR   = constrain(dHR   + random(-2, 3),   58, 102);
  dSpo2 = constrain(dSpo2 + random(-1, 2),   95, 100);
  dTemp = constrain(dTemp + random(-4,5)*0.02f, 36.0, 37.4);
}

// ── OLED: splash ──────────────────────────────────────────────────────────────
void oledSplash(const char* line1, const char* line2 = "", bool big = false) {
  display.clearDisplay();
  display.setTextColor(WHITE);
  if (big) {
    display.setTextSize(2);
    display.setCursor(0, 12);
    display.println(line1);
    display.setTextSize(1);
    display.setCursor(0, 40);
  } else {
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println(line1);
    display.setCursor(0, 36);
  }
  display.println(line2);
  display.display();
}

// ── OLED: WiFi progress ───────────────────────────────────────────────────────
void oledWiFiProgress(int attempt, int maxA, const String& dots) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);  display.println("Connecting WiFi...");
  display.setCursor(0, 14); display.print("SSID: "); display.println(WIFI_SSID);
  display.setCursor(0, 28); display.println(dots);
  display.setCursor(0, 42); display.print(attempt); display.print("/");
                            display.print(maxA);   display.print("  ");
                            display.print(attempt/2); display.println("s");
  display.display();
}

// ── OLED: live vitals ─────────────────────────────────────────────────────────
void oledVitals(float hr, float o2, float temp, int steps, bool demo) {
  display.clearDisplay();
  display.setTextColor(WHITE);

  // Status bar
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("HealthMate");
  display.setCursor(82, 0);
  display.print(wifiOK ? "[WiFi]" : "[DEMO]");
  display.drawLine(0, 9, 127, 9, WHITE);

  // HR  (large)
  display.setTextSize(1); display.setCursor(0, 13); display.print("HR");
  display.setTextSize(2); display.setCursor(16, 11); display.print((int)hr);
  display.setTextSize(1); display.setCursor(50, 17); display.print("bpm");

  // SpO2
  display.setTextSize(1); display.setCursor(72, 13); display.print("O2");
  display.setTextSize(2); display.setCursor(86, 11); display.print((int)o2);
  display.setTextSize(1); display.setCursor(118, 17); display.print("%");

  display.drawLine(0, 30, 127, 30, WHITE);

  // Temp + Steps
  display.setTextSize(1);
  display.setCursor(0, 35);  display.print("Temp: "); display.print(temp, 1); display.print(" C");
  display.setCursor(0, 47);  display.print("Steps: "); display.print(steps);
  if (demo) { display.setCursor(0, 57); display.print("[demo vitals]"); }

  display.display();
}

// ── HTTP POST ─────────────────────────────────────────────────────────────────
bool postVitals(float hr, float o2, float temp, int steps) {
  if (!wifiOK) return false;
  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);
  http.setTimeout(4000);

  StaticJsonDocument<256> doc;
  doc["heart_rate"]  = round(hr * 10) / 10.0;
  doc["spo2"]        = round(o2 * 10) / 10.0;
  doc["temperature"] = round(temp * 100) / 100.0;
  doc["steps"]       = steps;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  return (code == 200 || code == 201);
}

// ═════════════════════════════════════════════════════════════════════════════
//  SETUP
// ═════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);

  // ── Kill all hardware watchdogs & brownout ─────────────────────────────────
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG,  0);
  WRITE_PERI_REG(RTC_CNTL_WDTCONFIG0_REG, 0);
  esp_task_wdt_deinit();
  esp_log_level_set("*", ESP_LOG_ERROR);  // silence WiFi radio debug spam

  Wire.begin(21, 22);

  // ── OLED ──────────────────────────────────────────────────────────────────
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED FAIL — halted");
    while (1);
  }
  display.setTextColor(WHITE);
  oledSplash("HealthMate AI", "Initializing...");
  delay(1200);

  // ── MAX30102 ──────────────────────────────────────────────────────────────
  oledSplash("MAX30102", "Checking...");
  if (particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    maxAvailable = true;
    Serial.println("MAX30102 OK");
    oledSplash("MAX30102", "Ready");
  } else {
    Serial.println("MAX30102 NOT FOUND");
    oledSplash("MAX30102", "Not found (demo)");
  }
  delay(600);

  // ── DS18B20 ───────────────────────────────────────────────────────────────
  tempSensor.begin();
  Serial.println("DS18B20 OK");

  // ── MPU6050 ───────────────────────────────────────────────────────────────
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); Wire.write(0);
  Wire.endTransmission(true);
  Serial.println("MPU6050 OK");

  // Show last OLED frame before WiFi — then NO more I2C until connected
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 10); display.println("  Connecting WiFi");
  display.setCursor(0, 26); display.print("  "); display.println(WIFI_SSID);
  display.setCursor(0, 42); display.println("  Please wait...");
  display.setCursor(0, 56); display.println("  (up to 30 sec)");
  display.display();
  // ── OLED I2C STOPS HERE until WiFi result ────────────────────────────────

  // ── WiFi ─────────────────────────────────────────────────────────────────
  // Phone hotspot is right next to device → 2dBm is plenty, draws ~20mA peak
  // vs 19.5dBm which draws 500mA and collapses the 3.3V rail / freezes I2C
  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_2dBm);   // minimum TX — phone is <2m away
  WiFi.setSleep(false);
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi connecting to ");
  Serial.println(WIFI_SSID);

  // Wait — serial only, NO oledWiFiProgress (no I2C during radio TX)
  const int MAX_ATT = 60;
  for (int i = 0; i < MAX_ATT && WiFi.status() != WL_CONNECTED; i++) {
    esp_task_wdt_reset();
    delay(500);
    Serial.print(".");
  }

  // ── Result — resume OLED I2C now that WiFi radio is stable ───────────────
  if (WiFi.status() == WL_CONNECTED) {
    wifiOK = true;
    Serial.printf("\nWiFi OK: %s\n", WiFi.localIP().toString().c_str());
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 14); display.println("  WiFi Connected!");
    display.setCursor(0, 30); display.print("  "); display.println(WiFi.localIP().toString());
    display.setCursor(0, 46); display.println("  Starting monitor...");
    display.display();
  } else {
    wifiOK = false;
    Serial.println("\nWiFi FAILED — demo mode");
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 14); display.println("  WiFi FAILED");
    display.setTextSize(2);
    display.setCursor(0, 32); display.println("DEMO MODE");
    display.display();
  }
  delay(2000);
}


// ═════════════════════════════════════════════════════════════════════════════
//  LOOP
// ═════════════════════════════════════════════════════════════════════════════
void loop() {

  // ── 1. Temperature ────────────────────────────────────────────────────────
  tempSensor.requestTemperatures();
  float tempC    = tempSensor.getTempCByIndex(0);
  bool  tempGood = (tempC > -100.0f);

  // ── 2. MAX30102 ───────────────────────────────────────────────────────────
  if (maxAvailable) {
    for (byte i = 0; i < BUFFER_SIZE; i++) {
      while (!particleSensor.available()) particleSensor.check();
      redBuffer[i] = particleSensor.getRed();
      irBuffer[i]  = particleSensor.getIR();
      particleSensor.nextSample();
    }
    maxim_heart_rate_and_oxygen_saturation(
      irBuffer, BUFFER_SIZE, redBuffer,
      &spo2, &validSPO2, &heartRate, &validHeartRate
    );
  }

  // ── 3. MPU6050 accelerometer + step count ─────────────────────────────────
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();

  float ax_g = ax / 16384.0f;
  float ay_g = ay / 16384.0f;
  float az_g = az / 16384.0f;
  float mag   = sqrt(ax_g*ax_g + ay_g*ay_g + az_g*az_g);

  if (mag > STEP_THR && !stepPeak)     { stepCount++; stepPeak = true; }
  else if (mag < (STEP_THR - 0.1f))    { stepPeak = false; }

  // ── 4. Resolve real vs demo values ────────────────────────────────────────
  bool realHR   = maxAvailable && validHeartRate && heartRate > 30 && heartRate < 220;
  bool useReal  = realHR && tempGood;

  float finalHR, finalO2, finalTemp;
  bool  isDemo;

  if (useReal) {
    finalHR   = (float)heartRate;
    finalO2   = validSPO2 ? (float)spo2 : dSpo2;
    finalTemp = tempC;
    isDemo    = false;
  } else {
    updateDemo();
    finalHR   = dHR;
    finalO2   = dSpo2;
    finalTemp = tempGood ? tempC : dTemp;
    isDemo    = true;
  }

  // ── 5. OLED ───────────────────────────────────────────────────────────────
  oledVitals(finalHR, finalO2, finalTemp, stepCount, isDemo);

  // ── 6. Serial debug ───────────────────────────────────────────────────────
  Serial.printf("HR:%.0f O2:%.0f%% T:%.2fC St:%d %s WiFi:%s\n",
    finalHR, finalO2, finalTemp, stepCount,
    isDemo ? "DEMO" : "REAL",
    wifiOK  ? "OK"   : "OFF");

  // ── 7. POST to backend every POST_INTERVAL ms (real data only) ────────────
  unsigned long now = millis();
  if (wifiOK && !isDemo && (now - lastPostMs >= POST_INTERVAL)) {
    if (postVitals(finalHR, finalO2, finalTemp, stepCount)) {
      lastPostMs = now;
      Serial.println("POST OK");
    } else {
      Serial.println("POST failed");
      // Attempt reconnect if WiFi dropped
      if (WiFi.status() != WL_CONNECTED) {
        WiFi.reconnect();
        wifiOK = false;
        delay(3000);
        wifiOK = (WiFi.status() == WL_CONNECTED);
      }
    }
  }

  delay(200);
}
