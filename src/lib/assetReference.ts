export interface ParsedAssetReference {
  url: string;
  filename: string;
  extension?: string;
}

/**
 * Parse an avatar reference string. References can be raw folder names,
 * absolute/relative URLs, or blob URLs suffixed with "#filename".
 */
export function parseAssetReference(reference: string): ParsedAssetReference {
  const [rawUrl, nameFragment] = reference.split('#');
  let filename = nameFragment ?? '';

  if (!filename) {
    const sanitized = rawUrl.split('?')[0];
    const parts = sanitized.split('/').filter(Boolean);
    filename = parts[parts.length - 1] ?? '';
  }

  const extension = filename.includes('.')
    ? filename.split('.').pop()?.toLowerCase()
    : undefined;

  return {
    url: rawUrl,
    filename,
    extension,
  };
}

export function getDisplayNameFromReference(reference: string): string {
  const { filename, url } = parseAssetReference(reference);
  if (filename) return filename;
  return url.replace(/^.*\//, '') || reference;
}
