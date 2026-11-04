import manifest from '../chapters/manifest.json';

// Alterar para true quando a autora liberar o capítulo e a reportagem no índice.
export const chapter28Metadata = { number: 28, title: 'Capítulo 28', listed: false };
export const listedChapters = [...manifest, ...(chapter28Metadata.listed ? [chapter28Metadata] : [])];
