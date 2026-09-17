import { appendFile } from 'node:fs/promises';
const name = (process.env.GITHUB_REPOSITORY || 'owner/DnDev').split('/')[1];
const base =
  process.env.CUSTOM_BASE_PATH ||
  (name.toLowerCase().endsWith('.github.io') ? '/' : '/' + name + '/');
if (!/^\/(?:[a-zA-Z0-9_.-]+\/)*$/.test(base))
  throw new Error('BASE_PATH must start and end with / and contain only safe path components.');
if (!process.env.GITHUB_ENV) throw new Error('Run this helper in GitHub Actions.');
await appendFile(process.env.GITHUB_ENV, 'BASE_PATH=' + base + '\n');
console.log('Pages asset path: ' + base);
