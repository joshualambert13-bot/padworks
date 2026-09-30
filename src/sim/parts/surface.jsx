// Procedural surface equipment. Every group is named with a record ID so the
// inspector and the build check can bind scene nodes to library records.
// Geometry is generic and representative; proportions are not OEM dimensions.
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, Cyl, Pipe, PipeRun, Trailer, Wheel, MAT, Label } from './primitives.jsx';

// Pulsing ring drawn around the valve the next-steps guidance is pointing at.
function PulseRing({ r }) {
  const ref = useRef();
  useFrame((state) => { if (ref.current) { const k = 0.55 + 0.45 * Math.sin(state.clock.elapsedTime * 4); ref.current.material.opacity = k; ref.current.scale.setScalar(1 + 0.08 * k); } });
  return (
    <mesh ref={ref} rotation={[0, 0, 0]}>
      <torusGeometry args={[r, r * 0.08, 8, 40]} />
      <meshBasicMaterial color="#ffd166" transparent opacity={0.8} depthTest={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------- valves
// A block-body gate valve. `open` is 0..1 position. kind: 'manual' | 'hydraulic'.
// axis: 'vertical' (bore along Y) or 'horizontal' (bore along X). The stem always points to -Z
// (the operator side) so actuators and handwheels line up along the pad, as on a real stack.
export const WELL_COLORS = ['#2f8f4e', '#2b62b8', '#d0d4d8', '#c23a2c', '#d9a400', '#e0762a', '#7a3fa8', '#1f9c8f', '#8a6d3b', '#4a7fb5', '#b03a6e', '#5b8a2b', '#c9c9c9', '#3d4f9a', '#a3521c', '#6d6d6d'];
export function tintMat(color, dim = false) {
  if (!color) return dim ? MAT.dimSteel : MAT.darkSteel;
  if (!dim) return { color, metalness: 0.5, roughness: 0.55 };
  const c = new THREE.Color(color).multiplyScalar(0.45);
  return { color: '#' + c.getHexString(), metalness: 0.6, roughness: 0.6 };
}
export function GateValveBlock({ open = 1, kind = 'manual', axis = 'vertical', bore = 0.18, name, position = [0, 0, 0], label, dim = false, pulse = false, tint = null }) {
  const body = bore * 2.4;     // block across the bore
  const len = bore * 3.1;      // block along the bore (between hubs)
  const ftf = bore * 6.3;      // flange face to face
  const flangeR = bore * 1.4;
  const indicator = open > 0.99 ? '#35e08f' : open < 0.01 ? '#ff4d4d' : '#ffb020';
  const stemTravel = bore * 1.1 * open;
  const matBody = tint ? tintMat(tint, dim) : dim ? MAT.dimSteel : MAT.darkSteel;
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
      {pulse && <group rotation={[Math.PI / 2, 0, 0]}><PulseRing r={body * 1.15} /></group>}
    </group>
  );
  if (axis === 'z') return <group position={position} rotation={[0, Math.PI / 2, 0]} name={name}><group rotation={[0, 0, -Math.PI / 2]}>{inner}</group></group>;
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
export function FracTree({ valves, showLabels, lubricator = false, wlStep = 'idle', bore = 0.18, dim = false, name = 'WH-FRACTREE', partner = false, focusValve = null, launcher = false, ballsLeft = 0, tint = null }) {
  const d = treeDims(bore);
  const v = valves;
  const mat = tint ? tintMat(tint, dim) : dim ? MAT.dimSteel : MAT.darkSteel;
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={partner ? undefined : name}>
      <Cyl r={1.1} r2={1.1} h={0.05} position={[0, 0.025, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.42} h={0.7} position={[0, 0.35, 0]} mat={mat} name={nm('WH-CASINGHEAD')} />
      <Cyl r={0.48} h={0.08} position={[0, 0.7, 0]} mat={MAT.steel} />
      <Cyl r={0.4} h={0.7} position={[0, 1.05, 0]} mat={mat} name={nm('WH-CASINGSPOOL')} />
      <Cyl r={0.47} h={0.08} position={[0, 1.4, 0]} mat={MAT.steel} />
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[0.62, 1.05, 0]} dim={dim} tint={tint} />
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[-0.62, 1.05, 0]} dim={dim} tint={tint} />
      <Cyl r={0.38} h={0.6} position={[0, 1.7, 0]} mat={mat} name={nm('WH-TUBINGHEAD')} />
      <Cyl r={bore * 1.4} h={d.adapterH} position={[0, d.wellheadTop + d.adapterH / 2, 0]} mat={MAT.steel} name={nm('WH-TREEADAPTER')} />
      <GateValveBlock open={v.lmv.pos} kind="manual" bore={bore} position={[0, d.lmvY, 0]} name={nm('WH-FRACTREE-LMV')} pulse={focusValve === 'lmv'} label={showLabels ? 'Lower master (manual)' : null} dim={dim} tint={tint} />
      <GateValveBlock open={v.umv.pos} kind="hydraulic" bore={bore} position={[0, d.umvY, 0]} name={nm('WH-FRACTREE-UMV')} pulse={focusValve === 'umv'} label={showLabels ? 'Upper master (hyd.)' : null} dim={dim} tint={tint} />
      <group name={nm('WH-FRACTREE-CROSS')} position={[0, d.crossY, 0]}>
        <Box size={[bore * 2.4, d.crossH, bore * 2.4 * 1.55]} mat={mat} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[bore * 1.2 + bore * 0.45, 0, 0]} mat={MAT.steel} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.2 - bore * 0.45, 0, 0]} mat={MAT.steel} />
      </group>
      {/* wing A (-X, pump-down side): manual inboard, hydraulic outboard */}
      <GateValveBlock open={1} kind="manual" axis="horizontal" bore={bore} position={[-d.wingInnerX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGA-MAN')} dim={dim} tint={tint} />
      <GateValveBlock open={v.wingA.pos} kind="hydraulic" axis="horizontal" bore={bore} position={[-d.wingOuterX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGA-HYD')} pulse={focusValve === 'wingA'} label={showLabels ? 'Wing A: manual + hyd. (pump-down)' : null} dim={dim} tint={tint} />
      {/* wing B (+X, flowback side) */}
      <GateValveBlock open={1} kind="manual" axis="horizontal" bore={bore} position={[d.wingInnerX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGB-MAN')} dim={dim} tint={tint} />
      <GateValveBlock open={v.wingB.pos} kind="hydraulic" axis="horizontal" bore={bore} position={[d.wingOuterX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGB-HYD')} pulse={focusValve === 'wingB'} label={showLabels ? 'Wing B: manual + hyd. (flowback)' : null} dim={dim} tint={tint} />
      <GateValveBlock open={v.crown.pos} kind="hydraulic" bore={bore} position={[0, d.crownY, 0]} name={nm('WH-FRACTREE-CROWN')} pulse={focusValve === 'crown'} label={showLabels ? 'Crown valve (hyd.)' : null} dim={dim} tint={tint} />
      {/* inlet block with a flanged hub toward the zipper (-X) */}
      <group name={nm('WH-FRACTREE-INLETBLOCK')} position={[0, d.inletY, 0]}>
        <Box size={[bore * 2.4, d.inletH, bore * 2.4 * 1.55]} mat={mat} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.2 - bore * 0.45, 0, 0]} mat={MAT.steel} />
        {showLabels && <Label position={[-bore * 3, bore * 1.2, 0]} text={'Inlet block (flanged spool from zipper)'} />}
      </group>
      <GateValveBlock open={v.swab.pos} kind="hydraulic" bore={bore} position={[0, d.swabY, 0]} name={nm('WH-FRACTREE-SWAB')} pulse={focusValve === 'swab'} label={showLabels ? 'Swab valve (hyd., wireline access)' : null} dim={dim} tint={tint} />
      {launcher && <BallLauncher baseY={d.swabY + d.ftf / 2} bore={bore} ballsLeft={ballsLeft} showLabels={showLabels} dim={dim} name={nm('WH-FRACTREE-BALLLAUNCHER')} />}
      {!lubricator && !launcher && (
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

// Ball launcher on top of the tree for sliding sleeve jobs: a pressure housing on the swab valve, a horizontal
// magazine holding the graduated balls behind two small isolation valves, and a hydraulic push rod that feeds
// one ball at a time into the flow stream. Generic geometry.
export function BallLauncher({ baseY, bore, ballsLeft = 0, showLabels, dim, name }) {
  const mat = dim ? MAT.dimSteel : MAT.darkSteel;
  const hH = bore * 3.2;
  const cy = baseY + bore * 0.4 + hH / 2;
  const magX = bore * 1.3 + bore * 2.6;
  return (
    <group name={name} position={[0, 0, 0]}>
      <Cyl r={bore * 1.4} h={bore * 0.4} position={[0, baseY + bore * 0.2, 0]} mat={MAT.steel} />
      <Cyl r={bore * 1.15} h={hH} position={[0, cy, 0]} mat={mat} />
      <Cyl r={bore * 1.4} h={bore * 0.45} position={[0, baseY + bore * 0.4 + hH + bore * 0.22, 0]} mat={MAT.steel} />
      <Cyl r={bore * 0.5} h={bore * 0.9} position={[0, baseY + bore * 0.4 + hH + bore * 0.9, 0]} mat={mat} />
      {/* side port, two small isolation valves, magazine tube, push cylinder */}
      <Cyl r={bore * 0.55} h={bore * 1.4} rotation={[0, 0, Math.PI / 2]} position={[bore * 1.6, cy, 0]} mat={mat} />
      <GateValveBlock open={1} kind="hydraulic" axis="horizontal" bore={bore * 0.4} position={[bore * 2.9, cy, 0]} dim={dim} />
      <GateValveBlock open={0} kind="hydraulic" axis="horizontal" bore={bore * 0.4} position={[bore * 5.4, cy, 0]} dim={dim} />
      <Cyl r={bore * 0.6} h={bore * 5.2} rotation={[0, 0, Math.PI / 2]} position={[magX + bore * 5.2, cy, 0]} mat={MAT.steel} />
      {Array.from({ length: Math.min(8, ballsLeft) }).map((_, i) => (
        <mesh key={i} position={[magX + bore * 3.0 + i * bore * 0.62, cy + bore * 0.9, 0]}><sphereGeometry args={[bore * 0.22 + i * bore * 0.012, 10, 10]} /><meshStandardMaterial color="#d8d8d8" metalness={0.3} roughness={0.4} /></mesh>
      ))}
      <Cyl r={bore * 0.38} h={bore * 1.6} rotation={[0, 0, Math.PI / 2]} position={[magX + bore * 8.6, cy, 0]} mat={MAT.blue} />
      <Cyl r={0.02} h={bore * 8} rotation={[0, 0, Math.PI / 2]} position={[magX + bore * 4, cy - bore * 0.9, bore * 0.5]} mat={MAT.rubber} />
      {showLabels && <Label position={[magX + bore * 3, cy + bore * 2.2, 0]} text={'Ball launcher (' + ballsLeft + ' balls loaded)'} />}
    </group>
  );
}

// ---------------------------------------------------------------- production tree (production phase)
// Small manual tree on the tubing head after the frac stack comes off: adapter, two masters, flow cross,
// production wing with an actuated choke to the flowline, kill wing with a gauge, swab valve, cap with gauge.
export function ProductionTree({ showLabels, name = 'UC-PRODTREE', partner = false, tint = null, lift = 'flow' }) {
  const bore = 0.078;                      // 3-1/16 in.
  const body = tint ? tintMat(tint, partner) : MAT.darkSteel;
  const ftf = bore * 6.6;
  const nm = (k) => (partner ? undefined : k);
  let y = 2.0;
  const adH = bore * 2.2 + 0.2;
  const adY = y + adH / 2; y += adH;
  const lmvY = y + ftf / 2; y += ftf;
  const umvY = y + ftf / 2; y += ftf;
  const crossH = bore * 3.4;
  const crossY = y + crossH / 2; y += crossH;
  const swabY = y + ftf / 2; y += ftf;
  const capY = y;
  const wingX = bore * 1.2 + bore * 0.7 + ftf / 2;
  const chokeX = wingX + ftf / 2 + bore * 3.0;
  return (
    <group name={partner ? undefined : name}>
      <Cyl r={1.1} r2={1.1} h={0.05} position={[0, 0.025, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.42} h={0.7} position={[0, 0.35, 0]} mat={MAT.darkSteel} name={nm('WH-CASINGHEAD')} />
      <Cyl r={0.48} h={0.08} position={[0, 0.7, 0]} mat={MAT.steel} />
      <Cyl r={0.4} h={0.7} position={[0, 1.05, 0]} mat={MAT.darkSteel} name={nm('WH-CASINGSPOOL')} />
      <Cyl r={0.47} h={0.08} position={[0, 1.4, 0]} mat={MAT.steel} />
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[0.62, 1.05, 0]} />
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[-0.62, 1.05, 0]} />
      <Cyl r={0.38} h={0.6} position={[0, 1.7, 0]} mat={MAT.darkSteel} name={nm('WH-TUBINGHEAD')} />
      <Cyl r={bore * 1.5} h={adH} position={[0, adY, 0]} mat={MAT.steel} name={nm('UC-PRODTREE-TUBINGHEADADAPTER')} />
      <GateValveBlock open={1} kind="manual" bore={bore} position={[0, lmvY, 0]} tint={tint} name={nm('UC-PRODTREE-LMV')} label={showLabels ? 'Lower master' : null} />
      <GateValveBlock open={1} kind="manual" bore={bore} position={[0, umvY, 0]} tint={tint} name={nm('UC-PRODTREE-UMV')} label={showLabels ? 'Upper master' : null} />
      <group name={nm('UC-PRODTREE-FLOWCROSS')} position={[0, crossY, 0]}>
        <Box size={[bore * 2.4, crossH, bore * 3.7]} mat={body} />
        <Cyl r={bore * 1.5} h={bore * 0.7} rotation={[0, 0, Math.PI / 2]} position={[bore * 1.2 + bore * 0.35, 0, 0]} mat={MAT.steel} />
        <Cyl r={bore * 1.5} h={bore * 0.7} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.2 - bore * 0.35, 0, 0]} mat={MAT.steel} />
      </group>
      {/* production wing (+X): wing valve, choke with actuator, flowline drop */}
      <GateValveBlock open={1} kind="manual" axis="horizontal" bore={bore} position={[wingX, crossY, 0]} tint={tint} name={nm('UC-PRODTREE-WINGVALVE')} label={showLabels ? 'Production wing' : null} />
      <group name={nm('UC-PRODTREE-CHOKE')} position={[chokeX, crossY, 0]}>
        <Box size={[bore * 3.6, bore * 2.2, bore * 2.2]} mat={MAT.darkSteel} />
        <Cyl r={bore * 0.9} h={bore * 1.2} position={[-bore * 0.4, bore * 1.6, 0]} mat={MAT.steel} />
        <Box size={[bore * 2.6, bore * 2.0, bore * 2.0]} position={[-bore * 0.4, bore * 3.6, 0]} mat={MAT.redIron} name={nm('UC-PRODTREE-ACTUATOR')} />
        {showLabels && <Label position={[0, bore * 6, 0]} text={'Choke with actuator'} />}
      </group>
      <PipeRun points={[[chokeX + bore * 1.8, crossY, 0], [chokeX + bore * 4.5, crossY, 0], [chokeX + bore * 4.5, 0.3, 0], [chokeX + bore * 4.5, 0.3, 6.0]]} r={bore * 0.6} mat={MAT.darkSteel} />
      {/* kill wing (-X): valve and companion flange with gauge */}
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={bore} position={[-wingX, crossY, 0]} tint={tint} name={nm('UC-PRODTREE-KILLWING')} label={showLabels ? 'Kill wing' : null} />
      <Cyl r={bore * 1.5} h={bore * 0.6} rotation={[0, 0, Math.PI / 2]} position={[-wingX - ftf / 2 - bore * 0.3, crossY, 0]} mat={MAT.steel} />
      <Cyl r={bore * 0.9} h={0.04} rotation={[0, 0, Math.PI / 2]} position={[-wingX - ftf / 2 - bore * 1.4, crossY, 0]} mat={MAT.white} name={nm('UC-PRODTREE-GAUGE')} />
      <GateValveBlock open={lift === 'plunger' || lift === 'rodpump' ? 1 : 0} kind="manual" bore={bore} position={[0, swabY, 0]} tint={tint} name={nm('UC-PRODTREE-SWAB')} label={showLabels ? 'Swab valve' : null} />
      {lift === 'rodpump' ? (
        <group name={nm('AL-BEAMUNIT-STUFFINGBOX')} position={[0, capY, 0]}>
          <Box size={[bore * 3.0, bore * 2.4, bore * 2.4]} position={[0, bore * 1.2, 0]} mat={body} />
          <Cyl r={bore * 0.6} h={bore * 2.0} rotation={[0, 0, Math.PI / 2]} position={[bore * 2.4, bore * 1.2, 0]} mat={MAT.steel} />
          <Cyl r={bore * 1.1} h={bore * 2.2} position={[0, bore * 3.5, 0]} mat={MAT.steel} />
          <Cyl r={bore * 1.4} h={bore * 0.4} position={[0, bore * 4.8, 0]} mat={MAT.darkSteel} />
          {showLabels && <Label position={[bore * 3, bore * 6, 0]} text={'Pumping tee and stuffing box'} />}
        </group>
      ) : lift === 'plunger' ? (
        <group name={nm('AL-PLUNGERLIFT-LUBRICATOR')} position={[0, capY, 0]}>
          <Cyl r={bore * 1.5} h={bore * 0.6} position={[0, bore * 0.3, 0]} mat={MAT.steel} />
          <Cyl r={bore * 1.0} h={1.4} position={[0, 0.75, 0]} mat={MAT.steel} />
          <Cyl r={bore * 1.3} h={0.12} position={[0, 1.5, 0]} mat={MAT.darkSteel} />
          <Box size={[0.12, 0.1, 0.08]} position={[bore * 1.1, 1.1, 0]} mat={MAT.blue} />
          <Cyl r={0.05} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.3, 0.5, 0]} mat={MAT.steel} />
          {showLabels && <Label position={[bore * 3, 1.9, 0]} text={'Plunger lubricator and arrival sensor'} />}
        </group>
      ) : (
        <group name={nm('UC-PRODTREE-TREECAP')} position={[0, capY, 0]}>
          <Cyl r={bore * 1.5} h={bore * 0.6} position={[0, bore * 0.3, 0]} mat={MAT.steel} />
          <Cyl r={bore * 0.9} r2={bore * 0.4} h={bore * 1.4} position={[0, bore * 1.3, 0]} mat={MAT.darkSteel} />
          <Cyl r={0.02} h={bore * 2.0} position={[0, bore * 3.0, 0]} mat={MAT.steel} />
          <Cyl r={bore * 0.8} h={0.04} rotation={[Math.PI / 2, 0, 0]} position={[0, bore * 4.4, 0]} mat={MAT.white} />
          {showLabels && <Label position={[bore * 3, bore * 5, 0]} text={'Tree cap and gauge'} />}
        </group>
      )}
      {lift === 'rodpump' && <PumpingUnit topY={capY + bore * 6.0} partner={partner} showLabels={showLabels} />}
      {lift === 'esp' && <EspSurface partner={partner} showLabels={showLabels} />}
      {lift === 'gaslift' && <GasLiftSurface partner={partner} showLabels={showLabels} />}
      {lift === 'plunger' && <PlungerController partner={partner} />}
    </group>
  );
}



// ---------------------------------------------------------------- workover rig and BOP stack (production hookup)
// BOP stack on the tubing head during the hookup: adapter, drilling spool with kill and choke outlets, double ram
// preventer with bonnets, annular preventer, and a bell nipple. Generic proportions.
export function BopStack({ showLabels, name = 'RG-BOPSTACK' }) {
  const r = 0.34;
  return (
    <group name={name}>
      <Cyl r={1.1} r2={1.1} h={0.05} position={[0, 0.025, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.42} h={0.7} position={[0, 0.35, 0]} mat={MAT.darkSteel} name="WH-CASINGHEAD" />
      <Cyl r={0.48} h={0.08} position={[0, 0.7, 0]} mat={MAT.steel} />
      <Cyl r={0.4} h={0.7} position={[0, 1.05, 0]} mat={MAT.darkSteel} name="WH-CASINGSPOOL" />
      <Cyl r={0.47} h={0.08} position={[0, 1.4, 0]} mat={MAT.steel} />
      <Cyl r={0.38} h={0.6} position={[0, 1.7, 0]} mat={MAT.darkSteel} name="WH-TUBINGHEAD" />
      <Cyl r={0.5} h={0.3} position={[0, 2.15, 0]} mat={MAT.steel} name="RG-BOPSTACK-ADAPTER" />
      <group name="RG-BOPSTACK-SPOOL" position={[0, 2.75, 0]}>
        <Cyl r={r} h={0.9} mat={MAT.darkSteel} />
        <Cyl r={0.5} h={0.12} position={[0, -0.45, 0]} mat={MAT.steel} />
        <Cyl r={0.5} h={0.12} position={[0, 0.45, 0]} mat={MAT.steel} />
        <Cyl r={0.12} h={0.7} rotation={[0, 0, Math.PI / 2]} position={[0.55, 0, 0]} mat={MAT.darkSteel} />
        <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.07} position={[1.2, 0, 0]} />
        <Cyl r={0.12} h={0.7} rotation={[0, 0, Math.PI / 2]} position={[-0.55, 0, 0]} mat={MAT.darkSteel} />
        <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.07} position={[-1.2, 0, 0]} />
      </group>
      <group name="RG-BOPSTACK-RAMS" position={[0, 4.0, 0]}>
        <Box size={[1.1, 1.5, 0.9]} mat={MAT.darkSteel} />
        {[-0.35, 0.35].map((dy, i) => [1, -1].map(sx => (
          <group key={i + '-' + sx} position={[sx * 0.95, dy, 0]}>
            <Box size={[0.8, 0.5, 0.7]} mat={MAT.steel} />
            <Cyl r={0.12} h={0.6} rotation={[0, 0, Math.PI / 2]} position={[sx * 0.65, 0, 0]} mat={MAT.darkSteel} />
            <Cyl r={0.2} h={0.1} rotation={[0, 0, Math.PI / 2]} position={[sx * 0.95, 0, 0]} mat={MAT.rubber} />
          </group>
        )))}
        <Cyl r={0.55} h={0.12} position={[0, -0.8, 0]} mat={MAT.steel} />
        <Cyl r={0.55} h={0.12} position={[0, 0.8, 0]} mat={MAT.steel} />
      </group>
      <group name="RG-BOPSTACK-ANNULAR" position={[0, 5.5, 0]}>
        <Cyl r={0.62} r2={0.5} h={0.9} mat={MAT.darkSteel} />
        <Cyl r={0.5} r2={0.62} h={0.3} position={[0, 0.6, 0]} mat={MAT.darkSteel} />
        <Cyl r={0.66} h={0.12} position={[0, -0.5, 0]} mat={MAT.steel} />
      </group>
      <Cyl r={0.3} h={0.8} position={[0, 6.5, 0]} mat={MAT.steel} name="RG-BOPSTACK-BELLNIPPLE" />
      {showLabels && <Label position={[1.4, 5.5, 0]} text={'BOP stack: annular, double rams, spool'} />}
    </group>
  );
}
// Workover (completion) rig over the well: substructure, mast, crown, traveling block on a line, drawworks,
// doghouse, pipe racks with tubing. The block travels while tubing is being run.
export function WorkoverRig({ active = false, showLabels, position = [0, 0, 0] }) {
  const block = useRef();
  useFrame((state) => { if (block.current) block.current.position.y = 9.5 + (active ? 5.0 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 0.7)) : 3.0); });
  return (
    <group position={position} name="RG-WORKOVERRIG">
      <Box size={[6.0, 2.2, 5.0]} position={[3.0, 1.1, 0]} mat={MAT.dimSteel} name="RG-WORKOVERRIG-SUBSTRUCTURE" />
      <Box size={[6.0, 0.3, 5.0]} position={[3.0, 2.35, 0]} mat={MAT.darkSteel} />
      {[[-1.4, 1.2], [-1.4, -1.2], [1.4, 1.2], [1.4, -1.2]].map(([dx, dz], i) => (
        <Cyl key={i} r={0.12} h={18} position={[0.1 + dx * 0.5, 2.5 + 9, dz]} rotation={[0, 0, 0]} mat={MAT.redIron} />
      ))}
      {[4, 8, 12, 16].map((h, i) => <Box key={i} size={[1.6, 0.1, 2.6]} position={[0.1, 2.5 + h, 0]} mat={MAT.redIron} />)}
      <Box size={[2.0, 0.6, 3.0]} position={[0.1, 20.6, 0]} mat={MAT.darkSteel} name="RG-WORKOVERRIG-CROWN" />
      <group ref={block} position={[0, 12, 0]} name="RG-WORKOVERRIG-BLOCK">
        <Box size={[0.5, 1.4, 0.7]} mat={MAT.darkSteel} />
        <Box size={[0.4, 0.8, 0.5]} position={[0, -1.1, 0]} mat={MAT.steel} />
        <Cyl r={0.05} h={2.4} position={[0, -2.4, 0]} mat={MAT.steel} />
      </group>
      <Cyl r={0.02} h={12} position={[0, 15, 0.35]} mat={MAT.rubber} />
      <Box size={[2.0, 1.4, 1.6]} position={[4.6, 3.2, 1.4]} mat={MAT.darkSteel} name="RG-WORKOVERRIG-DRAWWORKS" />
      <Box size={[2.4, 2.2, 2.4]} position={[4.5, 3.6, -1.6]} mat={MAT.white} name="RG-WORKOVERRIG-DOGHOUSE" />
      <Trailer length={12} width={2.8} position={[9.5, 0, 0]}><Box size={[2.8, 2.2, 2.4]} position={[-4.2, 2.2, 0]} mat={MAT.white} /></Trailer>
      {/* pipe rack with tubing joints */}
      <group position={[8.0, 0, 5.5]} name="RG-WORKOVERRIG-PIPERACK">
        <Box size={[0.3, 1.2, 4.0]} position={[-4, 0.6, 0]} mat={MAT.yellow} />
        <Box size={[0.3, 1.2, 4.0]} position={[4, 0.6, 0]} mat={MAT.yellow} />
        {Array.from({ length: 12 }).map((_, i) => <Cyl key={i} r={0.04} h={9.5} rotation={[0, 0, Math.PI / 2]} position={[0, 1.3 + Math.floor(i / 6) * 0.1, -1.5 + (i % 6) * 0.6]} mat={MAT.steel} />)}
      </group>
      {showLabels && <Label position={[2, 22, 0]} text={'Workover rig (tubing run)'} />}
    </group>
  );
}

