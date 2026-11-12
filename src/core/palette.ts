// Palette SIGNAL (docs/ART_DIRECTION_BIBLE.md §3). Unica fonte dei colori nel codice.
export const P = {
  petrol0: 0x0e1a1a, petrol: 0x182b2a, petrol2: 0x22403c,
  green0: 0x253a34, green: 0x304b43, green2: 0x41625a, green3: 0x587a70,
  phos0: 0x4e5a36, phos1: 0x7e8b57, phos: 0xa9b77b, phos3: 0xd6e0a8,
  ochre0: 0x8c7240, ochre: 0xd3b46f, ochre2: 0xebd39a,
  cream0: 0xbba987, cream: 0xe5d8b9, cream2: 0xf4eddc,
  night0: 0x16212f, night: 0x24364a, night2: 0x3a5470,
  red0: 0x6e2e27, red: 0xa94e42, red2: 0xd2766a,
  metal0: 0x4a4139, metal: 0x74675b, metal2: 0x9a8c7c,
  conc0: 0x8a7d69, conc: 0xb5a68d, conc2: 0xcdc1aa,
  cyan0: 0x12303a, cyan1: 0x1f5a66, cyan: 0x3fa7b5, cyan3: 0x8fe3ea,
  lamp0: 0x8a4a22, lamp: 0xd9853b, lamp2: 0xf2b66d,
  jacket0: 0x4e3526, jacket1: 0x6b4a34, jacket: 0x8c6446, jacket3: 0xa9805a,
  scarf0: 0x4f241e, scarf: 0x7a3a30,
  hair: 0x141a24, skin0: 0x8c5e46, skin: 0xc08a6a,
} as const;

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
