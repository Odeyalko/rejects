let items = [];
let tempImages = [];

// Обработка перетаскивания
const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.style.borderColor = '#007bff';
});
dropzone.addEventListener('dragleave', () => {
  dropzone.style.borderColor = '#ccc';
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.style.borderColor = '#ccc';
  handleFiles(e.dataTransfer.files);
});

// Ctrl+V
document.addEventListener('paste', (e) => {
  if (e.clipboardData && e.clipboardData.items) {
    const items = [...e.clipboardData.items];
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      handleFiles([imageItem.getAsFile()]);
    }
  }
});

// Обработка файлов
function handleFiles(files) {
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      tempImages.push(e.target.result);
    };
    reader.readAsDataURL(file);
  }
}

// Обработка изображений
async function processImages() {
  if (!tempImages.length) return;

  const vision = await window.FileFromPath.loadVisionTasks();
  const ocr = vision.ImageToTextRecognizer.create();

  for (const imgData of tempImages) {
    const img = new Image();
    img.src = imgData;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const text = await ocr.recognize(canvas);
    parseText(text.text);
  }

  sortItems();
  renderResults();
  tempImages = [];
}

// Парсинг текста
function parseText(text) {
  const lines = text.split('\n').filter(Boolean);
  for (const line of lines) {
    const match = line.match(/(SLM\d+|WR\d+)\s+(Ячейка \d+-\d+-\d+|Полка \d+-\d+)/i);
    if (match) {
      items.push({ code: match[1], location: match[2], found: false });
    }
  }
}

// Сортировка
function sortItems() {
  items.sort((a, b) => {
    const numA = a.location.match(/\d+/g).map(Number);
    const numB = b.location.match(/\d+/g).map(Number);
    return numA.join('') - numB.join('');
  });
}

// Рендер результатов
function renderResults() {
  const results = document.getElementById('results');
  results.innerHTML = items.map(item => `
    <div class="item ${item.found ? 'found' : ''}">
      ${item.code} — ${item.location}
    </div>
  `).join('');
}

// Сканирование камеры
async function toggleCamera() {
  const container = document.getElementById('camera-container');
  const video = document.getElementById('scanner-video');
  container.classList.toggle('hidden');

  if (!container.classList.contains('hidden')) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    startScanning(video);
  }
}

// Сканирование штрихкода
async function startScanning(video) {
  const vision = await window.FileFromPath.loadVisionTasks();
  const barcodeScanner = vision.BarcodeScanner.create();

  const scanLoop = async () => {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const results = await barcodeScanner.scan(video);
      for (const result of results) {
        const code = result.rawValue;
        if (code && items.some(i => i.code === code)) {
          items = items.map(i => i.code === code ? { ...i, found: true } : i);
          renderResults();
        }
      }
    }
    requestAnimationFrame(scanLoop);
  };
  scanLoop();
}

// Сброс
function resetAll() {
  items = [];
  document.getElementById('results').innerHTML = '';
}

// Обработка громкости как сканер
document.addEventListener('keydown', (e) => {
  if (e.code === 'AudioVolumeDown') {
    e.preventDefault();
    toggleCamera();
  }
});
