// Fully offline dialogue. The modal exclusively owns keyboard/mouse while open;
// no combat input can leak through the dialogue's choice buttons.
export function replyToResident( person, question, { stage = 0, timeOfDay = 12 } = {} ) {
	const text = String( question || '' ).trim().slice( 0, 160 ).toLowerCase();
	const lines = person?.lines || [];
	if ( !text ) return '你想问些什么？海风有点大，靠近一点说吧。';
	if ( /你好|您好|嗨|早上好|hello|hi\b/.test( text ) )
		return `${person?.name?.split( '·' ).at( -1 )?.trim() || '朋友'}在这里。你是刚从码头来的吗？`;
	if ( /叫什|名字|职业|做什么|工作|忙什么/.test( text ) ) return lines[ 0 ] || '我在这座岛上生活了很多年。';
	if ( /灯塔|楼梯|钥匙|开门|航线|镜片|反光|机关|怎么走/.test( text ) )
		return stage >= 4 ? lines[ 2 ] || '灯塔的灯光终于回来了。' :
			stage < 2 ? '先在港口的告示牌接取调查任务，再沿发光石柱向北进入森林。灯塔入口就在临海的一侧。' :
			'灯塔门能亲手打开；进入后沿螺旋阶梯上行。想恢复光束，还得校准三面反光镜。';
	if ( /怪物|野兽|狐狸|野猪|狼|海神|危险|战斗|武器/.test( text ) ) return lines[ 1 ] || '听见森林里怪异的声响就要谨慎。';
	if ( /村庄|镇里|大家|近况|生活|天气/.test( text ) ) return lines[ stage >= 4 ? 2 : 1 ] || '最近岛上的人都很忙。';
	if ( /时间|几点|晚上|白天|夜晚|睡觉/.test( text ) )
		return timeOfDay >= 21 || timeOfDay < 6 ? '现在正是休息时间，巡夜人还在港口值班。' :
			'白天我们各忙各的，傍晚会到广场碰头。你也可以过去听听故事。';
	if ( /谢谢|再见|辛苦|拜拜/.test( text ) ) return '愿你一路顺风；遇到麻烦就回村里来。';
	return `这件事我不太确定，不过可以告诉你：${lines[ stage >= 4 ? 2 : 0 ] || '多留意路标和天气。' }`;
}

