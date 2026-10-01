// Keeps a weak machine from taking the tab down. If the browser drops the WebGL context (out of GPU memory, a
// driver reset, too many canvases), this catches the event, tells the person what happened, switches the site to
// Lite quality, and reloads. Mounted inside every Canvas.
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { LITE } from './lighting.jsx';

let handled = false;
function notice(text) {
  const el = document.createElement('div');
  el.setAttribute('data-status', 'context-lost');
  el.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;background:#5a1a1a;color:#fee2e2;border:1px solid #b91c1c;border-radius:8px;padding:10px 14px;font:13px system-ui,sans-serif;max-width:90vw';
  el.textContent = text;
  document.body.appendChild(el);
}
export function ContextLoss() {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    const canvas = gl && gl.domElement;
    if (!canvas) return;
    const onLost = (e) => {
      e.preventDefault();
      if (handled) return;
      handled = true;
      try { window.localStorage.setItem('padworks.lite', '1'); window.localStorage.setItem('padworks.fx', 'off'); } catch { /* no storage */ }
      notice(LITE ? 'The graphics context was lost. Reloading.' : 'The graphics context was lost. Switching to Lite quality and reloading.');
      setTimeout(() => window.location.reload(), 1800);
    };
    canvas.addEventListener('webglcontextlost', onLost, false);
    return () => canvas.removeEventListener('webglcontextlost', onLost, false);
  }, [gl]);
  return null;
}
