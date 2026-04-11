#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================================================
// CONFIGURATION
// ============================================================================

// Line 16-17: WiFi credentials
const char* WIFI_SSID = "GLA";
const char* WIFI_PASSWORD = "GLACAMPUS";

// Line 21: Backend URL (change for production)
const char* BACKEND_URL = "http://172.16.185.38:8000/api3/vitals";

// Line 25: Device API Key (from Render environment)
const char* DEVICE_API_KEY = "sk_test_nancy0125";

// Line 29: Your user UUID (from Supabase)
const char* USER_ID = "29ccd72b-b2c7-49fd-8e47-7aaa4a0b5bd2";

// Sensor Configuration
#define MAX30102_I2C_SDA 21
#define MAX30102_I2C_SCL 22
#define DS18B20_PIN 4
#define BUFFER_SIZE 100

// Sampling interval (milliseconds)
#define SAMPLE_INTERVAL 60000  // Post vitals every 60 seconds

// ============================================================================
// SENSOR OBJECTS
// ============================================================================

MAX30105 particleSensor;
OneWire oneWire(DS18B20_PIN);
DallasTemperature sensors(&oneWire);

// Buffers
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

// Raw sensor readings
int32_t spo2 = 0;
int8_t validSPO2 = 0;
int32_t heartRate = 0;
int8_t validHeartRate = 0;

// Filtered values (exponential moving average)
float avgHR = 0.0;
float avgSpO2 = 0.0;
float temperature = 0.0;

// Status tracking
unsigned long lastSensorCalibration = 0;
unsigned long lastApiPost = 0;
unsigned long lastConnectionAttempt = 0;
int failedPostCount = 0;
const int MAX_FAILED_POSTS = 5;

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(2000);  // Give serial monitor time to connect
  
  Serial.println("\n\n===== HealthMate AI - ESP32 Vitals Monitor =====");
  Serial.println("Initializing sensors...");

  // Initialize I2C
  Wire.begin(MAX30102_I2C_SDA, MAX30102_I2C_SCL);
  delay(500);

  // Initialize MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("ERROR: MAX30102 not detected!");
    Serial.println("Check I2C wiring (SDA=21, SCL=22)");
    while (1) {
      delay(1000);
    }
  }
  Serial.println("✓ MAX30102 initialized");

  // Configure MAX30102
  // setup(pulseAmplitude, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange)
  particleSensor.setup(60, 4, 2, 100, 411, 4096);
  Serial.println("✓ MAX30102 configured");

  // Initialize DS18B20
  sensors.begin();
  Serial.println("✓ DS18B20 initialized");

  // Initialize WiFi
  connectToWiFi();

  // Calibration message
  Serial.println("\nℹ️  Calibrating sensors (10 seconds)...");
  Serial.println("📌 Place your finger on MAX30102 sensor");
  lastSensorCalibration = millis();
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
  // Check WiFi connection every 30 seconds
  if (millis() % 30000 < 100) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠️  WiFi disconnected, reconnecting...");
      connectToWiFi();
    }
  }

  // Calibration delay (first 10 seconds)
  unsigned long calibrationElapsed = millis() - lastSensorCalibration;
  if (calibrationElapsed < 10000) {
    delay(500);
    return;
  }

  // Read sensors and post to API every SAMPLE_INTERVAL
  unsigned long timeSinceLastPost = millis() - lastApiPost;
  if (timeSinceLastPost >= SAMPLE_INTERVAL) {
    readAllSensors();
    postVitalsToAPI();
    lastApiPost = millis();
  }

  delay(100);  // Small delay to prevent watchdog timeout
}

// ============================================================================
// SENSOR READING FUNCTIONS
// ============================================================================

void readAllSensors() {
  Serial.println("\n--- Reading Sensors ---");

  // Read MAX30102
  readMAX30102();

  // Read DS18B20
  readTemperature();

  // Display current readings
  displaySensorStatus();
}

void readMAX30102() {
  // Collect buffer of samples
  for (byte i = 0; i < BUFFER_SIZE; i++) {
    // Wait for data available
    while (!particleSensor.available()) {
      particleSensor.check();
    }

    // Read samples
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
    particleSensor.nextSample();
  }

  // Calculate SpO2 and HR using Maxim's algorithm
  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, BUFFER_SIZE,
    redBuffer,
    &spo2, &validSPO2,
    &heartRate, &validHeartRate
  );

  // Apply exponential moving average filter to HR
  if (validHeartRate && heartRate > 40 && heartRate < 200) {
    // EMA: smooth_value = (0.8 * old) + (0.2 * new)
    avgHR = (avgHR * 0.8) + (heartRate * 0.2);
  }

  // Apply exponential moving average filter to SpO2
  if (validSPO2 && spo2 > 70 && spo2 <= 100) {
    avgSpO2 = (avgSpO2 * 0.8) + (spo2 * 0.2);
  }
}

void readTemperature() {
  sensors.requestTemperatures();
  temperature = sensors.getTempCByIndex(0);

  // Check for sensor error (returns -127 if disconnected)
  if (temperature == -127.0) {
    Serial.println("ERROR: DS18B20 disconnected!");
    temperature = 0.0;  // Reset to 0
  }
}

