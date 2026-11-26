import {menuAllowed} from '../core/ControlPolicy.js';
import { EXPEDITION_TASKS, currentGameSnapshot, isObjectiveComplete, nextObjective, locationHint, distanceXZ } from './ExpeditionLogic.js';
import { getLocale, setLocale } from './Localization.js';
import { parseCompanionCommand } from './CompanionBrain.js';
import './companion.css';

const SAVE_KEY = 'tidewater.course.expedition.v1';
const VOICE_KEY = 'tidewater.course.voice.v1';
const byId = ( root, id ) => root.querySelector( `[data-ic="${ id }"]` );

const COPY = {
	zh: {
		open: '海岛伙伴 · 小汐', dialog: '海岛伙伴和探索任务', close: '关闭伙伴', switchLanguage: 'Switch language to English',
		eyebrow: '潮汐海岛 · 探索伙伴', subtitle: '你的海岛向导，随时与你并肩出发', quest: '当前探索目标',
		online: '● DeepSeek 已配置 · 对话将通过本地服务转发', offline: '◌ 离线导游模式 · 配置 DeepSeek API Key 后启用真实 AI 对话', checking: '正在检查 AI 连接…',
		chat: '✧ 和小汐聊天', tasks: '◈ 探索任务', quickWhere: '下一步去哪里', quickFish: '怎么钓鱼', quickIsland: '认识海岛',
		input: '发消息给海岛伙伴', placeholder: '问问小汐…', send: '发送 ↗', progress: '探索航程', reset: '↺ 重新开始探索任务',
		resetConfirm: '清空海岛探索任务记录并重新开始？原游戏的钓鱼存档不会删除。', footer: '按 F4 关闭 · 游戏进度自动保存', voice: '朗读回答', done: '探索完成', locked: '完成上一项后解锁',
		greeting: ( hour ) => hour < 6 || hour >= 19 ? '晚上好' : hour < 12 ? '早上好' : '你好',
		welcome: '我是你的海岛探险伙伴。按 F4 随时找我聊天；先完成右侧的探索任务吧。', you: '你', guide: '离线导游', ai: 'DeepSeek AI', active: '主动提醒',
		allDone: '恭喜你完成了整个海岛探索！', nextUpdated: '下一个目的地已经更新。', taskDone: '任务完成',
		fish: '按 R 拿出鱼竿，按住鼠标左键蓄力、松开抛竿。浮标被拖下去时点击刺鱼，收线时注意张力条，别让线绷断！',
		boat: '走到码头尽头的小船旁，按 E 登船；来到驾驶位按 E 掌舵。按 V 可以切换船只视角。',
		chatGreeting: '当然啦，我会在这座小岛上陪着你探险！想听钓鱼技巧，还是一起去看看珊瑚礁？',
		offlinePrefix: '我现在处于离线导游模式，只能提供预设提示哦。', offlineSuffix: ' 如果配置 DeepSeek Key，就可以和我自由聊天。',
		fallbackError: '（AI 请求未成功，以下是离线提示。）', time: ( hour ) => `现在岛上的游戏时间大约是 ${ hour.toFixed( 1 ) } 点。按 H 可以调节时间、云层、风速和海浪。`,
	},
	en: {
		open: 'Island Companion · Xiaoxi', dialog: 'Island companion and expedition tasks', close: 'Close companion', switchLanguage: '切换为中文',
		eyebrow: 'TIDEWATER · ISLAND GUIDE', subtitle: 'Your island guide is ready to explore with you', quest: 'CURRENT EXPEDITION',
		online: '● DeepSeek is ready · Chats are relayed through the local server', offline: '◌ Offline guide · Add a DeepSeek API key to enable AI chat', checking: 'Checking AI connection…',
		chat: '✧ Chat with Xiaoxi', tasks: '◈ Expedition', quickWhere: 'Where should I go next?', quickFish: 'How do I fish?', quickIsland: 'Tell me about the island',
		input: 'Message your island companion', placeholder: 'Ask Xiaoxi…', send: 'Send ↗', progress: 'Expedition progress', reset: '↺ Restart expedition',
		resetConfirm: 'Clear island expedition progress and start over? Your original fishing save will not be deleted.', footer: 'Press F4 to close · Game progress saves automatically', voice: 'Read replies aloud', done: 'Complete', locked: 'Complete the previous task to unlock',
		greeting: ( hour ) => hour < 6 || hour >= 19 ? 'Good evening' : hour < 12 ? 'Good morning' : 'Hello',
		welcome: "I'm your island adventure companion. Press F4 to chat anytime; try the expedition tasks on the other tab!", you: 'You', guide: 'Offline guide', ai: 'DeepSeek AI', active: 'Island tip',
		allDone: 'Congratulations, you completed the whole island expedition!', nextUpdated: 'Your next destination is ready.', taskDone: 'Task complete',
		fish: 'Press R to equip your rod. Hold the left mouse button to charge, then release to cast. Click to strike when the bobber goes under, and watch the tension so your line does not snap!',
		boat: 'Walk to the boat at the end of the pier and press E to board. Press E at the helm to steer, and V to change the boat camera.',
		chatGreeting: "Of course! I'll explore this island with you. Want a fishing tip, or shall we check out the coral reef?",
		offlinePrefix: "I'm in offline guide mode, so I can offer prepared tips. ", offlineSuffix: ' Add a DeepSeek API key to chat freely with me.',
		fallbackError: '(The AI request failed, so here is an offline tip.)', time: ( hour ) => `The island game time is about ${ hour.toFixed( 1 ) }. Press H to adjust the time, clouds, wind, and waves.`,
	},
};

