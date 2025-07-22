// === Configuration ===
const WS_URL = "wss://your-backend.example.com/integrity";  // Replace with your WebSocket URL
const OCR_INTERVAL_MS = 10000;                            // milliseconds between OCR checks
const OFFSCREEN_THRESHOLD_MS = 3000;                       // gaze off-screen duration threshold
const FORBIDDEN_KEYWORDS = ['ChatGPT','notepad','.pdf','Slack','Zoom'];

// === WebSocket Setup ===
const socket = new WebSocket(WS_URL);
socket.addEventListener('open', () => console.log("WebSocket connected"));
socket.addEventListener('error', e => console.error("WebSocket error", e));

// === OCR Initialization ===
let ocrWorker;
async function initOCR() {
  ocrWorker = Tesseract.createWorker();
  await ocrWorker.load();
  await ocrWorker.loadLanguage('eng');
  await ocrWorker.initialize('eng');
}

// === Start Full‐Screen Screen Share ===
async function startScreenShare() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'monitor', width:{ideal:1920}, height:{ideal:1080} }
    });
    document.getElementById('screenVideo').srcObject = stream;
  } catch (err) {
    console.error('Screen share failed:', err);
    alert('Please share your entire screen to proceed.');
  }
}

// === OCR Check Function ===
async function checkScreen() {
  const video = document.getElementById('screenVideo');
  if (!video.videoWidth) return;
  const canvas = document.getElementById('captureCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const { data:{ text } } = await ocrWorker.recognize(canvas);
  if (FORBIDDEN_KEYWORDS.some(k => text.includes(k))) {
    socket.send(JSON.stringify({ type:'overlay', timestamp:Date.now(), detail:text }));
    console.warn('Unauthorized content detected:', text);
  }
}

// === Gaze Tracking & Off-Screen Detection ===
let offscreenStart = null;
async function initGaze() {
  await webgazer.setGazeListener(data => {
    if (!data) return;
    const x = data.x, y = data.y;
    const inViewport = x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight;
    if (!inViewport) {
      offscreenStart = offscreenStart || Date.now();
      if (Date.now() - offscreenStart > OFFSCREEN_THRESHOLD_MS) {
        socket.send(JSON.stringify({ type:'gaze-offscreen', timestamp:Date.now() }));
        offscreenStart = Date.now();
      }
    } else {
      offscreenStart = null;
    }
  }).begin();
}

// === Module Launcher ===
window.addEventListener('load', async () => {
  await initOCR();
  await startScreenShare();
  await initGaze();
  setInterval(checkScreen, OCR_INTERVAL_MS);
});