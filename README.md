# 🎵 Souler Web — AI Live Speaker

> A production-ready single-page web app that mimics the **Souler AI Live Speaker** experience — powered entirely by browser technologies. Upload any character image, blast some music, and watch your companion dance, react, and chat in real time.

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blueviolet)](manifest.json)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow)](app.js)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🖼️ **Custom Character** | Upload any PNG/JPG/GIF/WEBP image — it becomes your animated companion |
| 🕺 **Dance Mode** | Real-time beat-reactive bouncing, swaying, scaling, and rotation |
| 😴 **Idle Mode** | Gentle breathing, floating, and eye-blinking animation |
| 🎶 **Music Reactive** | Web Audio API beat/energy detection drives all animations and particle effects |
| 🎤 **Voice Commands** | Full hands-free control via Web Speech Recognition |
| 🤖 **AI Chat** | Voice or text chat with any OpenAI-compatible API (ChatGPT, Grok, etc.) |
| 🌍 **Env Mic** | Microphone listens for ambient music → auto-switches to Music mode |
| 🌈 **Particles** | Reactive particle network that pulses with the beat |
| 📱 **PWA** | Add to home screen for a native-app-like experience |
| ⚙️ **Settings Panel** | API key, model, volume, sensitivity, theme, animation speed |

---

## 🚀 Quick Start

### Option 1 — Open directly in browser
```bash
# Clone the repo
git clone https://github.com/khannover/souler-web.git
cd souler-web

# Open index.html in any modern browser
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

### Option 2 — Local dev server (recommended for microphone / Service Worker)
```bash
# Python 3
python3 -m http.server 8080

# OR Node.js
npx serve .

# OR VS Code Live Server extension
```
Then visit **http://localhost:8080** in your browser.

> ⚠️ Microphone access and Service Workers require a secure context (`https://` or `localhost`).

### Option 3 — Deploy to GitHub Pages
1. Push to your repo's `main` branch
2. Go to **Settings → Pages → Deploy from branch → `main` → `/` (root)**
3. Your app is live at `https://yourusername.github.io/souler-web/`

---

## 📱 Install as PWA (Add to Home Screen)

### iOS Safari
1. Open the site in Safari
2. Tap the **Share** button (square with arrow)
3. Tap **"Add to Home Screen"**
4. Tap **Add**

### Android Chrome
1. Open the site in Chrome
2. Tap the **⋮** menu → **"Add to Home Screen"** (or the install banner)
3. Tap **Install**

---

## 🎮 How to Use

### 1. Upload Your Character
- Tap the **upload area** in the center of the screen, or tap the character canvas
- Choose any PNG, JPG, GIF, or WEBP image
- Your image immediately becomes the animated character!
- To change it: go to **Settings → Upload New Character**

### 2. Play Music
- Tap the **🎵 load button** (music note icon) to open a local audio file
- Or paste an audio URL into the URL field and tap **Load**
- Hit **▶ Play** to start — your character will automatically enter Music mode!

### 3. Voice Commands
Tap the **VOICE** button or press **V** on keyboard, then speak a command:

| Command | Action |
|---|---|
| `"dance"` / `"let's dance"` | Enter dance mode |
| `"idle"` / `"chill"` / `"rest"` | Enter idle mode |
| `"play"` / `"play music"` | Start playback |
| `"pause"` / `"stop music"` | Pause playback |
| `"stop"` | Stop & reset playback |
| `"volume up"` / `"louder"` | Increase volume by 10% |
| `"volume down"` / `"quieter"` | Decrease volume by 10% |
| `"mute"` / `"silence"` | Mute audio |
| `"unmute"` | Restore volume |
| `"chat"` / `"hey souler"` | Open AI chat |
| `"settings"` | Open settings panel |
| `"listen"` / `"microphone"` | Start environmental mic |
| `"spin"` / `"rotate"` | Spin animation |
| `"flash"` / `"light up"` | Flash glow effect |
| `"shake"` / `"tremble"` | Shake animation |
| `"close"` / `"cancel"` | Close any open panel |

### 4. Environmental Mic
- Tap **ENV MIC** to start listening to the room
- Souler will automatically detect music and switch to Music/Dance mode
- When the music stops, it returns to Idle mode

### 5. AI Chat
- Tap **CHAT** or say `"chat"` / `"hey souler"`
- Type a message or tap the 🎤 button to speak
- Set your API key in **Settings** first

---

## ⚙️ Settings

