// Procedural surface equipment. Every group is named with a record ID so the
// inspector and the build check can bind scene nodes to library records.
// Geometry is generic and representative; proportions are not OEM dimensions.
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, Cyl, Pipe, PipeRun, Trailer, Wheel, MAT, Label } from './primitives.jsx';

// ---------------------------------------------------------------- valves
// A gate valve block. `open` is 0..1 position. kind: 'manual' | 'hydraulic'.
// axis: 'vertical' (bore along Y, stem along X) or 'horizontal' (bore along X, stem along Y).
export function GateValveBlock({ open = 1, kind = 'manual', axis = 'vertical', bore = 0.13, name, position = [0, 0, 0], label }) {
  const body = bore * 5.2;     // block width
  const len = bore * 6.0;      // along the bore
  const indicator = open > 0.99 ? '#35e08f' : open < 0.01 ? '#ff4d4d' : '#ffb020';
  const stemTravel = bore * 1.2 * open;
  const inner = (
    <group>
      {/* body block with bore along local Y */}
      <Box size={[body, len, body]} mat={MAT.darkSteel} name={name ? name + '-BODY' : undefined} />
      {/* flanges */}
      <Cyl r={body * 0.62} h={0.06} position={[0, len / 2 + 0.03, 0]} mat={MAT.steel} />
      <Cyl r={body * 0.62} h={0.06} position={[0, -len / 2 - 0.03, 0]} mat={MAT.steel} />
      {/* bonnet along +X */}
      <Cyl r={body * 0.36} h={body * 0.5} rotation={[0, 0, Math.PI / 2]} position={[body / 2 + body * 0.25, 0, 0]} mat={MAT.steel} name={name ? name + '-BONNET' : undefined} />
      {/* stem */}
      <Cyl r={bore * 0.22} h={body * 0.9} rotation={[0, 0, Math.PI / 2]} position={[body / 2 + body * 0.5 + body * 0.45 + stemTravel, 0, 0]} mat={MAT.brass} name={name ? name + '-STEM' : undefined} />
      {kind === 'manual' ? (
        <group position={[body / 2 + body * 0.5 + body * 0.95 + stemTravel, 0, 0]} name={name ? name + '-HANDWHEEL' : undefined}>
          <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[body * 0.42, bore * 0.18, 8, 24]} /><meshStandardMaterial {...MAT.redIron} /></mesh>
          {[0, 60, 120].map(a => (
            <mesh key={a} rotation={[THREE.MathUtils.degToRad(a), 0, 0]}><boxGeometry args={[bore * 0.2, body * 0.84, bore * 0.2]} /><meshStandardMaterial {...MAT.redIron} /></mesh>
          ))}
        </group>
      ) : (
        <group name={name ? name + '-ACTUATOR' : undefined}>
          <Cyl r={body * 0.3} h={body * 1.1} rotation={[0, 0, Math.PI / 2]} position={[body / 2 + body * 0.5 + body * 0.55, 0, 0]} mat={MAT.blue} />
          <Cyl r={body * 0.36} h={0.05} rotation={[0, 0, Math.PI / 2]} position={[body / 2 + body * 0.5 + body * 1.1, 0, 0]} mat={MAT.steel} />
          <Cyl r={0.015} h={0.5} position={[body / 2 + body * 0.5 + body * 0.9, 0.25, 0]} mat={MAT.rubber} />
        </group>
      )}
      {/* position indicator lamp */}
      <mesh position={[body / 2 + body * 0.5 + (kind === 'manual' ? body * 0.95 + stemTravel : body * 1.15), body * 0.45, 0]}>
        <sphereGeometry args={[bore * 0.3, 10, 10]} />
        <meshStandardMaterial color={indicator} emissive={indicator} emissiveIntensity={1.2} />
      </mesh>
      {label && <Label position={[0, 0, body]} text={label} />}
    </group>
  );
  const rot = axis === 'vertical' ? [0, 0, 0] : [0, 0, -Math.PI / 2];
  return <group position={position} rotation={rot} name={name}>{inner}</group>;
}

