/**
 * Battle log
 *
 * An exercise in minimalism! This is a dependency of the client, which
 * requires IE9+ and uses Preact, and the replay player, which requires
 * IE7+ and uses jQuery. Therefore, this has to be compatible with IE7+
 * and use the DOM directly!
 *
 * Special thanks to PPK for QuirksMode.org, one of the few resources
 * available for how to do web development in these conditions.
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

import type {BattleScene} from './battle-animations';

// Caja
declare const html4: any;
declare const html: any;

// defined in battle-log-misc
declare function MD5(input: string): string;
declare function formatText(input: string, isTrusted?: boolean): string;

export class BattleLog {
	elem: HTMLDivElement;
	innerElem: HTMLDivElement;
	scene: BattleScene | null = null;
	preemptElem: HTMLDivElement = null!;
	atBottom = true;
	skippedLines = false;
	className: string;
	battleParser: BattleTextParser | null = null;
	joinLeave: {
		joins: string[],
		leaves: string[],
		element: HTMLDivElement,
	} | null = null;
	lastRename: {
		from: string,
		to: string,
		element: HTMLDivElement,
	} | null = null;
	/**
	 * * -1 = spectator: "Red sent out Pikachu!" "Blue's Eevee used Tackle!"
	 * * 0 = player 1: "Go! Pikachu!" "The opposing Eevee used Tackle!"
	 * * 1 = player 2: "Red sent out Pikachu!" "Eevee used Tackle!"
	 */
	perspective: -1 | 0 | 1 = -1;
	constructor(elem: HTMLDivElement, scene?: BattleScene | null, innerElem?: HTMLDivElement) {
		this.elem = elem;

		if (!innerElem) {
			elem.setAttribute('role', 'log');
			elem.innerHTML = '';
			innerElem = document.createElement('div');
			innerElem.className = 'inner message-log';
			elem.appendChild(innerElem);
		}
		this.innerElem = innerElem;

		if (scene) {
			this.scene = scene;
			const preemptElem = document.createElement('div');
			preemptElem.className = 'inner-preempt message-log';
			elem.appendChild(preemptElem);
			this.preemptElem = preemptElem;
			this.battleParser = new BattleTextParser();
		}

		this.className = elem.className;
		elem.onscroll = this.onScroll;
	}
	onScroll = () => {
		const distanceFromBottom = this.elem.scrollHeight - this.elem.scrollTop - this.elem.clientHeight;
		this.atBottom = (distanceFromBottom < 30);
	};
	reset() {
		this.innerElem.innerHTML = '';
		this.atBottom = true;
		this.skippedLines = false;
	}
	destroy() {
		this.elem.onscroll = null;
		this.elem.innerHTML = '';
	}
	addSeekEarlierButton() {
		if (this.skippedLines) return;
		this.skippedLines = true;
		const el = document.createElement('div');
		el.className = 'chat';
		el.innerHTML = '<button class="button earlier-button"><i class="fa fa-caret-up"></i><br />Earlier messages</button>';
		const button = el.getElementsByTagName('button')[0];
		button?.addEventListener?.('click', e => {
			e.preventDefault();
			this.scene?.battle.seekTurn(this.scene.battle.turn - 100);
		});
		this.addNode(el);
	}
	add(args: Args, kwArgs?: KWArgs, preempt?: boolean) {
		if (kwArgs?.silent) return;
		const battle = this.scene?.battle;
		if (battle?.seeking) {
			if (battle.stepQueue.length > 2000) {
				// adding elements gets slower and slower the more there are
				// (so showing 100 turns takes around 2 seconds, and 1000 turns takes around a minute)
				// capping at 100 turns makes everything _reasonably_ snappy
				if (
					battle.seeking === Infinity ?
						battle.currentStep < battle.stepQueue.length - 2000 :
						battle.turn < battle.seeking! - 100
				) {
					this.addSeekEarlierButton();
					return;
				}
			}
		}
		let divClass = 'chat';
		let divHTML = '';
		let noNotify: boolean | undefined;
		if (!['join', 'j', 'leave', 'l'].includes(args[0])) this.joinLeave = null;
		if (!['name', 'n'].includes(args[0])) this.lastRename = null;
		switch (args[0]) {
		case 'chat': case 'c': case 'c:':
			let name;
			let message;
			if (args[0] === 'c:') {
				name = args[2];
				message = args[3];
			} else {
				name = args[1];
				message = args[2];
			}
			let rank = name.charAt(0);
			if (battle?.ignoreSpects && ' +'.includes(rank)) return;
			if (battle?.ignoreOpponent) {
				if ('\u2605\u2606'.includes(rank) && toUserid(name) !== app.user.get('userid')) return;
			}
			if (window.app?.ignore?.[toUserid(name)] && ' +*\u2605\u2606'.includes(rank)) return;
			let isHighlighted = window.app?.rooms?.[battle!.roomid].getHighlight(message);
			[divClass, divHTML, noNotify] = this.parseChatMessage(message, name, '', isHighlighted);
			if (!noNotify && isHighlighted) {
				let notifyTitle = "Mentioned by " + name + " in " + battle!.roomid;
				app.rooms[battle!.roomid].notifyOnce(notifyTitle, "\"" + message + "\"", 'highlight');
			}
			break;

		case 'join': case 'j': case 'leave': case 'l': {
			const user = BattleTextParser.parseNameParts(args[1]);
			if (battle?.ignoreSpects && ' +'.includes(user.group)) return;
			const formattedUser = user.group + user.name;
			const isJoin = (args[0].charAt(0) === 'j');
			if (!this.joinLeave) {
				this.joinLeave = {
					joins: [],
					leaves: [],
					element: document.createElement('div'),
				};
				this.joinLeave.element.className = 'chat';
			}

			if (isJoin && this.joinLeave.leaves.includes(formattedUser)) {
				this.joinLeave.leaves.splice(this.joinLeave.leaves.indexOf(formattedUser), 1);
			} else {
				this.joinLeave[isJoin ? "joins" : "leaves"].push(formattedUser);
			}

			let buf = '';
			if (this.joinLeave.joins.length) {
				buf += `${this.textList(this.joinLeave.joins)} joined`;
			}
			if (this.joinLeave.leaves.length) {
				if (this.joinLeave.joins.length) buf += `; `;
				buf += `${this.textList(this.joinLeave.leaves)} left`;
			}
			this.joinLeave.element.innerHTML = `<small>${BattleLog.escapeHTML(buf)}</small>`;
			(preempt ? this.preemptElem : this.innerElem).appendChild(this.joinLeave.element);
			return;
		}

		case 'name': case 'n': {
			const user = BattleTextParser.parseNameParts(args[1]);
			if (toID(args[2]) === toID(user.name)) return;
			if (!this.lastRename || toID(this.lastRename.to) !== toID(user.name)) {
				this.lastRename = {
					from: args[2],
					to: '',
					element: document.createElement('div'),
				};
				this.lastRename.element.className = 'chat';
			}
			this.lastRename.to = user.group + user.name;
			this.lastRename.element.innerHTML = `<small>${BattleLog.escapeHTML(this.lastRename.to)} renamed from ${BattleLog.escapeHTML(this.lastRename.from)}.</small>`;
			(preempt ? this.preemptElem : this.innerElem).appendChild(this.lastRename.element);
			return;
		}

		case 'chatmsg': case '':
			divHTML = BattleLog.escapeHTML(args[1]);
			break;

		case 'chatmsg-raw': case 'raw': case 'html':
			divHTML = BattleLog.sanitizeHTML(args[1]);
			break;

		case 'uhtml': case 'uhtmlchange':
			this.changeUhtml(args[1], args[2], args[0] === 'uhtml');
			return ['', ''];

		case 'error': case 'inactive': case 'inactiveoff':
			divClass = 'chat message-error';
			divHTML = BattleLog.escapeHTML(args[1]);
			break;

		case 'bigerror':
			this.message('<div class="broadcast-red">' + BattleLog.escapeHTML(args[1]).replace(/\|/g, '<br />') + '</div>');
			return;

		case 'pm':
			divHTML = '<strong>' + BattleLog.escapeHTML(args[1]) + ':</strong> <span class="message-pm"><i style="cursor:pointer" onclick="selectTab(\'lobby\');rooms.lobby.popupOpen(\'' + BattleLog.escapeHTML(args[2], true) + '\')">(Private to ' + BattleLog.escapeHTML(args[3]) + ')</i> ' + BattleLog.parseMessage(args[4]) + '</span>';
			break;

		case 'askreg':
			this.addDiv('chat', '<div class="broadcast-blue"><b>Register an account to protect your ladder rating!</b><br /><button name="register" value="' + BattleLog.escapeHTML(args[1]) + '"><b>Register</b></button></div>');
			return;

		case 'unlink': {
			// |unlink| is deprecated in favor of |hidelines|
			const user = toID(args[2]) || toID(args[1]);
			this.unlinkChatFrom(user);
			if (args[2]) {
				const lineCount = parseInt(args[3], 10);
				this.hideChatFrom(user, true, lineCount);
			}
			return;
		}

		case 'hidelines': {
			const user = toID(args[2]);
			this.unlinkChatFrom(user);
			if (args[1] !== 'unlink') {
				const lineCount = parseInt(args[3], 10);
				this.hideChatFrom(user, args[1] === 'hide', lineCount);
			}
			return;
		}

		case 'debug':
			divClass = 'debug';
			divHTML = '<div class="chat"><small style="color:#999">[DEBUG] ' + BattleLog.escapeHTML(args[1]) + '.</small></div>';
			break;

		case 'notify':
			const title = args[1];
			const body = args[2];
			const roomid = this.scene?.battle.roomid;
			if (!roomid) break;
			app.rooms[roomid].notifyOnce(title, body, 'highlight');
			break;

		case 'showteam': {
			if (!battle) return;
			const team = Teams.unpack(args[2]);
			if (!team.length) return;
			const side = battle.getSide(args[1]);
			const exportedTeam = team.map(set => {
				let buf = Teams.export([set], battle.gen).replace(/\n/g, '<br />');
				if (set.name && set.name !== set.species) {
					buf = buf.replace(set.name, BattleLog.sanitizeHTML(`<span class="picon" style="${Dex.getPokemonIcon(set.species)}"></span><br />${set.name}`));
				} else {
					buf = buf.replace(set.species, `<span class="picon" style="${Dex.getPokemonIcon(set.species)}"></span><br />${set.species}`);
				}
				if (set.item) {
					buf = buf.replace(set.item, `${set.item} <span class="itemicon" style="${Dex.getItemIcon(set.item)}"></span>`);
				}
				return buf;
			}).join('');
			divHTML = `<div class="infobox"><details><summary>Open Team Sheet for ${side.name}</summary>${exportedTeam}</details></div>`;
			break;
		}

		case 'seed': case 'choice': case ':': case 'timer': case 't:':
		case 'J': case 'L': case 'N': case 'spectator': case 'spectatorleave':
		case 'initdone':
			return;

		default:
			this.addBattleMessage(args, kwArgs);
			return;
		}
		if (divHTML) this.addDiv(divClass, divHTML, preempt);
	}
	addBattleMessage(args: Args, kwArgs?: KWArgs) {
		switch (args[0]) {
		case 'warning':
			this.message('<strong>Warning:</strong> ' + BattleLog.escapeHTML(args[1]));
			this.message(`Bug? Report it to <a href="http://www.smogon.com/forums/showthread.php?t=3453192">the replay viewer's Smogon thread</a>`);
			if (this.scene) this.scene.wait(1000);
			return;

		case 'variation':
			this.addDiv('', '<small>Variation: <em>' + BattleLog.escapeHTML(args[1]) + '</em></small>');
			break;

		case 'rule':
			const ruleArgs = args[1].split(': ');
			this.addDiv('', '<small><em>' + BattleLog.escapeHTML(ruleArgs[0]) + (ruleArgs[1] ? ':' : '') + '</em> ' + BattleLog.escapeHTML(ruleArgs[1] || '') + '</small>');
			break;

		case 'rated':
			this.addDiv('rated', '<strong>' + (BattleLog.escapeHTML(args[1]) || 'Rated battle') + '</strong>');
			break;

		case 'tier':
			this.addDiv('', '<small>Format:</small> <br /><strong>' + BattleLog.escapeHTML(args[1]) + '</strong>');
			break;

		case 'turn':
			const h2elem = document.createElement('h2');
			h2elem.className = 'battle-history';
			let turnMessage;
			if (this.battleParser) {
				turnMessage = this.battleParser.parseArgs(args, {}).trim();
				if (!turnMessage.startsWith('==') || !turnMessage.endsWith('==')) {
					throw new Error("Turn message must be a heading.");
				}
				turnMessage = turnMessage.slice(2, -2).trim();
				this.battleParser.curLineSection = 'break';
			} else {
				turnMessage = `Turn ${args[1]}`;
			}
			h2elem.innerHTML = BattleLog.escapeHTML(turnMessage);
			this.addSpacer();
			this.addNode(h2elem);
			break;

		default:
			let line = null;
			if (this.battleParser) {
				line = this.battleParser.parseArgs(args, kwArgs || {}, true);
			}
			if (line === null) {
				this.addDiv('chat message-error', 'Unrecognized: |' + BattleLog.escapeHTML(args.join('|')));
				return;
			}
			if (!line) return;
			this.message(...this.parseLogMessage(line));
			break;
		}
	}
	textList(list: string[]) {
		let message = '';
		const listNoDuplicates: string[] = [];
		for (const user of list) {
			if (!listNoDuplicates.includes(user)) listNoDuplicates.push(user);
		}
		list = listNoDuplicates;

		if (list.length === 1) return list[0];
		if (list.length === 2) return `${list[0]} and ${list[1]}`;
		for (let i = 0; i < list.length - 1; i++) {
			if (i >= 5) {
				return `${message}and ${list.length - 5} others`;
			}
			message += `${list[i]}, `;
		}
		return `${message}and ${list[list.length - 1]}`;
		return message;
	}
	/**
	 * To avoid trolling with nicknames, we can't just run this through
	 * parseMessage
	 */
	parseLogMessage(message: string): [string, string] {
		const messages = message.split('\n').map(line => {
			line = BattleLog.escapeHTML(line);
			line = line.replace(/\*\*(.*)\*\*/, '<strong>$1</strong>');
			line = line.replace(/\|\|([^\|]*)\|\|([^\|]*)\|\|/, '<abbr title="$1">$2</abbr>');
			if (line.startsWith('  ')) line = '<small>' + line.trim() + '</small>';
			return line;
		});
		return [
			messages.join('<br />'),
			messages.filter(line => !line.startsWith('<small>[')).join('<br />'),
		];
	}
	message(message: string, sceneMessage = message) {
		if (this.scene) this.scene.message(sceneMessage);
		this.addDiv('battle-history', message);
	}
	addNode(node: HTMLElement, preempt?: boolean) {
		(preempt ? this.preemptElem : this.innerElem).appendChild(node);
		if (this.atBottom) {
			this.elem.scrollTop = this.elem.scrollHeight;
		}
	}
	updateScroll() {
		if (this.atBottom) {
			this.elem.scrollTop = this.elem.scrollHeight;
		}
	}
	addDiv(className: string, innerHTML: string, preempt?: boolean) {
		const el = document.createElement('div');
		el.className = className;
		el.innerHTML = innerHTML;
		this.addNode(el, preempt);
	}
	prependDiv(className: string, innerHTML: string, preempt?: boolean) {
		const el = document.createElement('div');
		el.className = className;
		el.innerHTML = innerHTML;
		if (this.innerElem.childNodes.length) {
			this.innerElem.insertBefore(el, this.innerElem.childNodes[0]);
		} else {
			this.innerElem.appendChild(el);
		}
		this.updateScroll();
	}
	addSpacer() {
		this.addDiv('spacer battle-history', '<br />');
	}
	changeUhtml(id: string, htmlSrc: string, forceAdd?: boolean) {
		id = toID(id);
		const classContains = ' uhtml-' + id + ' ';
		let elements = [] as HTMLDivElement[];
		for (const node of this.innerElem.childNodes as any) {
			if (node.className && (' ' + node.className + ' ').includes(classContains)) {
				elements.push(node);
			}
		}
		if (this.preemptElem) {
			for (const node of this.preemptElem.childNodes as any) {
				if (node.className && (' ' + node.className + ' ').includes(classContains)) {
					elements.push(node);
				}
			}
		}
		if (htmlSrc && elements.length && !forceAdd) {
			for (const element of elements) {
				element.innerHTML = BattleLog.sanitizeHTML(htmlSrc);
			}
			this.updateScroll();
			return;
		}
		for (const element of elements) {
			element.parentElement!.removeChild(element);
		}
		if (!htmlSrc) return;
		if (forceAdd) {
			this.addDiv('notice uhtml-' + id, BattleLog.sanitizeHTML(htmlSrc));
		} else {
			this.prependDiv('notice uhtml-' + id, BattleLog.sanitizeHTML(htmlSrc));
		}
	}
	hideChatFrom(userid: ID, showRevealButton = true, lineCount = 0) {
		const classStart = 'chat chatmessage-' + userid + ' ';
		let nodes: HTMLElement[] = [];
		for (const node of this.innerElem.childNodes as any as HTMLElement[]) {
			if (node.className && (node.className + ' ').startsWith(classStart)) {
				nodes.push(node);
			}
		}
		if (this.preemptElem) {
			for (const node of this.preemptElem.childNodes as any as HTMLElement[]) {
				if (node.className && (node.className + ' ').startsWith(classStart)) {
					nodes.push(node);
				}
			}
		}
		if (lineCount) nodes = nodes.slice(-lineCount);

		for (const node of nodes) {
			node.style.display = 'none';
			node.className = 'revealed ' + node.className;
		}
		if (!nodes.length || !showRevealButton) return;
		const button = document.createElement('button');
		button.name = 'toggleMessages';
		button.value = userid;
		button.className = 'subtle';
		button.innerHTML = `<small>(${nodes.length} line${nodes.length > 1 ? 's' : ''} from ${userid} hidden)</small>`;
		const lastNode = nodes[nodes.length - 1];
		lastNode.appendChild(document.createTextNode(' '));
		lastNode.appendChild(button);
	}

	static unlinkNodeList(nodeList: ArrayLike<HTMLElement>, classStart: string) {
		for (const node of nodeList as HTMLElement[]) {
			if (node.className && (node.className + ' ').startsWith(classStart)) {
				const linkList = node.getElementsByTagName('a');
				// iterate in reverse because linkList will update as links are removed
				for (let i = linkList.length - 1; i >= 0; i--) {
					const linkNode = linkList[i];
					const parent = linkNode.parentElement;
					if (!parent) continue;
					for (const childNode of linkNode.childNodes as any) {
						parent.insertBefore(childNode, linkNode);
					}
					parent.removeChild(linkNode);
				}
			}
		}
	}

	unlinkChatFrom(userid: ID) {
		const classStart = 'chat chatmessage-' + userid + ' ';
		const innerNodeList = this.innerElem.childNodes;
		BattleLog.unlinkNodeList(innerNodeList as NodeListOf<HTMLElement>, classStart);

		if (this.preemptElem) {
			const preemptNodeList = this.preemptElem.childNodes;
			BattleLog.unlinkNodeList(preemptNodeList as NodeListOf<HTMLElement>, classStart);
		}
	}

	preemptCatchup() {
		if (!this.preemptElem.firstChild) return;
		this.innerElem.appendChild(this.preemptElem.firstChild);
	}

	static escapeFormat(formatid: string): string {
		let atIndex = formatid.indexOf('@@@');
		if (atIndex >= 0) {
			return this.escapeFormat(formatid.slice(0, atIndex)) +
				'<br />Custom rules: ' + this.escapeHTML(formatid.slice(atIndex + 3));
		}
		if (window.BattleFormats && BattleFormats[formatid]) {
			return this.escapeHTML(BattleFormats[formatid].name);
		}
		if (window.NonBattleGames && NonBattleGames[formatid]) {
			return this.escapeHTML(NonBattleGames[formatid]);
		}
		return this.escapeHTML(formatid);
	}

	static escapeHTML(str: string, jsEscapeToo?: boolean) {
		if (typeof str !== 'string') return '';
		str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		if (jsEscapeToo) str = str.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
		return str;
	}

	static unescapeHTML(str: string) {
		str = (str ? '' + str : '');
		return str.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
	}

	static colorCache: {[userid: string]: string} = {};

	/** @deprecated */
	static hashColor(name: ID) {
		return `color:${this.usernameColor(name)};`;
	}

	static usernameColor(name: ID) {
		if (this.colorCache[name]) return this.colorCache[name];
		let hash;
		if (Config.customcolors[name]) {
			hash = MD5(Config.customcolors[name]);
		} else {
			hash = MD5(name);
		}
		let H = parseInt(hash.substr(4, 4), 16) % 360; // 0 to 360
		let S = parseInt(hash.substr(0, 4), 16) % 50 + 40; // 40 to 89
		let L = Math.floor(parseInt(hash.substr(8, 4), 16) % 20 + 30); // 30 to 49

		let {R, G, B} = this.HSLToRGB(H, S, L);
		let lum = R * R * R * 0.2126 + G * G * G * 0.7152 + B * B * B * 0.0722; // 0.013 (dark blue) to 0.737 (yellow)

		let HLmod = (lum - 0.2) * -150; // -80 (yellow) to 28 (dark blue)
		if (HLmod > 18) HLmod = (HLmod - 18) * 2.5;
		else if (HLmod < 0) HLmod = (HLmod - 0) / 3;
		else HLmod = 0;
		// let mod = ';border-right: ' + Math.abs(HLmod) + 'px solid ' + (HLmod > 0 ? 'red' : '#0088FF');
		let Hdist = Math.min(Math.abs(180 - H), Math.abs(240 - H));
		if (Hdist < 15) {
			HLmod += (15 - Hdist) / 3;
		}

		L += HLmod;

		let {R: r, G: g, B: b} = this.HSLToRGB(H, S, L);
		const toHex = (x: number) => {
			const hex = Math.round(x * 255).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};
		this.colorCache[name] = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
		return this.colorCache[name];
	}

	static HSLToRGB(H: number, S: number, L: number) {
		let C = (100 - Math.abs(2 * L - 100)) * S / 100 / 100;
		let X = C * (1 - Math.abs((H / 60) % 2 - 1));
		let m = L / 100 - C / 2;

		let R1;
		let G1;
		let B1;
		switch (Math.floor(H / 60)) {
		case 1: R1 = X; G1 = C; B1 = 0; break;
		case 2: R1 = 0; G1 = C; B1 = X; break;
		case 3: R1 = 0; G1 = X; B1 = C; break;
		case 4: R1 = X; G1 = 0; B1 = C; break;
		case 5: R1 = C; G1 = 0; B1 = X; break;
		case 0: default: R1 = C; G1 = X; B1 = 0; break;
		}
		let R = R1 + m;
		let G = G1 + m;
		let B = B1 + m;
		return {R, G, B};
	}

	static prefs(name: string) {
		// @ts-ignore
		if (window.Storage?.prefs) return Storage.prefs(name);
		// @ts-ignore
		if (window.PS) return PS.prefs[name];
		return undefined;
	}

	parseChatMessage(
		message: string, name: string, timestamp: string, isHighlighted?: boolean
	): [string, string, boolean?] {
		let showMe = !BattleLog.prefs('chatformatting')?.hideme;
		let group = ' ';
		if (!/[A-Za-z0-9]/.test(name.charAt(0))) {
			// Backwards compatibility
			group = name.charAt(0);
			name = name.substr(1);
		}
		const colorStyle = ` style="color:${BattleLog.usernameColor(toID(name))}"`;
		const clickableName = `<small>${BattleLog.escapeHTML(group)}</small><span class="username" data-name="${BattleLog.escapeHTML(name)}">${BattleLog.escapeHTML(name)}</span>`;
		let hlClass = isHighlighted ? ' highlighted' : '';
		let isMine = (window.app?.user?.get('name') === name) || (window.PS?.user.name === name);
		let mineClass = isMine ? ' mine' : '';

		let cmd = '';
		let target = '';
		if (message.charAt(0) === '/') {
			if (message.charAt(1) === '/') {
				message = message.slice(1);
			} else {
				let spaceIndex = message.indexOf(' ');
				cmd = (spaceIndex >= 0 ? message.slice(1, spaceIndex) : message.slice(1));
				if (spaceIndex >= 0) target = message.slice(spaceIndex + 1);
			}
		}

		switch (cmd) {
		case 'me':
		case 'mee':
			let parsedMessage = BattleLog.parseMessage(' ' + target);
			if (cmd === 'mee') parsedMessage = parsedMessage.slice(1);
			if (!showMe) {
				return [
					'chat chatmessage-' + toID(name) + hlClass + mineClass,
					`${timestamp}<strong${colorStyle}>${clickableName}:</strong> <em>/me${parsedMessage}</em>`,
				];
			}
			return [
				'chat chatmessage-' + toID(name) + hlClass + mineClass,
				`${timestamp}<em><i><strong${colorStyle}>&bull; ${clickableName}</strong>${parsedMessage}</i></em>`,
			];
		case 'invite':
			let roomid = toRoomid(target);
			return [
				'chat',
				`${timestamp}<em>${clickableName} invited you to join the room "${roomid}"</em>' +
				'<div class="notice"><button name="joinRoom" value="${roomid}">Join ${roomid}</button></div>`,
			];
		case 'announce':
			return [
				'chat chatmessage-' + toID(name) + hlClass + mineClass,
				`${timestamp}<strong${colorStyle}>${clickableName}:</strong> <span class="message-announce">${BattleLog.parseMessage(target)}</span>`,
			];
		case 'log':
			return [
				'chat chatmessage-' + toID(name) + hlClass + mineClass,
				`${timestamp}<span class="message-log">${BattleLog.parseMessage(target)}</span>`,
			];
		case 'data-pokemon':
		case 'data-item':
		case 'data-ability':
		case 'data-move':
			return ['chat message-error', '[outdated code no longer supported]'];
		case 'text':
			return ['chat', BattleLog.parseMessage(target)];
		case 'error':
			return ['chat message-error', formatText(target, true)];
		case 'html':
			if (!name) {
				return [
					'chat' + hlClass,
					`${timestamp}<em>${BattleLog.sanitizeHTML(target)}</em>`,
				];
			}
			return [
				'chat chatmessage-' + toID(name) + hlClass + mineClass,
				`${timestamp}<strong${colorStyle}>${clickableName}:</strong> <em>${BattleLog.sanitizeHTML(target)}</em>`,
			];
		case 'uhtml':
		case 'uhtmlchange':
			let parts = target.split(',');
			let htmlSrc = parts.slice(1).join(',').trim();
			this.changeUhtml(parts[0], htmlSrc, cmd === 'uhtml');
			return ['', ''];
		case 'raw':
			return ['chat', BattleLog.sanitizeHTML(target)];
		case 'nonotify':
			return ['chat', BattleLog.sanitizeHTML(target), true];
		default:
			// Not a command or unsupported. Parsed as a normal chat message.
			if (!name) {
				return [
					'chat' + hlClass,
					`${timestamp}<em>${BattleLog.parseMessage(message)}</em>`,
				];
			}
			return [
				'chat chatmessage-' + toID(name) + hlClass + mineClass,
				`${timestamp}<strong${colorStyle}>${clickableName}:</strong> <em>${BattleLog.parseMessage(message)}</em>`,
			];
		}
	}

	static parseMessage(str: string, isTrusted = false) {
		// Don't format console commands (>>).
		if (str.substr(0, 3) === '>> ' || str.substr(0, 4) === '>>> ') return this.escapeHTML(str);
		// Don't format console results (<<).
		if (str.substr(0, 3) === '<< ') return this.escapeHTML(str);
		str = formatText(str, isTrusted);

		let options = BattleLog.prefs('chatformatting') || {};

		if (options.hidelinks) {
			str = str.replace(/<a[^>]*>/g, '<u>').replace(/<\/a>/g, '</u>');
		}
		if (options.hidespoiler) {
			str = str.replace(/<span class="spoiler">/g, '<span class="spoiler spoiler-shown">');
		}
		if (options.hidegreentext) {
			str = str.replace(/<span class="greentext">/g, '<span>');
		}

		return str;
	}

	static interstice = (() => {
		const whitelist: string[] = Config.whitelist;
		const patterns = whitelist.map(entry => new RegExp(
			`^(https?:)?//([A-Za-z0-9-]*\\.)?${entry.replace(/\./g, '\\.')}(/.*)?`,
		'i'));
		return {
			isWhitelisted(uri: string) {
				if (uri[0] === '/' && uri[1] !== '/') {
					// domain-relative URIs are safe
					return true;
				}
				for (const pattern of patterns) {
					if (pattern.test(uri)) return true;
				}
				return false;
			},
			getURI(uri: string) {
				return `http://${Config.routes.root}/interstice?uri=${encodeURIComponent(uri)}`;
			},
		};
	})();

	static players: any[] = [];
	static ytLoading: Promise<void> | null = null;
	static tagPolicy: ((tagName: string, attribs: string[]) => any) | null = null;
	static initSanitizeHTML() {
		if (this.tagPolicy) return;
		if (!('html4' in window)) {
			throw new Error('sanitizeHTML requires caja');
		}

		// By default, Caja will ban any HTML tags it doesn't recognize.
		// Additional HTML tags to allow:
		Object.assign(html4.ELEMENTS, {
			marquee: 0,
			blink: 0,
			psicon: html4.eflags['OPTIONAL_ENDTAG'] | html4.eflags['EMPTY'],
			username: 0,
			spotify: 0,
			youtube: 0,
			formatselect: 0,
			copytext: 0,
			twitch: 0,
		});

		// By default, Caja will ban any attributes it doesn't recognize.
		// Additional attributes to allow:
		Object.assign(html4.ATTRIBS, {
			// See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/marquee
			'marquee::behavior': 0,
			'marquee::bgcolor': 0,
			'marquee::direction': 0,
			'marquee::height': 0,
			'marquee::hspace': 0,
			'marquee::loop': 0,
			'marquee::scrollamount': 0,
			'marquee::scrolldelay': 0,
			'marquee::truespeed': 0,
			'marquee::vspace': 0,
			'marquee::width': 0,
			'psicon::pokemon': 0,
			'psicon::item': 0,
			'psicon::type': 0,
			'selectformat::type': 0,
			'psicon::category': 0,
			'username::name': 0,
			'form::data-submitsend': 0,
			'formatselect::format': 0,
			'div::data-server': 0,
			'button::data-send': 0,
			'form::data-delimiter': 0,
			'button::data-delimiter': 0,
			'*::aria-label': 0,
			'*::aria-hidden': 0,
		});

		// Caja unfortunately doesn't document how `tagPolicy` works, so
		// here's how it goes:

		// Every opening tag and attributes is filtered through
		// `tagPolicy`, being replaced by the {tagName, attribs} returned.
		// Returning `undefined` means that the tag will be removed entirely.

		// We run Caja's built-in tag sanitization in the first line of our
		// custom tagPolicy, and its attribs sanitization midway through, with
		// `sanitizeAttribs`.

		// (n.b. tag contents etc can't be modified in this step.)

		/**
		 * @param tagName Lowercase tag name
		 * @param attribs attribs in the form of [key, value, key, value]
		 * @return undefined to remove the tag
		 */
		this.tagPolicy = (tagName: string, attribs: string[]) => {
			if (html4.ELEMENTS[tagName] & html4.eflags['UNSAFE']) {
				return;
			}

			function getAttrib(key: string) {
				for (let i = 0; i < attribs.length - 1; i += 2) {
					if (attribs[i] === key) {
						return attribs[i + 1];
					}
				}
				return undefined;
			}
			function setAttrib(key: string, value: string) {
				for (let i = 0; i < attribs.length - 1; i += 2) {
					if (attribs[i] === key) {
						attribs[i + 1] = value;
						return;
					}
				}
				attribs.push(key, value);
			}
			function deleteAttrib(key: string) {
				for (let i = 0; i < attribs.length - 1; i += 2) {
					if (attribs[i] === key) {
						attribs.splice(i, 2);
						return;
					}
				}
			}

			let dataUri = '';
			let targetReplace = false;
			// if Caja CSS isn't loaded, we still trust <psicon> CSS
			let unsanitizedStyle = '';

			if (tagName === 'a') {
				if (getAttrib('target') === 'replace') {
					targetReplace = true;
				}
			} else if (tagName === 'img') {
				const src = getAttrib('src') || '';
				if (src.startsWith('data:image/')) {
					dataUri = src;
				}
				if (src.startsWith('//')) {
					if (location.protocol !== 'http:' && location.protocol !== 'https:') {
						// in testclient with `file://`, fix src so it still works
						setAttrib('src', 'https:' + src);
					}
				}
			} else if (tagName === 'twitch') {
				// <iframe src="https://player.twitch.tv/?channel=ninja&parent=www.example.com" allowfullscreen="true" height="378" width="620"></iframe>
				const src = getAttrib('src') || "";
				const channelId = /(https?:\/\/)?twitch.tv\/([A-Za-z0-9]+)/i.exec(src)?.[2];
				const height = parseInt(getAttrib('height') || "", 10) || 400;
				const width = parseInt(getAttrib('width') || "", 10) || 340;
				return {
					tagName: 'iframe',
					attribs: [
						'src', `https://player.twitch.tv/?channel=${channelId}&parent=${location.hostname}&autoplay=false`,
						'allowfullscreen', 'true', 'height', `${height}`, 'width', `${width}`,
					],
				};
			} else if (tagName === 'username') {
				// <username> is a custom element that handles namecolors
				tagName = 'strong';
				const color = this.usernameColor(toID(getAttrib('name')));
				const style = getAttrib('style');
				setAttrib('style', `${style};color:${color}`);
			} else if (tagName === 'spotify') {
				// <iframe src="https://open.spotify.com/embed/track/6aSYnCIwcLpnDXngGKAEzZ" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
				const src = getAttrib('src') || '';
				const songId = /(?:\?v=|\/track\/)([A-Za-z0-9]+)/.exec(src)?.[1];

				return {
					tagName: 'iframe',
					attribs: ['src', `https://open.spotify.com/embed/track/${songId}`, 'width', '300', 'height', '380', 'frameborder', '0', 'allowtransparency', 'true', 'allow', 'encrypted-media'],
				};
			} else if (tagName === 'youtube') {
				// <iframe width="320" height="180" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

				const src = getAttrib('src') || '';
				// Google's ToS requires a minimum of 200x200
				let width = getAttrib('width') || '0';
				let height = getAttrib('height') || '0';
				if (Number(width) < 200) {
					width = window.innerWidth >= 400 ? '400' : '320';
				}
				if (Number(height) < 200) {
					height = window.innerWidth >= 400 ? '225' : '200';
				}
				const videoId = /(?:\?v=|\/embed\/)([A-Za-z0-9_\-]+)/.exec(src)?.[1];
				if (!videoId) return {tagName: 'img', attribs: ['alt', `invalid src for <youtube>`]};

				const time = /(?:\?|&)(?:t|start)=([0-9]+)/.exec(src)?.[1];
				this.players.push(null);
				const idx = this.players.length;
				this.initYoutubePlayer(idx);
				return {
					tagName: 'iframe',
					attribs: [
						'id', `youtube-iframe-${idx}`,
						'width', width, 'height', height,
						'src', `https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1${time ? `&start=${time}` : ''}`,
						'frameborder', '0', 'allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', 'allowfullscreen', 'allowfullscreen',
						'time', (time || 0) + "",
					],
				};
			} else if (tagName === 'formatselect') {
				return {
					tagName: 'button',
					attribs: [
						'type', 'selectformat',
						'class', "select formatselect",
						'value', getAttrib('format') || getAttrib('value') || '',
						'name', getAttrib('name') || '',
					],
				};
			} else if (tagName === 'copytext') {
				return {
					tagName: 'button',
					attribs: [
						'type', getAttrib('type'),
						'class', getAttrib('class') || 'button',
						'value', getAttrib('value'),
						'name', 'copyText',
					],
				};
			} else if (tagName === 'psicon') {
				// <psicon> is a custom element which supports a set of mutually incompatible attributes:
				// <psicon pokemon> and <psicon item>
				let iconType = null;
				let iconValue = null;
				for (let i = 0; i < attribs.length - 1; i += 2) {
					if (attribs[i] === 'pokemon' || attribs[i] === 'item' || attribs[i] === 'type' || attribs[i] === 'category') {
						[iconType, iconValue] = attribs.slice(i, i + 2);
						break;
					}
				}
				tagName = 'span';

				if (iconType) {
					const className = getAttrib('class');

					if (iconType === 'pokemon') {
						setAttrib('class', 'picon' + (className ? ' ' + className : ''));
						unsanitizedStyle = Dex.getPokemonIcon(iconValue);
					} else if (iconType === 'item') {
						setAttrib('class', 'itemicon' + (className ? ' ' + className : ''));
						unsanitizedStyle = Dex.getItemIcon(iconValue);
					} else if (iconType === 'type') {
						tagName = Dex.getTypeIcon(iconValue).slice(1, -3);
					} else if (iconType === 'category') {
						tagName = Dex.getCategoryIcon(iconValue).slice(1, -3);
					}
				}
			}

			attribs = html.sanitizeAttribs(tagName, attribs, (urlData: any) => {
				if (urlData.scheme_ === 'geo' || urlData.scheme_ === 'sms' || urlData.scheme_ === 'tel') return null;
				return urlData;
			});
			if (unsanitizedStyle) {
				const style = getAttrib('style');
				setAttrib('style', unsanitizedStyle + (style ? '; ' + style : ''));
			}

			if (dataUri && tagName === 'img') {
				setAttrib('src', dataUri);
			}
			if (tagName === 'a' || (tagName === 'form' && !getAttrib('data-submitsend'))) {
				if (targetReplace) {
					setAttrib('data-target', 'replace');
					deleteAttrib('target');
				} else {
					setAttrib('target', '_blank');
				}
				if (tagName === 'a') {
					setAttrib('rel', 'noopener');
				}
			}
			return {tagName, attribs};
		};
	}
	static localizeTime(full: string, date: string, time: string, timezone?: string) {
		let parsedTime = new Date(date + 'T' + time + (timezone || 'Z').toUpperCase());
		// Very old (pre-ES5) web browsers may be incapable of parsing ISO 8601
		// dates. In such a case, gracefully continue without replacing the date
		// format.
		if (!parsedTime.getTime()) return full;

		let formattedTime;
		// Try using Intl API if it exists
		if ((window as any).Intl?.DateTimeFormat) {
			formattedTime = new Intl.DateTimeFormat(undefined, {
				month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric',
			}).format(parsedTime);
		} else {
			// toLocaleString even exists in ECMAScript 1, so no need to check
			// if it exists.
			formattedTime = parsedTime.toLocaleString();
		}
		return '<time>' + BattleLog.escapeHTML(formattedTime) + '</time>';
	}
	static sanitizeHTML(input: string) {
		if (typeof input !== 'string') return '';

		this.initSanitizeHTML();

		input = input.replace(/<username([^>]*)>([^<]*)<\/username>/gi, (match, attrs, username) => {
			if (/\bname\s*=\s*"/.test(attrs)) return match;
			const escapedUsername = username.replace(/"/g, '&quot;').replace(/>/g, '&gt;');
			return `<username${attrs} name="${escapedUsername}">${username}</username>`;
		});

		// Our custom element support happens in `tagPolicy`, which is set
		// up in `initSanitizeHTML` above.
		const sanitized = html.sanitizeWithPolicy(input, this.tagPolicy) as string;

		// <time> parsing requires ISO 8601 time. While more time formats are
		// supported by most JavaScript implementations, it isn't required, and
		// how to exactly enforce ignoring user agent timezone setting is not obvious.
		// As dates come from the server which isn't aware of client timezone, a
		// particular timezone is required.
		//
		// This regular expression is split into three groups.
		//
		// Group 1 - date
		// Group 2 - time (seconds and milliseconds are optional)
		// Group 3 - optional timezone
		//
		// Group 1 and group 2 are split to allow using space as a separator
		// instead of T. Stricly speaking ECMAScript 5 specification only
		// allows T, however it's more practical to also allow spaces.
		return sanitized.replace(
			/<time>\s*([+-]?\d{4,}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?)(Z|[+-]\d{2}:\d{2})?\s*<\/time>/ig,
		this.localizeTime);
	}

	static initYoutubePlayer(idx: number) {
		const id = `youtube-iframe-${idx}`;
		const loadPlayer = () => {
			const el = $(`#${id}`);
			if (!el.length) return;
			const player = new window.YT.Player(id, {
				events: {
					onStateChange: (event: any) => {
						if (event.data === window.YT.PlayerState.PLAYING) {
							for (const curPlayer of BattleLog.players) {
								if (player === curPlayer) continue;
								curPlayer?.pauseVideo?.();
							}
						}
					},
				},
			});
			const time = Number(el.attr('time'));
			if (time) {
				player.seekTo(time);
			}
			this.players[idx - 1] = player;

		};
		// wait for html element to be in DOM
		this.ensureYoutube().then(() => {
			setTimeout(() => loadPlayer(), 300);
		});
	}

	static ensureYoutube(): Promise<void> {
		if (this.ytLoading) return this.ytLoading;

		this.ytLoading = new Promise(resolve => {
			const el = document.createElement('script');
			el.type = 'text/javascript';
			el.async = true;
			el.src = 'https://youtube.com/iframe_api';
			el.onload = () => {
				// since the src loads more files remotely we'll just wait
				// until the player exists
				const loopCheck = () => {
					if (!window.YT?.Player) {
						setTimeout(() => loopCheck(), 300);
					} else {
						resolve();
					}
				};
				loopCheck();
			};
			document.body.appendChild(el);
		});
		return this.ytLoading;
	}

	/*********************************************************
	 * Replay files
	 *********************************************************/

	// Replay files are .html files that display a replay for a battle.

	// The .html files mainly contain replay log data; the actual replay
	// player is downloaded online. Also included is a textual log and
	// some minimal CSS to make it look pretty, for offline viewing.

	// This strategy helps keep the replay file reasonably small; of
	// the 30 KB or so for a 50-turn battle, around 10 KB is the log
	// data, and around 20 KB is the textual log.

	// The actual replay player is downloaded from replay-embed.js,
	// which handles loading all the necessary resources for turning the log
	// data into a playable replay.

	// Battle log data is stored in and loaded from a
	// <script type="text/plain" class="battle-log-data"> tag.

	// replay-embed.js is loaded through a cache-buster that rotates daily.
	// This allows pretty much anything about the replay viewer to be
	// updated as desired.

	static createReplayFile(room: {battle: Battle, id?: string, fragment?: string}) {
		let battle = room.battle;
		let replayid = room.id;
		if (replayid) {
			// battle room
			replayid = replayid.slice(7);
			if (window.Config?.server.id !== 'showdown') {
				if (!window.Config?.server.registered) {
					replayid = 'unregisteredserver-' + replayid;
				} else {
					replayid = Config.server.id + '-' + replayid;
				}
			}
		} else if (room.fragment) {
			// replay panel
			replayid = room.fragment;
		} else {
			replayid = battle.id;
		}
		// TODO: do this synchronously so large battles aren't cut off
		battle.seekTurn(Infinity);
		if (!battle.atQueueEnd) return null;
		let buf = '<!DOCTYPE html>\n';
		buf += '<meta charset="utf-8" />\n';
		buf += '<!-- version 1 -->\n';
		buf += `<title>${BattleLog.escapeHTML(battle.tier)} replay: ${BattleLog.escapeHTML(battle.p1.name)} vs. ${BattleLog.escapeHTML(battle.p2.name)}</title>\n`;
		// This <style> exists so that replays are readable without an internet connection
		buf += '<style>\n';
		buf += 'html,body {font-family:Verdana, sans-serif;font-size:10pt;margin:0;padding:0;}body{padding:12px 0;} .battle-log {font-family:Verdana, sans-serif;font-size:10pt;} .battle-log-inline {border:1px solid #AAAAAA;background:#EEF2F5;color:black;max-width:640px;margin:0 auto 80px;padding-bottom:5px;} .battle-log .inner {padding:4px 8px 0px 8px;} .battle-log .inner-preempt {padding:0 8px 4px 8px;} .battle-log .inner-after {margin-top:0.5em;} .battle-log h2 {margin:0.5em -8px;padding:4px 8px;border:1px solid #AAAAAA;background:#E0E7EA;border-left:0;border-right:0;font-family:Verdana, sans-serif;font-size:13pt;} .battle-log .chat {vertical-align:middle;padding:3px 0 3px 0;font-size:8pt;} .battle-log .chat strong {color:#40576A;} .battle-log .chat em {padding:1px 4px 1px 3px;color:#000000;font-style:normal;} .chat.mine {background:rgba(0,0,0,0.05);margin-left:-8px;margin-right:-8px;padding-left:8px;padding-right:8px;} .spoiler {color:#BBBBBB;background:#BBBBBB;padding:0px 3px;} .spoiler:hover, .spoiler:active, .spoiler-shown {color:#000000;background:#E2E2E2;padding:0px 3px;} .spoiler a {color:#BBBBBB;} .spoiler:hover a, .spoiler:active a, .spoiler-shown a {color:#2288CC;} .chat code, .chat .spoiler:hover code, .chat .spoiler:active code, .chat .spoiler-shown code {border:1px solid #C0C0C0;background:#EEEEEE;color:black;padding:0 2px;} .chat .spoiler code {border:1px solid #CCCCCC;background:#CCCCCC;color:#CCCCCC;} .battle-log .rated {padding:3px 4px;} .battle-log .rated strong {color:white;background:#89A;padding:1px 4px;border-radius:4px;} .spacer {margin-top:0.5em;} .message-announce {background:#6688AA;color:white;padding:1px 4px 2px;} .message-announce a, .broadcast-green a, .broadcast-blue a, .broadcast-red a {color:#DDEEFF;} .broadcast-green {background-color:#559955;color:white;padding:2px 4px;} .broadcast-blue {background-color:#6688AA;color:white;padding:2px 4px;} .infobox {border:1px solid #6688AA;padding:2px 4px;} .infobox-limited {max-height:200px;overflow:auto;overflow-x:hidden;} .broadcast-red {background-color:#AA5544;color:white;padding:2px 4px;} .message-learn-canlearn {font-weight:bold;color:#228822;text-decoration:underline;} .message-learn-cannotlearn {font-weight:bold;color:#CC2222;text-decoration:underline;} .message-effect-weak {font-weight:bold;color:#CC2222;} .message-effect-resist {font-weight:bold;color:#6688AA;} .message-effect-immune {font-weight:bold;color:#666666;} .message-learn-list {margin-top:0;margin-bottom:0;} .message-throttle-notice, .message-error {color:#992222;} .message-overflow, .chat small.message-overflow {font-size:0pt;} .message-overflow::before {font-size:9pt;content:\'...\';} .subtle {color:#3A4A66;}\n';
		buf += '</style>\n';
		buf += '<div class="wrapper replay-wrapper" style="max-width:1180px;margin:0 auto">\n';
		buf += '<input type="hidden" name="replayid" value="' + replayid + '" />\n';
		buf += '<div class="battle"></div><div class="battle-log"></div><div class="replay-controls"></div><div class="replay-controls-2"></div>\n';
		buf += `<h1 style="font-weight:normal;text-align:center"><strong>${BattleLog.escapeHTML(battle.tier)}</strong><br /><a href="http://${Config.routes.users}/${toID(battle.p1.name)}" class="subtle" target="_blank">${BattleLog.escapeHTML(battle.p1.name)}</a> vs. <a href="http://${Config.routes.users}/${toID(battle.p2.name)}" class="subtle" target="_blank">${BattleLog.escapeHTML(battle.p2.name)}</a></h1>\n`;
		buf += '<script type="text/plain" class="battle-log-data">' + battle.stepQueue.join('\n').replace(/\//g, '\\/') + '</script>\n'; // lgtm [js/incomplete-sanitization]
		buf += '</div>\n';
		buf += '<div class="battle-log battle-log-inline"><div class="inner">' + battle.scene.log.elem.innerHTML + '</div></div>\n';
		buf += '</div>\n';
		buf += '<script>\n';
		buf += `let daily = Math.floor(Date.now()/1000/60/60/24);document.write('<script src="https://${Config.routes.client}/js/replay-embed.js?version'+daily+'"></'+'script>');\n`;
		buf += '</script>\n';
		return buf;
	}

	static createReplayFileHref(room: {battle: Battle, id?: string, fragment?: string}) {
		// unescape(encodeURIComponent()) is necessary because btoa doesn't support Unicode
		const replayFile = BattleLog.createReplayFile(room);
		if (!replayFile) return 'javascript:alert("You will need to click Download again once the replay file is at the end.");void 0';
		return 'data:text/plain;base64,' + encodeURIComponent(btoa(unescape(encodeURIComponent(replayFile))));
	}
}
