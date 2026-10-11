process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://reservaya:reservaya@localhost:5432/reservaya_test';
