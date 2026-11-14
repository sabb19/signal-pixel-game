# SIGNAL — cinematic "L'arrivo": Myra raggiunge la stazione sotto la neve.
# Uso:  /Applications/Blender.app/Contents/MacOS/Blender -b -P cinematics/shot_arrivo.py -- [anteprima]
# Scena tutta procedurale (nessun file esterno): terreno innevato, antenna parabolica, stazione,
# Myra stilizzata che cammina, neve, nebbia volumetrica, luce rossa che lampeggia, camera a gru.
import bpy, bmesh, math, sys, os, random
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = 'anteprima' in ARGS
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'render', 'arrivo')
FPS, SECONDS = 24, 8
random.seed(7)

# ---------- scena pulita
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, FPS * SECONDS
sc.render.fps = FPS

def mat(name, color, emit=None, strength=0.0, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

def link(obj, m):
    obj.data.materials.append(m); return obj

SNOW = mat('neve', (0.78, 0.84, 0.95), rough=0.6)
METAL = mat('metallo', (0.55, 0.6, 0.66), rough=0.35, metal=0.8)
DARK = mat('scuro', (0.08, 0.09, 0.11), rough=0.7)
CONC = mat('cemento', (0.32, 0.34, 0.38), rough=0.9)
WARM = mat('finestra', (1, 0.6, 0.25), emit=(1, 0.55, 0.2), strength=12)
RED = mat('faro', (1, 0.05, 0.05), emit=(1, 0.04, 0.03), strength=0)
JACKET = mat('giacca', (0.35, 0.2, 0.1), rough=0.9)
SCARF = mat('sciarpa', (0.55, 0.05, 0.05), rough=0.9)
JEANS = mat('jeans', (0.08, 0.12, 0.25), rough=0.9)
HAIR = mat('capelli', (0.03, 0.03, 0.04), rough=0.6)
PACK = mat('zaino', (0.12, 0.2, 0.12), rough=0.9)
SKIN = mat('pelle', (0.85, 0.65, 0.52), rough=0.6)

# ---------- terreno: pendio innevato con rilievi
bpy.ops.mesh.primitive_grid_add(x_subdivisions=160, y_subdivisions=160, size=260, location=(0, 60, 0))
ground = bpy.context.object; ground.name = 'terreno'
for v in ground.data.vertices:
    x, y = v.co.x, v.co.y
    h = 0.0
    h += max(0, (y - 40)) * 0.22                         # la montagna sale verso il fondo
    h += 2.2 * math.sin(x * 0.07) * math.cos(y * 0.05)
    h += 0.6 * math.sin(x * 0.31 + y * 0.17)
    if abs(x) < 3.2 and y < 70: h *= 0.15                # il sentiero
    v.co.z = h
bpy.ops.object.shade_smooth()
link(ground, SNOW)

# montagne lontane
for i in range(9):
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=random.uniform(30, 55), depth=random.uniform(40, 80),
                                    location=(random.uniform(-160, 160), random.uniform(180, 260), 0))
    m = bpy.context.object; m.rotation_euler.z = random.uniform(0, 3); link(m, SNOW)

# ---------- la stazione
def box(name, loc, size, m):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object; o.name = name; o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); return link(o, m)

base_z = 5.5
box('stazione', (0, 66, base_z + 3), (16, 9, 6), CONC)
box('tetto', (0, 66, base_z + 6.2), (16.6, 9.6, 0.5), DARK)
for i, x in enumerate([-5, -1.5, 4]):
    box(f'finestra{i}', (x, 61.45, base_z + 3.4), (1.6, 0.1, 1.2), WARM if i != 1 else DARK)
box('porta', (1.2, 61.45, base_z + 1.6), (1.6, 0.1, 2.6), DARK)
bpy.ops.object.light_add(type='POINT', location=(-5, 60, base_z + 3.4)); l = bpy.context.object; l.data.energy = 900; l.data.color = (1, 0.55, 0.25)

