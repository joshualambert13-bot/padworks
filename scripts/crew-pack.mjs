// Pack a crew GLB for the site (Drop 78): put the FRC atlas from crew-frc.py in as the body color (JPEG), make the
// materials plain PBR (the FBX import leaves them half metallic with a glossiness map in the roughness slot and a
// specular extension), opaque body and cut-out hair, drop the unused specular and glossiness images, and write
// the result over the input. Usage: node scripts/crew-pack.mjs public/models/crew/lewis.glb
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, resample } from '@gltf-transform/functions';

const file = process.argv[2];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const frc = file.replace(/\.glb$/, '_frc.png');
const frcJpeg = fs.existsSync(frc) ? await sharp(frc).jpeg({ quality: 85 }).toBuffer() : null;
for (const mat of doc.getRoot().listMaterials()) {
  const body = /_body$/i.test(mat.getName());
  mat.setMetallicFactor(0).setRoughnessFactor(body ? 0.82 : 0.6);
  mat.setMetallicRoughnessTexture(null);
  mat.setExtension('KHR_materials_specular', null);
  if (body) {
    mat.setAlphaMode('OPAQUE').setDoubleSided(false);
    // the body gets its own texture with the FRC atlas; the hair keeps the original (its alpha cuts the hair cards)
    if (frcJpeg) { const t = doc.createTexture(path.basename(file, '.glb') + '_frc').setImage(frcJpeg).setMimeType('image/jpeg'); mat.setBaseColorTexture(t); }
  } else {
    mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
    // hair cards need the alpha, so the PNG stays, at 512 px: the hair takes a small corner of the atlas
    const tex = mat.getBaseColorTexture();
    if (tex && tex.getMimeType() === 'image/png') tex.setImage(await sharp(tex.getImage()).resize(512, 512).png({ compressionLevel: 9 }).toBuffer());
  }
}
// the normal maps as JPEG at 1024 if they are PNG, to keep each character under 3 MB
for (const tex of doc.getRoot().listTextures()) {
  if (tex.getMimeType() === 'image/png' && /Normal/i.test(tex.getName() || '')) {
    tex.setImage(await sharp(tex.getImage()).jpeg({ quality: 85 }).toBuffer()).setMimeType('image/jpeg');
  }
}
const metaFile = file.replace(/\.glb$/, '_meta.json');
if (fs.existsSync(metaFile)) { const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); doc.getRoot().getDefaultScene().setExtras(meta); }   // hatY and height, read by crewmodel.jsx
await doc.transform(dedup(), resample(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), prune());
await io.write(file, doc);
const kb = Math.round(fs.statSync(file).size / 1024);
console.log('packed', file, kb, 'KB |', doc.getRoot().listTextures().map(t => (t.getName() || '?') + ':' + t.getMimeType()).join(', '), '| animations:', doc.getRoot().listAnimations().map(a => a.getName()).join(', '));
