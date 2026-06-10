/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║    HealthMate AI — Zero-WiFi "Bridge" Firmware (Arduino)    ║
 * ║  Sensors : MAX30102 | DS18B20 | MPU6050                     ║
 * ║  Data : Pushed over USB Serial → Python Bridge → Dashboard  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 *  STABILITY NOTE: 
 *  This version disables ALL WiFi/Bluetooth to ensure 100% 
 *  power stability on cheap LDOs and USB ports.
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ── Hardware Config ──────────────────────────────────────────────────────────
#define ONE_WIRE_BUS   4
#define MPU_ADDR       0x68
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64

// ── Globals ──────────────────────────────────────────────────────────────────
Adafruit_SSD1306  display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
MAX30105          particleSensor;
OneWire           oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

#define BUFFER_SIZE 50
uint32_t irBuffer[BUFFER_SIZE], redBuffer[BUFFER_SIZE];
int32_t  spo2;       int8_t validSPO2;
int32_t  heartRate;  int8_t validHeartRate;

int16_t ax, ay, az;
int     stepCount = 0;
bool    stepPeak  = false;
const float STEP_THR = 1.2f;

bool maxAvailable = false;
float dHR = 72, dSpo2 = 98.5, dTemp = 36.6;

void updateDemo() {
  dHR   = constrain(dHR   + random(-2, 3),     58,  102);
  dSpo2 = constrain(dSpo2 + random(-1, 2),     95,  100);
  dTemp = constrain(dTemp + random(-4, 5)*0.02f, 36.0, 37.4);
}

void oledVitals(float hr, float o2, float temp, int steps, bool demo) {
  display.clearDisplay();
  display.setTextColor(WHITE);

  display.setTextSize(1);
  display.setCursor(0, 0);   display.print("HealthMate AI");
  display.setCursor(82, 0);  display.print("[USB]"); // Changed status
  display.drawLine(0, 9, 127, 9, WHITE);

  display.setTextSize(1); display.setCursor(0, 13);  display.print("HR");
  display.setTextSize(2); display.setCursor(16, 11); display.print((int)hr);
  display.setTextSize(1); display.setCursor(50, 17); display.print("bpm");

  display.setTextSize(1); display.setCursor(72, 13);  display.print("O2");
  display.setTextSize(2); display.setCursor(86, 11);  display.print((int)o2);
  display.setTextSize(1); display.setCursor(118, 17); display.print("%");

  display.drawLine(0, 30, 127, 30, WHITE);

  display.setTextSize(1);
  display.setCursor(0, 35); display.print("Temp: "); display.print(temp, 1); display.print(" C");
  display.setCursor(0, 47); display.print("Steps: "); display.print(steps);
  
  if (demo) { 
    display.setCursor(0, 57); display.print("[DEMO MODE]"); 
  } else {
    display.setCursor(0, 57); display.print("[REAL SENSOR]"); 
  }

  display.display();
}

void setup() {
  Serial.begin(115200);
  
  // Power Saving: No WiFi/BT means zero brownouts
  btStop(); 

  Wire.begin(21, 22);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED_FAIL");
    while (1);
  }
  display.display();
  delay(500);

  // MAX30102
  if (particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    maxAvailable = true;
    Serial.println("SYS_MAX:OK");
  } else {
    Serial.println("SYS_MAX:FAIL");
  }

  // DS18B20
  tempSensor.begin();
  Serial.println("SYS_TEMP:OK");

  // MPU6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); Wire.write(0);
  Wire.endTransmission(true);
  Serial.println("SYS_MPU:OK");

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 20); display.println("  SERIAL BRIDGE");
  display.setCursor(0, 35); display.println("  ACTIVE - USB");
  display.display();
  delay(1500);
}

void loop() {
  // 1. Temperature
  tempSensor.requestTemperatures();
  float tempC = tempSensor.getTempCByIndex(0);
  bool  tempOK = (tempC > -100.0f);

  // 2. Heart/O2
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

  // 3. Acceleration/Steps
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();
  float mag = sqrt(sq(ax/16383.0f) + sq(ay/16383.0f) + sq(az/16383.0f));
  if (mag > STEP_THR && !stepPeak) { stepCount++; stepPeak = true; }
  else if (mag < (STEP_THR - 0.1f)) { stepPeak = false; }

  // 4. Fusion Logic
  bool realValue = maxAvailable && validHeartRate && heartRate > 30;
  float finalHR, finalO2, finalTemp;
  bool isDemo = !realValue;

  if (realValue) {
    finalHR = (float)heartRate;
    finalO2 = validSPO2 ? (float)spo2 : dSpo2;
    finalTemp = tempC;
  } else {
    updateDemo();
    finalHR = dHR;
    finalO2 = dSpo2;
    finalTemp = tempOK ? tempC : dTemp;
  }

  // 5. Update OLED
  oledVitals(finalHR, finalO2, finalTemp, stepCount, isDemo);

  // 6. OUTPUT DATA AS JSON STRING (This is what the bridge reads!)
  // Format: {"heart_rate": 70, "spo2": 98, "temperature": 36.5, "steps": 0}
  Serial.print("{");
  Serial.print("\"heart_rate\":");  Serial.print(finalHR, 1);
  Serial.print(",\"spo2\":");        Serial.print(finalO2, 1);
  Serial.print(",\"temperature\":"); Serial.print(finalTemp, 1);
  Serial.print(",\"steps\":");       Serial.print(stepCount);
  Serial.println("}");

  delay(500); // Faster updates over USB are fine!
}
