import 'server-only';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export async function hashQuizPassword(password:string){const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64) as Buffer;return `scrypt$${salt}$${hash.toString('hex')}`;}
export async function verifyQuizPassword(password:string,encoded:string){if(password.length>128||!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded))return false;const [algorithm,salt,key]=encoded.split('$');if(algorithm!=='scrypt'||!salt||!key||!/^[a-f0-9]{128}$/.test(key))return false;const hash=await scrypt(password,salt,64) as Buffer;return timingSafeEqual(hash,Buffer.from(key,'hex'));}