Open with the gear icon ⚙️ or press **S**.

| Setting | Description |
|---|---|
| **API Key** | Your OpenAI / Grok / compatible API key |
| **API Base URL** | Endpoint URL (default: `https://api.openai.com/v1`) |
| **Model** | Model name (e.g., `gpt-4o-mini`, `grok-3`) |
| **Volume** | Master audio volume |
| **Beat Sensitivity** | How reactive the character is to audio energy |
| **Accent Theme** | Color scheme: Neon Cyan, Hot Pink, Purple, Green, Gold |
| **Animation Speed** | Speed multiplier for all animations |
| **Character Image** | Re-upload or change your character |
| **AI System Prompt** | Customize Souler's personality |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `D` | Toggle Dance / Idle |
| `V` | Start voice command |
| `C` | Open chat panel |
| `M` | Toggle microphone |
| `S` | Open settings |
| `Esc` | Close panels |

---

## 🎨 Customization Tips

### Change the Accent Color
Pick from 5 built-in themes in Settings, or add your own by editing `style.css`:
```css
:root {
  --accent: #ff6b35;        /* your custom color */
  --accent-rgb: 255, 107, 53;
}
```

### Custom AI Personality
Set a custom System Prompt in Settings:
```
You are Voxel, an edgy DJ AI. You speak in short punchy sentences, love house music, and always end with a 🔥 emoji.
```

### Adjust Beat Detection
Increase **Beat Sensitivity** in Settings for more reactive dancing (especially for quieter tracks or ambient listening).

### Custom Characters
Works great with:
- Anime-style character illustrations
- Cartoon avatars
- Transparent PNG stickers
- Your own photo!
- Animated GIFs (first frame is used for the canvas drawing)

---

## 🏗️ Project Structure

```
souler-web/
├── index.html              # Main SPA — full UI layout
├── style.css               # Dark cyberpunk theme, animations, responsive
├── app.js                  # Core logic: audio, animation, voice, AI chat
├── sw.js                   # Service Worker for PWA / offline support
├── manifest.json           # PWA manifest (icons, display, theme)
├── assets/
│   ├── placeholder-character.png   # Default character (when none uploaded)
│   ├── icon-192.png                # PWA icon 192×192
│   └── icon-512.png                # PWA icon 512×512
├── LICENSE                 # MIT License
└── README.md               # This file
```

---

## 🔧 Technical Stack

| Technology | Usage |
|---|---|
| **Vanilla HTML5 + CSS3 + JS** | No framework dependencies |
| **Web Audio API** | Beat detection, frequency analysis, energy normalization |
| **Canvas 2D API** | Character rendering, animation, glow effects |
| **Web Speech API** | Voice command recognition + TTS responses |
| **SpeechSynthesis API** | Souler speaks back to you |
| **MediaDevices API** | Environmental microphone access |
| **Tailwind CSS (CDN)** | Utility-first styling |
| **Service Worker** | PWA offline caching |
| **Fetch API** | OpenAI-compatible AI chat integration |
| **localStorage** | Settings persistence |

---

## 🔌 AI Integration

Souler supports any **OpenAI-compatible API**. In Settings, set:

| Service | API Base URL | Model |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| xAI Grok | `https://api.x.ai/v1` | `grok-3-mini` |
| Groq | `https://api.groq.com/openai/v1` | `llama3-8b-8192` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3` |
| LM Studio | `http://localhost:1234/v1` | any local model |

> Your API key is stored **only in your browser** (`localStorage`) and never sent anywhere except your chosen API endpoint.

---

## 🚀 Future Improvements

- [ ] **Lip sync** — sync mouth animations to TTS audio output
- [ ] **Skeleton animation** — multi-point bone rigging for uploaded images
- [ ] **Multiple characters** — swap between saved character slots
- [ ] **Audio effects** — reverb, echo, pitch shift
- [ ] **Playlist support** — queue multiple tracks
- [ ] **Recording** — export character animation as video
- [ ] **Live2D integration** — richer 2D puppet animation
- [ ] **WebRTC** — live stream your Souler session
- [ ] **Custom voice** — clone a voice using ElevenLabs or similar API
- [ ] **3D mode** — Three.js character with depth and lighting
- [ ] **Multilingual voice commands** — detect and switch language automatically

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © 2025 Souler Web Contributors — see [LICENSE](LICENSE) for details.

---

<p align="center">Made with ❤️ and 🎵 — have fun dancing!</p>
