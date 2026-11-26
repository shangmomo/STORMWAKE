# 潮汐海岛 V25：正版 3D Nautilus 潜艇与利维坦最终 Boss

## 已经替换的是真实 3D 资产，不是截图 / 贴图拉伸

两个美术资产都来自用户提供的 **Sketchfab 原版 `.glb`**，其文件内包含作者、来源和 CC BY 4.0 授权元数据。它们与之前项目的自制模型属于不同资产。模型在 WebGPU 引擎中通过原有 PBR 材质渲染、灯光照明、3D 场景节点和物理交互系统工作。

| 角色 | V25 实际素材 | 关键处理 |
| --- | --- | --- |
| 深海魔鲸号 | SDC PERFORMANCE《(FREE) Nautilus Submarine - SDC》；约 **248,218 三角面**、38 个分网格、4 种材质 | 直接打包原版 3D 网格与贴图；针对源文件 X 轴船首方向适配原工程 +Z 航向，按世界空间模型边界居中缩放；移除旧版悬空的装饰舷窗，缩小并对齐真实双船首探照灯 |
| 海神利维坦 | Lebin Benny《Leviathan Monster》，源文件共约 **289,079 三角面**（**包含展示场地和大量装饰发光物**） | 从原版场景中单独保留真实海怪雕塑和眼睛，去除跟着海怪移动的海底展台；保留作者材质和贴图；给真实身体增加 **66 个蒙皮关节**，制作 `Swim` / `Charge` / `Attack` 三个 Blender 骨骼动画片段；以 18 个低成本发光物体代替原场地高面数光球 |

注意：清理后的利维坦生物本体约 **19,767 三角面 / 12,923 蒙皮顶点**。宣传中的“28.9 万面”是整个 Sketchfab 展示场景的总量，不能当成海怪本体的面数。V25 使用的是该作者的真实角色雕塑，但动画为本项目新制作的程序化骨骼动作，并非作者原生动画。

## 资产路径

### 作者原版美术实物预览（Blender）

![SDC Nautilus 潜艇 3D 船体](asset-previews/nautilus_sdc_v25.png)

![剥离展示海床、重绑 66 节骨骼之后的利维坦模型](asset-previews/leviathan_66bones_v25.png)

```text
public/models/abyss/external/nautilus-sdc.glb
public/models/titans/external/leviathan-monster.glb
```

两个模型已实际随 V25 完整工程打包。游戏先尝试这两个外部授权模型，只有对应 GLB 缺失或出现加载错误才回退到项目旧模型。进入 Boss 关卡后，HUD 明确显示 `外形：SDC Nautilus · Lebin Leviathan`，可用来确认不是回退模型。

### 玩法保留

- 击败三首深海魇龙、取得深渊材料、制作深海魔鲸号，进入最终 Boss 关卡的存档逻辑完全保留。
- 潜艇驾驶、鱼雷、声呐、船体受击、水压、Boss 三阶段攻击与胜利奖励保留。
- 潜艇探照灯：`L` 开关；鼠标拖动、`Q/E` 环视；`V` 第三人称/舰桥视角；`X` 镜头回正；滚轮缩放。
- 深海利维坦的身体可在独立蒙皮骨骼驱动下持续弯曲摆尾，冲刺和攻击时切换更激烈的动作，避免整张模型平移或拉伸。
- 对真正的船首进行了航向校正，探照灯照向潜艇前进方向。

## 第三方素材署名与许可

这两个美术素材按各自原版文件标注的 **Creative Commons Attribution 4.0 International (CC BY 4.0)** 使用和改编；重新分发、演示或发布本项目时不得删除下列署名与改动说明。游戏源码的 MIT 协议**不覆盖**这些第三方模型。

1. **《(FREE) Nautilus Submarine - SDC》** — SDC PERFORMANCE™️，Sketchfab：<https://sketchfab.com/3d-models/free-nautilus-submarine-sdc-be50bf46e3304024989706c804023c24>。模型本体与作者贴图保留，游戏中进行了比例、航向与挂载灯位适配。
2. **《Leviathan Monster》** — Lebin Benny，Sketchfab：<https://sketchfab.com/3d-models/leviathan-monster-57285685b5f746c7abab880f2498da37>。从展示场景提取海怪，移除原背景海床和展示光球，增添自制骨骼蒙皮、游动/冲刺/攻击片段及游戏中低面数动态光点。
3. CC BY 4.0 授权全文：<https://creativecommons.org/licenses/by/4.0/>。

**可复现的 Blender 资产处理脚本**：`scripts/prepare_artist_leviathan.py`，随后执行 `scripts/stamp_licensed_glb.py`，可在衍生 GLB 自身写回原作者、许可、源链接和处理说明。最终带署名的模型已包含在工程中，玩家**无需再次下载模型或安装 Blender**。

## 验证状态

```text
npm run test:v25
```

检查了：真实 GLB 格式和几何、作者源信息、子模型材质、模型朝向配置、利维坦 66 个加权真实骨骼、三个动作片段存在并在 CPU 动画矩阵测试中能够变化、动作切换无 NaN。`test:v25` 同时级联 V24–V11 的全部回归测试。

美术方面已在 Blender 对原 Nautilus、原场景 Leviathan、去展台版 Leviathan、66 骨骼动画版进行实际渲染预览。**运行中的浏览器 WebGPU 画面、帧率和撞击接触仍需在实际显卡环境里验收**，不能把离线骨骼和逻辑测试说成已完成 3A 品质认证。**66 骨骼驱动的是身体/尾部游动；本轮不宣称已为嘴部、双眼做独立精密表情骨骼。**