// ---------------------------------------------------------------- artificial lift (production phase)
// Conventional beam pumping unit on a skid west of the tree, horsehead over the well. The crank turns, the beam
// rocks, the bridle and polished rod follow. Generic proportions of a mid-size unit.
export function PumpingUnit({ topY = 3.0, partner = false, showLabels }) {
  const beam = useRef(); const crankL = useRef(); const crankR = useRef(); const pitman = useRef(); const rod = useRef();
  const pivot = [-4.6, 3.9, 0];        // center bearing (world, relative to the well)
  const beamLen = 7.0, headR = 1.7;
  const reducer = [-6.7, 1.5, 0], crankLen = 0.95;
  useFrame((state) => {
    const th = state.clock.elapsedTime * 1.2 * (partner ? 0.9 : 1);
    const tilt = 0.16 * Math.sin(th);
    if (beam.current) beam.current.rotation.z = tilt;
    if (crankL.current) crankL.current.rotation.z = th;
    if (crankR.current) crankR.current.rotation.z = th;
    if (pitman.current) {
      const px = reducer[0] + crankLen * Math.cos(th), py = reducer[1] + crankLen * Math.sin(th);
      const tx = pivot[0] - (beamLen / 2 - 0.4) * Math.cos(tilt), ty = pivot[1] - (beamLen / 2 - 0.4) * Math.sin(tilt) - 0.3;
      const dx = tx - px, dy = ty - py; const L = Math.hypot(dx, dy);
      pitman.current.position.set((px + tx) / 2, (py + ty) / 2, 0);
      pitman.current.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      pitman.current.scale.y = L;
    }
    if (rod.current) rod.current.position.y = 0.15 + headR * Math.sin(tilt) * 0.5;
  });
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={nm('AL-BEAMUNIT')}>
      <Box size={[5.8, 0.3, 1.9]} position={[-5.1, 0.15, 0]} mat={MAT.darkSteel} name={nm('AL-BEAMUNIT-BASE')} />
      {/* Samson post: three legs to the center bearing */}
      {[[-6.0, 0.7], [-6.0, -0.7], [-3.7, 0]].map(([x, z], i) => {
        const dx = pivot[0] - x, dy = pivot[1] - 0.3, dz = -z; const L = Math.hypot(dx, dy, dz);
        return <Box key={i} size={[0.2, L, 0.2]} position={[(x + pivot[0]) / 2, (0.3 + pivot[1]) / 2, z / 2]} rotation={[Math.atan2(dz, dy) * 0, 0, -Math.atan2(dx, dy)]} mat={MAT.redIron} name={i === 0 ? nm('AL-BEAMUNIT-SAMSONPOST') : undefined} />;
      })}
      <Box size={[0.6, 0.25, 1.0]} position={pivot} mat={MAT.darkSteel} />
      {/* walking beam with horsehead at the +X end and the equalizer at the tail */}
      <group ref={beam} position={pivot} name={nm('AL-BEAMUNIT-WALKINGBEAM')}>
        <Box size={[beamLen, 0.5, 0.35]} position={[0, 0.25, 0]} mat={MAT.redIron} />
        <mesh position={[beamLen / 2 - 0.3, -0.7, 0]} rotation={[Math.PI / 2, 0, 0]} name={nm('AL-BEAMUNIT-HORSEHEAD')}>
          <cylinderGeometry args={[headR, headR, 0.4, 24, 1, false, -0.5, 1.7]} />
          <meshStandardMaterial {...MAT.redIron} side={THREE.DoubleSide} />
        </mesh>
        <Box size={[0.5, 0.25, 1.6]} position={[-beamLen / 2 + 0.4, -0.05, 0]} mat={MAT.darkSteel} name={nm('AL-BEAMUNIT-EQUALIZER')} />
      </group>
      {/* pitman arm (scaled to length each frame), cranks, counterweights, reducer, motor and belt guard */}
      <group ref={pitman} name={nm('AL-BEAMUNIT-PITMAN')}><Box size={[0.16, 1, 0.16]} position={[0, 0, 0.75]} mat={MAT.darkSteel} /><Box size={[0.16, 1, 0.16]} position={[0, 0, -0.75]} mat={MAT.darkSteel} /></group>
      {[[crankL, 0.95], [crankR, -0.95]].map(([ref, z], i) => (
        <group key={i} ref={ref} position={[reducer[0], reducer[1], z]} name={i === 0 ? nm('AL-BEAMUNIT-CRANK') : undefined}>
          <Box size={[crankLen * 2 + 0.6, 0.35, 0.12]} mat={MAT.darkSteel} />
          <Box size={[0.75, 0.55, 0.28]} position={[-crankLen + 0.1, 0, z > 0 ? 0.2 : -0.2]} mat={MAT.rubber} name={i === 0 ? nm('AL-BEAMUNIT-COUNTERWEIGHT') : undefined} />
        </group>
      ))}
      <Box size={[1.3, 1.1, 1.5]} position={[reducer[0], reducer[1] - 0.1, 0]} mat={MAT.darkSteel} name={nm('AL-BEAMUNIT-GEARREDUCER')} />
      <Box size={[1.5, 0.5, 1.7]} position={[reducer[0], 0.55, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.3} h={0.8} rotation={[0, 0, Math.PI / 2]} position={[-8.4, 0.75, 0]} mat={MAT.darkSteel} name={nm('AL-BEAMUNIT-PRIMEMOVER')} />
      <Box size={[2.2, 0.9, 0.12]} position={[-7.6, 1.3, -0.95]} rotation={[0, 0, 0.35]} mat={MAT.redIron} name={nm('AL-BEAMUNIT-BELTGUARD')} />
      {/* bridle and polished rod over the well */}
      <group ref={rod} name={nm('AL-BEAMUNIT-POLISHEDROD')}>
        <Cyl r={0.012} h={pivot[1] + 0.3 - topY} position={[0, topY + (pivot[1] + 0.3 - topY) / 2, 0.08]} mat={MAT.rubber} />
        <Cyl r={0.012} h={pivot[1] + 0.3 - topY} position={[0, topY + (pivot[1] + 0.3 - topY) / 2, -0.08]} mat={MAT.rubber} />
        <Box size={[0.35, 0.12, 0.4]} position={[0, topY + 0.6, 0]} mat={MAT.steel} />
        <Cyl r={0.02} h={1.3} position={[0, topY + 0.1, 0]} mat={MAT.white} />
      </group>
      {showLabels && <Label position={[-5, 6.2, 0]} text={'Beam pumping unit (rod pump)'} />}
    </group>
  );
}
// ESP surface: variable speed drive and transformer on a skid, junction box, cable to the wellhead penetrator.
export function EspSurface({ partner = false, showLabels }) {
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={nm('AL-ESP-SURFACE')}>
      <Box size={[3.0, 0.2, 2.0]} position={[-4.5, 0.1, 3.0]} mat={MAT.dimSteel} />
      <Box size={[1.2, 2.0, 0.8]} position={[-5.2, 1.2, 3.0]} mat={MAT.blue} name={nm('AL-ESP-VSD')} />
      <Box size={[1.2, 1.4, 1.2]} position={[-3.7, 0.9, 3.0]} mat={MAT.steel} name={nm('AL-ESP-TRANSFORMER')} />
      {[-0.35, 0, 0.35].map((dz, i) => <Box key={i} size={[1.3, 1.2, 0.05]} position={[-3.7, 0.9, 3.0 + dz]} mat={MAT.darkSteel} />)}
      <Box size={[0.4, 0.5, 0.3]} position={[-1.6, 1.6, 1.4]} mat={MAT.steel} name={nm('AL-ESP-JUNCTIONBOX')} />
      <Cyl r={0.04} h={1.6} position={[-1.6, 0.8, 1.4]} mat={MAT.darkSteel} />
      <PipeRun points={[[-4.6, 1.9, 3.0], [-1.6, 1.9, 1.4], [-0.5, 1.9, 0.3], [-0.42, 1.55, 0.2]]} r={0.03} mat={MAT.rubber} />
      <Box size={[0.22, 0.22, 0.22]} position={[-0.42, 1.5, 0.2]} mat={MAT.brass} name={nm('AL-ESP-PENETRATOR')} />
      {showLabels && <Label position={[-4.5, 3.0, 3.0]} text={'ESP drive, transformer, and cable'} />}
    </group>
  );
}
// Gas lift surface: compressor skid with cooler, injection line to the casing side outlet, meter run.
export function GasLiftSurface({ partner = false, showLabels }) {
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={nm('AL-GASLIFT-SURFACE')}>
      <Box size={[5.0, 0.25, 2.2]} position={[-8.0, 0.12, 5.0]} mat={MAT.yellow} name={nm('AL-GASLIFT-COMPRESSOR')} />
      <Cyl r={0.5} h={2.0} rotation={[0, 0, Math.PI / 2]} position={[-9.2, 1.0, 5.0]} mat={MAT.darkSteel} />
      <Box size={[1.4, 1.2, 1.2]} position={[-7.0, 0.85, 5.0]} mat={MAT.steel} />
      <Box size={[1.6, 1.8, 0.5]} position={[-6.0, 1.3, 5.0]} mat={MAT.darkSteel} />
      <Cyl r={0.45} h={2.4} rotation={[0, 0, Math.PI / 2]} position={[-8.0, 2.0, 4.2]} mat={MAT.steel} />
      <PipeRun points={[[-5.6, 0.6, 5.0], [-2.5, 0.6, 5.0], [-2.5, 0.6, 0.0], [-1.2, 1.05, 0.0], [-0.9, 1.05, 0.0]]} r={0.05} mat={MAT.yellow} name={nm('AL-GASLIFT-INJECTIONLINE')} />
      <Box size={[0.3, 0.3, 0.3]} position={[-2.5, 0.75, 2.5]} mat={MAT.blue} name={nm('AL-GASLIFT-METER')} />
      {showLabels && <Label position={[-8, 3.4, 5]} text={'Gas lift compressor and injection line'} />}
    </group>
  );
}
// Plunger lift controller on a post with a solar panel, and the motor valve on the flowline.
export function PlungerController({ partner = false }) {
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={nm('AL-PLUNGERLIFT-CONTROLLER')}>
      <Cyl r={0.04} h={2.2} position={[2.2, 1.1, 1.6]} mat={MAT.darkSteel} />
      <Box size={[0.4, 0.5, 0.25]} position={[2.2, 1.7, 1.6]} mat={MAT.steel} />
      <Box size={[0.7, 0.5, 0.04]} position={[2.2, 2.4, 1.5]} rotation={[-0.6, 0, 0]} mat={{ color: '#1c2f5a', metalness: 0.4, roughness: 0.3 }} />
      <Box size={[0.3, 0.45, 0.3]} position={[1.9, 2.75, 0]} mat={MAT.blue} name={nm('AL-PLUNGERLIFT-MOTORVALVE')} />
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
// Vertical zipper: the missile treating line enters through an inlet isolation valve into a low header along the
// skid. Each well has a vertical leg off the header: a lower isolation valve, an upper working valve, and a top
// elbow that turns toward the tree at the leg's outlet flange. Well 0 binds to the store's zipIso and zipWork
// valves; partner wells open both while they are being pumped, the lower one only while they wait.
export const ZIPPER_X = -8;
export function zipperDims(bore) {
  const bz = Math.min(bore, 0.18);
  const ftf = bz * 6.3;
  const headerY = 0.55;
  const isoY = headerY + 0.5 + ftf / 2;
  const workY = isoY + ftf + 0.18;
  const topY = treeDims(bore).inletY;      // the top elbow sits at the tree inlet height: a level spool runs to the inlet block
  return { bz, ftf, headerY, isoY, workY, topY, outletX: 1.9 };
}
// Layout from pad photographs (proportions only): the header lies low along the ground on pipe supports, each leg
// stands on its own small base, and the flanged line from the top elbow runs level to the top of the tree.
export function ZipperManifold({ valves, showLabels, position = [ZIPPER_X, 0, 0], wellZ = [0], roles = [], bore = 0.18, focusValve = null }) {
  const n = wellZ.length;
  const z0 = wellZ[0], z1 = wellZ[n - 1];
  const len = Math.abs(z1 - z0) + 6.0;
  const zc = (z0 + z1) / 2;
  const zFront = zc - len / 2;
  const d = zipperDims(bore);
  const hx = -1.0;
  return (
    <group position={position} name="WH-ZIPPER">
      {/* inlet isolation valve from the missile, bore along the header, at the front end */}
      <Box size={[2.6, 0.2, 2.4]} position={[hx + 0.3, 0.1, zFront + 0.9]} mat={MAT.yellow} name="WH-ZIPPER-SKID" />
      <GateValveBlock open={valves.iso.pos} kind="hydraulic" axis="z" bore={d.bz} position={[hx, d.headerY, zFront + 0.9]} name="WH-ZIPPER-INLETVALVE" pulse={focusValve === 'iso'} label={showLabels ? 'Inlet isolation valve (from the missile)' : null} />
      <Pipe from={[hx, d.headerY, zFront + 0.9 + d.ftf / 2]} to={[hx, d.headerY, zc + len / 2 - 0.6]} r={d.bz * 0.62} mat={MAT.redIron} unions={false} name="WH-ZIPPER-INLETHEADER" />
      {Array.from({ length: Math.max(2, Math.round(len / 4)) }).map((_, i) => <Box key={i} size={[0.6, d.headerY - d.bz * 0.55, 0.3]} position={[hx, (d.headerY - d.bz * 0.55) / 2, zFront + 2.2 + i * 4]} mat={MAT.darkSteel} />)}
      {/* bleed valve on the far end of the header */}
      <GateValveBlock open={0} kind="manual" axis="z" bore={0.05} position={[hx, d.headerY, zc + len / 2 - 0.25]} name="WH-ZIPPER-BLEEDVALVE" />
      {wellZ.map((z, i) => {
        const role = roles[i] ? roles[i].role : 'idle';
        const isoOpen = i === 0 ? valves.zipIso.pos : role === 'wireline' || role === 'done' ? 0 : 1;
        const workOpen = i === 0 ? valves.zipWork.pos : role === 'frac' ? 1 : 0;
        return (
          <group key={i} position={[hx, 0, z]} name={i === 0 ? undefined : 'WH-ZIPPER-LEG-' + (i + 1)}>
            {/* base, tee on the header, riser to the lower valve */}
            <Box size={[2.4, 0.2, 2.2]} position={[0.2, 0.1, 0]} mat={MAT.yellow} />
            <Box size={[d.bz * 2.2, d.bz * 2.2, d.bz * 2.2]} position={[0, d.headerY, 0]} mat={MAT.darkSteel} name={i === 0 ? 'WH-ZIPPER-LEG' : undefined} />
            <Cyl r={d.bz * 0.62} h={0.5} position={[0, d.headerY + 0.25 + d.bz * 0.5, 0]} mat={MAT.steel} />
            <group rotation={[0, Math.PI / 2, 0]}>
              <GateValveBlock open={isoOpen} kind="hydraulic" bore={d.bz} position={[0, d.isoY, 0]} name={i === 0 ? 'WH-ZIPPER-ISOVALVE' : undefined} pulse={i === 0 && focusValve === 'zipIso'} label={showLabels && i === 0 ? 'Leg: lower isolation valve' : null} />
              <Cyl r={d.bz * 0.62} h={0.18} position={[0, d.isoY + d.ftf / 2 + 0.09, 0]} mat={MAT.steel} />
              <GateValveBlock open={workOpen} kind="hydraulic" bore={d.bz} position={[0, d.workY, 0]} name={i === 0 ? 'WH-ZIPPER-VALVE' : undefined} pulse={i === 0 && focusValve === 'zipWork'} label={showLabels && i === 0 ? 'Leg: upper working valve (this well)' : null} />
            </group>
            {/* riser spool from the working valve up to the top elbow at tree inlet height, with a flange at each end */}
            <Cyl r={d.bz * 0.62} h={Math.max(0.2, d.topY - d.bz * 1.2 - (d.workY + d.ftf / 2))} position={[0, (d.topY - d.bz * 1.2 + d.workY + d.ftf / 2) / 2, 0]} mat={MAT.steel} />
            <Cyl r={d.bz * 1.4} h={d.bz * 0.5} position={[0, d.workY + d.ftf / 2 + d.bz * 0.25, 0]} mat={MAT.steel} />
            <Cyl r={d.bz * 1.4} h={d.bz * 0.5} position={[0, d.topY - d.bz * 1.2 - d.bz * 0.25, 0]} mat={MAT.steel} />
            {/* top elbow block with a flanged outlet toward the tree (+X) */}
            <group name={i === 0 ? 'WH-ZIPPER-OUTLET' : undefined}>
              <Box size={[d.bz * 2.4, d.bz * 2.4, d.bz * 2.4 * 1.2]} position={[0, d.topY, 0]} mat={MAT.redIron} />
              <Cyl r={d.bz * 0.62} h={d.outletX - d.bz * 1.2} rotation={[0, 0, Math.PI / 2]} position={[d.bz * 1.2 + (d.outletX - d.bz * 1.2) / 2, d.topY, 0]} mat={MAT.redIron} />
              <Cyl r={d.bz * 1.4} h={d.bz * 0.5} rotation={[0, 0, Math.PI / 2]} position={[d.outletX - d.bz * 0.25, d.topY, 0]} mat={MAT.steel} />
              <Box size={[0.14, 0.14, 0.2]} position={[0, d.topY + d.bz * 1.2 + 0.12, 0]} mat={MAT.blue} name={i === 0 ? 'WH-ZIPPER-TRANSDUCER' : undefined} />
            </group>
          </group>
        );
      })}
      {/* hydraulic control unit and accumulator bottles on a small skid at the front, tree side */}
      <Box size={[1.6, 0.2, 1.4]} position={[1.2, 0.1, zFront + 0.9]} mat={MAT.yellow} />
      <Box size={[1.2, 1.1, 0.9]} position={[1.2, 0.75, zFront + 0.9]} mat={MAT.blue} name="WH-FRACVALVECONTROL" />
      {[0, 1, 2].map(k => <Cyl key={k} r={0.11} h={0.9} position={[0.8 + k * 0.3, 1.75, zFront + 0.9]} mat={MAT.steel} name={k === 0 ? 'WH-ZIPPER-ACCUMULATOR' : undefined} />)}
      <Pipe from={[1.0, 0.25, zFront + 1.4]} to={[1.0, 0.25, zc + len / 2 - 0.8]} r={0.04} mat={MAT.rubber} unions={false} />
      {showLabels && <Label position={[0, d.topY + 1.2, zc]} text={'Zipper manifold: ' + n + ' vertical leg' + (n > 1 ? 's' : '') + ', two valves each'} />}
    </group>
  );
}

// ---------------------------------------------------------------- missile and pumps
// Manifold trailer ("missile"): two low-pressure suction headers along the outer edges with an outlet per pump
// (butterfly valve and hose stub), and the high-pressure discharge header down the middle built from junction
// fittings, each with a radial feed port, check valve, and swivel arm to a pump. A pressure transducer and the
// relief valve sit on the header; the outlet at the front end feeds the treating line to the zipper.
export const MISSILE_PITCH = 3.6;
export function missileDims(perSide) { const len = perSide * MISSILE_PITCH + 3.0; return { len, hpY: 2.15, lpY: 1.45, hpZ: 0, lpZ: 1.15 }; }
export function Missile({ position = [-30, 0, 2], showLabels, perSide = 4, prvLifted = false, pumping = false }) {
  const d = missileDims(perSide);
  const xs = Array.from({ length: perSide }, (_, i) => (i - (perSide - 1) / 2) * MISSILE_PITCH);
  return (
    <Trailer length={d.len} width={3.0} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-MISSILE">
      {/* low-pressure side: two suction headers, one per side, fed from the blender at the rear */}
      {[-1, 1].map(side => (
        <group key={side} name={side === 1 ? 'PP-MISSILE-LPHEADER' : undefined}>
          <Pipe from={[-d.len / 2 + 0.4, d.lpY, side * d.lpZ]} to={[d.len / 2 - 1.0, d.lpY, side * d.lpZ]} r={0.28} mat={MAT.steel} unions={false} />
          <Cyl r={0.3} h={0.1} rotation={[0, 0, Math.PI / 2]} position={[d.len / 2 - 1.0, d.lpY, side * d.lpZ]} mat={MAT.darkSteel} />
          {xs.map((x, i) => (
            <group key={i} position={[x, d.lpY, side * d.lpZ]} name={i === 0 && side === 1 ? 'PP-MISSILE-LPOUTLET' : undefined}>
              <Cyl r={0.12} h={0.5} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.45]} mat={MAT.steel} />
              <Cyl r={0.2} h={0.08} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.62]} mat={MAT.darkSteel} />
              <Box size={[0.06, 0.22, 0.06]} position={[0, 0.22, side * 0.62]} mat={MAT.redIron} />
            </group>
          ))}
        </group>
      ))}
      {/* high-pressure side: junction fittings joined by flanged spools, feed ports alternate sides */}
      <group name="PP-MISSILE-HPHEADER">
        {xs.map((x, i) => (
          <group key={i} position={[x, d.hpY, d.hpZ]}>
            <Box size={[0.62, 0.62, 0.62]} mat={MAT.darkSteel} />
            <Cyl r={0.34} h={0.22} rotation={[0, 0, Math.PI / 2]} position={[0.42, 0, 0]} mat={MAT.steel} />
            <Cyl r={0.34} h={0.22} rotation={[0, 0, Math.PI / 2]} position={[-0.42, 0, 0]} mat={MAT.steel} />
            {i < perSide - 1 && <Cyl r={0.2} h={MISSILE_PITCH - 1.06} rotation={[0, 0, Math.PI / 2]} position={[MISSILE_PITCH / 2, 0, 0]} mat={MAT.darkSteel} />}
            {/* two radial feed ports per fitting, one to each side: check valve then a stub for the swivel arm */}
            {[-1, 1].map(side => (
              <group key={side} position={[0, 0, side * 0.31]} name={i === 0 && side === 1 ? 'PP-MISSILE-CHECKVALVE' : undefined}>
                <Cyl r={0.13} h={0.5} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.25]} mat={MAT.darkSteel} />
                <Cyl r={0.19} h={0.16} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.48]} mat={MAT.steel} />
                <Cyl r={0.11} h={0.5} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.81]} mat={MAT.redIron} />
              </group>
            ))}
          </group>
        ))}
        {/* outlet spool at the front (+X local) with a flange, transducer, and the relief valve with its vent line */}
        <Cyl r={0.2} h={1.3} rotation={[0, 0, Math.PI / 2]} position={[xs[perSide - 1] + 0.53 + 0.65, d.hpY, 0]} mat={MAT.darkSteel} name="PP-MISSILE-OUTLET" />
        <Cyl r={0.36} h={0.16} rotation={[0, 0, Math.PI / 2]} position={[xs[perSide - 1] + 0.53 + 1.3, d.hpY, 0]} mat={MAT.steel} />
        <Box size={[0.16, 0.22, 0.16]} position={[xs[perSide - 1] + 0.53 + 0.4, d.hpY + 0.36, 0]} mat={MAT.blue} name="PP-MISSILE-TRANSDUCER" />
        <group position={[xs[perSide - 1] + 0.53 + 0.9, d.hpY, 0]} name="PP-MISSILE-PRV">
          <Cyl r={0.12} h={0.45} position={[0, 0.45, 0]} mat={MAT.steel} />
          <Cyl r={0.17} h={0.3} position={[0, 0.8, 0]} mat={MAT.brass} />
          <PipeRun points={[[0, 0.75, 0], [0, 0.75, -0.6], [0, 0.2, -1.4], [0, 0.2, -2.6]]} r={0.06} mat={MAT.darkSteel} />
          {prvLifted && <mesh position={[0, 0.2, -3.0]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.35, 1.2, 10]} /><meshStandardMaterial color="#cfe8ff" emissive="#9fd0ff" emissiveIntensity={1.5} transparent opacity={0.7} /></mesh>}
        </group>
      </group>
      {/* walkway grating and handrail on the deck */}
      <Box size={[d.len - 1.0, 0.04, 0.8]} position={[0, 1.2, 0]} mat={MAT.dimSteel} />
      {showLabels && <Label position={[0, 3.4, 0]} text={'Missile: low-pressure suction sides, high-pressure discharge header'} />}
      {pumping && <Label position={[xs[perSide - 1] + 1.6, d.hpY + 0.9, 0]} text={'to zipper'} size={0.016} />}
    </Trailer>
  );
}

