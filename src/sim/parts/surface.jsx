// Procedural surface equipment. Every group is named with a record ID so the
// inspector and the build check can bind scene nodes to library records.
// Geometry is generic and representative; proportions are not OEM dimensions.
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, Cyl, Pipe, PipeRun, Trailer, Wheel, MAT, Label } from './primitives.jsx';

// ---------------------------------------------------------------- valves
// A block-body gate valve. `open` is 0..1 position. kind: 'manual' | 'hydraulic'.
// axis: 'vertical' (bore along Y) or 'horizontal' (bore along X). The stem always points to -Z
// (the operator side) so actuators and handwheels line up along the pad, as on a real stack.
export function GateValveBlock({ open = 1, kind = 'manual', axis = 'vertical', bore = 0.18, name, position = [0, 0, 0], label, dim = false }) {
  const body = bore * 2.4;     // block across the bore
  const len = bore * 3.1;      // block along the bore (between hubs)
  const ftf = bore * 6.3;      // flange face to face
  const flangeR = bore * 1.4;
  const indicator = open > 0.99 ? '#35e08f' : open < 0.01 ? '#ff4d4d' : '#ffb020';
  const stemTravel = bore * 1.1 * open;
  const matBody = dim ? MAT.dimSteel : MAT.darkSteel;
  const inner = (
    <group>
      {/* body block, bore along local Y; hubs to the end flanges */}
      <Box size={[body, len, body * 1.55]} mat={matBody} name={name ? name + '-BODY' : undefined} />
      <Cyl r={body * 0.46} h={(ftf - len) / 2} position={[0, len / 2 + (ftf - len) / 4, 0]} mat={matBody} />
      <Cyl r={body * 0.46} h={(ftf - len) / 2} position={[0, -len / 2 - (ftf - len) / 4, 0]} mat={matBody} />
      <Cyl r={flangeR} h={bore * 0.65} position={[0, ftf / 2 - bore * 0.325, 0]} mat={MAT.steel} />
      <Cyl r={flangeR} h={bore * 0.65} position={[0, -ftf / 2 + bore * 0.325, 0]} mat={MAT.steel} />
      {/* bonnet flange on the stem side (-Z) and balance boss on the far side */}
      <Cyl r={body * 0.52} h={bore * 0.4} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -(body * 0.775 + bore * 0.2)]} mat={MAT.steel} name={name ? name + '-BONNET' : undefined} />
      <Cyl r={body * 0.33} h={bore * 0.5} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -(body * 0.775 + bore * 0.65)]} mat={matBody} />
      <Cyl r={bore * 0.17} h={bore * 0.9} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -(body * 0.775 + bore * 0.9 + stemTravel)]} mat={MAT.brass} name={name ? name + '-STEM' : undefined} />
      {kind === 'manual' ? (
        <group position={[0, 0, -(body * 0.775 + bore * 1.5 + stemTravel)]} name={name ? name + '-HANDWHEEL' : undefined}>
          <mesh><torusGeometry args={[bore * 1.35, bore * 0.11, 8, 28]} /><meshStandardMaterial {...MAT.rubber} /></mesh>
          {[0, 90].map(a => (
            <mesh key={a} rotation={[0, 0, THREE.MathUtils.degToRad(a)]}><boxGeometry args={[bore * 2.7, bore * 0.14, bore * 0.14]} /><meshStandardMaterial {...MAT.rubber} /></mesh>
          ))}
        </group>
      ) : (
        <group name={name ? name + '-ACTUATOR' : undefined}>
          {/* tie-rod cylinder: lower plate, cylinder, upper plate, four rods, indicator tube */}
          <Box size={[body * 0.95, body * 0.95, bore * 0.18]} position={[0, 0, -(body * 0.775 + bore * 0.95)]} mat={MAT.steel} />
          <Cyl r={body * 0.36} h={bore * 2.6} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -(body * 0.775 + bore * 0.95 + bore * 1.3)]} mat={matBody} />
          <Box size={[body * 0.95, body * 0.95, bore * 0.18]} position={[0, 0, -(body * 0.775 + bore * 0.95 + bore * 2.6)]} mat={MAT.steel} />
          {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b], i) => (
            <Cyl key={i} r={bore * 0.07} h={bore * 2.9} rotation={[Math.PI / 2, 0, 0]} position={[a * body * 0.42, b * body * 0.42, -(body * 0.775 + bore * 0.95 + bore * 1.3)]} mat={MAT.steel} />
          ))}
          <Cyl r={bore * 0.12} h={bore * 0.9} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -(body * 0.775 + bore * 0.95 + bore * 2.6 + bore * 0.45)]} mat={MAT.steel} />
          <Cyl r={0.015} h={bore * 0.5} position={[body * 0.36, body * 0.2, -(body * 0.775 + bore * 1.4)]} mat={MAT.rubber} />
          {/* balance stem housing on the far side */}
          <Cyl r={body * 0.2} h={bore * 1.1} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, body * 0.775 + bore * 0.55]} mat={matBody} />
        </group>
      )}
      {/* position indicator lamp */}
      <mesh position={[body * 0.3, body * 0.5, -(body * 0.775 + (kind === 'manual' ? bore * 1.5 + stemTravel : bore * 3.8))]}>
        <sphereGeometry args={[bore * 0.2, 10, 10]} />
        <meshStandardMaterial color={indicator} emissive={indicator} emissiveIntensity={1.2} />
      </mesh>
      {label && <Label position={[0, 0, -body * 1.6]} text={label} />}
    </group>
  );
  const rot = axis === 'vertical' ? [0, 0, 0] : [0, 0, -Math.PI / 2];
  return <group position={position} rotation={rot} name={name}>{inner}</group>;
}

