import manifest from '../chapters/manifest.json';

// Capítulo e reportagem liberados pela autora nas listagens oficiais.
export const chapter28Metadata = { number: 28, title: 'Capítulo 28', listed: true };
export const listedChapters = [...manifest, ...(chapter28Metadata.listed ? [chapter28Metadata] : [])];