export class LandDialoguePanel {
	constructor( app ) {
		this.app = app;
		this.active = false;
		this.savedInputEnabled = true;
		this.person = null;
		this.context = {};
		this.onClose = null;
		if ( typeof document === 'undefined' ) return;
		const style = document.createElement( 'style' );
		style.textContent = `
		.land-v33-dialogue{position:fixed;inset:0;z-index:1400;background:rgba(2,13,22,.58);display:none;align-items:end;justify-content:center;padding:5vh 24px;box-sizing:border-box;color:#edf7f5;font-family:system-ui,sans-serif;backdrop-filter:blur(2px)}
		.land-v33-dialogue[data-open="true"]{display:flex}
		.land-v33-dialogue-card{width:min(680px,95vw);background:linear-gradient(140deg,#071e2eea,#132d38fa);border:1px solid #5dc6bb99;border-radius:18px;box-shadow:0 15px 85px #000b;overflow:hidden;padding:26px}
		.land-v33-dialogue h2{font-size:21px;color:#8bf4e5;margin:0 0 13px}
		.land-v33-dialogue p{font-size:16px;line-height:1.7;margin:0 0 20px;min-height:3.3em}
		.land-v33-dialogue-choices{display:flex;flex-direction:column;gap:9px}
		.land-v33-dialogue-form{display:flex;gap:9px;margin-top:14px}
		.land-v33-dialogue-form input{flex:1;min-width:0;padding:10px 12px;background:#071b24;color:#e6faf6;border:1px solid #40898d;border-radius:9px;font:inherit}
		.land-v33-dialogue-form input:focus{outline:2px solid #79f1e4}
		.land-v33-dialogue-form button{white-space:nowrap}
		.land-v33-dialogue button{cursor:pointer;text-align:left;font:inherit;color:#e8faf8;background:#184453;border:1px solid #3d7f87;border-radius:10px;padding:10px 13px;transition:background .12s}
		.land-v33-dialogue button:hover,.land-v33-dialogue button:focus{background:#247080;outline:2px solid #79f1e4;outline-offset:1px}
		.land-v33-dialogue small{display:block;margin-top:13px;color:#abc2c6}`;
		document.head.append( style );
		this.root = document.createElement( 'section' );
		this.root.className = 'land-v33-dialogue';
		this.root.setAttribute( 'role', 'dialog' );
		this.root.setAttribute( 'aria-modal', 'true' );
		this.root.setAttribute( 'aria-label', '村民对话' );
		this.root.innerHTML = '<div class="land-v33-dialogue-card"><h2></h2><p aria-live="polite"></p><div class="land-v33-dialogue-choices"></div><form class="land-v33-dialogue-form"><input maxlength="160" aria-label="自由提问" placeholder="可自行输入问题，如：灯塔怎么去？"><button type="submit">提问</button></form><small>1–4 选择话题 · Enter 发送问题 · Esc 结束 · 当前使用离线语义规则，不是假装接入 AI</small></div>';
		document.body.append( this.root );
		this.title = this.root.querySelector( 'h2' );
		this.body = this.root.querySelector( 'p' );
		this.choices = this.root.querySelector( '.land-v33-dialogue-choices' );
		this.freeText = this.root.querySelector( '.land-v33-dialogue-form input' );
		this.form = this.root.querySelector( 'form' );
		this.form.addEventListener( 'submit', event => {
			event.preventDefault();
			if ( !this.active ) return;
			const message = this.freeText.value.trim().slice( 0, 160 );
			if ( message ) this.body.textContent = replyToResident( this.person, message, this.context );
			this.freeText.value = '';
			this.freeText.focus();
		} );
		window.addEventListener( 'keydown', event => {
			if ( !this.active ) return;
			event.stopPropagation();
			if ( event.code === 'Escape' ) { event.preventDefault(); event.stopPropagation(); this.close(); return; }
			if ( event.target === this.freeText ) return;
			const index = [ 'Digit1', 'Digit2', 'Digit3', 'Digit4' ].indexOf( event.code );
			if ( index >= 0 ) { event.preventDefault(); event.stopPropagation(); this.choices.children[ index ]?.click(); }
		}, true );
	}
	open( person, { missionComplete = false, phase = 'work', stage = 0, timeOfDay = 12 } = {} ) {
		if ( !this.root || !person || this.active ) return false;
		this.active = true;
		this.person = person;
		this.context = { stage: missionComplete ? 4 : stage, timeOfDay };
		this.savedInputEnabled = this.app.input.enabled;
		this.app.input.enabled = false;
		this.app.input.keys?.clear?.();
		this.app.input.pressed?.clear?.();
		this.app.player.velocity?.set?.( 0, 0, 0 );
		if ( document.pointerLockElement ) document.exitPointerLock?.();
		this.root.dataset.open = 'true';
		this.title.textContent = person.name;
		this.body.textContent = phase === 'home' ? '已经很晚了，你想聊些什么？' : '你好！海风今天吹得很远。有什么想问的吗？';
		this.choices.replaceChildren();
		const lines = person.lines || [];
		const topics = [
			[ '你今天在忙些什么？', lines[ 0 ] || '我还要忙一阵子。' ],
			[ '森林和灯塔有什么线索？', lines[ 1 ] || '小心森林里的陌生声音。' ],
			[ '村庄最近怎么样？', lines[ missionComplete ? 2 : 1 ] || '最近大家都不太安心。' ],
		];
		for ( const [ i, topic ] of topics.entries() ) {
			const button = document.createElement( 'button' );
			button.type = 'button';
			button.textContent = `${i + 1}. ${topic[ 0 ]}`;
			button.addEventListener( 'click', () => { this.body.textContent = topic[ 1 ]; } );
			this.choices.append( button );
		}
		const bye = document.createElement( 'button' );
		bye.type = 'button'; bye.textContent = '4. 结束谈话';
		bye.addEventListener( 'click', () => this.close() ); this.choices.append( bye );
		this.choices.children[ 0 ]?.focus();
		return true;
	}
	close() {
		if ( !this.active ) return;
		this.active = false;
		this.root.dataset.open = 'false';
		this.app.input.keys?.clear?.();
		this.app.input.pressed?.clear?.();
		this.app.input.enabled = this.savedInputEnabled;
		this.person = null;
		const done = this.onClose;
		this.onClose = null;
		done?.();
	}
}
