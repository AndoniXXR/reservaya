try {
  process.loadEnvFile('../.env');
} catch {
  // sin archivo .env (CI)
}

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://reservaya:reservaya@localhost:5432/reservaya_test';
