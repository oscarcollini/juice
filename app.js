'use strict';

const byId = id => document.getElementById(id);
const input = byId('input');
const choose = byId('choose');
const replace = byId('replace');
const share = byId('share');
const save = byId('save');
const photo = byId('photo');
const status = byId('status');
const maxSide = 2048;
const jpegQuality = 0.84;
let outputUrl;
let outputFile;
let originalWebp;
let replacement;
const canSelectFiles = typeof window.showOpenFilePicker === 'function' &&
  typeof window.showSaveFilePicker === 'function' &&
  typeof window.FileSystemHandle?.prototype.remove === 'function';
let selection = 0;

const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
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
        else reject(new Error('JPEG non disponibile'));
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
  originalWebp = undefined;
  replacement = undefined;
  replace.textContent = 'Sostituisci con JPG';
  replace.hidden = true;
}

choose.addEventListener('click', () => input.click());
input.addEventListener('change', async () => {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  const current = ++selection;
  clearResult();
  status.textContent = 'Preparo il JPG…';
  try {
    const { jpeg, width, height } = await makeJpeg(file);
    if (current !== selection) return;
    const name = (file.name.replace(/\.[^.]+$/, '') || 'foto') + '-juice.jpg';
    outputFile = new File([jpeg], name, { type: 'image/jpeg' });
    outputUrl = URL.createObjectURL(outputFile);
    if (/\.webp$/i.test(file.name) && (canSelectFiles || typeof window.showDirectoryPicker === 'function')) {
      originalWebp = file;
      replace.hidden = false;
    }
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
    status.textContent = percent > 0 ? 'Il JPG pesa più dell’originale.' : '';
    byId('empty').hidden = true;
    byId('preview').hidden = false;
    byId('result').hidden = false;
  } catch {
    if (current === selection) status.textContent = 'Non riesco ad aprire questa immagine. Prova con un JPG, WebP o PNG.';
  }
});

async function fileDigest(file) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
}

async function matchesFile(file, expectedSize, expectedDigest) {
  if (file.size !== expectedSize) return false;
  const digest = await fileDigest(file);
  return digest.every((byte, index) => byte === expectedDigest[index]);
}

async function getFileIfPresent(directory, name) {
  try {
    return await directory.getFileHandle(name);
  } catch (error) {
    if (error.name === 'NotFoundError') return null;
    throw error;
  }
}

async function writeVerifiedJpg(target, jpg) {
  const stream = await target.createWritable();
  try {
    await stream.write(jpg);
    await stream.close();
  } catch (error) {
    await stream.abort().catch(() => {});
    throw error;
  }
  const digest = await fileDigest(jpg);
  if (!await matchesFile(await target.getFile(), jpg.size, digest)) {
    throw new Error('Il JPG salvato non corrisponde alla conversione');
  }
  return digest;
}

function finishReplacement(name) {
  replace.hidden = true;
  originalWebp = undefined;
  replacement = undefined;
  status.textContent = 'Salvato «' + name + '» e rimosso il WebP.';
}

async function replaceInFolder() {
  const source = originalWebp;
  const jpg = outputFile;
  const destination = source.name.replace(/\.webp$/i, '.jpg');
  let saved = false;
  choose.disabled = replace.disabled = true;
  status.textContent = 'Scegli la cartella del WebP originale.';
  try {
    const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
    const original = await getFileIfPresent(directory, source.name);
    const digest = await fileDigest(source);
    if (!original || !await matchesFile(await original.getFile(), source.size, digest)) {
      status.textContent = 'In questa cartella non c’è il WebP che hai aperto.';
      return;
    }
    if (await getFileIfPresent(directory, destination)) {
      status.textContent = 'Esiste già «' + destination + '». Puoi usare Salva JPG per creare una copia.';
      return;
    }
    if (!window.confirm('Salvare «' + destination + '» e cancellare «' + source.name + '» dalla cartella scelta?')) {
      status.textContent = '';
      return;
    }
    if (await getFileIfPresent(directory, destination)) {
      status.textContent = 'Esiste già «' + destination + '».';
      return;
    }

    const target = await directory.getFileHandle(destination, { create: true });
    await writeVerifiedJpg(target, jpg);
    saved = true;
    const current = await getFileIfPresent(directory, source.name);
    if (!current || !await matchesFile(await current.getFile(), source.size, digest)) {
      status.textContent = 'JPG salvato. Il WebP è cambiato o non è più nella cartella.';
      return;
    }
    await directory.removeEntry(source.name);
    finishReplacement(destination);
  } catch (error) {
    status.textContent = saved
      ? 'JPG salvato, ma non sono riuscito a rimuovere il WebP.'
      : error.name === 'AbortError' ? '' : 'Sostituzione non riuscita. Il WebP è stato conservato.';
  } finally {
    choose.disabled = replace.disabled = false;
  }
}