function loadVoiceSetting() {

	try { return localStorage.getItem( VOICE_KEY ) === '1'; }
	catch { return false; }

}

function loadCompleted() {

	try {

		const v = JSON.parse( localStorage.getItem( SAVE_KEY ) );
		return Array.isArray( v ) ? v.filter( ( id ) => EXPEDITION_TASKS.some( ( q ) => q.id === id ) ) : [];

	} catch { return []; }

}

export class IslandCompanion {

	constructor( app ) {

		this.app = app;
		this.completed = loadCompleted();
		this.isOpen = false;
		this.busy = false;
		this.aiAvailable = false;
		this.history = [];
		this.speakingVendor = null;
		this._lastPrompt = Date.now();
		this.voice = loadVoiceSetting();
		this.language = getLocale();
		this._mount();
		this._localize();
		this.render();
		const copy = COPY[ this.language ];
		this.welcomeBox = this._message( `${ this.language === 'en' ? 'Xiaoxi' : '小汐' } · ${ copy.guide }`, `${ copy.greeting( app.settings.timeOfDay )}${ this.language === 'en' ? '! ' : '！' }${ copy.welcome }`, 'guide' );
		this._timer = setInterval( () => this._tick(), 800 );

	}

	_localize() {

		const c = COPY[ this.language ], en = this.language === 'en';
		const set = ( id, value ) => { byId( this.root, id ).textContent = value; };
		set( 'title', c.open );
		set( 'tab-chat', c.chat );
		set( 'tab-tasks', c.tasks );
		set( 'send', c.send );
		set( 'reset', c.reset );
		set( 'progress-title', c.progress );
		set( 'footer', c.footer );
		set( 'voice-label', c.voice );
		set( 'eyebrow', c.eyebrow );
		set( 'subtitle', c.subtitle );
		set( 'quest-kicker', c.quest );
		set( 'quick-where', c.quickWhere );
		set( 'quick-fish', c.quickFish );
		set( 'quick-island', c.quickIsland );
		const controls = en ? { auto: 'Explore', follow: 'Follow', wait: 'Wait', home: 'Go home', sit: 'Sit', stand: 'Stand', jump: 'Jump', wave: 'Wave', dance: 'Dance', spin: 'Spin', sleep: 'Rest' } : { auto: '自主活动', follow: '跟随我', wait: '原地等待', home: '回家', sit: '坐下', stand: '站起来', jump: '跳一下', wave: '挥手', dance: '跳舞', spin: '转圈', sleep: '睡觉' };
		this.root.querySelectorAll( '[data-companion-command]' ).forEach( button => { button.textContent = controls[ button.dataset.companionCommand ]; } );
		this._renderActorStatus();
		byId( this.root, 'open-title' ).textContent = c.open;
		byId( this.root, 'toggle' ).setAttribute( 'aria-label', c.open );
		byId( this.root, 'toggle' ).title = en ? 'Press F4 to open the island companion' : '按 F4 打开海岛伙伴';
		byId( this.root, 'panel' ).setAttribute( 'aria-label', c.dialog );
		byId( this.root, 'close' ).setAttribute( 'aria-label', c.close );
		byId( this.root, 'language' ).textContent = en ? '中文' : 'EN';
		byId( this.root, 'language' ).setAttribute( 'aria-label', c.switchLanguage );
		this.input.setAttribute( 'aria-label', c.input );
		this.input.placeholder = c.placeholder;
		this.root.lang = en ? 'en' : 'zh-CN';
		byId( this.root, 'quick-where' ).dataset.quick = en ? 'Where should I go next?' : '我现在应该去哪里？';
		byId( this.root, 'quick-fish' ).dataset.quick = en ? 'How do I fish?' : '教我怎么钓鱼';
		byId( this.root, 'quick-island' ).dataset.quick = en ? 'Tell me about the island' : '介绍一下这个海岛';
		byId( this.root, 'language' ).lang = en ? 'zh' : 'en';
		byId( this.root, 'voice-label' ).lang = en ? 'en' : 'zh-CN';
		byId( this.root, 'character' ).alt = en ? 'Xiaoxi, your island adventure companion' : '小汐：海岛探险伙伴';
		this._checkStatus();
		this.render();

	}

