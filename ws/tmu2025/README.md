# TMU 2025 Workshop Gallery

This directory is a gallery of student / workshop projects made with ORPHE CORE.

## What It Does

- Shows multiple workshop works in one gallery page.
- Links to individual project pages under `ws/tmu2025/apps/`.
- Provides a reference for what people can build with ORPHE CORE in a workshop.

## Requirements

Most pages are project showcases. Some individual apps may require:

- Chrome with Web Bluetooth support.
- One or two ORPHE CORE modules.
- Local server such as `python3 -m http.server 8767`.

## Run

Open:

```text
http://localhost:8767/ws/tmu2025/
```

## Validation

Needs human review before promotion from `public-candidate` to `public`.

Checks that do not require ORPHE CORE:

- Gallery opens.
- Project cards/images load.
- Links to individual project pages work.
- The page reads as a workshop gallery, not as a single maintained example.

Checks that may require ORPHE CORE:

- Individual apps that use BLE should be tested separately in Chrome.

## Notes

- Treat this as `workshop-archive`.
- Strong individual works can later be split into standalone catalog entries if
  they are maintained and documented.