export function FracPump({ position, rotation = [0, 0, 0], online = false, rate = 0, name, electric = false }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const amp = online ? 0.004 + rate / 100 * 0.01 : 0;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 40) * amp;
  });
  return (
    <Trailer length={13} width={2.6} position={position} rotation={rotation} name={name}>
      <group ref={ref}>
        {electric ? (
          <>
            <Cyl r={0.85} h={2.8} rotation={[0, 0, Math.PI / 2]} position={[-3.6, 2.1, 0]} mat={MAT.darkSteel} name={name + '-MOTOR'} />
            <Box size={[1.6, 2.0, 1.2]} position={[-5.4, 2.2, 0.5]} mat={MAT.blue} name={name + '-VFD'} />
            <Box size={[1.2, 0.9, 1.6]} position={[-1.6, 1.7, 0]} mat={MAT.darkSteel} name={name + '-TRANSMISSION'} />
            <Pipe from={[-6.2, 1.3, 0.5]} to={[-6.2, 0.2, 0.5]} r={0.05} mat={MAT.rubber} unions={false} />
          </>
        ) : (
          <>
            <Box size={[3.2, 1.6, 2.0]} position={[-4.2, 2.0, 0]} mat={MAT.white} name={name + '-ENGINE'} />
            <Cyl r={0.12} h={1.2} position={[-4.8, 3.4, 0.6]} mat={MAT.darkSteel} />
            <Box size={[1.8, 1.2, 1.6]} position={[-1.6, 1.8, 0]} mat={MAT.darkSteel} name={name + '-TRANSMISSION'} />
          </>
        )}
        <Box size={[2.6, 1.7, 2.2]} position={[1.0, 2.05, 0]} mat={MAT.steel} name={name + '-POWEREND'} />
        <Box size={[1.4, 1.5, 2.3]} position={[3.1, 2.0, 0]} mat={MAT.darkSteel} name={name + '-FLUIDEND'} />
        {[-0.8, -0.4, 0, 0.4, 0.8].map((z, i) => (
          <Cyl key={i} r={0.12} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[3.95, 2.0, z]} mat={MAT.brass} />
        ))}
        <Pipe from={[3.6, 2.9, 0]} to={[5.6, 2.9, 0]} r={0.07} mat={MAT.redIron} unions={false} />
        <Pipe from={[3.6, 1.2, 0]} to={[5.6, 1.2, 0]} r={0.12} mat={MAT.steel} unions={false} />
        {!electric && <Box size={[3.4, 1.3, 0.35]} position={[-4.2, 3.4, 0.9]} mat={MAT.darkSteel} />}
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