	setLanguage( language ) {

		this.language = language === 'en' ? 'en' : 'zh';
		setLocale( this.language );
		this._localize();
		const c = COPY[ this.language ];
		if ( this.welcomeBox?.isConnected ) {
			this.welcomeBox.querySelector( 'small' ).textContent = `${ this.language === 'en' ? 'Xiaoxi' : '小汐' } · ${ c.guide }`;
			this.welcomeBox.querySelector( 'span' ).textContent = `${ c.greeting( this.app.settings.timeOfDay )}${ this.language === 'en' ? '! ' : '！' }${ c.welcome }`;
		}

	}

	_mount() {

		const root = document.createElement( 'div' );
		root.className = 'ic-root';
		root.innerHTML = `
			<button class="ic-open" data-ic="toggle" aria-label="打开海岛伙伴" title="按 F4 打开海岛伙伴">
				<span class="ic-open-symbol">✦</span><span data-ic="open-title">海岛伙伴 · 小汐</span><span class="ic-open-count" data-ic="count">0/5</span><kbd>F4</kbd>
			</button>
		<div class="ic-panel" data-ic="panel" hidden role="dialog" aria-modal="false" aria-label="海岛伙伴和探索任务">
				<div class="ic-hero">
					<div class="ic-character-stage"><div class="ic-character-glow"></div><img class="ic-character" data-ic="character" src="${ ( import.meta.env.BASE_URL || '/' ) }xiaoxi-guide.png" alt="小汐：海岛探险伙伴"/></div>
					<div class="ic-hero-copy"><span class="ic-eyebrow" data-ic="eyebrow">潮汐海岛 · 探索伙伴</span><strong data-ic="title">海岛伙伴 · 小汐</strong><span class="ic-subtitle" data-ic="subtitle">你的海岛向导，随时与你并肩出发</span><span class="ic-connection" data-ic="status">正在检查 AI 连接…</span></div>
					<button class="ic-language" data-ic="language" type="button">EN</button><button class="ic-close" data-ic="close" aria-label="关闭伙伴">×</button>
				</div>
				<div class="ic-quest-peek"><span data-ic="quest-kicker">当前探索目标</span><strong data-ic="current-task"></strong><small data-ic="current-hint"></small></div>
				<div class="ic-actor-controls"><span data-ic="actor-status"></span><div><button type="button" data-companion-command="auto">自主活动</button><button type="button" data-companion-command="follow">跟随我</button><button type="button" data-companion-command="wait">原地等待</button><button type="button" data-companion-command="home">回家</button><button type="button" data-companion-command="sit">坐下</button><button type="button" data-companion-command="stand">站起来</button><button type="button" data-companion-command="jump">跳一下</button><button type="button" data-companion-command="wave">挥手</button><button type="button" data-companion-command="dance">跳舞</button><button type="button" data-companion-command="spin">转圈</button><button type="button" data-companion-command="sleep">睡觉</button></div></div>
				<div class="ic-tabs"><button data-ic="tab-chat" class="is-active">✧ 和小汐聊天</button><button data-ic="tab-tasks">◈ 探索任务</button></div>
				<div class="ic-body" data-ic="chat-view">
					<div class="ic-messages" data-ic="messages" aria-live="polite"></div>
					<div class="ic-quick"><button data-ic="quick-where" data-quick="我现在应该去哪里？">下一步去哪里</button><button data-ic="quick-fish" data-quick="教我怎么钓鱼">怎么钓鱼</button><button data-ic="quick-island" data-quick="介绍一下这个海岛">认识海岛</button></div>
					<form class="ic-compose" data-ic="form"><input data-ic="input" maxlength="450" autocomplete="off" aria-label="发消息给海岛伙伴" placeholder="问问小汐…"/><button data-ic="send" type="submit">发送 ↗</button></form>
				</div>
				<div class="ic-body ic-tasks-view" data-ic="tasks-view" hidden>
					<div class="ic-progress-head"><span data-ic="progress-title">探索航程</span><strong data-ic="progress-label">0 / 5</strong></div>
					<div class="ic-progress-bar"><div data-ic="progress-bar"></div></div>
					<div class="ic-task-list" data-ic="task-list"></div>
					<button class="ic-reset" data-ic="reset">↺ 重新开始探索任务</button>
				</div>
				<div class="ic-footer"><span data-ic="footer">按 F4 关闭 · 游戏进度自动保存</span><label><input type="checkbox" data-ic="voice"/><span data-ic="voice-label">朗读回答</span></label></div>
			</div>
			<div class="ic-notice" data-ic="notice" role="status" hidden></div>`;
		document.body.append( root );
		this.root = root;
		this.panel = byId( root, 'panel' );
		this.messages = byId( root, 'messages' );
		this.input = byId( root, 'input' );
		byId( root, 'voice' ).checked = this.voice;
		byId( root, 'voice' ).addEventListener( 'change', ( e ) => {

			this.voice = e.target.checked;
			try { localStorage.setItem( VOICE_KEY, this.voice ? '1' : '0' ); } catch { /* optional */ }

		} );
		byId( root, 'toggle' ).addEventListener( 'click', () => this.toggle() );
		byId( root, 'language' ).addEventListener( 'click', () => this.setLanguage( this.language === 'zh' ? 'en' : 'zh' ) );
		byId( root, 'close' ).addEventListener( 'click', () => this.toggle( false ) );
		byId( root, 'tab-chat' ).addEventListener( 'click', () => this._tab( 'chat' ) );
		byId( root, 'tab-tasks' ).addEventListener( 'click', () => this._tab( 'tasks' ) );
		byId( root, 'form' ).addEventListener( 'submit', ( e ) => {

			e.preventDefault();
			this.ask( this.input.value );

		} );
		root.querySelectorAll( '[data-quick]' ).forEach( ( button ) => button.addEventListener( 'click', () => this.ask( button.dataset.quick ) ) );
		root.querySelectorAll( '[data-companion-command]' ).forEach( button => button.addEventListener( 'click', () => this._commandActor( button.dataset.companionCommand ) ) );
		byId( root, 'reset' ).addEventListener( 'click', () => {

			if ( ! window.confirm( COPY[ this.language ].resetConfirm ) ) return;
			this.completed = [];
			this._save();
			this.render();

		} );
		this._onKey = ( e ) => {

			if ( e.code === 'Escape' && this.isOpen ) {

				e.preventDefault();
				this.toggle( false );
				return;

			}
            // F4 opens via the central frame router; the open panel alone owns F4 to close.
            if(e.code==='F4'&&!e.repeat&&this.isOpen){e.preventDefault();e.stopPropagation();this.toggle(false);}


		};
		window.addEventListener( 'keydown', this._onKey );

	}

