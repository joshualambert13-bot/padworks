#!/usr/bin/env python3
"""Renders the narration lines in content/narration.json to voice clips (Drop 84).

Voice: Piper text-to-speech (MIT) with the LibriTTS multi-speaker English model (CC BY 4.0; the speaker number picks
the voice). Every line becomes public/audio/narration/<id>-<hash>.mp3, where the hash is the line's text (the same
FNV-1a the site computes in demo.js), so an edited line falls back to the browser voice until it is rendered again.
Clips whose line is gone are deleted, and the list of clips is written back into narration.json for the site.

    pip install piper-tts   (plus ffmpeg on the path)
    python3 scripts/narration-render.py --model path/to/en-us-libritts-high.onnx --speaker 1027 [--rate 1.05] [--only intro-1,L3-step-2]
"""
import argparse, json, os, subprocess, sys, tempfile, wave

ap = argparse.ArgumentParser()
ap.add_argument('--model', required=True, help='the Piper .onnx model (its .onnx.json sits beside it)')
ap.add_argument('--speaker', default='1027', help='speaker name in the model\'s speaker_id_map (LibriTTS reader number)')
ap.add_argument('--rate', type=float, default=1.05, help='length scale: above 1 is slower')
ap.add_argument('--only', default='', help='comma-separated line ids to render (default: every line without a current clip)')
ap.add_argument('--force', action='store_true', help='render every line again')
ap.add_argument('--out', default='public/audio/narration')
ap.add_argument('--bitrate', default='40k')
ap.add_argument('--radio-speaker', default='3230', help='speaker for the radio replies (a lesson\'s `replies` lines, Drop 89): the frac engineer answering the van')
args = ap.parse_args()

from piper import PiperVoice
from piper.config import SynthesisConfig

def line_hash(text):
    h = 0x811c9dc5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xffffffff
    return format(h, '08x')

N = json.load(open('content/narration.json', encoding='utf8'))
lines = [(it['id'], it['text']) for it in N['intro']]
for lid, L in N['lessons'].items():
    lines.append((lid + '-intro', L['intro']))
    for i, t in enumerate(L['steps']): lines.append((lid + '-step-' + str(i + 1), t))
    for i, t in enumerate(L.get('replies', [])):
        if t: lines.append((lid + '-reply-' + str(i + 1), t))
    lines.append((lid + '-end', L['end']))
want = {lid + '-' + line_hash(t): (lid, t) for lid, t in lines}

os.makedirs(args.out, exist_ok=True)
have = {f[:-4] for f in os.listdir(args.out) if f.endswith('.mp3')}
only = set(x for x in args.only.split(',') if x)
todo = [k for k in want if (args.force or k not in have) and (not only or want[k][0] in only)]
stale = [k for k in have if k not in want]
for k in stale:
    os.remove(os.path.join(args.out, k + '.mp3'))
print(f'{len(want)} lines, {len(todo)} to render, {len(stale)} stale clips removed')

if todo:
    voice = PiperVoice.load(args.model, args.model + '.json')
    spk_map = json.load(open(args.model + '.json'))['speaker_id_map']
    spk = spk_map.get(args.speaker)
    radio = spk_map.get(args.radio_speaker)
    if spk is None or radio is None:
        sys.exit('speaker not in the model: ' + args.speaker + ' / ' + args.radio_speaker)
    cfg = SynthesisConfig(speaker_id=spk, length_scale=args.rate)
    cfg_radio = SynthesisConfig(speaker_id=radio, length_scale=args.rate * 0.97)
    for n, k in enumerate(todo):
        lid, text = want[k]
        is_reply = '-reply-' in lid
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            wav_path = tmp.name
        w = wave.open(wav_path, 'wb')
        voice.synthesize_wav(text, w, cfg_radio if is_reply else cfg)
        w.close()
        out = os.path.join(args.out, k + '.mp3')
        # a reply comes over the radio: band-limited, a little compressed, and quieter than the instructor
        flt = ['-af', 'highpass=f=320,lowpass=f=3300,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,volume=0.9'] if is_reply else []
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav_path, *flt, '-ac', '1', '-ar', '22050', '-b:a', args.bitrate, out], check=True)
        os.remove(wav_path)
        print(f'  {n + 1}/{len(todo)} {k} ({os.path.getsize(out) // 1024} KB)', flush=True)

N['clips'] = sorted(f[:-4] for f in os.listdir(args.out) if f.endswith('.mp3'))
json.dump(N, open('content/narration.json', 'w', encoding='utf8'), indent=2, ensure_ascii=False)
open('content/narration.json', 'a').write('\n')
total = sum(os.path.getsize(os.path.join(args.out, f)) for f in os.listdir(args.out))
print(f'{len(N["clips"])} clips, {total / 1e6:.1f} MB')
