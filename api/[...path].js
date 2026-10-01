// Vercel serverless function: every /api/* request lands here and is routed by server/api.js.
import { handle } from '../server/api.js';
export default function handler(req, res) { return handle(req, res); }
