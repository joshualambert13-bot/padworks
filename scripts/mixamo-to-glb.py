# Mixamo FBX to GLB for the crew (Drop 78). Run from the project folder with Blender in the background:
#
#   & "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" -b -P scripts\mixamo-to-glb.py -- "C:\Dev\Frac Completions Project\assets-in\mixamo" public\models\crew
#
# (the version number in the path is whatever Blender installed; look in C:\Program Files\Blender Foundation).
# Input: one folder of Mixamo FBX files named <character>_<animation>.fbx, where <character>_idle.fbx was
# downloaded With Skin (it carries the mesh and textures) and the others Without Skin. Output: one
# <character>.glb per character with every animation inside it (idle, walk, point, kneel, radio, hammer, whatever
# was in the folder), textures embedded as JPEG at 1024 px, Y up, ready for the site. Nothing else is changed.
import bpy, sys, os, glob

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) < 2:
    print('usage: blender -b -P scripts/mixamo-to-glb.py -- <input folder of fbx> <output folder>'); sys.exit(1)
src, dst = argv[0], argv[1]
os.makedirs(dst, exist_ok=True)

chars = {}
for f in sorted(glob.glob(os.path.join(src, '*.fbx'))):
    base = os.path.splitext(os.path.basename(f))[0]
    if '_' not in base:
        print('skipped', base, '(name it <character>_<animation>.fbx)'); continue
    name, anim = base.rsplit('_', 1)
    chars.setdefault(name.lower(), {})[anim.lower()] = f

def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, ignore_leaf_bones=True, automatic_bone_orientation=False, use_anim=True)
    return [o for o in bpy.data.objects if o not in before]

for name, anims in chars.items():
    if 'idle' not in anims:
        print('skipped', name, ': no', name + '_idle.fbx (the one downloaded With Skin)'); continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = import_fbx(anims['idle'])
    arm = next((o for o in objs if o.type == 'ARMATURE'), None)
    if arm is None:
        print('skipped', name, ': no armature in the idle file'); continue
    arm.name = name
    # Mixamo files come in centimeters; bring the rig to meters when it imported a hundred times too big
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    if arm.dimensions.z > 20:
        for o in objs:
            if o.parent is None: o.scale = (0.01, 0.01, 0.01)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    actions = {}
    if arm.animation_data and arm.animation_data.action:
        a = arm.animation_data.action; a.name = 'idle'; a.use_fake_user = True; actions['idle'] = a
    for anim, f in anims.items():
        if anim == 'idle': continue
        new = import_fbx(f)
        arm2 = next((o for o in new if o.type == 'ARMATURE'), None)
        if arm2 is not None and arm2.animation_data and arm2.animation_data.action:
            a = arm2.animation_data.action; a.name = anim; a.use_fake_user = True; actions[anim] = a
        else:
            print('  no animation found in', os.path.basename(f))
        for o in new: bpy.data.objects.remove(o, do_unlink=True)
    # every action on the armature's NLA, one strip per track, so the exporter writes them all by name
    if arm.animation_data is None: arm.animation_data_create()
    arm.animation_data.action = None
    for anim, a in actions.items():
        track = arm.animation_data.nla_tracks.new(); track.name = anim
        track.strips.new(anim, int(a.frame_range[0]), a)
    for img in bpy.data.images:
        if img.size[0] > 1024 or img.size[1] > 1024: img.scale(1024, 1024)
    out = os.path.join(dst, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_nla_strips=True, export_apply=True,
                              export_image_format='JPEG', export_jpeg_quality=80, export_skins=True, export_yup=True, export_morph=False, export_lights=False, export_cameras=False)
    print('wrote', out, 'with', ', '.join(actions.keys()))
print('done:', len(chars), 'character(s)')