// Tree stack heights (meters) for a nominal bore in meters, shared with the scene for crane and cable geometry.
export const BORE_M = { '4-10K': 0.103, '4-15K': 0.103, '5-10K': 0.13, '5-15K': 0.13, '7-10K': 0.18, '7-15K': 0.18 };
export function treeDims(bore) {
  const ftf = bore * 6.0;                  // valve face to face along the bore
  const crossH = bore * 3.2;
  const inletH = bore * 3.0;
  const wellheadTop = 2.0;                 // casing head, casing spool, tubing head
  const adapterH = bore * 1.6;
  const lmvY = wellheadTop + adapterH + ftf / 2;
  const umvY = lmvY + ftf;
  const crossY = umvY + ftf / 2 + crossH / 2;
  const crownY = crossY + crossH / 2 + ftf / 2;
  const inletY = crownY + ftf / 2 + inletH / 2;
  const swabY = inletY + inletH / 2 + ftf / 2;
  const topY = swabY + ftf / 2 + bore * 1.5;
  const wingInnerX = bore * 1.2 + bore * 0.9 + ftf / 2;
  const wingOuterX = wingInnerX + ftf;
  return { ftf, crossH, inletH, wellheadTop, adapterH, lmvY, umvY, crossY, crownY, inletY, swabY, topY, wingInnerX, wingOuterX };
}