// ---------------------------------------------------------------- frac tree
// Stack from the ground up: casing head, casing spool, tubing head (frac-ready), lower master,
// upper master (hydraulic), studded cross with two wing valves, swab valve, goat head.
export function FracTree({ valves, showLabels, goatHead = true, lubricator = false, wlStep = 'idle' }) {
  const bore = 0.13;              // 5-1/8 in. nominal
  const blockH = bore * 6.0 + 0.12;
  let y = 0;
  const casingHeadY = 0.35; y = 0.7;
  const spoolY = y + 0.35; y += 0.7;
  const tubingHeadY = y + 0.3; y += 0.6;
  const lmvY = y + blockH / 2; y += blockH;
  const umvY = y + blockH / 2; y += blockH;
  const crossY = y + 0.4; y += 0.8;
  const swabY = y + blockH / 2; y += blockH;
  const topY = y;
  const wingX = bore * 5.2 / 2 + 0.4 + (bore * 6.0) / 2;
  return (
    <group name="WH-FRACTREE">
      {/* ground cellar ring */}
      <Cyl r={1.1} r2={1.1} h={0.05} position={[0, 0.025, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.42} h={0.7} position={[0, casingHeadY, 0]} mat={MAT.darkSteel} name="WH-CASINGHEAD" />
      <Cyl r={0.48} h={0.08} position={[0, casingHeadY + 0.35, 0]} mat={MAT.steel} />
      <Cyl r={0.4} h={0.7} position={[0, spoolY, 0]} mat={MAT.darkSteel} name="WH-CASINGSPOOL" />
      <Cyl r={0.47} h={0.08} position={[0, spoolY + 0.35, 0]} mat={MAT.steel} />
      {/* side outlet valves on the casing spool */}
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[0.55, spoolY, 0]} />
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[-0.55, spoolY, 0]} />
      <Cyl r={0.38} h={0.6} position={[0, tubingHeadY, 0]} mat={MAT.darkSteel} name="WH-TUBINGHEAD" />
      <Cyl r={0.5} h={0.09} position={[0, tubingHeadY + 0.3, 0]} mat={MAT.steel} name="WH-TREEADAPTER" />
      <GateValveBlock open={valves.lmv.pos} kind="manual" bore={bore} position={[0, lmvY, 0]} name="WH-FRACTREE-LMV" label={showLabels ? 'Lower master' : null} />
      <GateValveBlock open={valves.umv.pos} kind="hydraulic" bore={bore} position={[0, umvY, 0]} name="WH-FRACTREE-UMV" label={showLabels ? 'Upper master (hyd.)' : null} />
      {/* studded cross */}
      <group name="WH-FRACTREE-CROSS" position={[0, crossY, 0]}>
        <Box size={[bore * 5.4, 0.8, bore * 5.4]} mat={MAT.darkSteel} />
        <Cyl r={bore * 2.2} h={0.4} rotation={[0, 0, Math.PI / 2]} position={[bore * 2.7 + 0.2, 0, 0]} mat={MAT.darkSteel} />
        <Cyl r={bore * 2.2} h={0.4} rotation={[0, 0, Math.PI / 2]} position={[-bore * 2.7 - 0.2, 0, 0]} mat={MAT.darkSteel} />
      </group>
      {/* wing valves: A toward the zipper (-X), B toward flowback (+X) */}
      <GateValveBlock open={valves.wingA.pos} kind="hydraulic" axis="horizontal" bore={bore} position={[-wingX, crossY, 0]} name="WH-FRACTREE-WINGA" label={showLabels ? 'Frac wing (hyd.)' : null} />
      <GateValveBlock open={valves.wingB.pos} kind="hydraulic" axis="horizontal" bore={bore} position={[wingX, crossY, 0]} name="WH-FRACTREE-WINGB" label={showLabels ? 'Flowback wing (hyd.)' : null} />
      <GateValveBlock open={valves.swab.pos} kind="manual" bore={bore} position={[0, swabY, 0]} name="WH-FRACTREE-SWAB" label={showLabels ? 'Swab valve' : null} />
      {goatHead && !lubricator && (
        <group name="WH-GOATHEAD" position={[0, topY + 0.35, 0]}>
          <Cyl r={0.42} h={0.6} mat={MAT.darkSteel} />
          <Cyl r={0.5} h={0.08} position={[0, -0.3, 0]} mat={MAT.steel} />
          {[-1, 0, 1].map(k => (
            <Cyl key={k} r={0.08} h={0.9} rotation={[0, 0, THREE.MathUtils.degToRad(-35 + 0 * k)]} position={[-0.55, 0.45, k * 0.28]} mat={MAT.redIron} />
          ))}
          <Cyl r={0.3} h={0.12} position={[0, 0.36, 0]} mat={MAT.steel} />
          {showLabels && <Label position={[0.6, 0.6, 0]} text={'Goat head (3 in. inlets)'} />}
        </group>
      )}
      {lubricator && <Lubricator baseY={topY} wlStep={wlStep} showLabels={showLabels} />}
    </group>
  );
}

