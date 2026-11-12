'use strict';

globalThis.appLocale = (() => {
  const english = {
    "Cerca": "Search",
    "Chiudi": "Close",
    "Installa": "Install",
    "Installa app": "Install app",
    "Risultato": "Result",
    "Riprendi": "Resume",
    "Pausa": "Pause",
    "Copia": "Copy",
    "Riprova": "Try again",
    "In Chrome apri il menu ⋮ e scegli «Aggiungi a schermata Home» o «Installa app», se disponibile.": "Open Chrome’s ⋮ menu and choose “Add to Home screen” or “Install app” if available.",
    "Il browser non ha aperto la richiesta. Riprova dal menu ⋮.": "The browser didn’t open the install prompt. Try again from the ⋮ menu.",
    "Apri foto": "Open photo",
    "Anteprima del JPG": "JPG preview",
    "Alleggerisci una foto o converti un WebP in JPG.": "Reduce a photo’s file size or convert a WebP to JPG.",
    "Salva JPG": "Save JPG",
    "Condividi": "Share",
    "Installa juice": "Install juice",
    "JPEG non disponibile": "JPEG unavailable",
    "Preparo il JPG…": "Preparing JPG…",
    "Il JPG pesa più dell’originale.": "The JPG is larger than the original.",
    "Non riesco ad aprire questa immagine. Prova con un JPG, WebP o PNG.": "Couldn’t open this image. Try a JPG, WebP or PNG.",
    "Condivisione non riuscita. Puoi usare Salva JPG.": "Couldn’t share the file. You can use Save JPG."
  };
  const preference = navigator.language || navigator.languages?.[0] || 'it';
  const language = /^it(?:-|$)/i.test(preference) ? 'it' : 'en';
  const locale = /^(?:it|en)(?:-|$)/i.test(preference) ? preference : 'en';
  const text = (source, ...values) => {
    const message = language === 'en' && Object.hasOwn(english, source) ? english[source] : source;
    return values.length ? message.replace(/\{(\d+)\}/g, (_, index) => values[Number(index)]) : message;
  };

  document.documentElement.lang = language;
  if (language === 'en') {
    document.querySelector('link[rel="manifest"]').href = "manifest-en.webmanifest?v=08";
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement.closest('script, style')) continue;
      const source = node.data.trim();
      if (Object.hasOwn(english, source)) node.data = node.data.replace(source, () => text(source));
    }
    for (const element of document.querySelectorAll('[aria-label], [alt], [placeholder], [title]')) {
      for (const attribute of ['aria-label', 'alt', 'placeholder', 'title']) {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, text(element.getAttribute(attribute)));
      }
    }
    for (const link of document.querySelectorAll('a[rel~="license"], a[href*="creativecommons.org/licenses/"]')) {
      link.href = link.href.replace(/deed\.it$/, 'deed.en');
    }
  }
  return { text, locale };
})();