# ---------- l'antenna parabolica
px, py, pz = 14, 78, base_z
box('pilone', (px, py, pz + 7), (3, 3, 14), METAL)
bpy.ops.mesh.primitive_cylinder_add(radius=2.6, depth=2, location=(px, py, pz + 14.5)); link(bpy.context.object, METAL)
# parabola: semisfera schiacciata, inclinata verso il cielo
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=11, location=(px, py, pz + 22))
dish = bpy.context.object; dish.name = 'parabola'
bm = bmesh.new(); bm.from_mesh(dish.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > -3.0], context='VERTS')
bm.to_mesh(dish.data); bm.free()
dish.scale = (1, 1, 0.55)
dish.rotation_euler = (math.radians(-130), 0, math.radians(20))
mod = dish.modifiers.new('spessore', 'SOLIDIFY'); mod.thickness = 0.3
bpy.ops.object.shade_smooth(); link(dish, METAL)
# braccio e illuminatore
bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=12, location=(px - 1.5, py - 4, pz + 25), rotation=(math.radians(50), 0, math.radians(20))); link(bpy.context.object, METAL)
# il faro rosso in cima
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(px - 3, py - 8, pz + 30)); beacon = bpy.context.object; link(beacon, RED)
bpy.ops.object.light_add(type='POINT', location=(px - 3, py - 8.6, pz + 30)); beacon_l = bpy.context.object; beacon_l.data.color = (1, 0.05, 0.03); beacon_l.data.energy = 0
for f in range(1, sc.frame_end + 1, FPS):          # lampeggia una volta al secondo
    for off, on in [(0, 0), (2, 1), (7, 0)]:
        fr = f + off
        RED.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 40 * on
        RED.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].keyframe_insert('default_value', frame=fr)
        beacon_l.data.energy = 6000 * on; beacon_l.data.keyframe_insert('energy', frame=fr)

# pali della luce lungo il sentiero, uno spento e uno acceso
for i, y in enumerate([20, 38]):
    box(f'palo{i}', (3.5, y, 2.5 + y * 0.0), (0.2, 0.2, 5), DARK)
bpy.ops.object.light_add(type='SPOT', location=(3.2, 38, 5)); sp = bpy.context.object
sp.data.energy = 1500; sp.data.color = (1, 0.7, 0.4); sp.data.spot_size = math.radians(70); sp.rotation_euler = (0, 0, 0)

# ---------- Myra stilizzata (gruppo di forme), cammina sul sentiero
myra = bpy.data.objects.new('Myra', None); sc.collection.objects.link(myra)
def part(name, kind, loc, scale, m, parent=myra):
    if kind == 'cyl': bpy.ops.mesh.primitive_cylinder_add(vertices=16, location=loc)
    elif kind == 'sph': bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=loc)
    else: bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale; link(o, m); o.parent = parent
    bpy.ops.object.shade_smooth(); return o
part('busto', 'cyl', (0, 0, 1.25), (0.26, 0.18, 0.36), JACKET)
part('sciarpa', 'cyl', (0, 0, 1.62), (0.2, 0.17, 0.08), SCARF)
part('testa', 'sph', (0, 0, 1.82), (0.15, 0.15, 0.17), SKIN)
part('capelli', 'sph', (0, 0.02, 1.86), (0.18, 0.18, 0.19), HAIR)
part('zaino', 'cube', (0, 0.24, 1.28), (0.2, 0.1, 0.24), PACK)
legs, arms = [], []
for side in (-1, 1):
    hip = bpy.data.objects.new(f'anca{side}', None); sc.collection.objects.link(hip); hip.parent = myra; hip.location = (side * 0.11, 0, 0.9)
    part(f'gamba{side}', 'cyl', (0, 0, -0.42), (0.09, 0.09, 0.44), JEANS, hip)
    part(f'scarpa{side}', 'cube', (0, -0.06, -0.86), (0.08, 0.13, 0.05), DARK, hip)
    legs.append(hip)
    sh = bpy.data.objects.new(f'spalla{side}', None); sc.collection.objects.link(sh); sh.parent = myra; sh.location = (side * 0.31, 0, 1.52)
    part(f'braccio{side}', 'cyl', (0, 0, -0.32), (0.07, 0.07, 0.34), JACKET, sh)
    arms.append(sh)
# cammino: avanza verso la stazione (asse +y), gambe e braccia oscillano
start, end = Vector((0.4, 4, 0)), Vector((0.2, 22, 0))
for f in range(1, sc.frame_end + 1):
    t = (f - 1) / (sc.frame_end - 1)
    p = start.lerp(end, t)
    p.z = 0.35 * math.sin(p.x) * 0 + 0.0
    myra.location = p; myra.keyframe_insert('location', frame=f)
    ph = f / FPS * 2 * math.pi * 0.9
    for i, hip in enumerate(legs):
        hip.rotation_euler.x = 0.45 * math.sin(ph + i * math.pi); hip.keyframe_insert('rotation_euler', frame=f)
    for i, sh in enumerate(arms):
        sh.rotation_euler.x = -0.35 * math.sin(ph + i * math.pi); sh.keyframe_insert('rotation_euler', frame=f)
