import { randomBytes } from 'node:crypto';
const key = randomBytes(32).toString('hex');
console.log(
  'Keep this key private. Create campaigns/<key> in Firebase Console with enabled: true and name: your campaign name.',
);
console.log(key);
console.log('Invitation: https://YOUR-NAME.github.io/YOUR-REPOSITORY/#/join/' + key);
