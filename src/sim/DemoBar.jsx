// The caption bar of a narrated demo (Drop 77): what the voice is saying, which step this is, and the three
// things a person can do about it: mute the voice (captions stay), skip the sentence, or stop and take over.
import { Volume2, VolumeX, SkipForward, Square } from 'lucide-react';
import { useDemo, stopDemo, skipNarration } from './demo.js';

export function DemoBar() {
  const active = useDemo(d => d.active), caption = useDemo(d => d.caption), step = useDemo(d => d.step), steps = useDemo(d => d.steps), muted = useDemo(d => d.muted), setMuted = useDemo(d => d.setMuted);
  if (!active) return null;
  const label = active === 'intro' ? 'Introduction' : 'Lesson demo';
  return (
    <div className="absolute left-2 right-2 bottom-9 z-30 pointer-events-auto" data-demo-bar>
      <div className="mx-auto max-w-3xl rounded-lg bg-black/75 border border-line text-white px-3 py-2 flex items-start gap-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-accent mono">{label}{steps ? ' · ' + Math.min(step + 1, steps) + ' of ' + steps : ''}</div>
          <div className="text-sm leading-snug" data-demo-caption>{caption}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button className="btn text-[11px] px-2 py-1 flex items-center gap-1" title={muted ? 'Voice off: captions only. Click for the voice.' : 'Voice on. Click to mute; the captions stay.'} onClick={() => setMuted(!muted)} data-action="demo-mute">{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
          <button className="btn text-[11px] px-2 py-1 flex items-center gap-1" title="Skip the rest of this sentence" onClick={skipNarration} data-action="demo-skip"><SkipForward size={14} /></button>
          <button className="btn btn-primary text-[11px] px-2 py-1 flex items-center gap-1" title="Stop the demo and take over" onClick={stopDemo} data-action="demo-stop"><Square size={14} />Stop</button>
        </div>
      </div>
    </div>
  );
}
