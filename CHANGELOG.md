# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions before 1.4.0 are summarized in the "Version" section of [README.md](./README.md)
and the "Version History" section of [CLAUDE.md](./CLAUDE.md).

## [Unreleased]

### Fixed

- **Header 50 (CORE 1.x / 3.0 200 Hz `SENSOR_VALUES`) quaternion is now normalized by its actual norm** instead of being divided by a fixed 32768 (Q15). Real-device raw packets (CORE 3.0, 2026-09-05, 1827 packets) carry a **Q14** quaternion (|q| median 16383, 1.0 = 16384), so the old code halved every component and `gotEuler.yaw` came out at roughly **0.2× the true angle** (a 90° turn read as 15–21°). `gotQuat` now always delivers a unit quaternion regardless of the firmware's fixed-point scale (Q14 or Q15 — which one CORE 1.x uses is unknown, so the fix is scale-agnostic). A zero/degenerate quaternion keeps the previous orientation (identity on the first packet) instead of producing NaN. The header 40 (CORE 2.0) path already used `quatScale = 16384` plus `.normalize()` and is unchanged. Test: `tests/core-quat-normalize-header50.test.js`.
- **Header 50 (CORE 1.x / 3.0 200 Hz `SENSOR_VALUES`) per-sample timestamps are now `t_base − delta_k`** (k = 0, 1, 2 from bytes 28 / 49 / 70), and block 3 — the oldest sample, which has no delta byte (offset 91 is not a delta) — is `t_base − delta_2 − (delta_1 − delta_0)` (= −19 ms with the observed deltas; nominal −20 ms). Real-device raw packets (CORE 3.0, 2026-09-05, 1827 packets) show constant deltas 5 / 10 / 14 ms and consecutive base timestamps advancing 19–20 ms, so the delta is an **age relative to the base timestamp**, and the sample order is block 3 → 2 → 1 → 0 (oldest → newest, established by gyro continuity). The old code added the deltas cumulatively starting from block 3 = `t_base` (0 / +14 / +24 / +29): wrong sign and wrong accumulation, giving intra-packet dt of 14 / 10 / 5 ms and the first sample of the next packet jumping **back by ~9 ms**; integrating gyro against those timestamps inflated angles by ~1.4×. Dispatch order (i = 3 → 0, chronological) and `packet_number = 3 − i` (0 = oldest) are unchanged; the corrected timestamp is applied to `quat` / `gyro` / `acc` / `converted_gyro` / `converted_acc`. Test: `tests/core-header50-sample-timestamps.test.js`. Note: ORPHE-INSOLE.js `parseInsoleSensorValues` (header 50 branch) has the same accumulation pattern and should be checked separately.
- **Accelerometer range index 0 (±2 G) was converted as ±8 G, so `gotConvertedAcc` / `converted_acc` were 4× too large at ±2 G.** Both `SENSOR_VALUES` parse paths (header 50 and header 40) mapped the `device_information.range` index to a full-scale value with an `if` chain without `else` (`if (r == 0) r = 2; if (r == 1) r = 4; if (r == 2) r = 8; …`), so index 0 became 2 and then also matched `== 2` → 8. The gyro chain (250 / 500 / 1000 / 2000) happened not to collide but had the same fragile shape. Both are now lookup tables — `ORPHE_CORE_ACC_RANGE_G = [2, 4, 8, 16]` and `ORPHE_CORE_GYRO_RANGE_DPS = [250, 500, 1000, 2000]` via `orpheCoreRangeIndexToValue(indexOrValue, table)` (module scope). Indexes 1–3 and all gyro results are unchanged; non-index values (e.g. a full-scale value passed directly) still pass through as before. `begin()`'s value → index conversion reads the caller's `range` and writes `obj.range`, so it was not affected and is unchanged. Test: `tests/core-acc-range-mapping.test.js`.

## [1.4.0] - 2026-08-30

### Changed

- **Converted gyro values (`gotConvertedGyro` / `converted_gyro`) now use the per-range LSM6DSOX datasheet sensitivity instead of the ideal Q15 full scale.** Previously `converted_gyro = (raw / 32768) * range`, which corresponds to 61.035 mdps/LSB at ±2000 dps. The sensor's representative sensitivity is 0.035 mdps/LSB per 1 dps of full scale:

  | Gyro range | Sensitivity | deg/s per LSB |
  |---|---|---|
  | ±250 dps | 8.75 mdps/LSB | 0.00875 |
  | ±500 dps | 17.5 mdps/LSB | 0.0175 |
  | ±1000 dps | 35 mdps/LSB | 0.035 |
  | ±2000 dps | 70 mdps/LSB | 0.07 |

  Converted values are therefore **about 14.7% larger than before at ±2000 dps** (new/old ratio 1.14688 = 0.07 / (2000/32768); equivalently, the old formula under-reported by about 12.8%). The same ratio applies at every range for header 50. This mirrors the identical fix shipped in ORPHE-INSOLE.js v1.3.2. Both SENSOR_VALUES packet layouts are covered: header 50 (CORE 1.x, int16 samples) and header 40 (CORE 2.0, int8 samples). For header 40 the int8 payload is treated as the high byte of the int16 raw value (multiplied by 256) before applying the sensitivity, so header 40 and header 50 now yield the same deg/s for the same physical rate (e.g. int8 0x40 and int16 0x4000 both give 1146.88 deg/s at ±2000 dps). Because the old header-40 code normalized by int8/127 rather than by the int16 scale, its change is a slightly different ratio: **1.13792 (about +13.8%)**. The old code's two paths disagreed with each other by about 0.8%; they now agree. The helper `orpheCoreGyroRawToDps(raw, rangeDps)` and the constant `ORPHE_CORE_GYRO_DPS_PER_LSB_PER_RANGE` are exposed at module scope.
- The **normalized gyro callback `gotGyro` (raw / 32768, or int8 / 127 for header 40) is unchanged** for backward compatibility, and the accelerometer conversion (`raw / 32768 * range`, which already matches the datasheet 0.488 mg/LSB at ±16 G) is unchanged.
- Version bumped to 1.4.0 (`@version` in `js/ORPHE-CORE.js`, README version notes, CLAUDE.md version history, CITATION.cff). The usage policy described in README.md applies from this version.

### Added

- `tests/core-gyro-scale.test.js` — deterministic Node regression test for the gyro scale (per-range sensitivity, normalized callback unchanged, acc unchanged, header 40 path, ratio guard against the old ideal-Q15 formula) and `npm test` script that runs `node --check` plus the Node tests.
- `CHANGELOG.md` (this file).
