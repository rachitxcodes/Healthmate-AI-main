import serial
import json
import requests
import time
import sys

# ── CONFIGURATION ────────────────────────────────────────────────────────────
SERIAL_PORT = 'COM13'  # Identified from your earlier screenshot
BAUD_RATE   = 115200
API_URL     = "http://localhost:8000/api3/vitals"
API_KEY     = "sk_test_nancy0125"

def run_bridge():
    print("🚀 HealthMate AI Serial-to-Dashboard Bridge")
    print(f"📡 Listening on {SERIAL_PORT}...")
    print(f"🔗 Forwarding to {API_URL}")
    print("-" * 50)

    try:
        # Open Serial Port
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
        time.sleep(2)  # Wait for ESP32 to reset/init
        
        last_forward_time = 0
        FORWARD_INTERVAL = 4.0 # Limit POSTs to every 4 seconds to match dashboard expectations

        while True:
            if ser.in_waiting > 0:
                try:
                    line = ser.readline().decode('utf-8').strip()
                    if not line:
                        continue
                    
                    # Check if line is JSON
                    if line.startswith('{') and line.endswith('}'):
                        data = json.loads(line)
                        print(f"📥 Received data: {data}")
                        
                        # Throttle POSTing to avoid flooding backend
                        now = time.time()
                        if now - last_forward_time >= FORWARD_INTERVAL:
                            print(f"📤 Forwarding to dashboard...")
                            
                            headers = {
                                "Content-Type": "application/json",
                                "Authorization": f"Bearer {API_KEY}"
                            }
                            
                            response = requests.post(API_URL, json=data, headers=headers)
                            
                            if response.status_code in [200, 201]:
                                print(f"✅ Success: Dashboard updated!")
                            else:
                                print(f"❌ Error: Backend returned {response.status_code}")
                                print(response.text)
                                
                            last_forward_time = now
                        else:
                            # print(f"⏳ Throttled (waiting for next interval...)")
                            pass

                except json.JSONDecodeError:
                    # Ignore non-json lines (like "SYS_MAX:OK")
                    if "SYS_" in line:
                        print(f"ESP32 Status: {line}")
                except Exception as e:
                    print(f"⚠️ Loop Error: {e}")
                    
            time.sleep(0.01)

    except serial.SerialException as e:
        print(f"CRITICAL ERROR: Could not open {SERIAL_PORT}.")
        print("POSSIBLE CAUSES:")
        print(f"1. Is the ESP32 plugged into {SERIAL_PORT}?")
        print(f"2. IS THE ARDUINO SERIAL MONITOR OPEN? (Close it first!)")
        print(f"3. Another bridge is already running.")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Bridge stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    run_bridge()
