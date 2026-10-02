# SPDX-License-Identifier: MIT
"""
VYNDI 3rd Diamension — Blender addon
Import production medals (GLB / STL / OBJ / 3MF via external) and
prepare them for further sculpt, boolean rim lettering, multi-material
assignment, and slicer-ready export.

Install
-------
1. Blender → Edit → Preferences → Add-ons → Install…
2. Select this file (vyndi_terrain_medal.py)
3. Enable "VYNDI Terrain Medal"
4. Sidebar (N) → VYNDI tab

Workflow with the web app
-------------------------
1. In the web studio: Generate production model
2. Export 3MF (preferred multi-material) or STL / OBJ / GLB
3. Here: Import → optional rim text rebuild → Export for your printer
"""

bl_info = {
    "name": "VYNDI Terrain Medal",
    "author": "VYNDI / TrailRelief lineage",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar > VYNDI",
    "description": "Import and prepare VYNDI terrain medals for any 3D printer",
    "category": "Import-Export",
}

import bpy
from bpy.props import (
    StringProperty,
    FloatProperty,
    BoolProperty,
    EnumProperty,
    IntProperty,
)
from bpy_extras.io_utils import ImportHelper, ExportHelper
from pathlib import Path


class VYNDI_OT_import_medal(bpy.types.Operator, ImportHelper):
    """Import a VYNDI production mesh (GLB, STL, OBJ)"""
    bl_idname = "vyndi.import_medal"
    bl_label = "Import VYNDI Medal"
    bl_options = {"REGISTER", "UNDO"}

    filename_ext = ".*"
    filter_glob: StringProperty(default="*.glb;*.gltf;*.stl;*.obj;*.3mf", options={"HIDDEN"})

    def execute(self, context):
        path = Path(self.filepath)
        suffix = path.suffix.lower()
        before = set(bpy.data.objects)

        try:
            if suffix in {".glb", ".gltf"}:
                bpy.ops.import_scene.gltf(filepath=str(path))
            elif suffix == ".stl":
                if hasattr(bpy.ops.wm, "stl_import"):
                    bpy.ops.wm.stl_import(filepath=str(path))
                else:
                    bpy.ops.import_mesh.stl(filepath=str(path))
            elif suffix == ".obj":
                if hasattr(bpy.ops.wm, "obj_import"):
                    bpy.ops.wm.obj_import(filepath=str(path))
                else:
                    bpy.ops.import_scene.obj(filepath=str(path))
            elif suffix == ".3mf":
                self.report(
                    {"WARNING"},
                    "Native 3MF import is limited in Blender. Prefer GLB/STL from the web app, "
                    "or convert 3MF → STL in Bambu Studio / OrcaSlicer first.",
                )
                return {"CANCELLED"}
            else:
                self.report({"ERROR"}, f"Unsupported format: {suffix}")
                return {"CANCELLED"}
        except Exception as e:
            self.report({"ERROR"}, f"Import failed: {e}")
            return {"CANCELLED"}

        new_objs = [o for o in bpy.data.objects if o not in before]
        for obj in new_objs:
            obj["vyndi_medal"] = True
            obj.name = f"VYNDI_{path.stem}"[:60]
            if obj.scale.length < 0.01:
                obj.scale = (1000.0, 1000.0, 1000.0)
                bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        self.report({"INFO"}, f"Imported {len(new_objs)} object(s) from {path.name}")
        return {"FINISHED"}