// Wireline pressure control stack on the tree: adapter, wireline valve, tool trap, lubricator sections, grease head.
export function Lubricator({ baseY, wlStep, showLabels }) {
  const r = 0.16;
  const sections = 4, secH = 2.4;
  const toolVisible = wlStep === 'idle' || wlStep === 'done' || wlStep === 'pooh';
  return (
    <group name="WL-PCE-STACK" position={[0, baseY, 0]}>
      <Cyl r={0.34} h={0.25} position={[0, 0.125, 0]} mat={MAT.steel} name="WL-PCE-WELLHEADADAPTER" />
      <Box size={[0.75, 0.9, 0.55]} position={[0, 0.7, 0]} mat={MAT.darkSteel} name="WL-PCE-WIRELINEVALVE" />
      <Cyl r={0.06} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[0.55, 0.7, 0]} mat={MAT.blue} />
      <Cyl r={0.06} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[-0.55, 0.7, 0]} mat={MAT.blue} />
      <Cyl r={0.24} h={0.5} position={[0, 1.4, 0]} mat={MAT.steel} name="WL-PCE-TOOLTRAP" />
      <Cyl r={0.2} h={0.35} position={[0, 1.83, 0]} mat={MAT.steel} name="WL-PCE-PUMPINSUB" />
      <Cyl r={0.08} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[0.3, 1.83, 0]} mat={MAT.redIron} />
      {Array.from({ length: sections }).map((_, i) => (
        <group key={i} name={i === 0 ? 'WL-PCE-LUBRICATOR' : undefined}>
          <Cyl r={r} h={secH} position={[0, 2.0 + secH / 2 + i * secH, 0]} mat={MAT.steel} />
          <Cyl r={r * 1.35} h={0.14} position={[0, 2.0 + (i + 1) * secH, 0]} mat={MAT.darkSteel} name={i === 0 ? 'WL-PCE-QUICKUNION' : undefined} />
        </group>
      ))}
      <Cyl r={0.19} h={0.7} position={[0, 2.0 + sections * secH + 0.35, 0]} mat={MAT.darkSteel} name="WL-PCE-GREASEHEAD" />
      <Cyl r={0.05} h={0.35} rotation={[0, 0, Math.PI / 2]} position={[0.25, 2.0 + sections * secH + 0.5, 0]} mat={MAT.blue} />
      {/* tool string parked in the lubricator when not in the well */}
      {toolVisible && (
        <group position={[0, 2.0 + sections * secH - 4.0, 0]} name="WL-TOOLSTRING">
          <Cyl r={0.05} h={3.2} mat={MAT.brass} />
          <Cyl r={0.06} h={0.9} position={[0, -2.0, 0]} mat={MAT.rubber} />
        </group>
      )}
      {showLabels && <Label position={[0.5, 6, 0]} text={'Lubricator (wireline PCE)'} />}
    </group>
  );
}

