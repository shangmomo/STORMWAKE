STORMWAKE V50 — 真实船长室 / 海水遮挡 / 船头及桅杆玩法 / 完整工程

本工程以原 Dutch Ship Medium (Poly Haven) 作为唯一主船船壳基础；船长室采用
用户本轮上传的 TheMadraver Captain’s Quarters 模型（运行包采用完整保留纹理和许可的修改版 GLB，未重复打包未改动的源 GLB），保留其版权署名（CC BY 4.0）。
并非另建一个假房间或新增一层覆盖原船的甲板。

Windows: 双击 START_STORMWAKE_V50.cmd（需要 Python 3.10+）
或: python start_v50.py --port 5173
Chrome / Edge 打开：http://127.0.0.1:5173/?stormwake=1&heritageShip=1
无需 Vite 才能运行本地 Python 服务。VSCode/Vite 开发流程依然保留；npm build 需联网安装 devDependencies。

玩法：
- 在海里靠近船舷梯，W / Space 连续攀爬，或从陆地跳上有真实甲板支持的位置；
- 船上移动 WASD / Space 跳跃，跳过船舷可落海；
- 船尾高甲板靠近舱盖按 C，沿打开的舱口梯下船长室；在内部靠近舱口 W 返回；
- 船长室内走到海图桌，E 查看实际航海图，可选择航行标记；
- 靠近主桅杆同时按 C+W 开始攀爬，W 上 / S 下，顶端有可站立瞭望台；
- E 操作火炮、绞盘、物资等原有真实交互岗位；V 切换第一/第三人称。

测试：npm run test:v50 （无需额外 Node 依赖，但必须安装 Node.js）。
最新修改文档：docs/STORMWAKE_V50_船长室与物理验收说明.md
模型来源：public/models/stormwake_v50/CREDITS_V50.md

严格限制：海水遮挡采用随船坐标的 WebGPU shader 空间裁剪，源码测试不等于真实 GPU 着色器验收；
角色碰撞是离线 source walkmap + 船本地胶囊/盒体接触约束，船本体使用现有的
自定义浮力/惯性/摇摆物理。未集成外部 Rapier 物理引擎，不能保证任意姿态绝对零穿模。
真实 Windows Chrome/Edge 帧级、水下反射、极端横摇、同步联机仍需实机验证。
