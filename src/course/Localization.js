const LANGUAGE_KEY = 'tidewater.course.language.v2';
const PAGE_TITLE_EN = 'Tidewater · Island Companion';

const ZH = new Map( Object.entries( {
	'An island fishing game': '海岛垂钓与探索',
	'Loading Tidewater': '正在加载潮汐海岛', 'Tidewater · 海岛探险伙伴': '潮汐海岛 · 海岛伙伴', 'TIDEWATER': '潮汐海岛', 'Tidewater': '潮汐海岛', 'TIDEWATER · ISLAND EXPEDITION': '潮汐海岛 · 探索伙伴',
	'Take the boat out, work the reef and the deep water, and sell your catch to Joe before dark.': '驾驶小船驶向珊瑚礁与深海，在日落前把渔获带回码头。',
	'Starting…': '正在启航…', 'Starting WebGPU…': '正在启动海岛世界…', 'The first launch compiles the shaders and can take a minute or two. Later visits load much faster.': '首次进入需要准备海岛场景，可能需要一两分钟；之后再次进入会更快。', 'Tip': '探岛贴士',
	'Press ': '按 ', ' for the rod. Hold the left mouse button to wind up, release to cast: the longer you hold, the farther it goes.': ' 拿出鱼竿。按住鼠标左键蓄力，松开发竿；蓄力越久，抛得越远。',
	'Watch the bobber. A few nibbles, then it\'s pulled under: click the left mouse button that moment to set the hook.': '留意浮标：轻微晃动只是试探，完全沉下去时再按鼠标左键扬竿。',
	'In a fight, hold to reel but keep the line tension in the green. Ease off when the fish runs, or the line snaps.': '遛鱼时按住收线键，并让张力保持在绿色区域；鱼发力时松开一些，否则鱼线会断。',
	'What bites depends on where you fish: the shallows, the reef, the deep water past the drop-off, and the time of day.': '不同水域和时段会遇到不同鱼：浅滩、码头、珊瑚礁与外海各有惊喜。',
	'Joe at the fish stand by the pier buys your catch. Fish are worth more by weight, so bring the big ones in.': '码头鱼摊的乔会收购渔获。鱼越大越值钱，想办法把大鱼带上岸吧。',
	'Marta at the boathouse sells upgrades: stronger line, a faster reel, a bigger hold, more fuel and a fish finder.': '船屋的玛塔出售装备升级：更结实的鱼线、更快的渔轮、更大的鱼舱、燃油和探鱼器。',
	'at the boat to board, at the wheel to take the helm, and again to step away and walk the deck.': '靠近小船按 E 登船；在舵轮处按 E 驾驶，再按一次可离开舵轮、在甲板上走动。',
	' for your cooler and the fish log. Deck lights from Marta let you fish after dark.': ' 打开鱼舱和图鉴。向玛塔购买甲板灯后，夜晚也能继续钓鱼。',
	'Click to explore': '踏上小岛', 'Move': '移动', 'Look': '观察', 'Interact': '互动', 'Settings': '设置', 'All controls': '查看操作',
	'Controls': '操作指南', 'Settings sections': '设置分类', 'Click the view to capture the mouse. Esc releases it.': '点击游戏画面即可控制视角；按 Esc 释放鼠标。', 'Close': '关闭', 'Close (I)': '关闭（I）', 'Close (F1)': '关闭（F1）',
	'Move': '移动', 'Look around': '环顾四周', 'Click to capture': '点击锁定视角', 'Sprint, boat boost': '奔跑／船只加速', 'Jump, swim up': '跳跃／上浮', 'Crouch, dive': '蹲下／下潜',
	'Interact': '互动', 'Board, helm, step ashore, trade': '登船、驾驶、上岸、交易', 'Boat camera': '船只视角', '1st / 3rd person': '第一／第三人称', 'Fishing rod': '鱼竿', 'Take out / put away': '拿出／收起',
	'Cast, strike, reel': '抛竿、扬竿、收线', 'Hold to wind up / reel': '按住蓄力／收线', 'Reel in an empty line': '收回空线', 'Cooler and fish log': '鱼舱与鱼类图鉴', 'Free camera': '自由视角', 'Pause time': '暂停时间', 'Flashlight': '手电筒', 'Mute': '静音',
	'Interface': '界面', 'Settings panel': '设置面板', 'Photo mode': '拍照模式', 'Hides all interface': '隐藏全部界面', 'This sheet': '本操作指南', 'Release the mouse': '释放鼠标',
	'How to play:': '玩法简介：', 'catch fish, sell them to Joe at the fish stand by the pier, and buy upgrades from Marta at the chandlery by the boathouse. Both are on the map (lower right).': '在海岛钓鱼后，到码头鱼摊找乔出售渔获，再去船屋找玛塔购买升级。两人的位置会标记在右下角地图上。', 'Replay the guide': '重新查看新手指引', 'Enter · Esc to skip': '按 Enter 继续 · 按 Esc 跳过', 'Skip': '跳过', 'Next': '继续', 'Welcome to Tidewater': '欢迎来到潮汐海岛', 'Fish the island, sell your catch': '探索海岛，享受垂钓',
	'Fishing': '钓鱼', 'Cast, strike, reel': '抛竿、扬竿、收线', 'Take out the rod (by the water or on the boat)': '靠近水边或登船后按 R 拿出鱼竿', 'Wind up, release to cast. Hold longer to cast farther': '按住蓄力，松开发竿；蓄力越久，抛得越远', 'Strike when the bobber is ': '看到浮标完全沉入水中时扬竿（轻微晃动只是试探）', 'pulled under': '完全沉入水中', '(dips are only nibbles)': '（轻微晃动只是试探）', 'Reel in. ': '收线时注意张力。', 'Let go when the tension turns red': '张力变红时松开按键', ', or the line snaps': '，否则鱼线会断', 'Reel an empty line back in': '收回没有鱼的鱼线', 'Your cooler and fish log': '查看鱼舱和鱼类图鉴',
	'Getting around': '海岛探索', 'Joe and Marta': '认识乔与玛塔', 'Move, mouse to look, ': 'WASD 移动，鼠标观察，', ' to run': ' 奔跑', 'Board the boat, take the helm, talk to Joe and Marta': '登船驾驶，或与乔、玛塔交谈', 'All controls, and this guide again': '查看全部操作与新手指引', 'Joe': '乔', 'Marta': '玛塔', ' · fish stand by the pier': ' · 码头鱼摊', ' · chandlery by the boathouse': ' · 船屋装备铺', 'Both are marked on the map in the lower right.': '两人的位置会标记在右下角地图上。',
	' rod out': '拿出鱼竿',
	'Welcome to Tidewater': '欢迎来到潮汐海岛',
	'Fish on!': '鱼上钩了！', 'Reel in': '收线', 'Good pressure': '张力合适', 'New record': '新纪录', 'New species': '新鱼种', 'Catch': '渔获', 'No room in the ': '鱼舱已满，', 'hold': '鱼舱', 'cooler': '冷藏箱', ' · you let it go': ' · 已放生',
	'Previous best': '此前最佳', 'Beaten by': '超过', 'First one in your fish log.': '这是图鉴记录的第一条。', 'Your best:': '你的最佳记录：', 'Length': '长度', 'Weight': '重量', 'Value': '价值', 'in the cooler': '已放入鱼舱', 'let go': '已放生', 'Click': '点击', ' or ': ' 或 ', ' to continue': ' 继续',
	'Cooler': '冷藏箱', 'Fish hold': '鱼舱', ' fish · ': ' 条鱼 · ', ' of ': ' / ', ' kg · worth $': ' 千克 · 价值 $', 'Nothing yet. Cast from the pier, the beach or the boat.': '还没有渔获。去码头、沙滩或船上试试手气吧。', 'Fish log': '鱼类图鉴', 'Sell at the fish stand by the pier': '前往码头鱼摊出售渔获', 'Release': '放生', 'record': '纪录',
	'Fish buyer': '鱼贩', 'Let\'s see what you caught.': '让我看看你钓到了什么。', 'Come back when you\'ve got fish.': '钓到鱼后再来找我吧。', 'Your cooler is empty.': '冷藏箱里还没有鱼。', 'Leave (E)': '离开（E）', 'Sell all · $': '全部出售 · $', 'Sell': '出售', 'Sold ': '已出售 ', ' fish for $': ' 条鱼，获得 $', 'Sold for $': '已出售渔获，获得 $',
	'Top of the line': '已升至最高级', 'Now: ': '当前：', 'Diesel · $': '柴油 · $', ' / L': ' / 升', 'Tank: ': '油箱：', ' of ': ' / ', ' L': ' 升', 'Fill · $': '加满 · $', 'Full': '已加满', ' · You have $': ' · 当前余额 $', 'Upgrades take effect at once': '装备升级立即生效', 'None': '无',
	'Out of fuel · buy diesel at the chandlery by the boathouse': '燃油耗尽 · 前往船屋装备铺购买柴油', 'Rod out · hold left mouse to cast': '鱼竿已拿出 · 按住鼠标左键蓄力抛竿', 'Rod away': '已收起鱼竿', 'Take out the rod': '拿出鱼竿', 'Hold to wind up, release to cast   ·   R  put the rod away': '按住蓄力，松开发竿   ·   按 R 收起鱼竿', 'Release to cast (hold longer to cast farther)': '松开发竿（蓄力越久，抛得越远）', 'Strike now!': '现在扬竿！', 'Something\'s nibbling · wait until the bobber is pulled under': '有鱼在试探 · 等浮标完全沉下去再扬竿', 'Waiting for a bite · right-click to reel the line in': '等待咬钩 · 按鼠标右键收回鱼线', 'Reeling in': '正在收线', 'Too much tension · let go!': '鱼线张力过大 · 松开按键！', 'Hold to reel · let go when the tension goes red': '按住收线 · 张力变红时松开', 'Talk to ': '与', 'Landed on the sand': '已回到沙滩', 'It took the bait and ran': '鱼咬钩后逃走了', 'Not yet · wait for it to pull under': '还没到时候 · 等浮标沉下去再扬竿', 'Snap! The line broke': '糟了！鱼线断了', 'It threw the hook': '鱼挣脱鱼钩了', 'Lost it': '鱼逃走了', 'Filled up · ': '已加满 · ',
	'Something went wrong: ': '发生错误：', 'Ready': '准备就绪', 'Press H to hide the panel, F1 for controls': '按 H 隐藏面板，按 F1 查看操作', 'Press H to hide the panel, F1 for controls': '按 H 隐藏面板，按 F1 查看操作',
	'Ocean': '海洋', 'Sea state': '海况', 'Conditions': '海况预设', 'Calm': '平静', 'Breezy': '微风', 'Choppy': '有风浪', 'Storm': '风暴', 'Wind speed': '风速', 'Wind direction': '风向', 'Choppiness': '浪花起伏', 'Swell': '涌浪', 'Fetch': '风区长度', 'Water': '海水', 'Deep color': '深海颜色', 'Scattering': '水体散射', 'Turbidity': '浑浊度', 'Visibility': '能见度', 'Foam': '浪花', 'Coverage': '覆盖范围', 'Persistence': '持续时间', 'Whitecaps': '白浪', 'Amount': '强度',
	'Shore': '海岸', 'Surf': '浪涌', 'Shore foam': '岸边泡沫', 'Breaking waves': '碎浪强度', 'Beach': '沙滩', 'Sand': '沙地', 'Wet sand': '湿沙', 'Caustics': '焦散光', 'Intensity': '强度', 'Scale': '缩放', 'Spray': '浪花飞溅', 'Lip sheet': '浪峰水幕', 'Boat wake': '船尾波', 'Wake height': '尾波高度', 'Wake foam': '尾波泡沫', 'Wave height': '波高', 'Wave period': '波周期', 'Breaking depth ratio': '碎浪水深比例', 'Curl': '卷浪',
	'Sky': '天空', 'Sun': '太阳', 'Sun azimuth': '太阳方位角', 'Advance time': '时间流逝', 'Time speed': '时间速度', 'Atmosphere': '大气', 'Cloud cover': '云层覆盖', 'Cirrus': '卷云', 'Haze': '海面薄雾', 'Sun shafts': '阳光体积光', 'Air particles': '空气微粒', 'Exposure': '曝光', 'Camera': '镜头', 'View': '视角', '1st person': '第一人称', '3rd person': '第三人称', 'Field of view': '视野范围', 'Free': '自由', 'Free camera (F)': '自由视角（F）', 'Effects': '画面效果', 'Post-processing': '后期效果', 'Ambient occlusion': '环境光遮蔽', 'Bounce light': '地面反射光', 'Sharpen': '锐化', 'Motion blur': '动态模糊', 'Off': '关闭', 'Bloom': '泛光', 'Lens flare': '镜头光晕', 'Saturation': '饱和度', 'Contrast': '对比度', 'Vignette': '暗角', 'Film grain': '胶片颗粒',
	'Performance': '性能', 'Live': '实时状态', 'Frame rate': '帧率', 'Frame time': '帧耗时', 'GPU time': '显卡耗时', 'Significant wave height': '有效波高', 'Render size': '渲染分辨率', 'Quality': '画质', 'Preset': '预设', 'Low': '低', 'Medium': '中', 'High': '高', 'Ultra': '极高', 'Render scale': '渲染比例', 'Wave resolution': '海浪精度', 'Shadows': '阴影', 'Shadow map': '阴影贴图', 'Apply recommended': '应用推荐设置', 'Recommended settings applied': '已应用推荐设置', 'Log settings to console': '将设置记录到控制台', 'Reset all settings': '重置所有设置', 'All settings reset': '所有设置已重置', 'Anti-aliasing': '抗锯齿', 'Water reflections': '水面倒影', 'Lens': '镜头', 'Mouse': '鼠标', 'Sensitivity': '灵敏度', 'Smoothing': '平滑度', 'Invert vertical look': '反转垂直视角', 'Depth of field': '景深', 'Focus distance': '对焦距离', 'Lens dirt': '镜头污渍', 'Color grade': '色彩风格', 'Neutral': '自然', 'Filmic': '电影感', 'Golden hour': '黄金时刻', 'Overcast': '阴天', 'Tropical': '热带', 'Noir': '黑白', 'Significant wave height': '有效波高',
	'Depth': '水深', 'Fuel': '燃油', 'Sonar': '探鱼器', 'Fish': '鱼', 'Fish on!': '鱼上钩了！', 'Walking': '步行', 'Swimming': '游泳', 'Diving': '潜水', 'Free camera': '自由视角', 'Boat · 3rd person': '驾驶 · 第三人称', 'Boat · 1st person': '驾驶 · 第一人称', 'Board boat': '登船', 'Board the boat': '登船', 'Leave boat': '离开小船', 'Third-person camera': '切换第三人称', 'Swim up': '向上游', 'Leave free camera': '退出自由视角', 'Walk': '步行', 'Fish on': '鱼已咬钩', 'Good pressure': '张力合适',
	'Hardhead silverside': '硬头银汉鱼', 'Striped mullet': '条纹鲻鱼', 'Houndfish': '鳄雀鳝针鱼', 'Sergeant major': '军曹雀鲷', 'Bluestriped grunt': '蓝条石鲈', 'Yellowtail snapper': '黄尾笛鲷', 'Blue chromis': '蓝雀鲷', 'Blue tang': '蓝吊', 'Hogfish': '猪齿鱼', 'Stoplight parrotfish': '红带鹦嘴鱼', 'Queen angelfish': '女王神仙鱼', 'Crevalle jack': '大眼鲹', 'Great barracuda': '大梭鱼', 'Nassau grouper': '拿骚石斑鱼', 'Red snapper': '红笛鲷', 'Blackfin tuna': '黑鳍金枪鱼', 'Mahi-mahi': '鲯鳅', 'Tarpon': '大海鲢',
	'Click to type a value': '点击输入数值', 'Click to type a time': '点击输入时间', 'Time of day': '一天中的时间', 'Day': '白天', 'Night': '夜晚', 'Apply': '应用', 'Cancel': '取消', 'On': '开启', 'Off': '关闭', 'High': '高', 'Golden': '金色',
	'fps': '帧/秒', 'frame': '帧耗时', 'gpu': '显卡', ' ms': ' 毫秒', ' knots': ' 节', ' of ': ' / ', 'Click to capture': '点击锁定视角',
	'UI demo: every control is filled with sample data': '界面演示：控件已填入示例数据', '1st': '第一人称', '3rd': '第三人称', 'Boat · ': '驾驶 · ',
} ) );

