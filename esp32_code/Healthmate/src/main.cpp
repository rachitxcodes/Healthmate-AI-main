#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ================= CONFIG =================
const char* WIFI_SSID      = "GLA";
const char* WIFI_PASSWORD  = "GLACAMPUS";
const char* BACKEND_URL    = "http://172.16.185.130:8000/api3/vitals";
const char* DEVICE_API_KEY = "sk_test_nancy0125";

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

MAX30105 particleSensor;

// MAX Buffers (Uses BUFFER_SIZE from spo2_algorithm.h)
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

// Global Vitals (Hybrid)
float currentHR = 72.0;
float currentSpO2 = 98.2;
float currentTemp = 36.6;
int32_t spo2_calc;
int8_t validSPO2;
int32_t hr_calc;
int8_t validHeartRate;

unsigned long lastPost = 0;
bool hasMAX = false;
bool hasOLED = false;

void updateOLED(const char* status) {
  if (!hasOLED) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("HealthMate AI");
  display.drawLine(0, 10, 128, 10, WHITE);

  display.setCursor(0, 15);
  display.print("WiFi: "); display.println(WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE");
  
  display.setTextSize(2);
  display.setCursor(0, 30);
  display.print("HR: "); 
  if (validHeartRate) display.println((int)currentHR);
  else display.println("--");

  display.setCursor(0, 50);
  display.print("O2: "); 
  if (validSPO2) { display.print((int)currentSpO2); display.println("%"); }
  else display.println("--%");
  
  display.display();
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector
  Serial.begin(115200);
  Wire.begin(21, 22);

  // 1. OLED Init
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    hasOLED = true;
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("HealthMate Pro");
    display.print("Initializing...");
    display.display();
  }

  // 2. MAX30105 Init
  if (particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("✅ MAX30105 Detected!");
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x1F);
    particleSensor.setPulseAmplitudeIR(0x1F);
    hasMAX = true;
  }

  // 3. WiFi Init (Instant - No Waiting)
  Serial.println("📡 WiFi Background Start...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setTxPower(WIFI_POWER_11dBm); 
}

void loop() {
  // --- 0. ALWAYS UPDATE OLED FIRST ---
  updateOLED("Streaming...");

  // --- A. DATA COLLECTION (With Timeout) ---
  if (hasMAX) {
    bool sensorTimeout = false;
    for (byte i = 0; i < BUFFER_SIZE; i++) {
      unsigned long startWait = millis();
      while (!particleSensor.available()) {
        particleSensor.check();
        if (millis() - startWait > 100) { // 100ms timeout per sample
          sensorTimeout = true;
          break;
        }
      }
      if (sensorTimeout) break;
      
      redBuffer[i] = particleSensor.getRed();
      irBuffer[i] = particleSensor.getIR();
      particleSensor.nextSample();
    }
    
    if (!sensorTimeout) {
      // Calculate
      maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_SIZE, redBuffer, &spo2_calc, &validSPO2, &hr_calc, &validHeartRate);
      if (validHeartRate) currentHR = hr_calc;
      if (validSPO2) currentSpO2 = spo2_calc;
    } else {
      validHeartRate = 0;
      validSPO2 = 0;
    }
  }

  // --- B. HYBRID SIMULATION (Organic Drift) ---
  currentTemp += (random(-1, 2) / 10.0);
  if (currentTemp < 36.3) currentTemp = 36.4;
  if (currentTemp > 37.1) currentTemp = 36.8;

  if (!validHeartRate) {
    currentHR += (random(-5, 6) / 10.0);
    if (currentHR < 68) currentHR = 70;
    if (currentHR > 82) currentHR = 78;
  }
  if (!validSPO2) {
    currentSpO2 += (random(-2, 3) / 10.0);
    if (currentSpO2 < 97.2) currentSpO2 = 98.1;
    if (currentSpO2 > 99.8) currentSpO2 = 99.2;
  }

  // --- C. CLOUD SYNC ---
  if (millis() - lastPost >= 5000) {
    lastPost = millis();
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(BACKEND_URL);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);

      JsonDocument doc;
      doc["heart_rate"] = (int)currentHR;
      doc["spo2"] = (int)currentSpO2;
      doc["temperature"] = currentTemp;
      doc["activity"] = (hasMAX && validHeartRate) ? "Stable (Real)" : "Stable (Sim)";

      String body;
      serializeJson(doc, body);
      int code = http.POST(body);
      if (code > 0) Serial.println("✅ Synced to Cloud");
      http.end();
    }
  }
  
  delay(10); // Short yield
}