	async _checkStatus() {

		try {

			const r = await fetch( '/api/guide/status', { cache: 'no-store' } );
			if ( r.ok ) this.aiAvailable = !! ( await r.json() ).configured;

		} catch { /* built static files: offline expedition remains fully playable */ }
		const c = COPY[ this.language ];
		byId( this.root, 'status' ).textContent = this.aiAvailable ? c.online : c.offline;

	}

	toggle( open = ! this.isOpen ) {

		if (open===this.isOpen || (open&&!menuAllowed(this.app))) return;
        if(open)this.previousInput=this.app.input.enabled;
		this.isOpen = open;
		this.panel.hidden = ! open;
		byId( this.root, 'toggle' ).hidden = open;
		this.app.input.enabled = open?false:(this.previousInput??true);
		if ( open ) {

			if ( document.pointerLockElement ) document.exitPointerLock?.();
			this._tab( 'chat' );
			setTimeout( () => this.input.focus(), 30 );

		} else {

			window.speechSynthesis?.cancel();

		}
		this._updateVendor();

	}

	_tab( name ) {

		byId( this.root, 'chat-view' ).hidden = name !== 'chat';
		byId( this.root, 'tasks-view' ).hidden = name !== 'tasks';
		byId( this.root, 'tab-chat' ).classList.toggle( 'is-active', name === 'chat' );
		byId( this.root, 'tab-tasks' ).classList.toggle( 'is-active', name === 'tasks' );

	}