// ---------------------------------------------------------------- pad furniture (proportions from pad photographs; generic shapes)
// Lined containment around the well row: dark liner with a raised berm edge.
export function Containment({ x0, x1, z0, z1 }) {
  const w = x1 - x0, l = z1 - z0;
  return (
    <group name="LG-CONTAINMENT">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.02, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[w, l]} />
        <meshStandardMaterial color="#1d2126" roughness={0.7} metalness={0.05} />
      </mesh>
      {[[x0, (z0 + z1) / 2, 0.5, l], [x1, (z0 + z1) / 2, 0.5, l], [(x0 + x1) / 2, z0, w, 0.5], [(x0 + x1) / 2, z1, w, 0.5]].map(([x, z, bw, bl], i) => (
        <mesh key={i} position={[x, 0.2, z]}><boxGeometry args={[bw, 0.4, bl]} /><meshStandardMaterial color="#23272d" roughness={0.8} /></mesh>
      ))}
    </group>
  );
}
// Sand boxes: containers stacked two high in rows, the alternative to silos on many pads.
export function SandBoxes({ position, rows = 2, perRow = 6, showLabels }) {
  return (
    <group position={position} name="LG-SANDBOXES">
      {Array.from({ length: rows * perRow * 2 }).map((_, i) => {
        const r = Math.floor(i / (perRow * 2)), k = i % (perRow * 2), col = Math.floor(k / 2), lvl = k % 2;
        return <Box key={i} size={[2.5, 2.4, 6.0]} position={[col * 2.9, 1.2 + lvl * 2.5, r * 7.0]} mat={lvl ? MAT.redIron : { color: '#7a1f18', metalness: 0.5, roughness: 0.6 }} name={i === 0 ? 'LG-SANDBOX' : undefined} />;
      })}
      {showLabels && <Label position={[perRow * 1.4, 6.5, 3]} text={'Sand boxes (stacked containers)'} />}
    </group>
  );
}
// Fuel gas trailers (CNG or LNG) parked in a row along the pad edge for gas-burning fleets.
export function FuelTrailers({ position, count = 6, showLabels }) {
  return (
    <group position={position} name="PP-FUELGAS">
      {Array.from({ length: count }).map((_, i) => (
        <Trailer key={i} length={13} width={2.6} position={[0, 0, i * 3.4]} rotation={[0, 0, 0]}>
          <Cyl r={1.2} h={11.5} rotation={[0, 0, Math.PI / 2]} position={[0, 2.45, 0]} mat={MAT.white} name={i === 0 ? 'PP-FUELGAS-TRAILER' : undefined} />
          <Box size={[1.2, 1.4, 1.6]} position={[6.0, 1.9, 0]} mat={MAT.darkSteel} />
        </Trailer>
      ))}
      {showLabels && <Label position={[0, 4.5, count * 1.7]} text={'Fuel gas trailers (CNG or LNG)'} />}
    </group>
  );
}
// Light tower: trailer, mast, four lamp heads.
export function LightTower({ position }) {
  return (
    <group position={position} name="LG-LIGHTTOWER">
      <Box size={[2.6, 0.9, 1.4]} position={[0, 0.7, 0]} mat={MAT.white} />
      <Cyl r={0.07} h={8.5} position={[0, 4.9, 0]} mat={MAT.darkSteel} />
      {[[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 9.2, dz]}><boxGeometry args={[0.45, 0.35, 0.12]} /><meshStandardMaterial color="#fff6d5" emissive="#ffe9a8" emissiveIntensity={0.8} /></mesh>
      ))}
    </group>
  );
}
// Parked pickups near the data van.
export function Pickups({ position, count = 6 }) {
  return (
    <group position={position} name="LG-PICKUPS">
      {Array.from({ length: count }).map((_, i) => (
        <group key={i} position={[0, 0, i * 3.0]}>
          <Box size={[5.6, 0.9, 2.0]} position={[0, 0.85, 0]} mat={i % 3 === 0 ? MAT.white : i % 3 === 1 ? MAT.darkSteel : { color: '#8a8f95', metalness: 0.6, roughness: 0.4 }} />
          <Box size={[2.2, 0.8, 1.9]} position={[-0.6, 1.7, 0]} mat={i % 3 === 0 ? MAT.white : i % 3 === 1 ? MAT.darkSteel : { color: '#8a8f95', metalness: 0.6, roughness: 0.4 }} />
          {[[-1.8, 0.95], [1.8, 0.95], [-1.8, -0.95], [1.8, -0.95]].map(([x, z], k) => <Wheel key={k} position={[x, 0.4, z]} r={0.4} w={0.25} />)}
        </group>
      ))}
    </group>
  );
}
// Flanged treating spools: red iron with block elbows and flange rings at every joint (large-bore monoline).
export function FlangedRun({ points, r = 0.1, name, color = null }) {
  const mat = color ? { color, metalness: 0.5, roughness: 0.55 } : MAT.redIron;
  return (
    <group name={name}>
      {points.slice(1).map((p, i) => <Pipe key={i} from={points[i]} to={p} r={r} mat={mat} unions={false} />)}
      {points.slice(1, -1).map((p, i) => {
        const a = points[i], b = points[i + 2];
        const d1 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], d2 = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
        const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1;
        const straight = (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]) / (l1 * l2) > 0.98;
        return straight
          ? <Cyl key={'e' + i} r={r * 2.1} h={r * 1.2} position={p} rotation={Math.abs(d1[1]) / l1 > 0.7 ? [0, 0, 0] : Math.abs(d1[0]) / l1 > 0.7 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} mat={MAT.darkSteel} />
          : <Box key={'e' + i} size={[r * 3.2, r * 3.2, r * 3.2]} position={p} mat={mat} />;
      })}
      {points.slice(1).map((p, i) => {
        const a = points[i]; const d = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const len = Math.hypot(...d) || 1;
        const q = [a[0] + d[0] * 0.5, a[1] + d[1] * 0.5, a[2] + d[2] * 0.5];
        const rot = Math.abs(d[1]) / len > 0.7 ? [0, 0, 0] : Math.abs(d[0]) / len > 0.7 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
        return len > 1.2 ? <group key={'f' + i}><Cyl r={r * 2.1} h={r * 0.7} position={q} rotation={rot} mat={MAT.darkSteel} /></group> : null;
      })}
    </group>
  );
}