// ---------------------------------------------------------------- zipper manifold
export function ZipperManifold({ valves, showLabels, position = [-8, 0, 0] }) {
  const wells = [-2.2, 0, 2.2];
  return (
    <group position={position} name="WH-ZIPPER">
      <Box size={[3.0, 0.25, 7.0]} position={[0, 0.125, 0]} mat={MAT.yellow} name="WH-ZIPPER-SKID" />
      {/* inlet header from the missile side (-X) running along Z */}
      <Pipe from={[-1.2, 0.9, -3.6]} to={[-1.2, 0.9, 3.6]} r={0.09} mat={MAT.darkSteel} unions={false} />
      {wells.map((z, i) => (
        <group key={i} position={[0, 0.9, z]}>
          <Pipe from={[-1.2, 0, 0]} to={[-0.4, 0, 0]} r={0.075} mat={MAT.redIron} unions={false} />
          <GateValveBlock open={i === 1 ? valves.zip.pos : 0} kind="hydraulic" axis="horizontal" bore={0.11} position={[0.2, 0, 0]} name={i === 1 ? 'WH-ZIPPER-VALVE' : undefined} label={showLabels && i === 1 ? 'Zipper valve (this well)' : null} />
          <Pipe from={[0.85, 0, 0]} to={[1.5, 0, 0]} r={0.075} mat={MAT.redIron} unions={false} />
        </group>
      ))}
      {/* hydraulic control unit at the end of the skid */}
      <Box size={[1.2, 1.1, 0.9]} position={[0.6, 0.8, -3.0]} mat={MAT.blue} name="WH-FRACVALVECONTROL" />
      <Cyl r={0.12} h={0.9} position={[0.2, 1.8, -3.0]} mat={MAT.steel} />
      {showLabels && <Label position={[0, 2.2, 0]} text={'Zipper manifold'} />}
    </group>
  );
}

// ---------------------------------------------------------------- missile and pumps
export function Missile({ position = [-18, 0, 0], showLabels }) {
  return (
    <Trailer length={14} width={2.8} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-MISSILE">
      <Pipe from={[-6.5, 1.9, 0.8]} to={[6.5, 1.9, 0.8]} r={0.16} mat={MAT.darkSteel} unions={false} name="PP-MISSILE-HPHEADER" />
      <Pipe from={[-6.5, 1.5, -0.8]} to={[6.5, 1.5, -0.8]} r={0.26} mat={MAT.steel} unions={false} name="PP-MISSILE-LPHEADER" />
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i} position={[-5 + i * 2, 0, 0]}>
          <Pipe from={[0, 1.9, 0.8]} to={[0, 1.9, 2.4]} r={0.07} mat={MAT.redIron} unions={false} />
          <Pipe from={[0, 1.5, -0.8]} to={[0, 1.5, -2.4]} r={0.12} mat={MAT.steel} unions={false} />
          <Box size={[0.3, 0.3, 0.3]} position={[0, 1.9, 1.6]} mat={MAT.darkSteel} />
        </group>
      ))}
      {showLabels && <Label position={[0, 3, 0]} text={'Missile (manifold trailer)'} />}
    </Trailer>
  );
}

export function FracPump({ position, rotation = [0, 0, 0], online = false, rate = 0, name }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const amp = online ? 0.004 + rate / 100 * 0.01 : 0;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 40) * amp;
  });
  return (
    <Trailer length={13} width={2.6} position={position} rotation={rotation} name={name}>
      <group ref={ref}>
        <Box size={[3.2, 1.6, 2.0]} position={[-4.2, 2.0, 0]} mat={MAT.white} name={name + '-ENGINE'} />
        <Cyl r={0.12} h={1.2} position={[-4.8, 3.4, 0.6]} mat={MAT.darkSteel} />
        <Box size={[1.8, 1.2, 1.6]} position={[-1.6, 1.8, 0]} mat={MAT.darkSteel} name={name + '-TRANSMISSION'} />
        <Box size={[2.6, 1.7, 2.2]} position={[1.0, 2.05, 0]} mat={MAT.steel} name={name + '-POWEREND'} />
        <Box size={[1.4, 1.5, 2.3]} position={[3.1, 2.0, 0]} mat={MAT.darkSteel} name={name + '-FLUIDEND'} />
        {[-0.8, -0.4, 0, 0.4, 0.8].map((z, i) => (
          <Cyl key={i} r={0.12} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[3.95, 2.0, z]} mat={MAT.brass} />
        ))}
        <Pipe from={[3.6, 2.9, 0]} to={[5.6, 2.9, 0]} r={0.07} mat={MAT.redIron} unions={false} />
        <Pipe from={[3.6, 1.2, 0]} to={[5.6, 1.2, 0]} r={0.12} mat={MAT.steel} unions={false} />
        <Box size={[3.4, 1.3, 0.35]} position={[-4.2, 3.4, 0.9]} mat={MAT.darkSteel} />
        <mesh position={[-2.0, 3.1, 1.1]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color={online ? '#35e08f' : '#555'} emissive={online ? '#35e08f' : '#000'} emissiveIntensity={1.5} />
        </mesh>
      </group>
    </Trailer>
  );
}