	_renderActorStatus() {
		const actor = this.app.companionActor, el = byId( this.root, 'actor-status' );
		if ( ! el ) return;
		const en = this.language === 'en';
		const labels = en ? { explore: 'Exploring', follow: 'Following', wait: 'Waiting', home: 'Heading home', rest: 'Resting' } : { explore: '探索中', follow: '跟随中', wait: '等待中', home: '前往家园', rest: '休息中' };
		el.textContent = actor ? `${ labels[ actor.goal ] || labels.explore } · ${ en ? 'Energy' : '精力' } ${ Math.round( actor.state.energy ) } · ${ en ? 'Bond' : '亲密' } ${ Math.round( actor.state.bond ) }` : ( en ? 'Preparing companion…' : '正在准备伙伴…' );
		this.root.querySelectorAll( '[data-companion-command]' ).forEach( b => b.classList.toggle( 'is-active', actor?.state.command === b.dataset.companionCommand ) );
	}

	_commandActor( command ) {
		const en = this.language === 'en', actor = this.app.companionActor;
		const ok = actor?.command( command );
		const replies = en ? { auto: 'I will explore on my own!', follow: 'I will follow you on land. Walk ahead and I will come along.', wait: 'I will wait here.', home: 'I will head toward our home.', sit: 'I will sit here.', stand: 'I am standing.', jump: 'Here I go!', wave: 'Hello!', dance: 'Let us dance!', spin: 'Here is a spin!', sleep: 'I will rest here.' } : { auto: '我会自己去探索！', follow: '我会在陆地上跟着你，往前走我就跟上。', wait: '我在这里等你。', home: '我朝家园走去。', sit: '我坐在这里。', stand: '我站起来啦。', jump: '看我跳！', wave: '你好呀！', dance: '一起跳舞吧！', spin: '看我转个圈！', sleep: '我在这里休息一会儿。' };
		const text = ok ? ( command === 'follow' && this.app.player.mode !== 'walk' ? ( en ? 'I will wait on shore until you return.' : '你在水上，我会先在岸边等你。' ) : replies[ command ] ) : ! actor ? ( en ? 'I am still getting ready.' : '我还在准备中，请稍等。' ) : command === 'home' ? ( en ? 'Choose a home at a cottage bed first.' : '先在小屋床边选择家园吧。' ) : ( en ? 'I cannot do that yet.' : '这个动作我暂时做不到。' );
		this._message( en ? 'Xiaoxi' : '小汐', text );
		this._renderActorStatus();
		return !! ok;
	}

