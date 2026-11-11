# CORE 3.0 discovery and header-50 compatibility

## Scope

Branch: `fix/core3-discovery-packet-compat`, based on `origin/main` (`b2f6028`).
The change does not update device firmware. It adds discovery alternatives and
supports one known padded notification layout in the JavaScript SDK.

## Packet format evidence

A locally inspected CORE 3.0 firmware checkout (`ac7ebfe`, not necessarily the
firmware installed on the devices) contains:

- `nRF5_driver.h`: `NRF5_UPDATE_SENSOR_VALUES_CHAR_DATA_SIZE` is 104.
- `AppBleDataUpdater::updateSensorValues4datasCharNotify()`: zero-initializes
  that buffer, writes the header-50 four-frame layout, writes the checksum at
  byte 91, and passes the full buffer to `setUpdateSensorVal()`.
- `nRF5_driver.c`: uses the same size for the sensor-values transmit attribute.

This justifies accepting 104 bytes only when bytes 92..103 are zero. It does
not justify interpreting arbitrary longer notifications, FIFO packets, or
other headers as header 50. The existing 92-byte decoder and unit conversions
are retained. This is compatibility evidence, not a dated firmware regression
or proof of the installed firmware version.

## Automated validation

The new regression tests were run against the original implementation and
failed: name-only CR-3 discovery did not match, and 104-byte data dispatched no
sensor callbacks. With the fix:

- `npm test`: all existing tests and both new regression tests pass.
- Header 50: synthetic 92-byte and zero-padded 104-byte inputs produce identical
  acceleration, gyroscope, quaternion, converted values, Euler angles,
  timestamps, and four-sample order.
- Mixed 92/104 notifications preserve serial wraparound and gap reporting.
- Truncated, unknown-length and nonzero-padding packets do not affect parsed
  callbacks or the gap tracker. Raw `gotData` receives original notifications.
- Discovery still accepts existing service-based devices, supports name-only
  CR devices, rejects unrelated names/services, retains optional GATT services,
  and preserves the two-slot duplicate-device guard.
- `npm run lint`: zero errors (existing warnings remain).
- CDN pin, example catalog and example static-quality checks pass.

## Browser/device validation (2026-11-11 JST)

Host: macOS 26.6.2 (25G83), Chrome 157.0.8103.39, existing work profile.
Installed device firmware versions were not captured.

1. The public GAME-HURDLE page previously received sensor notifications while
   repeatedly logging `SENSOR VALUES: Data length is not 92`; decoded
   acceleration was not displayed. This was before the fix.
2. Opened `http://localhost:8765/tests/physical-core3-compat.html` from this
   branch. Old information-service-only search showed an empty chooser.
3. Updated SDK discovery also showed an empty chooser in the current state.
4. Disconnected the existing public VIEW and GAME-HURDLE connections and retried
   updated discovery; still no selectable device was observed.
5. The diagnostic `acceptAllDevices` chooser displayed nearby Bluetooth
   devices, but no `CR-3` name was observed. This verifies that scanning can
   return results, not that all unnamed candidates are unrelated to CORE.

**Physical validation is incomplete.** No device was selected/connected through
the patched SDK, so no on-device packet length, decoded rate, two-device
continuity, or GAME-HURDLE control improvement is claimed. The discovery
change has not yet been shown to resolve the reported empty chooser.

## Remaining hardware check

1. Put both CORE devices into connectable advertising near the Mac, disconnect
   other phone applications, and record their firmware versions and the
   host/browser versions.
2. Compare old and updated discovery in the manual test page. Record the exact
   candidate names and which device was selected; do not infer discovery from
   Bluetooth Internals' cached names or GATT services.
3. Connect each device to a different slot. Observe original header/length
   counts, four decoded samples per header-50 packet, live finite acceleration
   and attitude, gaps and disconnects for at least 60 seconds per trial.
4. Repeat with both devices and reversed connection order, then test the local
   GAME-HURDLE page's acceleration and jump inputs with actual movements.
5. Preserve an old 92-byte CORE and a CORE 2.0 header-40 physical regression
   check before publishing a release.

Serve the repository root locally, for example:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

The manual page reads device information and subscribes to sensor values
without writing settings, synchronizing time, enabling recording, or updating
firmware. Its all-device chooser is diagnostic-only and does not connect a
selected device. It does not load BleSharedBridge or use remembered-device
selection, so the patched discovery and parser are exercised directly.
