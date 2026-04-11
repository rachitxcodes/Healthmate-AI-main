#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
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

#define I2C_SDA 21
#define I2C_SCL 22
#define DS18B20_PIN 4
#define POST_INTERVAL 10000 

// OLED Config
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// MPU6050 Config
Adafruit_MPU6050 mpu;
bool mpuFound = false;

// MAX30102 Config
MAX30105 particleSensor;
bool maxFound = false;

// Temp Config
OneWire oneWire(DS18B20_PIN);
DallasTemperature tempSensor(&oneWire);
bool tempFound = false;

// Buffers and Vitals
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];
int32_t spo2 = 0;
int8_t validSPO2 = 0;
int32_t heartRate = 0;
int8_t validHeartRate = 0;

float avgHR = 0.0;
float avgSpO2 = 0.0;
float temperature = 36.5;
int stepCount = 1240; // demo start
String activityMode = "Stable";
bool fallDetected = false;

unsigned long lastPost = 0;
int screenState = 0; // OLED screen toggle

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n===== HealthMate PRO — DEMO MODE =====");

  // 1. Start I2C
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(50000); // stable clock

  // 2. Initialize OLED
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(WHITE);
    display.setCursor(0,0);
    display.println("HealthMate AI");
    display.println("Initializing...");
    display.display();
    Serial.println("✅ OLED initialized");
  } else {
    Serial.println("❌ OLED not found");
  }

  // 3. Initialize MAX30102
  if (particleSensor.begin(Wire)) {
    maxFound = true;
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x1F);
    particleSensor.setPulseAmplitudeIR(0x1F);
    Serial.println("✅ MAX30102 initialized");
  } else {
    Serial.println("❌ MAX30102 not found"  );
  }

  // 4. Initialize MPU6050
  if (mpu.begin()) {
    mpuFound = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("✅ MPU6050 initialized");
  } else {
    Serial.println("❌ MPU6050 not found");
  }

  // 5. Initialize DS18B20
  tempSensor.begin();
  if (tempSensor.getDeviceCount() > 0) {
    tempFound = true;
    Serial.println("✅ DS18B20 initialized");
  } else {
    Serial.println("❌ DS18B20 not found");
  }

  // 6. WiFi
  Serial.print("📡 Connecting WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 15) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? "\n✅ Connected" : "\n⚠️ Offline Mode");
}

// ================= HELPERS =================
void updateOLED() {
  display.clearDisplay();
  display.setCursor(0,0);
  display.setTextSize(1);
  display.println("HealthMate AI - LIVE");
  display.drawLine(0, 10, 128, 10, WHITE);
  
  display.setCursor(0, 15);
  display.print("HR: "); display.print(avgHR, 1); display.println(" BPM");
  display.print("Oxygen: "); display.print(avgSpO2, 1); display.println(" %");
  display.print("Temp: "); display.print(temperature, 1); display.println(" C");
  
  display.setCursor(0, 45);
  display.print("Steps: "); display.println(stepCount);
  display.print("Status: "); display.println(fallDetected ? "FALL!" : activityMode);
  
  if (WiFi.status() == WL_CONNECTED) {
    display.setCursor(100, 0); display.print("WIFI");
  }
  
  display.display();
}

void generateDemoData() {
  avgHR = 72.0 + (random(0, 50) / 10.0);
  avgSpO2 = 98.0 + (random(0, 10) / 10.0);
  temperature = 36.5 + (random(0, 4) / 10.0);
  stepCount += random(1, 5);
  activityMode = (random(0, 10) > 8) ? "Walking" : "Stable";
  fallDetected = false;
  Serial.println("✨ Demo Values Generated");
}

// ================= LOOP =================
void loop() {
  // --- Constant Motion Detection ---
  if (mpuFound) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    float magnitude = sqrt(a.acceleration.x * a.acceleration.x + 
                           a.acceleration.y * a.acceleration.y + 
                           a.acceleration.z * a.acceleration.z);
    
    if (magnitude > 25.0) { // Fall threshold
      fallDetected = true;
      Serial.println("🚨 FALL DETECTED!");
    } else if (magnitude > 12.0) {
      stepCount++;
      activityMode = "Moving";
    } else {
      activityMode = "Resting";
    }
  }

  // --- Interval Processing (Vitals + Post) ---
  if (millis() - lastPost >= POST_INTERVAL) {
    lastPost = millis();

    Serial.println("\n--- Processing Cycle ---");
    bool fingerOn = false;

    // 1. Try Pulse
    if (maxFound) {
      long ir = particleSensor.getIR();
      if (ir > 30000) {
        fingerOn = true;
        for (byte i = 0; i < BUFFER_SIZE; i++) {
          while (!particleSensor.available()) particleSensor.check();
          redBuffer[i] = particleSensor.getRed();
          irBuffer[i] = particleSensor.getIR();
          particleSensor.nextSample();
          yield();
        }
        maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_SIZE, redBuffer, &spo2, &validSPO2, &heartRate, &validHeartRate);
        if (validHeartRate) avgHR = (avgHR * 0.7) + (heartRate * 0.3);
        if (validSPO2) avgSpO2 = (avgSpO2 * 0.7) + (spo2 * 0.3);
      }
    }

    // 2. Try Temp
    if (tempFound) {
      tempSensor.requestTemperatures();
      float t = tempSensor.getTempCByIndex(0);
      if (t > 10.0) temperature = t;
    }

    // 3. Demo Fallback
    if (!fingerOn && (!maxFound || avgHR < 40)) {
      generateDemoData();
    }

    // 4. Update OLED
    updateOLED();

    // 5. Send API
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(BACKEND_URL);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);

      JsonDocument doc;
      doc["heart_rate"] = avgHR;
      doc["spo2"] = avgSpO2;
      doc["temperature"] = temperature;
      doc["steps"] = stepCount;
      doc["activity"] = activityMode;
      doc["fall_detected"] = fallDetected;

      String body;
      serializeJson(doc, body);
      int code = http.POST(body);
      Serial.print("POST Code: "); Serial.println(code);
      http.end();
      
      // Reset fall after alert sent
      if (fallDetected) delay(2000); 
      fallDetected = false; 
    }
  }
  
  delay(10); 
}