	companionEvent( zh, en ) {
		const text = this.language === 'en' ? en : zh;
		this._message( this.language === 'en' ? 'Xiaoxi · Island life' : '小汐 · 海岛生活', text );
		this._notice( `✦ ${ text }` );
		this._speak( text );
	}

	_message( author, message, type = 'guide' ) {

		const box = document.createElement( 'div' );
		box.className = `ic-message ic-message-${ type }`;
		const name = document.createElement( 'small' );
		name.textContent = author;
		const text = document.createElement( 'span' );
		text.textContent = message;
		box.append( name, text );
		this.messages.append( box );
		if ( type !== 'user' ) {
			this.root.classList.add( 'is-speaking' );
			clearTimeout( this._speakingTimer );
			this._speakingTimer = setTimeout( () => this.root.classList.remove( 'is-speaking' ), 1700 );
		}
		while ( this.messages.children.length > 30 ) this.messages.firstChild.remove();
		this.messages.scrollTop = this.messages.scrollHeight;
		return box;

	}

	_speak( message ) {

		if ( ! this.voice || ! ( 'speechSynthesis' in window ) ) return;
		window.speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance( message );
		u.lang = this.language === 'en' ? 'en-US' : 'zh-CN';
		u.rate = 1.08;
		window.speechSynthesis.speak( u );

	}

	_offline( message ) {

		const text = message.toLowerCase();
		const state = currentGameSnapshot( this.app ), c = COPY[ this.language ];
		const task = nextObjective( this.completed );
		if ( /记得|记忆|回忆|remember|memories/.test( text ) ) {
			const memories = this.app.companionActor?.state.memories || [];
			const fish = memories.find( m => m.type === 'large_fish' ) || memories.find( m => m.type === 'first_fish' );
			const home = memories.find( m => m.type === 'first_home' );
			const weight = fish?.detail.match( /([\d.]+)kg/ )?.[ 1 ];
			if ( fish ) return this.language === 'en' ? `I remember the fish we caught on day ${ fish.day }${ weight ? `; it weighed ${ weight } kg` : '' }!` : `我记得第 ${ fish.day } 天我们钓到的鱼${ weight ? `，它有 ${ weight } 千克` : '' }！`;
			if ( home ) return this.language === 'en' ? `I remember choosing our island home on day ${ home.day }.` : `我记得第 ${ home.day } 天我们选定了海岛家园。`;
			return this.language === 'en' ? 'We have many island memories still to make!' : '我们的海岛故事才刚刚开始，一起创造些回忆吧！';
		}
		if ( this.language === 'en' ) {
			if ( /home|house|cottage|bed|sleep|door|furniture/.test( text ) ) return `There are 17 cottages to explore. Press E at a door, G beside a bed to choose a home, and E beside a bed to sleep. It is day ${ state.day }.`;
			if ( /where|go|task|next|direction|route|lost|how do i get/.test( text ) ) return locationHint( state, task, 'en' );
			if ( /fish|fishing|cast|reel|rod/.test( text ) ) return c.fish;
			if ( /boat|sail|sea|helm/.test( text ) ) return c.boat;
			if ( /time|day|evening|weather|sun|cloud|wind/.test( text ) ) return c.time( state.timeOfDay );
			if ( /hello|hi|thanks|chat|company/.test( text ) ) return c.chatGreeting;
			return `${ c.offlinePrefix }${ locationHint( state, task, 'en' ) }${ c.offlineSuffix }`;
		}
		if ( /房|家|床|睡觉|开门|大门|家具|昼夜|休息/.test( text ) ) return `岛上有 17 栋住宅。门口按 E 开门，床边按 G 安家、按 E 睡觉。现在是第 ${ state.day } 天。`;
		if ( /在哪|去哪|哪里|任务|下一步|方向|路线|迷路|怎么走/.test( text ) ) return locationHint( state, task, 'zh' );
		if ( /钓|鱼|抛竿|收线/.test( text ) ) return c.fish;
		if ( /船|航行|出海/.test( text ) ) return c.boat;
		if ( /时间|白天|晚上|天气|太阳/.test( text ) ) return c.time( state.timeOfDay );
		if ( /你好|谢谢|嗨|陪|聊天/.test( text ) ) return c.chatGreeting;
		return `${ c.offlinePrefix }${ locationHint( state, task, 'zh' ) }${ c.offlineSuffix }`;

	}

