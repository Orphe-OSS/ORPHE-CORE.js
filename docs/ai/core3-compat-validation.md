# CORE 3.0 discovery and header-50 compatibility

## Scope

Branch: `fix/core3-discovery-packet-compat`, based on `origin/main` (`b2f6028`).
The change does not update device firmware. It adds discovery alternatives,
supports one known padded notification layout in the JavaScript SDK, and fixes
GAME-HURDLE's nested connection startup.

## Packet format evidence

The CORE 3.0 physical trials below received header-50 notifications of 104
bytes. The patched parser accepted these only after checking that bytes
92..103 were zero; each accepted notification produced the existing four-frame
sensor callbacks. Synthetic 92-byte and zero-padded 104-byte inputs also
produced equivalent decoded values, sample order and timestamps.

This covers one observed padded variant. It does not justify interpreting
arbitrary longer notifications, FIFO packets or other headers as header 50.
The existing 92-byte decoder and unit conversions are retained. These results
establish compatibility, not when or why a firmware change occurred.

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
Both game controls also use `forceDeviceSelection: true`: old remembered units
or a failed selected candidate must not silently replace a new manual choice.

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
- A test executes the game's actual toolkit initialization and passes its
  options into the real SDK scan path. Even with an old remembered CR-2, both
  controls open a new chooser, including when replacing a cached selection on
  a subsequent attempt. This test failed before adding the game options.
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
15. While the user kept the units moving, the previously mapped A appeared
    again. Used the toolkit's manual reselection helper for slot 2, selecting
    A while B stayed connected. Runtime inspection showed both `name: CR-3`,
    `connected: true`, and `secondary: false`, with finite acceleration and
    pitch updating in both game slots. Two observed snapshots approximately
    78 seconds apart showed both connected and updated sensor timestamps.
    This verifies live two-CORE-3.0 reception in the game, rather than retained
    UI values. It does not verify a worn movement/playthrough test.
16. Invoked the actual toolkit toggle handler with the new forced-selection
    option; it opened a fresh chooser and reconnected A while B stayed
    connected. Both subsequently reported connected and advancing serials.
    Then reloaded the updated HTML and used the ordinary two switches: both
    opened their own chooser and allowed B then A to be selected. B resumed
    reception; A's initial request subsequently failed while it was unavailable.
    After the user moved the units again, retried A using the ordinary switch
    and selected the mapped A. Both switches completed and showed live pitch
    and acceleration (approximately 1 G). This final trial used the reloaded
    HTML's actual forced-selection options, without a console connection call.

**Discovery and 104-byte decoding on both physical units, simultaneous streaming,
and live two-CORE-3.0 GAME-HURDLE reception in B -> A order are verified on this
host, including the final ordinary-switch reload/retry trial.** Worn
GAME-HURDLE movement controls remain unverified. These observations establish
an SDK/FW compatibility mismatch and a game initialization defect; they do not
establish a dated firmware regression.

## CORE 2.0 physical compatibility check (2026-11-11 JST)

Same host, browser and branch, using the local GAME-HURDLE page with
`STEP_ANALYSIS_AND_SENSOR_VALUES`. Two separate CR-2 candidates were displayed
and selected. Runtime inspection confirmed different browser device IDs,
both named CR-2, physically connected (`secondary: false`). Device identifiers
are omitted; CORE 2.0 firmware versions were not read.

Loaded the opt-in `tests/physical-game-probe.js` into the running game. It wraps
the existing read/sensor/error/disconnect callbacks, calls their originals,
and writes no device settings. Over 74.7 seconds of simultaneous reception:

| Slot | Sensor header / bytes | Notifications | Converted acc | Converted gyro | Quaternion / Euler | Nonfinite values | Disconnects | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 40 / 20 | 3,622 | 3,622 | 3,622 | 6,662 each | 0 | 0 | 0 |
| 1 | 40 / 20 | 3,632 | 3,632 | 3,632 | 6,650 each | 0 | 0 | 0 |

Both remained connected at the end. Sensor notification rates were approximately
48.5 and 48.6 per second. Each header-40 notification produced one converted
acceleration and gyroscope callback. Quaternion/Euler counts also include
STEP_ANALYSIS outputs because this game subscribes to both notification types.
The game displayed finite changing pitch and approximately 1.02 G at rest in
both slots. Stopped the probe to restore the original callbacks, then verified
that both toggles remained on and game values continued updating.

This verifies CORE 2.0 discovery, two-device game connection and header-40
decoding with the CORE 3.0 fixes present. It does not establish lossless delivery
or validate worn foot-stamp/jump detection. No CORE 2.0 code change was needed.

## Remaining hardware check

1. Test the local GAME-HURDLE page's acceleration and jump inputs with actual
   movements, and observe two-device continuity for at least 60 seconds.
2. Isolate the two-device transport degradation separately with matched
   device/order/host tests; do not attribute it to a foot or firmware yet.
3. Preserve an old 92-byte CORE physical regression check before publishing a
   release. The CORE 2.0 header-40 physical check above is complete for desk
   connection/reception behavior.

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

For an already connected example, the game probe can be loaded from DevTools:

```js
await import('/tests/physical-game-probe.js');
orpheGameProbe.snapshot();
orpheGameProbe.stop(); // restore original callbacks; reload for another run
```