const ATTRS = [ 'aria-label', 'title', 'placeholder', 'data-tip', 'data-tip-hint' ];
for ( const [ english, chinese ] of Object.entries( {
	'Photo mode (P)': '拍照模式（P）', 'Controls (F1)': '操作指南（F1）', 'Collapse (H)': '收起面板（H）', 'Open settings': '打开设置', 'Settings (H)': '设置（H）', 'Hide': '隐藏', 'Photo mode': '拍照模式',
	'Wind 10 m above the sea. Drives wave height and whitecaps.': '海面上方 10 米处的风速，会影响浪高和白浪。',
	'Distance the wind has blown over open water: longer fetch, longer and higher waves.': '风在开阔水面上吹过的距离；风区越长，海浪越高、越长。',
	'Horizontal displacement: sharp crests, wide troughs.': '水平位移幅度：数值越高，浪峰越尖、浪谷越宽。',
	'Lower = more suspended sediment and plankton (greener, murkier).': '数值越低，悬浮物和浮游生物越多，海水颜色越绿、越浑浊。',
	'Waves break when height exceeds this fraction of the depth.': '当波高超过水深的这一比例时，海浪会开始破碎。',
	'Droplets and mist thrown off breaking crests.': '碎浪飞溅产生的水滴和水雾。',
	'The thin sheet of water thrown forward by plunging breakers.': '卷浪向前抛出的薄层水幕。',
	'Turns the sun\'s path around the island (0 = the real path: rises in the east, sets in the west).': '调整太阳绕岛运行的方向（0 为真实路径：东升西落）。',
	'Aerial perspective and marine haze density (1 = about 20 km visibility at sea level, 0 = clear air).': '空气透视和海雾浓度（1 约相当于海平面 20 千米能见度，0 表示空气清澈）。',
	'Volumetric light shafts and crepuscular rays in the haze (shadows of palms, the pier, hills and clouds). 0 turns them off.': '海雾中的体积光束与曙暮光，会呈现棕榈树、码头、山丘和云层的阴影；设为 0 可关闭。',
	'Dust, pollen, salt haze, seed fluff and the odd gnat drifting in the air: they catch the light when backlit by the sun. 0 turns them off.': '空气中的尘埃、花粉、海盐雾、植物絮和小飞虫；逆光时会显现。设为 0 可关闭。',
	'Sunlight reflected off the ground (bright sand) onto undersides and shaded faces: pier, eaves, hulls, trunks. 0 = off.': '阳光经地面（如明亮沙滩）反射到码头、屋檐、船体和树干的背光面；设为 0 可关闭。',
	'Contrast-adaptive sharpening after the temporal anti-aliasing.': '时间抗锯齿之后进行的对比度自适应锐化。',
	'Camera and object motion blur, as a shutter angle (180° = film look). 0 turns it off.': '通过快门角度控制相机和物体的动态模糊（180° 接近电影效果）；设为 0 可关闭。',
	'Internal resolution; the temporal upscaler reconstructs the full output resolution.': '内部渲染分辨率；时间升频会重建完整输出画面。',
	'Temporal anti-aliasing: each pixel averages this many sub-pixel sample positions over successive frames (it also smooths dithered fades and shadow noise). More samples cost nothing per frame but take a few more frames to settle.': '时间抗锯齿：每个像素会在连续帧中累积多个子像素采样位置，也能平滑抖动渐隐和阴影噪点。采样次数越多，画面稳定所需帧数越多。',
	'Screen-space reflections of the pier, boats and hills on the water.': '在水面呈现码头、小船和山丘的屏幕空间倒影。',
	'8 lb mono': '8 磅单丝线', '15 lb mono': '15 磅单丝线', '30 lb braid': '30 磅编织线', '60 lb braid': '60 磅编织线',
	'Old spinning reel': '旧式纺车轮', 'Smooth spinning reel': '顺滑纺车轮', 'Conventional reel': '鼓式渔轮', 'Hand-me-down rod': '传家旧鱼竿', '7 ft graphite rod': '7 英尺碳素竿', '9 ft surf rod': '9 英尺远投竿',
	'Ice chest': '冰鲜箱', 'Insulated fish hold': '保温鱼舱', '40 L tank': '40 升油箱', '80 L tank': '80 升油箱', '150 L tank': '150 升油箱', 'Tired diesel': '老旧柴油机', 'Rebuilt diesel': '翻新柴油机', 'Turbo diesel': '涡轮柴油机',
	'Fish finder (depth and fish on the HUD)': '探鱼器（在界面显示水深和鱼群）', 'Nav lights only': '仅导航灯', 'Deck floodlights for night fishing': '夜钓甲板泛光灯',
	'Fishing line': '鱼线', 'Reel': '渔轮', 'Rod': '鱼竿', 'Fuel tank': '燃油箱', 'Engine': '发动机', 'Fish finder': '探鱼器', 'Boat lights': '船灯', 'Chandlery': '装备铺', 'Fish buyer': '鱼贩',
	'fps': '帧/秒', 'CPU per frame': 'CPU 单帧耗时', 'CPU time': 'CPU 耗时', 'm/s': '米/秒', 'h/s': '小时/秒', 'EV': '曝光值', 'km': '千米', 'kg': '千克', 'cm': '厘米', 'lb': '磅', 'in': '英寸',
	'Ultra wide 14 mm': '超广角 14 毫米', 'Wide 24 mm': '广角 24 毫米', 'Standard 35 mm': '标准 35 毫米', 'Portrait 85 mm': '人像 85 毫米', 'Telephoto 200 mm': '长焦 200 毫米',
	'Nothing to sell? The grunts are biting off the pier.': '没东西卖吗？码头边有石鲈在咬钩。', 'Line, reels, a bigger hold, diesel. What do you need?': '鱼线、渔轮、大鱼舱、柴油——你想看看什么？', 'Let\'s see what you caught. Fair prices, cash.': '让我看看你的渔获。价格公道，现金结算。',
	'Camera': '相机', 'Mouse': '鼠标', 'Standard': '标准', 'Portrait': '人像', 'Telephoto': '长焦', 'Neutral': '自然', 'Tropical': '热带', 'Noir': '黑白', 'Cirrus': '卷云', 'Clarity': '清澈度',
	'Photo mode (P)': '拍照模式（P）', 'Controls (F1)': '操作指南（F1）', 'Collapse (H)': '收起面板（H）', 'Open settings': '打开设置', 'Settings (H)': '设置（H）', 'Hide': '隐藏',
	'Buy': '购买', 'Leave': '离开', 'Board': '登船', 'Helm': '舵轮', 'Ashore': '上岸', 'Trade': '交易', 'Reef': '珊瑚礁', 'Pier': '码头', 'Boat': '小船', 'Deck': '甲板', 'North': '北', 'South': '南', 'East': '东', 'West': '西', 'north': '北', 'north-east': '东北', 'east': '东', 'south-east': '东南', 'south': '南', 'south-west': '西南', 'west': '西', 'north-west': '西北',
	'Not enough money': '余额不足', 'Distance': '距离', 'Current': '当前', 'Apply': '应用', 'Cancel': '取消', 'On': '开启', 'Off': '关闭',
	'Starting WebGPU…': '正在启动海岛世界…', 'Building the atmosphere…': '正在铺展海岛天空…', 'Shaping the island…': '正在塑造海岛地貌…', 'Building the village…': '正在搭建海边村落…', 'Planting the island…': '正在种植岛上树木…', 'Rolling in the swell…': '正在唤起海浪…', 'Growing the reef…': '正在生成珊瑚礁…', 'Simulating the ocean…': '正在模拟海洋…', 'Preparing the shaders…': '正在准备画面效果…', 'Compiling shaders…': '正在编译画面效果…', 'Warming up…': '马上就好…', 'Ready': '准备就绪',
} ) ) ZH.set( english, chinese );

