export const resolveAssetUrl = (relativePath: string): string =>
  `/assets/${relativePath.replace(/^\/+/, '')}`;
