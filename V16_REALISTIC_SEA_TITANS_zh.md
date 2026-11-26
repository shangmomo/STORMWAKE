# Tidewater V16：海洋巨兽真实模型替换

本版本以 V15 的远洋世界、四个独立猎兽海域、多人共战、六种开发者可用船只为基础，重点替换视觉模型，不改动原有的战斗伤害、船只解锁、地图位置或掉落进度。

## 实际交付的 4 个本地 GLB

| 巨兽 | 成品文件 | 面数 | 体积 | 来源与许可 |
|---|---|---:|---:|---|
| 大白鲨 | `public/models/titans/great-white-shark.glb` | 64,999 | 约 6.0 MB | Grab3D，CC0 1.0；原始模型 166,988 三角面，PBR 4K 贴图 |
| 远古巨龟 | `public/models/titans/sea-turtle.glb` | 85,000 | 约 8.6 MB | Grab3D，CC0 1.0；原始模型 778,786 三角面，PBR 4K 贴图 |
| 巨型乌贼/克拉肯 | `public/models/titans/kraken.glb` | 104,999 | 约 9.6 MB | Grab3D，CC0 1.0；原始模型 800,000 三角面，PBR 4K 贴图 |
| 深海利维坦 | `public/models/titans/leviathan.glb` | 27,792 | 约 5.0 MB | 项目原创建模；专用 2K 鳞甲颜色/法线贴图、头部、獠牙、背鳍、侧鳍、尾鳍 |

前三种不是图片贴片：下载了真正的高细分 GLB，并在 Blender 中压缩三角面数、把 PBR 图缩为 2K 后重新导出。大白鲨保留齿列、鳃裂及反影体色；巨龟保留龟甲纹理与鳍肢鳞纹；克拉肯保留吸盘、眼、腕足及疣状表皮。GLB 内嵌颜色、法线和粗糙度/金属度图。

利维坦没有使用《深海迷航》、其他商用游戏的非授权模型，也没有把一条中国龙直接换个名字。它是从几何与海洋爬行类特征重新制作的横向海蛇。原创造型暂不具备商业游戏级骨骼动画，但已经有由顶点着色器驱动的柔和波浪式游动；后续可进一步雕刻头部并添加多骨骼骨架。

## 来源链接与再现步骤

- Great White Shark: https://grab3d.com/models/animals/great-white-shark/
- Sea Turtle: https://grab3d.com/models/animals/sea-turtle/
- Kraken: https://grab3d.com/models/creatures/kraken/
- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- 下载网址由各模型页面明确给出，真正的二进制数据下载后通过本项目 GLB 解析器检查。

原创网格脚本：`scripts/build_leviathan.py`；写实模型优化脚本：`scripts/optimize_titan_assets.py`；渲染审查脚本：`scripts/render_titan_preview.py`。脚本会在需要时从上述公开直链取得原始 CC0 GLB，成品工程只内置轻量文件，不必登录资源网站。

## 游戏接入

- `src/oceanhunt/TitanAssets.js`：实际读取本地 GLB，构造带 UV 的引擎网格、解码贴图，使用 PBR 粗糙度/法线而非塑料材质。按物种添加轻微 GPU 顶点游动。
- `src/oceanhunt/SeaBosses.js`：离船只小于 **510 m** 时异步加载高清模型，**420 m** 内显示。海兽仍分布于各自远洋区域，不在码头集中刷新。
- 若网络/资源/GPU 解码意外失败，保留原有低负载、可动的程序化模型，避免变成不可见敌人。
- 模型替换不改动击中判定、血量、海域地标、开发者船只权限、船只回正或联机战斗。

注意：前三个外部高精度模型原版为**静态 PBR 网格，没有作者提供的骨骼动画**。本项目当前仅应用轻度顶点形变模拟游动，不等同于完整自然游泳骨骼动画。若继续精细化，建议下一轮给尾鳍/腕足加入独立骨架、碰撞盒层级和受击动画。

## 构建与检验

```text
npm install
npm run test:v16
npm run build
npm run dev
```

已通过 GLB 结构检查，四个文件均包含真实三角网格、法线和纹理。实际游玩须使用支持 WebGPU 的桌面浏览器，靠近巨兽所在远海区域观察细节与攻击表现。