// Guide text is split around <b> and <kbd> elements. Translate each complete
// text node so the original markup and English text survive language switches.
for ( const [ english, chinese ] of Object.entries( {
	'Catch fish from the': '可以在', 'beach': '沙滩', 'the': '、', 'pier': '码头', 'or your': '或', 'boat': '小船上钓鱼',
	'. Different fish bite in the shallows, around the pier, over the reef and out in deep water, and they change with the time of day.': '。浅滩、码头、珊瑚礁和深海的鱼各不相同，出现的鱼也会随时间变化。',
	'Sell your catch to': '把渔获卖给', 'at the fish stand by the pier, then spend the money on upgrades from': '，他在码头边经营鱼摊。赚到的钱可以找',
	'at the chandlery by the boathouse: stronger line, a faster reel, a bigger hold, a fish finder and lights for fishing at night.': '购买升级装备。她在船屋旁的商店出售鱼线、渔轮、鱼舱、探鱼器和夜钓灯。',
	'Fishing': '垂钓', 'Cast, strike, reel': '抛竿、扬竿、收线', 'Getting around': '探索海岛', 'Joe and Marta': '认识乔和玛塔',
	'Hold': '按住', 'LMB': '鼠标左键', 'RMB': '鼠标右键',
	'Take out the rod (by the water or on the boat)': '在水边或船上拿出鱼竿', 'Wind up, release to cast. Hold longer to cast farther': '蓄力后松开抛竿，按住越久抛得越远',
	'Strike when the bobber is': '浮标', 'pulled under': '完全沉入水中', '(dips are only nibbles)': '时扬竿；轻微晃动只是鱼儿试探',
	'Reel in.': '收线。', 'Let go when the tension turns red': '张力变红时松开', ', or the line snaps': '，否则鱼线会断',
	'Reel an empty line back in': '收回空鱼线', 'Your cooler and fish log': '打开鱼舱和鱼类图鉴',
	'Move, mouse to look,': '移动；鼠标控制视角，按', 'to run': '奔跑', 'Board the boat, take the helm, talk to Joe and Marta': '登船、驾驶小船或与乔和玛塔交谈',
	'All controls, and this guide again': '查看全部操作和新手引导', '· fish stand by the pier': '· 码头边的鱼摊', '· chandlery by the boathouse': '· 船屋旁的商店',
	'Both are marked on the map in the lower right.': '两人的位置都标记在右下角的地图上。', "Let's fish": '开始钓鱼',
	'Hold the': '按住', 'left mouse button': '鼠标左键', 'to wind up and release to cast. Try deeper water, around the pier or over the reef.': '蓄力，松开后抛竿。可以试试深水、码头附近或珊瑚礁。',
	'The bobber is dipping: something is': '浮标正在晃动，有鱼在', 'nibbling': '试探鱼饵', '. Wait until it is': '。等浮标', ', then click to strike.': '后点击扬竿。',
	'Hold the left mouse button': '按住鼠标左键', 'to reel. When the tension needle nears the': '收线。当张力指针接近', 'red': '红色区域', ', let go until it settles, then reel again.': '时松开，等张力下降后再收线。',
	'Into the cooler (': '鱼已放入鱼舱（', '). Sell your catch to': '）。把渔获卖给', 'at the fish stand by the pier: he is on the map.': '；他在码头边的鱼摊，地图上有标记。',
	'Your cooler is': '你的鱼舱', 'full': '满了', '. Sell to Joe, or buy a bigger hold from Marta at the chandlery.': '。可以卖给乔，或找玛塔购买更大的鱼舱。',
	'Your boat.': '你的小船。', 'to board,': '登船，在舵轮处再按', 'again at the wheel to drive (': '驾驶（', 'throttle,': '控制油门，', 'steer). Diesel is sold by Marta.': '控制方向）。玛塔出售柴油。',
	'buys your fish.': '收购你的鱼。按', 'to see what he will pay.': '查看收购价格。', 'sells upgrades and diesel.': '出售升级装备和柴油。按', 'to see her stock.': '查看商品。',
} ) ) ZH.set( english, chinese );

