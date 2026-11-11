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
The connected CR-3's read-only, 23-byte firmware-name response reported
version 3.1, date 2026-01-25, patch 1. Identifying fields and raw response
bytes are omitted from this public report.

This identifies the reported application firmware fields, not the separately
installed Bluetooth controller firmware or when the user updated either one.

1. The public GAME-HURDLE page previously received sensor notifications while
   repeatedly logging `SENSOR VALUES: Data length is not 92`; decoded
   acceleration was not displayed. This was before the fix.
2. Disconnected the public VIEW and GAME-HURDLE connections, then compared
   chooser conditions in `http://localhost:8765/tests/physical-core3-compat.html`.
   After the user prepared the hardware, updated discovery displayed CR-3 and
   allowed connection. An old information-service-only comparison subsequently
   displayed an empty chooser, verified by screenshot after scanning.
3. Some chooser rows were absent from the accessibility tree although visible
   in screenshots. Earlier accessibility-only "empty" observations are therefore
   inconclusive; candidate presence was rechecked visually.
4. The first single-device trial received 3,379 header-50, 104-byte notifications
   and 13,516 acceleration plus 13,516 Euler callbacks over approximately
   73 seconds before manual disconnect. Live values were finite.
5. A repeat trial read the firmware version fields above, then received 3,033 such
   notifications and 12,132 callbacks of each kind over approximately 64 seconds
   before manual disconnect. No unexpected disconnect was observed. Final
   acceleration was approximately (-0.0024, 0.0059, 1.0039) G.
6. Serial-discontinuity callbacks occurred 185 times in the first trial and
   120 times in the repeat. These are counts of gap events, not missing packets.
   No lossless-streaming claim is made, and this patch does not resolve them.
7. One updated chooser briefly displayed four CR-3 candidate rows with different
   addresses. They have not been established as four physical devices. With the
   selected CR-3 connected, a second-slot search showed only that paired device;
   an all-device scan showed other nearby devices but no separate CR-3 name.
   Unnamed results were not identified as belonging to or excluding the second
   CORE. The user confirmed that two CORE 3.0 units were powered on.
8. A later page observation showed streaming in slot 2 and
   `DuplicateBluetoothDeviceError` in slot 1. This demonstrates rejection of
   the same browser device in both slots, not simultaneous physical devices.
9. Opened the branch's local GAME-HURDLE page and selected the paired CR-3.
   During observation, the connection toggle remained disabled and the SDK
   reported `connected: false` / `connecting: true`; no game sensor updates
   were observed. Reloaded the page to clear the pending connection. The
   physical device's power/advertising state at this attempt was unconfirmed.
   This attempt does not establish successful GAME-HURDLE reconnection.
10. To map the browser slots to physical units, the user shook one CORE while
    leaving the other untouched; the shaken unit was designated A. Power-off
    of both units was not confirmed. A CR-3 candidate was selected in slot 1,
    and the patched SDK connected and received 4,426 header-50 / 104-byte
    notifications, 17,704 acceleration samples and 17,704 Euler samples over
    approximately 92 seconds, with 148 serial-discontinuity callbacks and no
    unexpected disconnect observed. The reported application firmware fields
    were again version 3.1, date 2026-01-25, patch 1. During the follow-up
    second-slot search, only the paired, connected CR-3 was visible. Waking
    the other physical unit (B) and connecting it remains pending.

**Single-device discovery and 104-byte decoding are verified on this host.**
The second physical device, simultaneous two-device streaming, reversed order,
and GAME-HURDLE movement controls remain unverified. A device-isolation trial is
needed to identify the second unit. These observations establish an SDK/FW
compatibility mismatch; they do not establish a dated firmware regression.

## Remaining hardware check

1. Keep A connected and stationary, then have the user wake the other physical
   unit (B). Compare candidate presence before and after waking B, and record
   its firmware version fields if connectable. Do not equate a browser slot
   number with a particular physical CORE until the mapping is established.
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

The manual page reads device information and optional firmware-name metadata,
then subscribes to sensor values
without writing settings, synchronizing time, enabling recording, or updating
firmware. Its all-device chooser is diagnostic-only and does not connect a
selected device. It does not load BleSharedBridge or use remembered-device
selection, so the patched discovery and parser are exercised directly.
