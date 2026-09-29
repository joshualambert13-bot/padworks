// Model preview used by the screenshot tooling: /preview?glb=/glb/WH/WH-GATEVALVE.glb
import { useSearchParams } from 'react-router-dom';
import Viewer from './Viewer.jsx';

export default function Preview() {
  const [sp] = useSearchParams();
  const glb = sp.get('glb');
  if (!glb) return <div className="p-4 text-sm text-mute">Add ?glb=/glb/SYSTEM/FILE.glb to the address.</div>;
  return <div className="h-full p-2"><Viewer url={glb} highlight={[]} /></div>;
}
