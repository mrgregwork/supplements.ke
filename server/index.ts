import { spawn } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load .env file before spawning Astro
config({ path: resolve(process.cwd(), '.env') });

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  // In production: serve the pre-built Astro standalone output
  const entryPoint = resolve(process.cwd(), 'dist/server/entry.mjs');
  if (existsSync(entryPoint)) {
    console.log('Starting Astro production server...');
    const server = spawn('node', [entryPoint], {
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        HOST: '0.0.0.0',
        PORT: '5000',
      }
    });
    server.on('error', (err) => { console.error('Failed to start Astro:', err); process.exit(1); });
    server.on('exit', (code) => { process.exit(code ?? 0); });
  } else {
    // Fallback: run astro dev if no production build exists yet
    console.log('No production build found, falling back to dev server...');
    const astro = spawn('npx', ['astro', 'dev', '--host', '0.0.0.0', '--port', '5000'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env }
    });
    astro.on('error', (err) => { console.error('Failed to start Astro:', err); process.exit(1); });
    astro.on('exit', (code) => { process.exit(code ?? 0); });
  }
} else {
  console.log('Starting Astro development server...');
  const astro = spawn('npx', ['astro', 'dev', '--host', '0.0.0.0', '--port', '5000'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });
  astro.on('error', (err) => { console.error('Failed to start Astro:', err); process.exit(1); });
  astro.on('exit', (code) => { process.exit(code ?? 0); });
}