	async ask( raw ) {

		const message = String( raw ?? '' ).trim().slice( 0, 450 );
		if ( ! message || this.busy ) return;
		this._lastPrompt = Date.now();
		this.input.value = '';
		this._tab( 'chat' );
		const c = COPY[ this.language ];
		this._message( c.you, message, 'user' );
		const command = parseCompanionCommand( message );
		if ( command ) { this._commandActor( command ); return; }
		this.app.companionActor?.remember( 'conversation', '', true );
		const currentHistory = this.history.slice( - 8 );
		this.busy = true;
		byId( this.root, 'send' ).disabled = true;
		let reply = '', mode = c.guide;
		if ( this.aiAvailable ) {

			try {

				const state = currentGameSnapshot( this.app ), task = nextObjective( this.completed );
				const resp = await fetch( '/api/guide', {
					method: 'POST', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( { message, history: currentHistory, scene: {
						language: this.language,
						objective: task ? ( this.language === 'en' ? task.titleEn : task.title ) : ( this.language === 'en' ? 'All tasks complete' : '任务全部完成' ),
						hint: locationHint( state, task, this.language ), mode: state.mode,
						hour: state.timeOfDay, day: state.day, home: state.home, nights: state.nights, progress: `${ this.completed.length }/${ EXPEDITION_TASKS.length }`,
						companion: this.app.companionActor ? { goal: this.app.companionActor.goal, energy: this.app.companionActor.state.energy, curiosity: this.app.companionActor.state.curiosity, mood: this.app.companionActor.state.mood, bond: this.app.companionActor.state.bond, memories: this.app.companionActor.state.memories.slice( - 5 ) } : null,
					} } ),
					signal: AbortSignal.timeout( 33_000 ),
				} );
				const result = await resp.json();
				if ( ! resp.ok || typeof result.reply !== 'string' ) throw new Error( result.error || '网络连接失败' );
				reply = result.reply;
				if ( result.action && ! this.app.companionActor?.command( result.action ) ) reply = this.language === 'en' ? 'Please choose a home at a cottage bed first.' : '请先在小屋床边选择家园。';
				else if ( result.action === 'follow' && this.app.player.mode !== 'walk' ) reply = this.language === 'en' ? 'I will wait on shore until you return.' : '你在水上，我会先在岸边等你。';
				mode = c.ai;

			} catch ( e ) {

				reply = this.language === 'en' ? `${ c.fallbackError } ${ this._offline( message ) }` : `（AI 请求未成功：${ e.message }。${ c.fallbackError }）${ this._offline( message ) }`;

			}

		} else reply = this._offline( message );
		this._message( `小汐 · ${ mode }`, reply );
		this.history.push( { role: 'user', content: message }, { role: 'assistant', content: reply } );
		if ( this.history.length > 20 ) this.history.splice( 0, this.history.length - 20 );
		this._speak( reply );
		this.busy = false;
		byId( this.root, 'send' ).disabled = false;
		if ( this.isOpen ) this.input.focus();

	}