// ---------------------------------------------------------------- fleet power
// Power for the pumps by fleet type: turbine generators, reciprocating gensets, a grid substation, a gas
// conditioning skid for dual fuel, or a fuel trailer for diesel. Generic shapes.
export function PowerGen({ fleet = 'diesel', position = [-40, 0, -34], showLabels }) {
  return (
    <group position={position} name="PP-POWERGEN">
      {fleet === 'efrac-turbine' && [0, 1].map(i => (
        <Trailer key={i} length={15} width={3.0} position={[0, 0, i * 5]} rotation={[0, 0, 0]}>
          <Box size={[9, 2.8, 2.6]} position={[1.5, 2.6, 0]} mat={MAT.white} name={i === 0 ? 'PP-POWERGEN-TURBINE' : undefined} />
          <Box size={[3.2, 3.4, 2.6]} position={[-4.8, 2.9, 0]} mat={MAT.steel} />
          <Cyl r={0.55} h={4.0} position={[-1.2, 6.0, 0]} mat={MAT.darkSteel} />
          <Box size={[2.4, 1.6, 2.0]} position={[6.2, 2.0, 0]} mat={MAT.blue} />
        </Trailer>
      ))}
      {fleet === 'efrac-turbine' && <Trailer length={12} width={2.8} position={[0, 0, 10]}><Box size={[10, 2.6, 2.5]} position={[0, 2.5, 0]} mat={MAT.blue} name="PP-POWERGEN-SWITCHGEAR" /></Trailer>}
      {fleet === 'efrac-genset' && [0, 1, 2, 3].map(i => (
        <Trailer key={i} length={13} width={2.8} position={[0, 0, i * 4.2]} rotation={[0, 0, 0]}>
          <Box size={[7, 2.6, 2.4]} position={[0.5, 2.5, 0]} mat={MAT.white} name={i === 0 ? 'PP-POWERGEN-GENSET' : undefined} />
          <Box size={[2.4, 2.6, 2.4]} position={[-4.6, 2.5, 0]} mat={MAT.darkSteel} />
          <Cyl r={0.25} h={2.0} position={[3.0, 4.6, 0.7]} mat={MAT.darkSteel} />
          <Box size={[2.0, 1.8, 2.0]} position={[5.2, 2.1, 0]} mat={MAT.blue} />
        </Trailer>
      ))}
      {fleet === 'grid' && (
        <group>
          <Box size={[8, 0.3, 8]} position={[0, 0.15, 0]} mat={MAT.dimSteel} />
          <Box size={[3.4, 2.8, 2.4]} position={[0, 1.7, 0]} mat={MAT.steel} name="PP-POWERGEN-TRANSFORMER" />
          {[-1.4, -0.7, 0, 0.7, 1.4].map((x, i) => <Box key={i} size={[0.2, 2.2, 3.0]} position={[x, 1.7, 0]} mat={MAT.darkSteel} />)}
          {[0, 1, 2].map(i => <Cyl key={i} r={0.12} h={1.6} position={[-1 + i, 3.9, 0]} mat={MAT.white} />)}
          <Box size={[2.6, 2.4, 2.0]} position={[5, 1.5, 0]} mat={MAT.blue} />
          {[0, 1, 2].map(i => <Cyl key={i} r={0.14} h={11} position={[-8 - i * 22, 5.5, -2]} mat={MAT.rubber} />)}
          {[0, 1, 2].map(i => <Box key={i} size={[0.2, 0.2, 3.0]} position={[-8 - i * 22, 10.4, -2]} mat={MAT.rubber} />)}
          {[-1.3, 0, 1.3].map((dz, i) => <Pipe key={i} from={[-8, 10.3, -2 + dz]} to={[-52, 10.3, -2 + dz]} r={0.02} mat={MAT.rubber} unions={false} />)}
        </group>
      )}
      {fleet === 'dualfuel' && (
        <group name="PP-POWERGEN-GASSKID">
          <Box size={[8, 0.3, 3]} position={[0, 0.15, 0]} mat={MAT.yellow} />
          <Cyl r={0.7} h={4.5} rotation={[0, 0, Math.PI / 2]} position={[-1, 1.4, 0.6]} mat={MAT.steel} />
          <Box size={[2.2, 2.0, 1.4]} position={[2.6, 1.3, -0.5]} mat={MAT.darkSteel} />
          <Cyl r={0.15} h={2.5} position={[2.6, 3.5, -0.5]} mat={MAT.darkSteel} />
          <Pipe from={[4, 0.6, 0]} to={[40, 0.6, 0]} r={0.08} mat={MAT.yellow} unions={false} />
        </group>
      )}
      {fleet === 'diesel' && (
        <Trailer length={12} width={2.6}><Cyl r={1.2} h={10} rotation={[0, 0, Math.PI / 2]} position={[0, 2.4, 0]} mat={MAT.white} name="PP-POWERGEN-FUELTRAILER" /></Trailer>
      )}
      {showLabels && <Label position={[0, 7.5, 2]} text={fleet === 'efrac-turbine' ? 'Turbine generators and switchgear' : fleet === 'efrac-genset' ? 'Gas reciprocating gensets' : fleet === 'grid' ? 'Grid substation' : fleet === 'dualfuel' ? 'Gas conditioning skid (dual fuel)' : 'Fuel trailer (diesel)'} />}
    </group>
  );
}