const textState = new WeakMap();
const attrState = new WeakMap();
let locale = 'zh';
let pageTitle = '';

export function getLocale() {
	try { return localStorage.getItem( LANGUAGE_KEY ) === 'en' ? 'en' : 'zh'; }
	catch { return 'zh'; }
}

function translate( source ) {
	if ( ZH.has( source ) ) return ZH.get( source );
	let m;
	if ( ( m = source.match( /^(\d+) m (north|north-east|east|south-east|south|south-west|west|north-west)$/ ) ) ) return `${ m[ 1 ] } 米 · ${ ZH.get( m[ 2 ] ) }`;
	if ( ( m = source.match( /^Talk to (.+)$/ ) ) ) return `与${ translate( m[ 1 ] ) }交谈`;
	if ( ( m = source.match( /^Sold (\d+) fish for \$([\d,]+)$/ ) ) ) return `已出售 ${ m[ 1 ] } 条鱼，获得 $${ m[ 2 ] }`;
	if ( ( m = source.match( /^Sold for \$([\d,]+)$/ ) ) ) return `已出售渔获，获得 $${ m[ 1 ] }`;
	if ( ( m = source.match( /^Filled up · ([\d.]+) L$/ ) ) ) return `已加满 · ${ m[ 1 ] } 升`;
	if ( ( m = source.match( /^(\d+) fish · ([\d.]+) of ([\d.]+) kg · worth \$([\d,]+)$/ ) ) ) return `${ m[ 1 ] } 条鱼 · ${ m[ 2 ] } / ${ m[ 3 ] } 千克 · 价值 $${ m[ 4 ] }`;
	if ( ( m = source.match( /^(.+): (\d+) caught, best ([\d.]+) kg · (\d+) cm$/ ) ) ) return `${ ZH.get( m[ 1 ] ) || m[ 1 ]}：已钓获 ${ m[ 2 ] } 条，最大 ${ m[ 3 ] } 千克 · ${ m[ 4 ] } 厘米`;
	if ( ( m = source.match( /^(.+) · ([\d.]+) kg · \$([\d,]+)$/ ) ) ) return `${ ZH.get( m[ 1 ] ) || m[ 1 ]} · ${ m[ 2 ] } 千克 · $${ m[ 3 ] }`;
	let value = source;
	for ( const [ from, to ] of ZH ) if ( from.length >= 4 && value.includes( from ) ) value = value.replaceAll( from, to );
	if ( ( m = value.match( /^(.+) · (\d+(?:\.\d+)?) kg · \$([\d,]+)$/ ) ) ) return `${ translate( m[ 1 ] )} · ${ m[ 2 ] } 千克 · $${ m[ 3 ] }`;
	if ( ( m = value.match( /^(\d+) caught, best ([\d.]+) kg · (\d+) cm$/ ) ) ) return `已钓获 ${ m[ 1 ] } 条，最大 ${ m[ 2 ] } 千克 · ${ m[ 3 ] } 厘米`;
	if ( ( m = value.match( /^Something went wrong: (.+)$/ ) ) ) return `发生错误：${ m[ 1 ] }`;
	return value;
}

