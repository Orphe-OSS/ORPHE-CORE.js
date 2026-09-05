# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions before 1.4.0 are summarized in the "Version" section of [README.md](./README.md)
and the "Version History" section of [CLAUDE.md](./CLAUDE.md).

## [Unreleased]

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
