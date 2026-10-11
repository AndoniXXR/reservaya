// Punto de entrada de la API en Vercel: la app de Express compilada (backend/dist) se
// expone como una única función serverless que atiende todo /api/*.
import { createApp } from '../backend/dist/app.js';

const app = createApp();

export default app;