async function replaceUsingFilePickers() {
  const source = originalWebp;
  const jpg = outputFile;
  choose.disabled = replace.disabled = true;
  try {
    if (!replacement) {
      status.textContent = 'Seleziona il singolo WebP, anche se si trova in Download.';
      const [original] = await window.showOpenFilePicker({
        startIn: 'downloads',
        types: [{ description: 'WebP', accept: { 'image/webp': ['.webp'] } }]
      });
      const digest = await fileDigest(source);
      if (original.name !== source.name || !await matchesFile(await original.getFile(), source.size, digest)) {
        status.textContent = 'Il file scelto è diverso dal WebP che hai aperto.';
        return;
      }
      replacement = { original, digest };
      replace.textContent = 'Salva JPG per sostituire';
      status.textContent = 'WebP verificato. Ora scegli dove salvare il JPG.';
      return;
    }

    if (!replacement.target) {
      const target = await window.showSaveFilePicker({
        startIn: 'downloads',
        suggestedName: source.name.replace(/\.webp$/i, '.jpg'),
        excludeAcceptAllOption: true,
        types: [{ description: 'JPG', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }]
      });
      if (!/\.jpe?g$/i.test(target.name) || await target.isSameEntry(replacement.original) ||
          (await target.getFile()).size !== 0) {
        status.textContent = 'Scegli un nuovo file JPG per conservare i file esistenti.';
        return;
      }
      const jpgDigest = await writeVerifiedJpg(target, jpg);
      Object.assign(replacement, { target, jpgDigest });
      replace.textContent = 'Rimuovi WebP originale';
      status.textContent = 'JPG salvato e verificato. Ora puoi rimuovere il WebP.';
      return;
    }

    const { original, digest, target, jpgDigest } = replacement;
    if (await original.requestPermission({ mode: 'readwrite' }) !== 'granted') {
      status.textContent = 'JPG salvato. Il browser non ha concesso il permesso di rimuovere il WebP.';
      return;
    }
    if (!await matchesFile(await target.getFile(), jpg.size, jpgDigest) ||
        !await matchesFile(await original.getFile(), source.size, digest)) {
      status.textContent = 'Uno dei file è cambiato. Il WebP è stato conservato.';
      return;
    }
    await original.remove();
    finishReplacement(target.name);
  } catch (error) {
    if (error.name === 'AbortError') status.textContent = replacement?.target ? 'JPG salvato. WebP conservato.' : '';
    else status.textContent = replacement?.target
      ? 'JPG salvato. Rimozione del WebP non riuscita.'
      : 'Sostituzione non riuscita. Il WebP è stato conservato.';
  } finally {
    choose.disabled = replace.disabled = false;
  }
}

replace.addEventListener('click', () => {
  if (!originalWebp || !outputFile || replace.disabled) return;
  return canSelectFiles ? replaceUsingFilePickers() : replaceInFolder();
});

share.addEventListener('click', async () => {
  if (!outputFile) return;
  const current = selection;
  try {
    await navigator.share({ files: [outputFile] });
  } catch (error) {
    if (current === selection && error.name !== 'AbortError') {
      status.textContent = 'Condivisione non riuscita. Puoi usare Salva JPG.';
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
      status.textContent = 'In Chrome apri il menu ⋮ e scegli «Aggiungi a schermata Home» o «Installa app», se disponibile.';
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
      status.textContent = 'Il browser non ha aperto la richiesta. Riprova dal menu ⋮.';
    } finally {
      button.disabled = false;
    }
  });
})();