function updateText( node ) {
	if ( node.parentElement?.closest( '.ic-root, script, style, noscript' ) ) return;
	const current = node.nodeValue;
	const old = textState.get( node );
	const source = old && old.applied === current ? old.source : current;
	const match = source.match( /^(\s*)([\s\S]*?)(\s*)$/ );
	const translated = locale === 'zh' ? translate( match[ 2 ] ) : match[ 2 ];
	const next = `${ match[ 1 ] }${ translated }${ match[ 3 ] }`;
	textState.set( node, { source, applied: next } );
	if ( current !== next ) node.nodeValue = next;
}

function updateAttributes( element ) {
	if ( element.closest?.( '.ic-root' ) ) return;
	let state = attrState.get( element );
	if ( ! state ) { state = new Map(); attrState.set( element, state ); }
	for ( const attr of ATTRS ) {
		if ( ! element.hasAttribute( attr ) ) continue;
		const current = element.getAttribute( attr ), old = state.get( attr );
		const source = old && old.applied === current ? old.source : current;
		const next = locale === 'zh' ? translate( source ) : source;
		state.set( attr, { source, applied: next } );
		if ( current !== next ) element.setAttribute( attr, next );
	}
}

function walk( root ) {
	if ( ! root ) return;
	if ( root.nodeType === Node.TEXT_NODE ) { updateText( root ); return; }
	if ( root.nodeType === Node.ELEMENT_NODE ) updateAttributes( root );
	const walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT );
	let node;
	while ( ( node = walker.nextNode() ) ) updateText( node );
	if ( root.querySelectorAll ) root.querySelectorAll( '*' ).forEach( updateAttributes );
}

export function setLocale( nextLocale ) {
	locale = nextLocale === 'en' ? 'en' : 'zh';
	try { localStorage.setItem( LANGUAGE_KEY, locale ); } catch { /* optional */ }
	document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
	if ( pageTitle ) document.title = locale === 'zh' ? translate( pageTitle ) : PAGE_TITLE_EN;
	walk( document.body );
}

export function initLocalization() {
	locale = getLocale();
	pageTitle = document.title;
	document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
	document.title = locale === 'zh' ? translate( pageTitle ) : PAGE_TITLE_EN;
	walk( document.body );
	const observer = new MutationObserver( ( records ) => {
		for ( const record of records ) {
			if ( record.type === 'characterData' ) updateText( record.target );
			else if ( record.type === 'attributes' ) updateAttributes( record.target );
			else for ( const node of record.addedNodes ) walk( node );
		}
	} );
	observer.observe( document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS } );
	window.addEventListener( 'tidewater:locale', ( e ) => setLocale( e.detail ) );
	return observer;
}
