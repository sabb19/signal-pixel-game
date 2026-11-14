// Font: VT323 per testi e terminali, Silkscreen per titoli. Caricati da Google Fonts in index.html.
export const FONT = 'VT323, monospace';
export const FONT_TITLE = 'Silkscreen, monospace';
// Font leggibili per il simulatore IRIS Tracer (stile app, non pixel)
export const FONT_MONO = '"JetBrains Mono", Menlo, monospace';
export const FONT_UI = 'Inter, "Helvetica Neue", Arial, sans-serif';

export async function loadFonts() {
  try {
    await Promise.all([document.fonts.load('16px VT323'), document.fonts.load('16px Silkscreen'), document.fonts.load('bold 16px Silkscreen'), document.fonts.load('16px "JetBrains Mono"'), document.fonts.load('600 16px Inter')]);
  } catch { /* senza rete restano i font di sistema */ }
}
