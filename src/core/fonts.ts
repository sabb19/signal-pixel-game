// Font: VT323 per testi e terminali, Silkscreen per titoli. Caricati da Google Fonts in index.html.
export const FONT = 'VT323, monospace';
export const FONT_TITLE = 'Silkscreen, monospace';

export async function loadFonts() {
  try {
    await Promise.all([document.fonts.load('16px VT323'), document.fonts.load('16px Silkscreen'), document.fonts.load('bold 16px Silkscreen')]);
  } catch { /* senza rete restano i font di sistema */ }
}
