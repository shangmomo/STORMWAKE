"""Optimize the freely downloadable CC0 marine-creature GLBs for Tidewater.

Run with Blender 4.3+: blender --background --python scripts/optimize_titan_assets.py
Source files are retained separately for audit. Output files contain geometry and
PBR maps, but no pre-rendered frames; this keeps runtime loads reasonably small.
"""

from pathlib import Path
import bpy
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "models" / "titans"
CONFIG = {
    "great-white-shark": (65000, 2048),
    "sea-turtle": (85000, 2048),
    "kraken": (105000, 2048),
}


def triangles(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def run(name, target_tris, texture_width):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)

    source = ASSETS / f"{name}-full.glb"
    output = ASSETS / f"{name}.glb"
    if not source.is_file():
        # Source models remain obtainable directly from their CC0 publishers;
        # the distributable game bundles only the optimized output GLBs.
        source_url = f"https://grab3d.com/dl/{name}/{name}.glb"
        print(f"Downloading original CC0 asset: {source_url}")
        urllib.request.urlretrieve(source_url, source)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    before = sum(triangles(o.data) for o in objects)
    if not objects:
        raise RuntimeError(f"No meshes imported from {source}")

    for obj in objects:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        if before > target_tris:
            modifier = obj.modifiers.new(name="Game-ready geometry", type="DECIMATE")
            modifier.ratio = min(1.0, target_tris / before)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)

    # PBR detail is kept in texture maps. The 2K target is detailed enough for
    # boatside inspections and limits VRAM across four distant world bosses.
    for im in bpy.data.images:
        if im.source not in {"FILE", "GENERATED"} or not im.has_data:
            continue
        if max(im.size) > texture_width:
            ratio = texture_width / max(im.size)
            im.scale(max(1, round(im.size[0] * ratio)), max(1, round(im.size[1] * ratio)))

    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", export_image_format="AUTO",
        export_apply=True, export_materials="EXPORT", export_texcoords=True,
        export_normals=True, export_animations=False, export_yup=True,
    )
    after = sum(triangles(o.data) for o in objects)
    print(f"TITAN_OPTIMIZED {name}: {before} -> {after} triangles; {output.stat().st_size / 1024**2:.1f} MiB")


for name, args in CONFIG.items():
    run(name, *args)
