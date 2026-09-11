import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(path.join(tmpdir(), 'goodminton-announcements-'));
try {
  const outfiles = [];
  for (const [index, entryPoint] of ['tests/announcement-store.test.tsx'].entries()) {
    const outfile = path.join(directory, `${index}.test.cjs`);
    await build({ entryPoints: [entryPoint], outfile, bundle: true, platform: 'node', format: 'cjs',
      define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'https://announcements.invalid', VITE_SUPABASE_ANON_KEY: 'test-placeholder-public-key' }) }
    });
    outfiles.push(outfile);
  }
  process.exitCode = spawnSync(process.execPath, ['--test', ...outfiles], { stdio: 'inherit' }).status ?? 1;
} finally {
  if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('goodminton-announcements-')) {
    throw new Error('Unexpected temporary test directory');
  }
  await rm(directory, { recursive: true, force: true });
}
