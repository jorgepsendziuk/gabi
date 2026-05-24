/**
 * Entry point Vercel (Express on Vercel).
 * Admin estático fica em public/ (gerado no build).
 */
import { createApp } from './apps/api/dist/create-app.js';

export default createApp();
