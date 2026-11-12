'use strict';

const byId = id => document.getElementById(id);
const input = byId('input');
const share = byId('share');
const save = byId('save');
const photo = byId('photo');
const status = byId('status');
const maxSide = 2048;
const jpegQuality = 0.84;
let outputUrl;
let outputFile;
let selection = 0;

const number = new Intl.NumberFormat(appLocale.locale, { maximumFractionDigits: 2 });
function formatSize(bytes) {
  return bytes >= 1_000_000
    ? number.format(bytes / 1_000_000) + ' MB'
    : number.format(bytes / 1000) + ' KB';
}

function targetSize(width, height) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

async function makeJpeg(file) {
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    image.src = sourceUrl;
    await image.decode();
    const [width, height] = targetSize(image.naturalWidth, image.naturalHeight);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);
    const jpeg = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob?.type === 'image/jpeg') resolve(blob);
        else reject(new Error(appLocale.text('JPEG non disponibile')));
      }, 'image/jpeg', jpegQuality);
    });
    return { jpeg, width, height };
  } finally {
    URL.revokeObjectURL(sourceUrl);
    canvas.width = canvas.height = 1;
  }
}

function clearResult() {
  byId('result').hidden = true;
  byId('preview').hidden = true;
  byId('empty').hidden = false;
  photo.removeAttribute('src');
  save.removeAttribute('href');
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = undefined;
  outputFile = undefined;
}

byId('choose').addEventListener('click', () => input.click());
input.addEventListener('change', async () => {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  const current = ++selection;
  clearResult();
  status.textContent = appLocale.text('Preparo il JPG…');
  try {
    const { jpeg, width, height } = await makeJpeg(file);
    if (current !== selection) return;
    const name = (file.name.replace(/\.[^.]+$/, '') || 'foto') + '-juice.jpg';
    outputFile = new File([jpeg], name, { type: 'image/jpeg' });
    outputUrl = URL.createObjectURL(outputFile);
    photo.src = outputUrl;
    save.href = outputUrl;
    save.download = name;
    share.hidden = !(navigator.share && navigator.canShare?.({ files: [outputFile] }));
    byId('weights').textContent = formatSize(file.size) + ' → ' + formatSize(jpeg.size);
    byId('dimensions').textContent = width + ' × ' + height + ' px · JPG';
    const percent = Math.round((jpeg.size / file.size - 1) * 100);
    const change = byId('change');
    change.textContent = (percent < 0 ? '−' : percent > 0 ? '+' : '') + Math.abs(percent) + '%';
    change.toggleAttribute('data-larger', percent > 0);
    status.textContent = percent > 0 ? appLocale.text('Il JPG pesa più dell’originale.') : '';
    byId('empty').hidden = true;
    byId('preview').hidden = false;
    byId('result').hidden = false;
  } catch {
    if (current === selection) status.textContent = appLocale.text('Non riesco ad aprire questa immagine. Prova con un JPG, WebP o PNG.');
  }
});

share.addEventListener('click', async () => {
  if (!outputFile) return;
  const current = selection;
  try {
    await navigator.share({ files: [outputFile] });
  } catch (error) {
    if (current === selection && error.name !== 'AbortError') {
      status.textContent = appLocale.text('Condivisione non riuscita. Puoi usare Salva JPG.');
    }
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);

(() => {
  const panel = document.getElementById('juiceInstallPanel');
  const button = document.getElementById('juiceInstallButton');
  const status = document.getElementById('juiceInstallStatus');
  const appMode = matchMedia('(display-mode: standalone)');
  let installPrompt = null;
  let installedHere = false;

  function updatePanel() {
    panel.hidden = installedHere || appMode.matches || navigator.standalone === true;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    status.textContent = '';
  });
  window.addEventListener('appinstalled', () => {
    installedHere = true;
    installPrompt = null;
    updatePanel();
  });
  appMode.addEventListener('change', updatePanel);
  updatePanel();

  button.addEventListener('click', async () => {
    const prompt = installPrompt;
    if (!prompt) {
      status.textContent = appLocale.text('In Chrome apri il menu ⋮ e scegli «Aggiungi a schermata Home» o «Installa app», se disponibile.');
      return;
    }
    installPrompt = null;
    button.disabled = true;
    status.textContent = '';
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        installedHere = true;
        updatePanel();
      }
    } catch {
      status.textContent = appLocale.text('Il browser non ha aperto la richiesta. Riprova dal menu ⋮.');
    } finally {
      button.disabled = false;
    }
  });
})();
