# CORE 3.0 discovery and header-50 compatibility

## Scope

Branch: `fix/core3-discovery-packet-compat`, based on `origin/main` (`b2f6028`).
The change does not update device firmware. It adds discovery alternatives,
supports one known padded notification layout in the JavaScript SDK, and fixes
GAME-HURDLE's nested connection startup.

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

## GAME-HURDLE initialization evidence

`onConnect(uuid)` fires when a GATT characteristic is obtained, not just once
per physical device. GAME-HURDLE counted these events as connected devices;
on the second event for the first CORE it called `begin()` on both instances
again. Chrome reproduced a second chooser attempt without a user gesture:
`SecurityError: Failed to execute 'requestDevice' on 'Bluetooth': Must be
handling a user gesture to show a permission request.`

The game now installs its acceleration/Euler handlers once and leaves each
connection and notification startup to the corresponding CoreToolkit toggle.
It no longer overrides `onConnect` to count events or start nested `begin()`.

## Automated validation

The new regression tests were run against the original implementation and
failed: name-only CR-3 discovery did not match, 104-byte data dispatched no
sensor callbacks, and repeated GATT events started two nested game connections.
With the fixes:

- `npm test`: all existing tests and all three new regression tests pass.
- Header 50: synthetic 92-byte and zero-padded 104-byte inputs produce identical
  acceleration, gyroscope, quaternion, converted values, Euler angles,
  timestamps, and four-sample order.
- Mixed 92/104 notifications preserve serial wraparound and gap reporting.
- Truncated, unknown-length and nonzero-padding packets do not affect parsed
  callbacks or the gap tracker. Raw `gotData` receives original notifications.
- Discovery still accepts existing service-based devices, supports name-only
  CR devices, rejects unrelated names/services, retains optional GATT services,
  and preserves the two-slot duplicate-device guard.
- GAME-HURDLE's actual inline handlers receive acceleration/Euler input from
  either slot independently. Repeated/reconnect GATT events start no additional
  `begin()` calls; callback routing and the shared jump cooldown are retained.
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
    second-slot search, only the paired, connected CR-3 was visible.
11. After the user shook the other unit (B), a separate CR-3 candidate appeared
    and connected in slot 2 while A remained connected. Both reported the
    application firmware fields above. Read settings were A: mount index 1,
    B: mount index 0; both battery index 1 and range indices acc=3, gyro=3.
    Both streamed header-50 / 104-byte notifications until manual disconnect:
    A had 18,095 notifications / 72,380 samples / 2,587 discontinuity callbacks
    over 435 seconds total (including the preceding single-device period);
    B had 5,554 notifications / 22,216 samples / 228 discontinuity callbacks
    over 118 seconds. Acceleration and Euler counts each equaled four times
    notifications, values were finite, and no unexpected disconnect occurred.
12. In an approximately 110-second simultaneous observation window, A's count
    advanced 15,212 -> 18,022 notifications and B's 223 -> 5,411, approximately
    25.5 and 47.2 notifications/s respectively. Their discontinuity-event
    counts rose by 1,874 and 213. A's reception degraded after B joined; this
    patch does not fix that transport limitation or identify its firmware/host
    cause. Gap events are not a count of missing packets.
13. On the local GAME-HURDLE page, connecting B first reproduced the
    no-user-gesture SecurityError described above. After changing the game's
    initialization and reloading, B connected and showed approximately 1 G and
    changing pitch before A connected. The SecurityError did not recur in the
    observed console; the remaining chooser-cancellation error resulted from
    manually cancelling the search for A when no separate candidate appeared.
    Waking A again and completing the B -> A game trial remains pending.
14. A later GAME-HURDLE page showed nonzero values for both slots and a finish
    result, but runtime inspection found both disconnected and remembered
    device names CR-2. Those retained values and the finish screen are not
    evidence of live two-CORE-3.0 gameplay. Cleared only the two remembered
    device entries and reloaded before selecting CR-3 again. One CR-3 connected
    and updated game values; an additional, unpaired CR-3 candidate failed with
    `NetworkError: Unsupported device`. That candidate was not established as
    the previously mapped physical A. Two-CORE-3.0 gameplay remains unverified.

**Discovery and 104-byte decoding on both physical units, including simultaneous
streaming, are verified on this host.** Reversed connection order and two-device
GAME-HURDLE movement controls remain unverified. These observations establish
an SDK/FW compatibility mismatch and a game initialization defect; they do not
establish a dated firmware regression.

## Remaining hardware check

1. Keep B connected in GAME-HURDLE and have the user wake A again, then connect
   A to the other slot to complete the reverse physical connection order.
2. Test the local GAME-HURDLE page's acceleration and jump inputs with actual
   movements, and observe two-device continuity for at least 60 seconds.
3. Isolate the two-device transport degradation separately with matched
   device/order/host tests; do not attribute it to a foot or firmware yet.
4. Preserve an old 92-byte CORE and a CORE 2.0 header-40 physical regression
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
