# 潮汐海岛 V6 · A 栋渔民住宅样板改造

## 本次交付的范围

这次是上一轮约定的 **第一阶段**。只将 A 栋住宅提升为样板房；其余 16 栋住宅、4 间仓库、原有船屋与市场、V5 港口大门全部保持原有实现。没有进行全村批量替换。

### A 栋新增内容

1. **真实墙体窗洞**：六个窗户分别对应前墙 2 个、后墙 2 个、左右侧墙各 1 个。墙面在几何层面切割出开口，窗框增添凹入式四周内衬与窗台。玻璃仍使用现有游戏着色器，不承诺具有真实透射折射效果。
2. **屋顶结构与细节**：主屋顶与门廊屋顶加入金属接缝、挂檐细节，主屋顶额外增加排水槽和转角落水管。
3. **与原有门廊融为一体的装饰**：花箱、花桶及植株，保持原有楼梯、栏杆、门口走道功能。
4. **侧面附属洗涤工作棚**：与主屋连接的单坡遮雨顶、工作台、水槽、架子、箱子、地板和落地支柱。
5. **室内生活空间**：床和睡眠交互不变，新增墙面置物架、厨房台面、碗杯、餐桌、椅子、地毯、墙饰和天花边梁。
6. **动态房门**：保留原来的开关运动与碰撞逻辑；A 栋门板增加双层细框装饰，装饰和门板一起活动。

### 代码位置

- `src/world/Village.js`：仅 A 栋启用 `heroCottage: true`，动态门板装饰。
- `src/world/village/Buildings.js`：窗洞切割、窗户后退、样板房细节接入；原有房屋生成仍可使用。
- `src/world/village/HeroCottage.js`：新房屋细节模块；采用现有木材、金属、石材、布料材质批次。
- `test/hero-cottage.mjs`：离线检查窗洞、门口、家具、材质及三角形数量。
- `tools/cottage/`：离线几何导出/Blender CPU 模型检查脚本。

## Windows 使用方式

1. 解压 ZIP，进入 `tidewater-course` 文件夹。
2. 确认安装 Node.js 与 Python 3。
3. 用 Python 运行 `python run_windows.py`（会自动在缺失时安装前端依赖，启动本地服务并尝试打开浏览器）。
4. 也可以直接运行 `npm install` 和 `npm run dev`。
5. 在村庄海边寻找 A 栋蓝绿色、红色坡屋顶的房子。进入房屋验证开门、睡觉、室内走动；查看右侧后部的洗涤工作棚。

### 自动化检查

```powershell
npm run test:cottage
npm run test:harbor
npm run test:course
node test/islandlife-logic.mjs
node test/islandlife-day.mjs
node test/game-logic.mjs
npm run build
```

### 外观和性能限制

- `docs/v6_cottage_geometry.png` 为 Blender CPU 离线模型形状检查，**不是游戏 WebGPU 实机画面**。
- `docs/v5_cottage_comparison.png` 是同样导出条件下的 V5 风格基线几何对比图。离线渲染不包含游戏的 GPU 程序化木纹、锈蚀和光照。
- V6 仅对 A 栋增加约五千个三角面；未新增着色器材质类型或运行时第三方模型加载器。由于没有 RTX 4060 实机 WebGPU 环境，不能承诺具体帧率。
- 若需把其他房屋也做成精品，应先在你的显卡上确认 A 栋实机视觉和性能，再逐栋扩展。

### 回退

V5 完整项目不受影响。若 A 栋不合适，既可以重新运行 V5，也可以删除 A 栋规格中的 `heroCottage: true` 并恢复原有地基设置。
