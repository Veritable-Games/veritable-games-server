# Mobile Testing with Chrome DevTools

**Simplest way to test responsive design and touch interactions locally.**

## Quick Start (30 seconds)

### 1. Start dev server
```bash
cd frontend
npm run dev
```

### 2. Open Chrome and go to localhost
```
http://localhost:3000  (or the port shown in terminal)
```

### 3. Enable mobile emulation
```
F12  (or right-click → Inspect)
```

### 4. Toggle device toolbar
```
Ctrl + Shift + M  (or click device icon in DevTools)
```

### 5. Select device
- iPhone 12 (390x844)
- Pixel 5 (393x851)
- iPad (768x1024)
- Or any custom size

Done! Now test touch and responsive design.

---

## Testing Touch Interactions

| What You Do | Result |
|---|---|
| **Click** | Tap |
| **Drag** | Swipe |
| **Right-click + drag** | Pinch zoom |
| **Scroll wheel** | Scroll/swipe |

---

## Testing Different Sizes

### Preset devices
- Click dropdown under "Responsive" → Select: iPhone 12, Pixel 5, iPad, etc.

### Custom size
- Click "Responsive" dropdown → Edit list → Add custom width/height

### Rotate device
- Click rotate icon (top right of viewport) to switch portrait ↔ landscape

---

## Network Throttling (Optional)

Simulate slow networks:

1. Open DevTools (F12)
2. Go to **Network** tab
3. Top left dropdown (says "No throttling")
4. Select: Fast 4G, Slow 4G, 3G, etc.
5. Reload page to test

---

## Testing on Real Device (Even Better)

If you have a phone:

```bash
# Install scrcpy (one time)
sudo apt-get install scrcpy

# Connect phone via USB
scrcpy

# On phone, open browser and go to:
http://192.168.1.175:3000  (your laptop IP)
```

Now you can actually **touch** the screen with your finger. Most realistic testing!

---

## Quick Reference

| Task | How |
|---|---|
| Open DevTools | F12 |
| Toggle mobile view | Ctrl + Shift + M |
| Change device | Click device dropdown |
| Rotate | Click rotate icon |
| Throttle network | Network tab → Throttling dropdown |
| Test on real phone | `scrcpy` + `http://192.168.1.175:3000` |
| View console logs | Console tab |
| Debug JavaScript | Sources tab |

---

## That's It!

No complex setup, no slow emulators. Just Chrome DevTools built-in mobile testing.

For detailed Chrome DevTools docs: https://developer.chrome.com/docs/devtools/device-mode/