// ---------------------------------------------------------------- frac tree (standard configuration)
// Wellhead, tree adapter, lower master (manual), upper master (hyd.), cross with a manual then a hydraulic
// wing valve each side, crown valve (hyd.), flanged inlet block for the spooled treating line, swab (hyd.),
// top adapter. Wing A (-X) is the pump-down side, wing B (+X) the flowback side; the inlet faces -X to the zipper.
export function FracTree({ valves, showLabels, lubricator = false, wlStep = 'idle', bore = 0.18, dim = false, name = 'WH-FRACTREE', partner = false }) {
  const d = treeDims(bore);
  const v = valves;
  const mat = dim ? MAT.dimSteel : MAT.darkSteel;
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={partner ? undefined : name}>
      <Cyl r={1.1} r2={1.1} h={0.05} position={[0, 0.025, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.42} h={0.7} position={[0, 0.35, 0]} mat={mat} name={nm('WH-CASINGHEAD')} />
      <Cyl r={0.48} h={0.08} position={[0, 0.7, 0]} mat={MAT.steel} />
      <Cyl r={0.4} h={0.7} position={[0, 1.05, 0]} mat={mat} name={nm('WH-CASINGSPOOL')} />
      <Cyl r={0.47} h={0.08} position={[0, 1.4, 0]} mat={MAT.steel} />
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[0.62, 1.05, 0]} dim={dim} />
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[-0.62, 1.05, 0]} dim={dim} />
      <Cyl r={0.38} h={0.6} position={[0, 1.7, 0]} mat={mat} name={nm('WH-TUBINGHEAD')} />
      <Cyl r={bore * 1.4} h={d.adapterH} position={[0, d.wellheadTop + d.adapterH / 2, 0]} mat={MAT.steel} name={nm('WH-TREEADAPTER')} />
      <GateValveBlock open={v.lmv.pos} kind="manual" bore={bore} position={[0, d.lmvY, 0]} name={nm('WH-FRACTREE-LMV')} label={showLabels ? 'Lower master (manual)' : null} dim={dim} />
      <GateValveBlock open={v.umv.pos} kind="hydraulic" bore={bore} position={[0, d.umvY, 0]} name={nm('WH-FRACTREE-UMV')} label={showLabels ? 'Upper master (hyd.)' : null} dim={dim} />
      <group name={nm('WH-FRACTREE-CROSS')} position={[0, d.crossY, 0]}>
        <Box size={[bore * 2.4, d.crossH, bore * 2.4 * 1.55]} mat={mat} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[bore * 1.2 + bore * 0.45, 0, 0]} mat={MAT.steel} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.2 - bore * 0.45, 0, 0]} mat={MAT.steel} />
      </group>
      {/* wing A (-X, pump-down side): manual inboard, hydraulic outboard */}
      <GateValveBlock open={1} kind="manual" axis="horizontal" bore={bore} position={[-d.wingInnerX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGA-MAN')} dim={dim} />
      <GateValveBlock open={v.wingA.pos} kind="hydraulic" axis="horizontal" bore={bore} position={[-d.wingOuterX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGA-HYD')} label={showLabels ? 'Wing A: manual + hyd. (pump-down)' : null} dim={dim} />
      {/* wing B (+X, flowback side) */}
      <GateValveBlock open={1} kind="manual" axis="horizontal" bore={bore} position={[d.wingInnerX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGB-MAN')} dim={dim} />
      <GateValveBlock open={v.wingB.pos} kind="hydraulic" axis="horizontal" bore={bore} position={[d.wingOuterX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGB-HYD')} label={showLabels ? 'Wing B: manual + hyd. (flowback)' : null} dim={dim} />
      <GateValveBlock open={v.crown.pos} kind="hydraulic" bore={bore} position={[0, d.crownY, 0]} name={nm('WH-FRACTREE-CROWN')} label={showLabels ? 'Crown valve (hyd.)' : null} dim={dim} />
      {/* inlet block with a flanged hub toward the zipper (-X) */}
      <group name={nm('WH-FRACTREE-INLETBLOCK')} position={[0, d.inletY, 0]}>
        <Box size={[bore * 2.4, d.inletH, bore * 2.4 * 1.55]} mat={mat} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.2 - bore * 0.45, 0, 0]} mat={MAT.steel} />
        {showLabels && <Label position={[-bore * 3, bore * 1.2, 0]} text={'Inlet block (flanged spool from zipper)'} />}
      </group>
      <GateValveBlock open={v.swab.pos} kind="hydraulic" bore={bore} position={[0, d.swabY, 0]} name={nm('WH-FRACTREE-SWAB')} label={showLabels ? 'Swab valve (hyd., wireline access)' : null} dim={dim} />
      {!lubricator && (
        <group name={nm('WH-FRACTREE-TOPADAPTER')} position={[0, d.swabY + d.ftf / 2, 0]}>
          <Cyl r={bore * 1.4} h={bore * 0.5} position={[0, bore * 0.25, 0]} mat={MAT.steel} />
          <Cyl r={bore * 0.9} h={bore * 0.8} position={[0, bore * 0.9, 0]} mat={mat} />
          <Cyl r={bore * 1.3} r2={bore * 0.9} h={bore * 0.4} position={[0, bore * 1.5, 0]} mat={MAT.steel} />
          {showLabels && <Label position={[bore * 2, bore * 2.2, 0]} text={'Top adapter (hands-free connector)'} />}
        </group>
      )}
      {lubricator && <Lubricator baseY={d.swabY + d.ftf / 2} wlStep={wlStep} showLabels={showLabels} />}
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
// One hydraulic valve per well on a skid along Z. Well 0 (the focus well) binds to the store's zip valve;
// partner wells open their valve while they are being pumped.
export function ZipperManifold({ valves, showLabels, position = [-8, 0, 0], wellZ = [0], roles = [], bore = 0.18 }) {
  const n = wellZ.length;
  const z0 = wellZ[0], z1 = wellZ[n - 1];
  const len = Math.abs(z1 - z0) + 4.0;
  const zc = (z0 + z1) / 2;
  const bz = Math.min(bore, 0.13);
  return (
    <group position={position} name="WH-ZIPPER">
      <Box size={[3.0, 0.25, len]} position={[0, 0.125, zc]} mat={MAT.yellow} name="WH-ZIPPER-SKID" />
      <Pipe from={[-1.2, 0.9, zc - len / 2 + 0.3]} to={[-1.2, 0.9, zc + len / 2 - 0.3]} r={0.09} mat={MAT.darkSteel} unions={false} />
      {wellZ.map((z, i) => {
        const role = roles[i] ? roles[i].role : 'idle';
        const open = i === 0 ? valves.zip.pos : role === 'frac' ? 1 : 0;
        return (
          <group key={i} position={[0, 0.9, z]}>
            <Pipe from={[-1.2, 0, 0]} to={[-0.4, 0, 0]} r={0.075} mat={MAT.redIron} unions={false} />
            <GateValveBlock open={open} kind="hydraulic" axis="horizontal" bore={bz} position={[0.2, 0, 0]} name={i === 0 ? 'WH-ZIPPER-VALVE' : undefined} label={showLabels && i === 0 ? 'Zipper valve (this well)' : null} />
            <Pipe from={[0.85, 0, 0]} to={[1.5, 0, 0]} r={0.075} mat={MAT.redIron} unions={false} />
          </group>
        );
      })}
      <Box size={[1.2, 1.1, 0.9]} position={[0.6, 0.8, zc - len / 2 + 1.0]} mat={MAT.blue} name="WH-FRACVALVECONTROL" />
      <Cyl r={0.12} h={0.9} position={[0.2, 1.8, zc - len / 2 + 1.0]} mat={MAT.steel} />
      {showLabels && <Label position={[0, 2.2, zc]} text={'Zipper manifold (' + n + ' well' + (n > 1 ? 's' : '') + ')'} />}
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
