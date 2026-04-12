#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ================= CONFIG =================
const char* WIFI_SSID      = "GLA";
const char* WIFI_PASSWORD  = "GLACAMPUS";
const char* BACKEND_URL    = "http://172.16.185.130:8000/api3/vitals";
const char* DEVICE_API_KEY = "sk_test_nancy0125";

#define DS18B20_PIN 4
#define POST_INTERVAL 10000 

OneWire oneWire(DS18B20_PIN);
DallasTemperature sensors(&oneWire);

float avgHR = 75.0;
float avgSpO2 = 98.5;
float temperature = 36.5;
int stepCount = 0;
unsigned long lastPost = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n===== HealthMate PRO — TEMP FIX MODE =====");

  sensors.begin();
  
  Serial.print("📡 Connecting WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\n✅ Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  if (millis() - lastPost >= POST_INTERVAL) {
    lastPost = millis();

    // 1. Read Temp
    sensors.requestTemperatures();
    float t = sensors.getTempCByIndex(0);
    if (t > 10.0 && t < 50.0) temperature = t;
    
    // 2. Dummy Fluctuations
    avgHR = 72.0 + (random(0, 50) / 10.0);
    avgSpO2 = 98.0 + (random(0, 15) / 10.0);
    stepCount += random(1, 3);

    Serial.print("🌡️ Real Temp: "); Serial.print(temperature);
    Serial.print(" | HR: "); Serial.println(avgHR);

    // 3. Send to Backend
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(BACKEND_URL);
      http.setConnectTimeout(5000); // 5s timeout
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);

      JsonDocument doc;
      doc["heart_rate"] = avgHR;
      doc["spo2"] = avgSpO2;
      doc["temperature"] = temperature;
      doc["steps"] = stepCount;
      doc["activity"] = "Stable";

      String body;
      serializeJson(doc, body);
      int code = http.POST(body);
      
      if (code > 0) {
        Serial.print("✅ Backend Success: "); Serial.println(code);
      } else {
        Serial.print("❌ Connection Failed. Error: ");
        Serial.println(http.errorToString(code).c_str());
      }
      http.end();
    } else {
      Serial.println("❌ WiFi Disconnected!");
    }
  }
}
