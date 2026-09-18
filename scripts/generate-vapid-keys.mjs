import { createECDH } from 'node:crypto';

const vapid = createECDH('prime256v1');
vapid.generateKeys();

console.log(JSON.stringify({
  publicKey: vapid.getPublicKey().toString('base64url'),
  privateKey: vapid.getPrivateKey().toString('base64url'),
}, null, 2));