// ---------------------------------------------------------------- terrain by basin
// Value noise, deterministic, for relief and color variation.
const hash2 = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = smooth(x - i), fz = smooth(z - j);
  return lerp(lerp(hash2(i, j), hash2(i + 1, j), fx), lerp(hash2(i, j + 1), hash2(i + 1, j + 1), fx), fz);
}
export function terrainNoise(x, z) { return vnoise(x, z) * 0.6 + vnoise(x * 2.3 + 7.1, z * 2.3 + 3.7) * 0.28 + vnoise(x * 5.1 + 2.3, z * 5.1 + 9.1) * 0.12; }
// Height of the natural ground at (x, z): rolling relief scaled by the basin, flattened across the pad.
export function terrainHeight(x, z, relief, pad) {
  const base = (terrainNoise(x / 55, z / 55) - 0.5) * 2 * relief * 2.2 + (relief > 1.2 ? (terrainNoise(x / 170 + 5, z / 170 + 2) - 0.5) * 2 * relief * 5 : 0);
  const dx = Math.max(pad.x0 - x, 0, x - pad.x1), dz = Math.max(pad.z0 - z, 0, z - pad.z1);
  const dist = Math.sqrt(dx * dx + dz * dz);
  const k = smooth(Math.max(0, Math.min(1, (dist - 4) / 30)));
  return base * k - 0.02;
}