export function Blender({ position, showLabels }) {
  return (
    <Trailer length={13} width={2.8} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-BLENDER">
      <Box size={[3.0, 1.6, 2.2]} position={[-4.4, 2.0, 0]} mat={MAT.white} />
      <Box size={[2.6, 2.0, 2.4]} position={[-0.5, 2.2, 0]} mat={MAT.blue} name="PP-BLENDER-TUB" />
      {[1.6, 2.6].map((x, i) => <Cyl key={i} r={0.35} h={3.4} rotation={[0, 0, THREE.MathUtils.degToRad(-40)]} position={[x, 2.4, i * 0.8 - 0.4]} mat={MAT.steel} name={i === 0 ? 'PP-BLENDER-AUGER' : undefined} />)}
      <Cyl r={0.6} h={0.9} rotation={[0, 0, Math.PI / 2]} position={[4.4, 1.9, 0.6]} mat={MAT.darkSteel} name="PP-BLENDER-DISCHARGEPUMP" />
      <Cyl r={0.6} h={0.9} rotation={[0, 0, Math.PI / 2]} position={[4.4, 1.9, -0.6]} mat={MAT.darkSteel} name="PP-BLENDER-SUCTIONPUMP" />
      {showLabels && <Label position={[0, 4.2, 0]} text={'Blender'} />}
    </Trailer>
  );
}

export function Hydration({ position, showLabels }) {
  return (
    <Trailer length={13} width={2.8} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-HYDRATION">
      <Box size={[9, 2.2, 2.5]} position={[0.5, 2.3, 0]} mat={MAT.green} />
      {[-3, -1, 1, 3].map((x, i) => <Cyl key={i} r={0.18} h={0.8} position={[x, 3.8, 0]} mat={MAT.darkSteel} />)}
      {showLabels && <Label position={[0, 4.4, 0]} text={'Hydration unit'} />}
    </Trailer>
  );
}

export function ChemAdd({ position, showLabels }) {
  return (
    <Trailer length={11} width={2.6} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-CHEMADD">
      {[-3.5, -1.2, 1.1, 3.4].map((x, i) => <Cyl key={i} r={0.7} h={2.0} position={[x, 2.2, 0]} mat={i % 2 ? MAT.white : MAT.yellow} />)}
      {showLabels && <Label position={[0, 3.8, 0]} text={'Chemical additive unit'} />}
    </Trailer>
  );
}

export function SandSilos({ position, showLabels }) {
  return (
    <group position={position} name="LG-SANDSILOS">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <group key={i} position={[(i % 3) * 4.0, 0, Math.floor(i / 3) * 4.2]}>
          <Cyl r={1.6} h={9} position={[0, 6.0, 0]} mat={MAT.white} name={i === 0 ? 'LG-SANDSILO' : undefined} />
          <Cyl r={1.6} r2={0.4} h={1.6} position={[0, 0.7 + 0.8, 0]} mat={MAT.darkSteel} />
          {[0, 1, 2, 3].map(k => <Cyl key={k} r={0.08} h={1.5} position={[Math.cos(k * Math.PI / 2) * 1.3, 0.75, Math.sin(k * Math.PI / 2) * 1.3]} mat={MAT.darkSteel} />)}
        </group>
      ))}
      <Box size={[14, 0.5, 0.9]} position={[4, 0.8, 6.5]} mat={MAT.darkSteel} name="LG-CONVEYOR" />
      {showLabels && <Label position={[4, 11.5, 2]} text={'Sand silos and conveyor'} />}
    </group>
  );
}

export function WaterTanks({ position, count = 8, showLabels }) {
  return (
    <group position={position} name="PP-FRACTANKS">
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} size={[3.0, 3.0, 12.5]} position={[i * 3.4, 1.5, 0]} mat={i % 2 ? MAT.white : MAT.steel} name={i === 0 ? 'PP-FRACTANK' : undefined} />
      ))}
      {showLabels && <Label position={[count * 1.7, 4, 0]} text={'Frac tanks (500 bbl)'} />}
    </group>
  );
}

