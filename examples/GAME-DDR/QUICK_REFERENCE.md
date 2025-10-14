# 🎮 ORPHE DDR GAME - Quick Reference Guide

## 🚀 Quick Start (5 Steps)

1. **Open the game**: Navigate to `/examples/GAME-DDR/index.html`
2. **Select difficulty**: Choose Easy, Medium, or Hard
3. **Connect ORPHE** (optional): Use toolkit to connect devices
4. **Click START**: Begin playing
5. **Hit arrows**: Press keys or step when arrows reach the line

---

## ⌨️ Keyboard Controls

```
←  →  Left/Right lanes
↑     Up lane  
↓     Down lane
```

---

## 👟 ORPHE CORE Steps

```
Direction 0 (Left step)    → ← lane
Direction 2 (Forward)      → ↑ lane
Direction 4 (Backward)     → ↓ lane
Direction 6 (Right step)   → → lane
```

---

## 📊 Scoring Cheat Sheet

| Judgment | Timing | Points | Effect |
|----------|--------|--------|--------|
| PERFECT  | ±50ms  | 100    | Combo + |
| GOOD     | ±100ms | 50     | Combo + |
| OK       | ±150ms | 25     | Combo + |
| MISS     | >150ms | 0      | Combo reset |

**Combo Bonus**: `floor(combo/10) × 10` extra points

---

## ⚙️ Recommended Settings

### For Beginners
- Note Speed: 300 px/s
- Judge Window: 150ms
- Chart: Sample (Easy)

### For Intermediate
- Note Speed: 400 px/s
- Judge Window: 100ms
- Chart: Medium

### For Experts
- Note Speed: 500-600 px/s
- Judge Window: 50-75ms
- Chart: Hard

---

## 🎵 Adding Your Own Music

1. Place MP3 file in `music/` folder
2. Edit `main.js` line ~234:
   ```javascript
   const musicPath = `music/your-song.mp3`;
   ```
3. Create matching chart JSON in `assets/charts/`
4. Add option to chart selector in `index.html`

---

## 🛠️ Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Notes don't appear | Check chart file path, open console |
| ORPHE won't connect | Enable Bluetooth, refresh page |
| Timing feels off | Adjust chart offset value |
| Input lag | Close other browser tabs, check CPU |
| Audio won't play | Check file exists, check browser audio permissions |

---

## 📁 Important Files

```
index.html       - Open this in browser
main.js          - Game logic & ORPHE integration
game/render.js   - Visual customization
assets/charts/   - Add new charts here
style.css        - UI customization
README.md        - Full documentation
```

---

## 🎨 Quick Customization

### Change Arrow Colors
Edit `game/render.js` line 24:
```javascript
this.arrowColors = ['#FF4444', '#44FF44', '#4444FF', '#FFAA00'];
```

### Change Background
Edit `game/render.js` `drawBackground()` function

### Change Scoring
Edit `game/player.js` line 92-119 (processHit function)

---

## 🐛 Debug Commands

Open browser console (F12) and try:

```javascript
// Check game state
game.state()

// View ORPHE data
game.orpheData

// Check current chart
game.chartManager.getInfo()

// View player stats
game.playerManager.getResults()
```

---

## 📝 Creating a Simple Chart

```json
{
  "name": "Test",
  "bpm": 120,
  "offset": 0,
  "notes": [
    { "time": 1.0, "lane": 0 },
    { "time": 1.5, "lane": 1 },
    { "time": 2.0, "lane": 2 },
    { "time": 2.5, "lane": 3 }
  ]
}
```

Save as `assets/charts/test.json`

---

## 🎯 Achievement Guide

Try these challenges:

- ✨ **Full Combo**: Complete chart without missing
- 🔥 **Perfect Play**: All PERFECT judgments
- 🏃 **Speed Demon**: Beat Hard at 600 px/s
- 👟 **Pure ORPHE**: Complete using only steps
- 🎵 **Marathon**: Play all 3 charts in sequence

---

## 🌐 Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome  | ✅ Recommended |
| Firefox | ✅ Works |
| Safari  | ✅ Works |
| Edge    | ✅ Works |
| Mobile  | ⚠️ Limited (no ORPHE) |

---

## 💡 Pro Tips

1. **Watch the notes early**: Don't focus on the hit line
2. **Use peripheral vision**: See all lanes at once
3. **Relax**: Tension leads to mistiming
4. **Practice rhythm**: Count beats mentally
5. **Adjust settings**: Find what works for you
6. **Calibrate ORPHE**: Stand naturally for best results

---

## 📞 Need Help?

1. Check `README.md` for detailed documentation
2. Open browser console for error messages
3. Review `CHANGELOG.md` for technical details
4. Check ORPHE-CORE.js main documentation

---

**Version**: 1.0.0  
**Last Updated**: October 14, 2025  
**Ready to Play!** 🎉