export function Ground({ terrain, pad, seed = 1 }) {
  const t = terrain || { ground: '#4b4235', pad: '#5a5245', relief: 0.5, veg: 'scrub', density: 0.1, vegColor: '#4f5b3c' };
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(720, 720, 144, 144);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const base = new THREE.Color(t.ground);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z, t.relief, pad);
      pos.setY(i, h);
      const v = 0.82 + 0.36 * terrainNoise(x / 9 + 3, z / 9 + 1);
      c.copy(base).multiplyScalar(v);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, [t.ground, t.relief, pad.x0, pad.x1, pad.z0, pad.z1]); // eslint-disable-line react-hooks/exhaustive-deps
  const padW = pad.x1 - pad.x0, padL = pad.z1 - pad.z0;
  return (
    <group>
      <mesh geometry={geom} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
      {/* the pad itself: graded caliche or crushed stone, and the lease road out to the edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(pad.x0 + pad.x1) / 2, 0.0, (pad.z0 + pad.z1) / 2]} receiveShadow>
        <planeGeometry args={[padW, padL]} />
        <meshStandardMaterial color={t.pad} roughness={1} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pad.x1 + 80, 0.01, pad.z0 + 12]} receiveShadow>
        <planeGeometry args={[160, 7]} />
        <meshStandardMaterial color={t.pad} roughness={1} metalness={0} />
      </mesh>
      {/* berm around the pad */}
      {[[pad.x0, (pad.z0 + pad.z1) / 2, 1.2, padL + 1.2], [pad.x1, (pad.z0 + pad.z1) / 2, 1.2, padL + 1.2], [(pad.x0 + pad.x1) / 2, pad.z0, padW + 1.2, 1.2], [(pad.x0 + pad.x1) / 2, pad.z1, padW + 1.2, 1.2]].map(([x, z, w, l], i) => (
        <mesh key={i} position={[x, 0.25, z]}><boxGeometry args={[w, 0.5, l]} /><meshStandardMaterial color={t.ground} roughness={1} /></mesh>
      ))}
      <Vegetation terrain={t} pad={pad} seed={seed} />
    </group>
  );
}

