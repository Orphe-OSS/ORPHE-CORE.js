# 110m Hurdle Game

ORPHE COREを足に装着して走る動きで進み、ハードルを越えてゴールを目指すVirtual Sports Exampleです。

## What It Does

- Uses ORPHE CORE motion and gait data as the game input.
- Shows a 110m hurdle race as a browser game.
- Provides the flagship example for the Virtual Sports category.

## このExampleで学べること

- ORPHE COREの歩行・走行データをゲーム入力に使う方法
- 2台のORPHE COREを使った足の動きの扱い
- 身体動作をそのまま競技型インターフェースにする考え方

## 使うデータ

- `gotConvertedAcc`
- `gotEuler`
- Gait Analysis data

## 必要なORPHE CORE数

- 2台

## Run

ローカルサーバを起動して、Chromeで開きます。

```text
http://localhost:8767/examples/GAME-HURDLE/
```

## Public Position

This is the current public representative for the Virtual Sports category.
Other sprint / hurdle variants should be promoted only after README cleanup,
thumbnail capture, and real-device validation.

## Related Examples

- `examples/GAME-HURDLE-VS/`
- `examples/GAME-HURDLE-400M-VS/`
- `examples/GAME-SPRINT-100M-VS/`
