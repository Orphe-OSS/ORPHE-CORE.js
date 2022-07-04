# ORPHE.js
Happy hacking for ORPHE CORE module on javascript.

## Advertise list table
| Name | type | UUID |
| - | - | - |
| ORPHE Information | Service |  01A9D6B5-FF6E-444A-B266-0BE75E85C064 |
| Device Information | Read/Write | 24354F22-1C46-430E-A4AB-A1EEABBCDFC0 |
| Other Service | Service | DB1B7ACA-CDA5-4453-A49B-33A53D3F0833 | 
| Sensor Values | Notify | F3F9C7CE-46EE-4205-89AC-ABE64E626C0F |
| Step Analysis | Notify |  4EB776DC-CF99-4AF7-B2D3-AD0F791A79DD | 


## ORPHE Information
Service for device configuration and status acquisition

### Device Information
The system acquires information such as remaining battery capacity, left and right side information, etc., and sets the acceleration sensor and gyro sensor.

## Other Service
Service for obtaining user gait information and sensor values

### Step Analysis
Transmits quaternion and microdisplacement at 50 Hz, and transmits step count and gait information at each step.