// Instanced vegetation outside the pad: cones for pines, canopies on trunks for hardwoods and mesquite,
// flattened spheres for scrub, brush, and sage. Density and color follow the basin.
function Vegetation({ terrain, pad, seed }) {
  const type = terrain.veg;
  const count = Math.round(Math.min(900, 900 * terrain.density));
  const { canopy, trunk } = useMemo(() => {
    const canopy = [], trunk = [];
    let k = seed * 17 + 3;
    const rnd = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    let tries = 0;
    while (canopy.length < count && tries < count * 6) {
      tries++;
      const x = (rnd() - 0.5) * 640, z = (rnd() - 0.5) * 640;
      if (x > pad.x0 - 6 && x < pad.x1 + 6 && z > pad.z0 - 6 && z < pad.z1 + 6) continue;
      if (Math.abs(z - (pad.z0 + 12)) < 6 && x > pad.x1) continue;   // keep the road clear
      const y = terrainHeight(x, z, terrain.relief, pad);
      const s = 0.7 + rnd() * 0.7;
      canopy.push({ x, y, z, s, r: rnd() * Math.PI });
      trunk.push({ x, y, z, s });
    }
    return { canopy, trunk };
  }, [count, pad.x0, pad.x1, pad.z0, pad.z1, terrain.relief, seed]);
  const canopyRef = useRef(); const trunkRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const hasTrunk = type === 'pine' || type === 'hardwood' || type === 'mesquite';
  useEffect(() => {
    if (!canopyRef.current) return;
    canopy.forEach((c, i) => {
      const h = type === 'pine' ? 7 * c.s : type === 'hardwood' ? 5 * c.s : type === 'mesquite' ? 2.6 * c.s : type === 'brush' ? 1.6 * c.s : type === 'sage' ? 0.8 * c.s : 1.1 * c.s;
      const w = type === 'pine' ? 2.2 * c.s : type === 'hardwood' ? 4.2 * c.s : type === 'mesquite' ? 3.2 * c.s : type === 'brush' ? 2.2 * c.s : type === 'sage' ? 1.3 * c.s : 1.8 * c.s;
      const lift = type === 'pine' ? h / 2 + 0.8 * c.s : type === 'hardwood' ? 3.2 * c.s : type === 'mesquite' ? 2.0 * c.s : h * 0.35;
      dummy.position.set(c.x, c.y + lift, c.z);
      dummy.rotation.set(0, c.r, 0);
      dummy.scale.set(w, h, w);
      dummy.updateMatrix();
      canopyRef.current.setMatrixAt(i, dummy.matrix);
    });
    canopyRef.current.instanceMatrix.needsUpdate = true;
    if (trunkRef.current && hasTrunk) {
      trunk.forEach((c, i) => {
        const th = type === 'pine' ? 1.6 * c.s : type === 'hardwood' ? 3.2 * c.s : 2.0 * c.s;
        dummy.position.set(c.x, c.y + th / 2, c.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.35 * c.s, th, 0.35 * c.s);
        dummy.updateMatrix();
        trunkRef.current.setMatrixAt(i, dummy.matrix);
      });
      trunkRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [canopy, trunk, type, hasTrunk, dummy]);
  if (count === 0) return null;
  return (
    <group>
      <instancedMesh ref={canopyRef} args={[null, null, canopy.length]} castShadow frustumCulled={false} key={type + canopy.length}>
        {type === 'pine' ? <coneGeometry args={[0.5, 1, 7]} /> : <sphereGeometry args={[0.5, 8, 6]} />}
        <meshStandardMaterial color={terrain.vegColor} roughness={1} />
      </instancedMesh>
      {hasTrunk && (
        <instancedMesh ref={trunkRef} args={[null, null, trunk.length]} frustumCulled={false} key={'t' + type + trunk.length}>
          <cylinderGeometry args={[0.5, 0.6, 1, 6]} />
          <meshStandardMaterial color="#4a3a2a" roughness={1} />
        </instancedMesh>
      )}
    </group>
  );
}