export function DataVan({ position, showLabels }) {
  return (
    <Trailer length={12} width={2.8} position={position} rotation={[0, 0, 0]} name="PP-DATAVAN">
      <Box size={[11, 2.6, 2.7]} position={[0, 2.5, 0]} mat={MAT.white} />
      <Box size={[10.5, 0.8, 0.05]} position={[0, 2.8, 1.36]} mat={{ color: '#7fb3ff', metalness: 0.1, roughness: 0.1 }} />
      <Cyl r={0.05} h={2.5} position={[-4.5, 5.0, 0]} mat={MAT.darkSteel} />
      {showLabels && <Label position={[0, 4.6, 0]} text={'Data van'} />}
    </Trailer>
  );
}

// Wireline truck with a crane holding the lubricator; cable runs from the drum over the top sheave to the tree.
export function WirelineUnit({ position, treeTop, showLabels, active }) {
  const drum = useRef();
  useFrame((_, dt) => { if (drum.current && active) drum.current.rotation.z += dt * 2; });
  const top = [treeTop[0], treeTop[1] + 12.5, treeTop[2]];
  return (
    <group position={position} name="WL-UNIT">
      <Trailer length={10} width={2.6} position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <Box size={[2.6, 2.2, 2.4]} position={[-3.4, 2.3, 0]} mat={MAT.white} name="WL-UNIT-CAB" />
        <Box size={[4.0, 2.4, 2.4]} position={[0.4, 2.4, 0]} mat={MAT.white} name="WL-UNIT-CONTROLCAB" />
        <group position={[3.6, 2.3, 0]} name="WL-UNIT-DRUM">
          <mesh ref={drum} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.9, 0.9, 1.6, 20]} /><meshStandardMaterial {...MAT.darkSteel} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.75, 0.75, 1.62, 20]} /><meshStandardMaterial color="#222" roughness={0.9} /></mesh>
        </group>
      </Trailer>
      {/* crane: base, boom to above the tree */}
      <group name="WL-CRANE" position={[6, 0, 3]}>
        <Box size={[3.5, 1.0, 3.0]} position={[0, 0.9, 0]} mat={MAT.yellow} />
        <Cyl r={0.5} h={1.2} position={[0, 2.0, 0]} mat={MAT.yellow} />
        <Pipe from={[0, 2.4, 0]} to={[position[0] * -1 + treeTop[0] , top[1] + 1.5, -3 + treeTop[2] - 0]} r={0.25} mat={MAT.yellow} unions={false} />
      </group>
      {/* cable from drum to top sheave to grease head */}
      <Pipe from={[3.6, 3.2, 0]} to={[top[0] - position[0], top[1] + 0.8, top[2] - position[2]]} r={0.012} mat={MAT.rubber} unions={false} />
      {showLabels && <Label position={[0, 5.2, 0]} text={'Wireline unit and crane'} />}
    </group>
  );
}

// Coiled tubing unit: reel trailer, injector head over the tree on a mast, power pack and cabin.
export function CTUnit({ position, treeTop, showLabels, active }) {
  const reel = useRef();
  useFrame((_, dt) => { if (reel.current && active) reel.current.rotation.z -= dt * 0.8; });
  const inj = [treeTop[0], treeTop[1] + 4.5, treeTop[2]];
  return (
    <group position={position} name="CT-UNIT">
      <Trailer length={12} width={2.8}>
        <group position={[1.5, 3.0, 0]} name="CT-REEL">
          <mesh ref={reel} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[2.4, 2.4, 2.2, 28]} /><meshStandardMaterial {...MAT.darkSteel} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[2.1, 2.1, 2.22, 28]} /><meshStandardMaterial color="#5b6168" metalness={0.9} roughness={0.3} /></mesh>
        </group>
        <Box size={[3.0, 2.3, 2.4]} position={[-4.0, 2.3, 0]} mat={MAT.white} name="CT-POWERPACK" />
      </Trailer>
      <Box size={[3.2, 2.6, 2.6]} position={[-2, 1.4, 6]} mat={MAT.white} name="CT-CONTROLCABIN" />
      {/* injector head and stripper over the tree; BOP stack below it */}
      <group position={[inj[0] - position[0], inj[1], inj[2] - position[2]]} name="CT-INJECTOR">
        <Box size={[1.2, 2.4, 1.0]} mat={MAT.darkSteel} name="CT-INJECTORHEAD" />
        <mesh position={[0, 1.9, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.1, 0.12, 8, 24, Math.PI]} /><meshStandardMaterial {...MAT.steel} /></mesh>
        <Cyl r={0.22} h={0.9} position={[0, -1.6, 0]} mat={MAT.steel} name="CT-STRIPPER" />
        <Box size={[0.9, 1.4, 0.7]} position={[0, -2.8, 0]} mat={MAT.darkSteel} name="CT-QUADBOP" />
      </group>
      {/* tubing from the reel over the gooseneck into the injector */}
      <Pipe from={[1.5, 5.4, 0]} to={[inj[0] - position[0], inj[1] + 2.3, inj[2] - position[2]]} r={0.035} mat={MAT.steel} unions={false} />
      {showLabels && <Label position={[0, 6.5, 0]} text={'Coiled tubing unit'} />}
    </group>
  );
}