myra.rotation_euler.z = math.radians(180)  # di spalle alla camera, verso la stazione
# Myra rivolta verso +y: il modello guarda verso -y, quindi la giriamo
myra.rotation_euler.z = 0
# torcia: un cono di luce davanti a lei
bpy.ops.object.light_add(type='SPOT', location=(0.25, -0.2, 1.3)); torch = bpy.context.object
torch.parent = myra; torch.rotation_euler = (math.radians(70), 0, 0); torch.data.energy = 120; torch.data.spot_size = math.radians(35); torch.data.color = (1, 0.85, 0.6)

# ---------- neve che cade (particelle)
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 25, 30)); em = bpy.context.object; em.name = 'nuvola'
em.hide_render = True
ps = em.modifiers.new('neve', 'PARTICLE_SYSTEM').particle_system.settings
ps.count = 9000 if not PREVIEW else 3000
ps.frame_start, ps.frame_end = -200, sc.frame_end
ps.lifetime = 400
ps.normal_factor = 0; ps.factor_random = 0.3
ps.effector_weights.gravity = 0.04
ps.brownian_factor = 0.6
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.035, location=(0, 0, -50)); flake = bpy.context.object
link(flake, mat('fiocco', (1, 1, 1), emit=(0.8, 0.85, 1), strength=0.6))
ps.render_type = 'OBJECT'; ps.instance_object = flake; ps.particle_size = 1; ps.size_random = 0.6

# ---------- mondo: notte blu, nebbia volumetrica, luna
world = bpy.data.worlds.new('notte'); sc.world = world; world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links
wn['Background'].inputs['Color'].default_value = (0.006, 0.01, 0.025, 1)
wn['Background'].inputs['Strength'].default_value = 1.0
vol = wn.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = 0.012
vol.inputs['Color'].default_value = (0.5, 0.6, 0.85, 1)
wl.new(vol.outputs['Volume'], wn['World Output'].inputs['Volume'])
bpy.ops.object.light_add(type='SUN', location=(0, 0, 50)); moon = bpy.context.object
moon.data.energy = 0.35; moon.data.color = (0.55, 0.65, 1); moon.rotation_euler = (math.radians(55), 0, math.radians(-35))

# ---------- camera: gru che parte bassa dietro Myra e sale rivelando l'antenna
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam
cam.data.lens = 28; cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 2.8
target = bpy.data.objects.new('mira', None); sc.collection.objects.link(target)
tc = cam.constraints.new('TRACK_TO'); tc.target = target; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
keys = [  # frame, posizione camera, punto guardato
    (1, (1.6, -1.5, 0.7), (0.4, 8, 1.4)),
    (int(FPS * 3.5), (2.4, 3, 2.6), (0.6, 18, 3)),
    (sc.frame_end, (4, 6, 9), (6, 60, 14)),
]
for f, cp, tp in keys:
    cam.location = cp; cam.keyframe_insert('location', frame=f)
    target.location = tp; target.keyframe_insert('location', frame=f)
cam.data.dof.focus_object = myra
for fc in (cam.animation_data.action.fcurves if cam.animation_data else []):
    for k in fc.keyframe_points: k.interpolation = 'BEZIER'; k.easing = 'EASE_IN_OUT'

# ---------- render
r = sc.render
r.engine = 'BLENDER_EEVEE'
ee = sc.eevee
ee.use_bloom = True; ee.bloom_intensity = 0.08; ee.bloom_threshold = 0.9
ee.use_volumetric_lights = True; ee.volumetric_tile_size = '8' if PREVIEW else '4'
ee.use_gtao = True; ee.use_soft_shadows = True
ee.taa_render_samples = 16 if PREVIEW else 48
r.resolution_x, r.resolution_y = (960, 540) if PREVIEW else (1280, 720)
r.resolution_percentage = 100
sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.6
r.image_settings.file_format = 'FFMPEG'
r.ffmpeg.format = 'MPEG4'; r.ffmpeg.codec = 'H264'; r.ffmpeg.constant_rate_factor = 'HIGH'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
r.filepath = OUT + ('_anteprima' if PREVIEW else '') + '.mp4'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(OUT), 'arrivo.blend'))
if 'still' in ARGS:
    sc.frame_set(int(ARGS[ARGS.index('still') + 1]) if len(ARGS) > ARGS.index('still') + 1 else 1)
    r.image_settings.file_format = 'PNG'; r.filepath = OUT + '_still.png'
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
