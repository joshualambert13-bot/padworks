// Vercel serverless function: every /api/* request is rewritten here (vercel.json) and routed by server/api.js.
// One function keeps the Hobby plan's function count at one and the routing in our own code.
import { handle } from '../server/api.js';
export default function handler(req, res) { return handle(req, res); }
