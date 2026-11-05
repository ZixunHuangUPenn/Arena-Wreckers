import bpy,math,json,pathlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models';OUT.mkdir(parents=True,exist_ok=True)
ATLAS=ROOT/'public/assets/textures/vehicle-atlas.png'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
img=bpy.data.images.load(str(ATLAS));img.name='vehicle-atlas'
def mat(name,tile,color=(1,1,1,1),metal=.4,rough=.6):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img
 mul=m.node_tree.nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[2].default_value=color;m.node_tree.links.new(tex.outputs['Color'],mul.inputs[1]);m.node_tree.links.new(mul.outputs[0],p.inputs['Base Color']);m['tile']=tile;m['factor']=list(color);return m
def uv(obj,m):
 if not obj.data.uv_layers:
  bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.03);bpy.ops.object.mode_set(mode='OBJECT');obj.select_set(False)
 col=int(m['tile'])%4;row=int(m['tile'])//4
 for loop in obj.data.uv_layers.active.data:loop.uv=(col/4+.004+loop.uv.x*.242,1-(row+1)/2+.006+loop.uv.y*.488)
 obj.data.materials.clear();obj.data.materials.append(m)
def mesh_finish(obj,name,m,parent=None,bevel=.035):
 obj.name=name
 if parent:obj.parent=parent
 uv(obj,m)
 if bevel:
  mod=obj.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=2;obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return obj
