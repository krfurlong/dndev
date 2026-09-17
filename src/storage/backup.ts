import { z } from 'zod';
import {
  CharacterSchema,
  uid,
  validateCharacter,
  type Character,
  type Asset,
} from '../domain/model';
const AssetSchema = z.object({
  id: z.string(),
  characterId: z.string().uuid(),
  kind: z.enum(['portrait', 'symbol']),
  dataUrl: z
    .string()
    .max(180000)
    .regex(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/),
});
const BackupSchema = z.object({
  format: z.literal('DnDev'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  ruleset: z.literal('2014'),
  characters: z.array(CharacterSchema).max(100),
  assets: z.array(AssetSchema).max(200),
});
export type Backup = z.infer<typeof BackupSchema>;
export function makeBackup(characters: Character[], assets: Asset[] = []): Backup {
  return BackupSchema.parse({
    format: 'DnDev',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ruleset: '2014',
    characters,
    assets: assets
      .filter((a) => characters.some((c) => c.id === a.characterId))
      .map(({ id, characterId, kind, dataUrl }) => ({ id, characterId, kind, dataUrl })),
  });
}
export function parseBackup(text: string): Backup {
  if (text.length > 20 * 1024 * 1024) throw new Error('Backup exceeds 20 MB.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const parsed = BackupSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      'Unsupported or invalid DnDev backup. Keep the original file; no data has been changed.',
    );
  parsed.data.characters.forEach(validateCharacter);
  const ids = new Set(parsed.data.characters.map((c) => c.id));
  if (ids.size !== parsed.data.characters.length)
    throw new Error('Backup contains duplicate character IDs.');
  const assets = new Map(parsed.data.assets.map((a) => [a.id, a]));
  if (assets.size !== parsed.data.assets.length)
    throw new Error('Backup contains duplicate image IDs.');
  for (const c of parsed.data.characters)
    for (const id of [c.portraitId, c.symbolId].filter(Boolean))
      if (assets.get(id)?.characterId !== c.id)
        throw new Error('Backup has a missing or mismatched image.');
  return parsed.data;
}
export function duplicateBackup(backup: Backup): { characters: Character[]; assets: Asset[] } {
  const map = new Map(backup.characters.map((c) => [c.id, uid()]));
  const assetMap = new Map(backup.assets.map((a) => [a.id, uid()]));
  return {
    characters: backup.characters.map((c) => ({
      ...structuredClone(c),
      id: map.get(c.id)!,
      revision: 0,
      updatedAt: 0,
      portraitId: assetMap.get(c.portraitId) || '',
      symbolId: assetMap.get(c.symbolId) || '',
    })),
    assets: backup.assets
      .map((a) => ({ ...a, id: assetMap.get(a.id)!, characterId: map.get(a.characterId)! }))
      .filter((a) => a.characterId),
  };
}
export function downloadBackup(backup: Backup, name = 'dndev-campaign') {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function compressImage(file: File): Promise<string> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('Choose a PNG, JPEG, or WebP image smaller than 10 MB.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'),
    scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let data = canvas.toDataURL('image/webp', 0.8);
  if (data.length > 180000) data = canvas.toDataURL('image/webp', 0.5);
  if (data.length > 180000) throw new Error('Image is still too large. Choose a smaller portrait.');
  return data;
}