class VYNDI_OT_export_printer(bpy.types.Operator, ExportHelper):
    """Export selected medal for any FDM / resin / SLS slicer"""
    bl_idname = "vyndi.export_printer"
    bl_label = "Export for Printer"
    bl_options = {"REGISTER"}

    filename_ext = ".stl"
    filter_glob: StringProperty(default="*.stl;*.obj", options={"HIDDEN"})

    format: EnumProperty(
        name="Format",
        items=[
            ("STL", "STL", "Universal binary/ascii STL — every slicer"),
            ("OBJ", "OBJ", "Wavefront OBJ — multi-object friendly"),
        ],
        default="STL",
    )
    ascii_stl: BoolProperty(name="ASCII STL", default=False)

    def execute(self, context):
        objs = [o for o in context.selected_objects if o.type == "MESH"]
        if not objs:
            self.report({"ERROR"}, "Select at least one mesh")
            return {"CANCELLED"}

        path = self.filepath
        try:
            if self.format == "STL":
                if hasattr(bpy.ops.wm, "stl_export"):
                    bpy.ops.wm.stl_export(
                        filepath=path,
                        export_selected_objects=True,
                        ascii_format=self.ascii_stl,
                    )
                else:
                    bpy.ops.export_mesh.stl(
                        filepath=path,
                        use_selection=True,
                        ascii=self.ascii_stl,
                    )
            else:
                if hasattr(bpy.ops.wm, "obj_export"):
                    bpy.ops.wm.obj_export(filepath=path, export_selected_objects=True)
                else:
                    bpy.ops.export_scene.obj(filepath=path, use_selection=True)
        except Exception as e:
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}

        self.report({"INFO"}, f"Exported {path}")
        return {"FINISHED"}


class VYNDI_OT_solidify_base(bpy.types.Operator):
    """Ensure a printable solid base thickness (mm)"""
    bl_idname = "vyndi.solidify_base"
    bl_label = "Add solid base"
    bl_options = {"REGISTER", "UNDO"}

    thickness_mm: FloatProperty(name="Base thickness (mm)", default=3.0, min=0.5, max=20.0)

    def execute(self, context):
        obj = context.active_object
        if not obj or obj.type != "MESH":
            self.report({"ERROR"}, "Select a mesh")
            return {"CANCELLED"}
        mod = obj.modifiers.new(name="VYNDI_Base", type="SOLIDIFY")
        mod.thickness = self.thickness_mm
        mod.offset = -1.0
        self.report({"INFO"}, f"Solidify {self.thickness_mm} mm applied")
        return {"FINISHED"}


class VYNDI_OT_manifold_check(bpy.types.Operator):
    """Quick non-manifold edge report (printability)"""
    bl_idname = "vyndi.manifold_check"
    bl_label = "Check manifold"
    bl_options = {"REGISTER"}

    def execute(self, context):
        obj = context.active_object
        if not obj or obj.type != "MESH":
            self.report({"ERROR"}, "Select a mesh")
            return {"CANCELLED"}
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.mesh.select_non_manifold()
        bpy.ops.object.mode_set(mode="OBJECT")
        count = sum(1 for e in obj.data.edges if e.select)
        if count:
            self.report({"WARNING"}, f"{count} non-manifold edges — fix before printing")
        else:
            self.report({"INFO"}, "Manifold OK")
        return {"FINISHED"}


class VYNDI_PT_panel(bpy.types.Panel):
    bl_label = "VYNDI Terrain Medal"
    bl_idname = "VYNDI_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "VYNDI"

    def draw(self, context):
        layout = self.layout
        layout.label(text="From web studio → Blender", icon="WORLD")
        layout.operator("vyndi.import_medal", icon="IMPORT")
        layout.separator()
        layout.operator("vyndi.solidify_base", icon="MESH_CUBE")
        layout.operator("vyndi.manifold_check", icon="CHECKMARK")
        layout.separator()
        layout.label(text="To any printer", icon="EXPORT")
        layout.operator("vyndi.export_printer", icon="EXPORT")
        box = layout.box()
        box.label(text="Formats", icon="INFO")
        box.label(text="• 3MF → Bambu / Orca / Prusa")
        box.label(text="• STL → every slicer")
        box.label(text="• OBJ → multi-body colour")
        box.label(text="• GLB → preview / AR")


classes = (
    VYNDI_OT_import_medal,
    VYNDI_OT_export_printer,
    VYNDI_OT_solidify_base,
    VYNDI_OT_manifold_check,
    VYNDI_PT_panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)


def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
