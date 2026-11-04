import work from './chapters/work.json';

export interface Credit {
  name: string;
  url?: string;
}

// Perfis já utilizados nos créditos do portal; não inferir URLs a partir do nome.
export const storyAuthor: Credit = { name: work.author, url: 'https://x.com/__medv' };
export const portalCreator: Credit = { name: '@itsxulia', url: 'https://x.com/itsxulia' };