void displaySensorStatus() {
  // Heart rate status
  String hrStatus = "NORMAL";
  if (avgHR < 45) hrStatus = "TOO_LOW";
  else if (avgHR < 60) hrStatus = "LOW";
  else if (avgHR > 110) hrStatus = "HIGH";
  else if (avgHR > 130) hrStatus = "TOO_HIGH";

  // SpO2 status
  String spo2Status = "NORMAL";
  if (avgSpO2 >= 95) spo2Status = "NORMAL";
  else if (avgSpO2 >= 90) spo2Status = "LOW";
  else if (avgSpO2 >= 80) spo2Status = "CRITICAL";
  else spo2Status = "SENSOR_ERROR";

  // Temperature status
  String tempStatus = "NORMAL";
  if (temperature < 35) tempStatus = "HYPOTHERMIA";
  else if (temperature < 36) tempStatus = "LOW";
  else if (temperature <= 37.5) tempStatus = "NORMAL";
  else if (temperature <= 38) tempStatus = "FEVER";
  else tempStatus = "HIGH_FEVER";

  // Print status
  Serial.println("╔════════════════════════════════════════╗");
  Serial.print("║ Heart Rate: ");
  Serial.print(avgHR, 1);
  Serial.print(" BPM (");
  Serial.print(hrStatus);
  Serial.println(")             ║");

  Serial.print("║ SpO2: ");
  Serial.print(avgSpO2, 1);
  Serial.print("% (");
  Serial.print(spo2Status);
  Serial.println(")                 ║");

  Serial.print("║ Temp: ");
  Serial.print(temperature, 1);
  Serial.print("°C (");
  Serial.print(tempStatus);
  Serial.println(")                ║");

  Serial.println("╚════════════════════════════════════════╝");
}

// ============================================================================
// API COMMUNICATION
// ============================================================================

void postVitalsToAPI() {
  // Check WiFi status
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected, skipping API post");
    failedPostCount++;
    return;
  }

  // Create JSON payload
  DynamicJsonDocument doc(256);
  doc["heart_rate"] = avgHR;
  doc["spo2"] = avgSpO2;
  doc["temperature"] = temperature;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("\n📤 Posting to API...");
  Serial.print("URL: ");
  Serial.println(BACKEND_URL);
  Serial.print("Payload: ");
  Serial.println(jsonPayload);

  // Create HTTP client
  HTTPClient http;
  http.begin(BACKEND_URL);

  // Add headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);

  // Send POST request
  int httpCode = http.POST(jsonPayload);

  // Handle response
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("✅ API Response (200 OK):");
    Serial.println(response);
    failedPostCount = 0;  // Reset counter on success

    // Parse response to check if alert was sent
    DynamicJsonDocument responseDoc(512);
    DeserializationError error = deserializeJson(responseDoc, response);

    if (!error) {
      float apiScore = responseDoc["score"];
      String apiStatus = responseDoc["status"];
      bool alertSent = responseDoc["alert_sent"];

      Serial.print("→ Risk Score: ");
      Serial.print(apiScore);
      Serial.print(" (");
      Serial.print(apiStatus);
      Serial.println(")");

      if (alertSent) {
        Serial.println("🚨 ALERT SENT TO CAREGIVERS!");
        alertLED();  // Optional: flash LED on alert
      }
    }
  } else {
    Serial.print("❌ API Error (");
    Serial.print(httpCode);
    Serial.print("): ");
    Serial.println(http.errorToString(httpCode));
    failedPostCount++;

    if (failedPostCount >= MAX_FAILED_POSTS) {
      Serial.println("⚠️  Multiple API failures. Check network/backend.");
      failedPostCount = 0;  // Reset counter
    }
  }

  http.end();
}

// ============================================================================
// WiFi MANAGEMENT
// ============================================================================

void connectToWiFi() {
  Serial.println("\n📡 Connecting to WiFi...");
  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  const int MAX_ATTEMPTS = 20;  // 20 * 500ms = 10 seconds

  while (WiFi.status() != WL_CONNECTED && attempts < MAX_ATTEMPTS) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✅ WiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("❌ WiFi Connection Failed!");
    Serial.println("Check SSID and password in configuration");
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

void alertLED() {
  // Flash LED 3 times if you have one connected
  // Example: GPIO pin 2
  // pinMode(2, OUTPUT);
  // for (int i = 0; i < 3; i++) {
  //   digitalWrite(2, HIGH);
  //   delay(200);
  //   digitalWrite(2, LOW);
  //   delay(200);
  // }
}

// Optional: Function to test API connection
void testAPIConnection() {
  Serial.println("\n🔧 Testing API Connection...");
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected");
    return;
  }

  HTTPClient http;
  http.begin("http://172.16.185.38:8000/api3/status");
  int httpCode = http.GET();

  if (httpCode == 200) {
    Serial.println("✅ Backend is reachable!");
    Serial.println(http.getString());
  } else {
    Serial.print("❌ Backend not reachable: ");
    Serial.println(httpCode);
  }

  http.end();
}

// ============================================================================
// DEBUGGING: Enter serial commands
// ============================================================================

void serialEvent() {
  while (Serial.available()) {
    char cmd = Serial.read();
    switch (cmd) {
      case 'T':
        Serial.println("Testing API connection...");
        testAPIConnection();
        break;
      case 'S':
        Serial.println("Reading sensors now...");
        readAllSensors();
        break;
      case 'P':
        Serial.println("Posting vitals now...");
        postVitalsToAPI();
        break;
      case 'W':
        Serial.println("Reconnecting WiFi...");
        connectToWiFi();
        break;
    }
  }
}