def box(name,loc,size,m,parent=None,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return mesh_finish(o,name,m,parent,bevel)
def cyl(name,loc,radius,length,m,parent=None,axis='Z',verts=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=length,location=loc);o=bpy.context.object
 if axis=='X':o.rotation_euler[1]=math.pi/2
 elif axis=='Y':o.rotation_euler[0]=math.pi/2
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return mesh_finish(o,name,m,parent,.018)
def beam(name,a,b,r,m,parent=None):
 mid=(Vector(a)+Vector(b))/2;diff=Vector(b)-Vector(a);o=cyl(name,mid,r,diff.length,m,parent);o.rotation_euler=diff.to_track_quat('Z','Y').to_euler();return o
def hull(name,sections,m,parent=None):
 verts=[]
 for y,w,bottom,top in sections:verts.extend([(-w,y,bottom),(w,y,bottom),(w,y,top),(-w,y,top)])
 faces=[(3,2,1,0)]
 for i in range(len(sections)-1):
  for j in range(4):a=i*4+j;b=i*4+(j+1)%4;faces.append((a,b,b+4,a+4))
 k=(len(sections)-1)*4;faces.append((k,k+1,k+2,k+3));me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return mesh_finish(o,name,m,parent,.045)
def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
# Imported CC0 wheel geometry, reused on every vehicle.
wheel_template=None
wheel_path=ROOT/'public/assets/vendor/wheel-default.glb'
if wheel_path.exists():
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(wheel_path));parts=[o for o in set(bpy.data.objects)-before if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();wheel_template=bpy.context.object;wheel_template.name='CC0WheelTemplate';dims=list(wheel_template.dimensions);axis=dims.index(min(dims))
 if axis==1:wheel_template.rotation_euler[2]+=math.pi/2
 elif axis==2:wheel_template.rotation_euler[1]+=math.pi/2
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);wheel_template.hide_render=True;wheel_template.hide_set(True)
colors=[(.93,.66,.10,1),(.42,.51,.28,1),(.45,.14,.62,1),(.63,.55,.36,1),(.73,.20,.13,1)]
ids=['mantis','punisher','retro','pummeler','bigrig']
all_roots=[]
for kind,ident in enumerate(ids):
 root=empty(ident);all_roots.append(root);paint=mat('Paint_'+ident,2,colors[kind],.52,.48);steel=mat('Steel_'+ident,4,(.8,.85,.84,1),.7,.44);rubber=mat('Rubber_'+ident,5,(.7,.7,.7,1),.05,.86);glass=mat('Glass_'+ident,6,(.7,.9,1,1),.35,.22);hazard=mat('Hazard_'+ident,7,(1,1,1,1),.3,.6)
 lengths=[3.5,3.9,4.1,4.3,4.6];L=lengths[kind];W=[2.1,2.25,2.3,2.4,2.4][kind]
 hull('Armored chassis',[(-L/2,.78,.43,.65),(-L*.3,W/2,.38,.87),(L*.3,W/2,.4,.88),(L/2,.78,.48,.69)],paint,root)
 if kind==0:
  hull('Sports hood',[(.15,.8,.72,1.0),(L*.45,.72,.7,.87)],paint,root)
  hull('Angled windshield',[(-.55,.72,.84,1.38),(.18,.68,.82,1.35)],glass,root)
  for side in [-1,1]:beam('Roll cage', (side*.72,-.7,.9),(side*.66,-.55,1.5),.055,steel,root);beam('Cage roof',(side*.66,-.55,1.5),(side*.64,.12,1.45),.055,steel,root)
  box('Rear wing',(0,-1.4,1.18),(1.95,.36,.12),paint,root)
 elif kind==1:
  hull('Armored cab',[(-.2,.94,.82,1.55),(.7,.86,.8,1.5)],paint,root);hull('Front windshield',[(.68,.74,1.12,1.42),(.83,.72,1.07,1.33)],glass,root)
  box('Pickup bed',(0,-1.1,.93),(1.95,1.25,.17),steel,root)
  for side in [-1,1]:box('Bed rails',(side*.96,-1.1,1.12),(.13,1.45,.42),paint,root)
 elif kind==2:
  hull('Lowrider cabin',[(-.65,.92,.82,1.25),(.4,.83,.83,1.35)],paint,root);hull('Retro windshield',[(.35,.78,.94,1.3),(.65,.77,.88,1.1)],glass,root)
  box('Long hood',(0,1.04,.91),(1.85,1.1,.24),paint,root);box('Chrome front bumper',(0,1.95,.63),(2.1,.14,.17),steel,root)
 elif kind==3:
  hull('Eight wheel armored hull',[(-1.95,1.07,.75,1.35),(-1.3,1.1,.75,1.5),(1.2,1.05,.75,1.48),(1.95,.9,.6,1.12)],paint,root)
  for side in [-1,1]:box('Side armor',(side*1.12,0,1.02),(.12,3.6,.7),steel,root)
  box('Driver slit',(0,1.66,1.22),(1.3,.12,.18),glass,root)
 else:
  hull('Truck cab',[(.2,1.02,.8,1.88),(1.65,.96,.78,1.82),(2.05,.87,.67,1.2)],paint,root);box('Truck windshield',(0,1.94,1.46),(1.55,.08,.25),glass,root);box('Rear flatbed',(0,-1.08,.94),(2.15,2.05,.26),steel,root)
  for side in [-1,1]:cyl('Exhaust stack',(side*.96,-.2,1.75),.085,1.6,steel,root)
 axles=[-1.1,1.12] if kind<3 else ([-1.55,-.52,.52,1.55] if kind==3 else [-1.65,-.72,1.47])
 for axle in axles:
  for side in [-1,1]:
   if wheel_template:
    o=wheel_template.copy();o.data=wheel_template.data.copy();bpy.context.collection.objects.link(o);o.hide_render=False;o.hide_set(False);o.name='CC0Wheel';o.parent=root;o.location=(side*(W/2+.02),axle,.45);o.dimensions=(.28,.87,.87);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.select_set(False);uv(o,rubber)
   else:cyl('Tire',(side*(W/2+.02),axle,.45),.44,.28,rubber,root,'X')
   cyl('Hub',(side*(W/2+.18),axle,.45),.21,.04,steel,root,'X')
 # Headlights, armored bumpers, grille, rivets and diagonal markings.
 for side in [-1,1]:
  box('Headlight',(side*.62,L/2-.05,.86),(.29,.06,.14),hazard,root,.012)
  for y in [-1.1,0,1.1]:cyl('Hull rivet',(side*(W/2+.015),y,.91),.035,.03,steel,root,'X',8)
 box('Ram plate',(0,L/2,.56),(W*.85,.15,.28),steel,root)
 for x in [-.5,-.25,0,.25,.5]:box('Grille',(x,L/2+.08,.65),(.075,.035,.24),rubber,root,.01)
 turret=empty('Turret',(0,-.15,[1.42,1.58,1.36,1.64,2.05][kind]),root)
 cyl('Turret ring',(0,0,.02),.4,.16,steel,turret)
 if kind in [0,1]:
  box('Gun receiver',(0,0,.22),(.54,.65,.35),steel,turret)
  for x in ([-.16,.16] if kind==0 else [0]):cyl('Muzzle',(x,.75,.25),.07,1.1,steel,turret,'Y')
 elif kind==2:
  box('Pulse receiver',(0,0,.22),(.65,.6,.33),steel,turret);cyl('Ion barrel',(0,.64,.25),.1,.95,steel,turret,'Y')
  for y in [.4,.65,.9]:cyl('Pulse coils',(0,y,.25),.16,.07,glass,turret,'Y')
 elif kind==3:
  for x in [-.32,0,.32]:
   for z in [.18,.47]:cyl('Rocket pod',(x,.32,z),.14,.8,steel,turret,'Y');cyl('Warhead',(x,.76,z),.09,.08,hazard,turret,'Y')
 else:
  box('Artillery breech',(0,0,.3),(.68,.8,.4),steel,turret);cyl('Heavy barrel',(0,.77,.35),.14,1.1,steel,turret,'Y');cyl('Muzzle brake',(0,1.34,.35),.20,.26,steel,turret,'Y')
 # Export only this vehicle; images are shared, not embedded five times.
 bpy.ops.object.select_all(action='DESELECT')
 def select_tree(o):o.select_set(True);[select_tree(ch) for ch in o.children]
 select_tree(root);bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=str(OUT/(ident+'.gltf')),export_format='GLTF_SEPARATE',use_selection=True,export_apply=True,export_image_format='AUTO',export_texture_dir='../textures',export_materials='EXPORT')
 # Guarantee a shared atlas reference and explicit factors for compact web materials.
 path=OUT/(ident+'.gltf');data=json.loads(path.read_text())
 for image in data.get('images',[]):image['uri']='../textures/vehicle-atlas.png'
 for node in data.get('nodes',[]):
  if node.get('name','').startswith('Turret'):node['name']='Turret'
 for material in data.get('materials',[]):
  name=material.get('name','');factor=colors[kind] if name.startswith('Paint') else [1,1,1,1];pbr=material.setdefault('pbrMetallicRoughness',{});pbr['baseColorFactor']=factor
 path.write_text(json.dumps(data,separators=(',',':')))
 # Export the independently mounted weapon hierarchy too.
 bpy.ops.object.select_all(action='DESELECT');select_tree(turret);bpy.context.view_layer.objects.active=turret
 bpy.ops.export_scene.gltf(filepath=str(OUT/('weapon-'+ident+'.gltf')),export_format='GLTF_SEPARATE',use_selection=True,export_apply=True,export_texture_dir='../textures')
 wp=OUT/('weapon-'+ident+'.gltf');wd=json.loads(wp.read_text());
 for image in wd.get('images',[]):image['uri']='../textures/vehicle-atlas.png'
 wp.write_text(json.dumps(wd,separators=(',',':')))
 # Render a useful in-game thumbnail from the same mesh, not a concept illustration.
 for other in all_roots:
  for o in [other,*other.children_recursive]:o.hide_render=other!=root
 bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.device='CPU';bpy.context.scene.cycles.samples=16;bpy.context.scene.cycles.use_denoising=False;bpy.context.scene.render.resolution_x=600;bpy.context.scene.render.resolution_y=360;bpy.context.scene.render.resolution_percentage=100;bpy.context.scene.render.film_transparent=True;bpy.context.scene.world.color=(.16,.18,.2)
 bpy.ops.object.camera_add(location=(5,6,4.3));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.7))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.4;bpy.context.scene.camera=camera
 lights=[]
 for loc,power,size in [((1,3,7),1200,6),((-4,-2,4),800,5)]:
  bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,.8))-light.location).to_track_quat('-Z','Y').to_euler();lights.append(light)
 bpy.context.scene.render.filepath=str(OUT/(ident+'-preview.png'));bpy.ops.render.render(write_still=True)
 # Weapon thumbnail is rendered from the actual same turret mesh.
 for o in root.children_recursive:
  if o!=turret and o not in turret.children_recursive:o.hide_render=True
 camera.location=(3,4,3+turret.location.z);camera.rotation_euler=(Vector((0,.3,turret.location.z+.25))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=3.5
 bpy.context.scene.render.filepath=str(OUT/('weapon-'+ident+'-preview.png'));bpy.ops.render.render(write_still=True)
 for o in [camera,*lights]:bpy.data.objects.remove(o,do_unlink=True)
 for o in [root,*root.children_recursive]:o.hide_render=True
 print('FINISHED MODEL',ident,flush=True)
print('All five GLTF vehicles exported',flush=True)

for kind in ['shell','rocket']:
 root=empty('ammo-'+kind);steel=mat('AmmoSteel',4,(.7,.75,.7,1),.65,.45);rubber=mat('AmmoDark',5,(.8,.8,.8,1),.2,.65)
 cyl('Body',(0,0,0),.12,.65,steel,root,'Y',12)
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.12,radius2=0,depth=.28,location=(0,.46,0));nose=bpy.context.object;nose.rotation_euler[0]=-math.pi/2;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);mesh_finish(nose,'Nose',steel,root,.005)
 if kind=='rocket':
  for angle in [0,math.pi/2,math.pi,math.pi*1.5]:
   fin=box('Fin',(math.cos(angle)*.15,-.22,math.sin(angle)*.15),(.06,.3,.2),rubber,root,.006);fin.rotation_euler[1]=angle
 bpy.ops.object.select_all(action='DESELECT');select_tree(root);bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=str(OUT/('ammo-'+kind+'.gltf')),export_format='GLTF_SEPARATE',use_selection=True,export_apply=True,export_texture_dir='../textures')
 ap=OUT/('ammo-'+kind+'.gltf');ad=json.loads(ap.read_text());
 for image in ad.get('images',[]):image['uri']='../textures/vehicle-atlas.png'
 ap.write_text(json.dumps(ad,separators=(',',':')))
