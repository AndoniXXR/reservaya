import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-env.ts';

// Aplica las migraciones a la base de pruebas una vez antes de toda la suite.
export default function globalSetup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
