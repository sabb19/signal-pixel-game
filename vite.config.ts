import { defineConfig } from 'vite';

// base relativa: il gioco funziona anche pubblicato in una sottocartella (GitHub Pages).
// __BUILD__: versione della build, usata per non mescolare immagini vecchie e codice nuovo nella cache.
export default defineConfig({ base: './', define: { __BUILD__: JSON.stringify(String(Date.now())) } });