	_save() {

		try { localStorage.setItem( SAVE_KEY, JSON.stringify( this.completed ) ); } catch { /* optional */ }

	}

	_notice( message ) {

		const note = byId( this.root, 'notice' );
		note.textContent = message;
		note.hidden = false;
		clearTimeout( this._noticeTimer );
		this._noticeTimer = setTimeout( () => { note.hidden = true; }, 5000 );

	}

	_updateVendor() {

		const player = this.app.player;
		const hud = this.app.game?.hud;
		this.speakingVendor = this.isOpen && player?.mode === 'walk' && ! hud?.standOpen
			? this.app.game?.vendors?.find( ( v ) => v.inRange( player.position ) ) || null : null;

	}

	_tick() {

		if ( document.hidden ) return;
		this._updateVendor();
		this._renderActorStatus();
		const state = currentGameSnapshot( this.app ), c = COPY[ this.language ];
		const next = nextObjective( this.completed );
		if ( next && ! this.app.freeCam && isObjectiveComplete( next, state ) ) {

			this.completed.push( next.id );
			this._save();
			this.render();
			const title = this.language === 'en' ? next.titleEn : next.title;
			const announce = this.language === 'en'
				? `${ c.taskDone }: ${ title }! ${ nextObjective( this.completed ) ? c.nextUpdated : c.allDone }`
				: `${ c.taskDone }：${ title }！${ nextObjective( this.completed ) ? c.nextUpdated : c.allDone }`;
			this._message( `${ this.language === 'en' ? 'Xiaoxi' : '小汐' } · ${ c.active }`, announce );
			this._notice( `✦ ${ announce }` );
			this._speak( announce );

		}

	}

	render() {

		const count = this.completed.length;
		byId( this.root, 'count' ).textContent = `${ count }/${ EXPEDITION_TASKS.length }`;
		byId( this.root, 'progress-label' ).textContent = `${ count } / ${ EXPEDITION_TASKS.length }`;
		byId( this.root, 'progress-bar' ).style.width = `${ 100 * count / EXPEDITION_TASKS.length }%`;
		const target = nextObjective( this.completed );
		byId( this.root, 'current-task' ).textContent = target ? ( this.language === 'en' ? target.titleEn : target.title ) : COPY[ this.language ].allDone;
		byId( this.root, 'current-hint' ).textContent = locationHint( currentGameSnapshot( this.app ), target, this.language );
		const list = byId( this.root, 'task-list' );
		list.replaceChildren();
		for ( const task of EXPEDITION_TASKS ) {

			const done = this.completed.includes( task.id );
			const active = target?.id === task.id;
			const row = document.createElement( 'div' );
			row.className = `ic-task${ done ? ' is-done' : '' }${ active ? ' is-current' : '' }`;
			const icon = document.createElement( 'span' );
			icon.className = 'ic-task-icon';
			icon.textContent = done ? '✓' : task.icon;
			const title = document.createElement( 'div' );
			const name = document.createElement( 'strong' );
			name.textContent = this.language === 'en' ? task.titleEn : task.title;
			const description = document.createElement( 'small' );
			description.textContent = done ? COPY[ this.language ].done : active ? ( this.language === 'en' ? task.hintEn : task.hint ) : COPY[ this.language ].locked;
			title.append( name, description );
			row.append( icon, title );
			list.append( row );

		}

	}

	dispose() {

		clearInterval( this._timer );
		clearTimeout( this._noticeTimer );
		clearTimeout( this._speakingTimer );
		window.removeEventListener( 'keydown', this._onKey );
		this.root.remove();

	}

}
