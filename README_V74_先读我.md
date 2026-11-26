# STORMWAKE V74 — 陆海空生态与钟影岩廊

完整解压，双击 `00_START_V74.cmd`。需要 Python 3.10+、支持 WebGPU 的 Chrome/Edge；联机房主需 Node.js 22+。无需额外下载本轮已实装素材。原 V73 内容保留。

## 新增内容
- 无齿翼龙：北部化石谷 (349,-625)；连续三维飞行、盘旋、滑翔、有限转向及地形净空。原始 6 个动作保留，当前仅飞行与滑翔状态接入，未实现起降、攻击。
- 灰狼：灰苔密林 (-128,-226)，两只；巡游、快走、避让与嚎叫。原始 demo 仅 2 个动作，暂不做战斗。
- Stonewisp 魔鬼鱼：海域 (530,490)，深水巡游、警戒退避，原始 8 个动作保留；非攻击性生态生物。支持发光贴图，透明混合仍由原渲染器近似处理。
- 钟影岩廊：古道支路 (448,-475)，约 23.5 米长的作者真实岩洞模型。入口通行、侧壁、顶面、地形整合，E 调查岩层首次奖励 45 金币，原路返回。不是完整多层地下城。
- 三种新增生物仅单人启用；岩洞在单人及联机可加载，未进行多人岩洞实机验收。

## 尚未采用的素材
- Lurker：原 GLB 眼睛、上喙蒙皮坐标异常；原 FBX 尚待重新导出及 骨骼修正。
- 迅猛龙：仅走路动作，来源链尚待确认。
- 哥斯拉、Titanus Behemoth：各仅一个组合动作；角色 IP 和源模型再分发权未核实，暂不加入分发包。
- Treak Cliff 钟乳石：1,998,878 三角面、28 张纹理，原 GLB 约246 MiB，待 LOD 与贴图优化。
- Rock Face 01：当前 FBX + 4K EXR 资源，需要 glTF 转换。优先获取 Poly Haven 2K glTF 完整包。
- KinemIQ 动作库：上传的是源码 ZIP，仅 README 和 LICENSE，无实际动画。请从 https://github.com/Kinemiq/free-game-animations/releases 获取实际 GLB 动作包。

## 质量与验证
原始四种新增资源的几何与动画保留；纹理尺寸上限 2K（魔鬼鱼原始 1K），部分不透明颜色贴图 JPEG95，法线/数据纹理采用无损 PNG 编码；狼旧版材质转换为 PBR 兼容形式，翼龙可选 specular 扩展不使用。素材授权与 SHA256 见 public/models/expedition/v74/manifest.json 和 CREDITS.md。
`npm run test:v74`：42 个专项/回归测试通过（V74 8、V69–V73 34），另 V68 四客户端 WebSocket 回归通过。所有 16 个原始生物动画均在 CPU 采样校验过有限骨骼矩阵、蒙皮顶点范围。洞穴实网格碰撞进出和侧墙测试通过。HTTP 主页、模块与四个模型返回 200。Chromium EGL/GPU 初始化失败，未完成 WebGPU 画面、帧率或人工操作验收。详见 qa/V74-final.log、V74-http.log、V74-browser.log。