export function FlowbackSpread({ position, showLabels, flaring }) {
  const flame = useRef();
  useFrame((state) => { if (flame.current) { const s = flaring ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.2 : 0.001; flame.current.scale.set(s, s * 1.3, s); } });
  return (
    <group position={position} name="FB-SPREAD">
      <group position={[0, 0, 0]} name="FB-CHOKEMANIFOLD">
        <Box size={[2.4, 0.2, 2.4]} position={[0, 0.1, 0]} mat={MAT.yellow} />
        <PipeRun points={[[-1.2, 0.9, -0.6], [1.2, 0.9, -0.6]]} r={0.07} />
        <PipeRun points={[[-1.2, 0.9, 0.6], [1.2, 0.9, 0.6]]} r={0.07} />
        <GateValveBlock open={1} kind="manual" axis="horizontal" bore={0.07} position={[0, 0.9, -0.6]} />
        <GateValveBlock open={1} kind="manual" axis="horizontal" bore={0.07} position={[0, 0.9, 0.6]} />
      </group>
      <group position={[4, 0, 0]} name="FB-PLUGCATCHER">
        <Cyl r={0.4} h={2.4} position={[-0.6, 1.4, 0]} mat={MAT.darkSteel} />
        <Cyl r={0.4} h={2.4} position={[0.6, 1.4, 0]} mat={MAT.darkSteel} />
      </group>
      <group position={[8, 0, 0]} name="FB-SANDSEPARATOR">
        <Cyl r={0.7} h={3.2} position={[0, 1.8, 0]} mat={MAT.steel} />
        <Cyl r={0.7} r2={0.2} h={0.8} position={[0, 0.2 + 0.4, 0]} mat={MAT.darkSteel} />
      </group>
      <group position={[13, 0, 0]} name="FB-SEPARATOR">
        <Cyl r={1.1} h={6} rotation={[0, 0, Math.PI / 2]} position={[0, 1.9, 0]} mat={MAT.white} />
        <Box size={[6.2, 0.8, 0.3]} position={[0, 0.4, 0.8]} mat={MAT.darkSteel} />
        <Box size={[6.2, 0.8, 0.3]} position={[0, 0.4, -0.8]} mat={MAT.darkSteel} />
      </group>
      <group position={[22, 0, -6]} name="FB-FLARESTACK">
        <Cyl r={0.18} h={12} position={[0, 6, 0]} mat={MAT.darkSteel} />
        <mesh ref={flame} position={[0, 12.6, 0]}>
          <coneGeometry args={[0.7, 2.2, 10]} />
          <meshStandardMaterial color="#ff8a00" emissive="#ff5a00" emissiveIntensity={2.5} transparent opacity={0.85} />
        </mesh>
      </group>
      <group position={[18, 0, 6]} name="FB-TANKS">
        {[0, 1, 2].map(i => <Box key={i} size={[3, 3, 12]} position={[i * 3.4, 1.5, 0]} mat={MAT.steel} />)}
      </group>
      {showLabels && <Label position={[8, 5, 0]} text={'Flowback: chokes, plug catcher, sand separator, test separator, flare, tanks'} />}
    </group>
  );
}

export function RedZone({ visible, radius = 14 }) {
  if (!visible) return null;
  return (
    <mesh position={[-6, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.3, radius, 64]} />
      <meshBasicMaterial color="#ff2a2a" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial {...MAT.ground} />
      </mesh>
      <gridHelper args={[400, 80, '#3a3f47', '#2a2f36']} position={[0, 0.0, 0]} />
    </group>
  );
}
