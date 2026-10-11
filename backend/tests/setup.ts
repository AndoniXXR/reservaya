import { TEST_DATABASE_URL } from './test-env.ts';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
