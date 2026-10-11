import fs from 'node:fs';
import { verifyRuntime } from './image-config.mjs';
try {
  verifyRuntime(process.env, JSON.parse(fs.readFileSync(new URL('./build-public.json', import.meta.url), 'utf8')));
} catch (error) {
  console.error(`Deployment startup refused: ${error.message}`);
  process.exit(1);
}
// Same process as Next.js: signals and stdout/stderr remain attached to Docker.
await import('../server.js');
