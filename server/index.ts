import { spawn } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file before spawning Astro
config({ path: resolve(process.cwd(), '.env') });

console.log('Starting Astro development server...');

const astro = spawn('npx', ['astro', 'dev', '--host', '0.0.0.0', '--port', '5000'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

astro.on('error', (err) => {
  console.error('Failed to start Astro:', err);
  process.exit(1);
});

astro.on('exit', (code) => {
  process.exit(code ?? 0);
});
