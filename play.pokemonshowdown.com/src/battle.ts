/**
 * Pokemon Showdown Battle
 *
 * This is the main file for handling battle animations
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * Layout:
 *
 * - Battle
 *   - Side
 *     - Pokemon
 *   - BattleScene
 *     - BattleLog
 *       - BattleTextParser
 *
 * When a Battle receives a message, it splits the message into tokens
 * and parses what happens, updating its own state, and then telling
 * BattleScene to do any relevant animations. The tokens then get
 * passed directly into BattleLog. If the message is an in-battle
 * message, it'll be extracted by BattleTextParser, which adds it to
 * both the battle log itself, as well as the messagebar.
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

import {BattleSceneStub} from './battle-scene-stub';
import {BattleLog} from './battle-log';
import {BattleScene, PokemonSprite, BattleStatusAnims} from './battle-animations';

/** [id, element?, ...misc] */
export type EffectState = any[] & {0: ID};
/** [name, minTimeLeft, maxTimeLeft] */
export type WeatherState = [string, number, number];
export type HPColor = 'r' | 'y' | 'g';

export class Pokemon implements PokemonDetails, PokemonHealth {
	name = '';
	speciesForme = '';

	/**
	 * A string representing information extractable from textual
	 * messages: side, nickname.
	 *
	 * Will be the empty string between Team Preview and the first
	 * switch-in.
	 *
	 * Examples: `p1: Unown` or `p2: Sparky`
	 */
	ident = '';
	/**
	 * A string representing visible information not included in
	 * ident: species, level, gender, shininess. Level is left off
	 * if it's 100; gender is left off if it's genderless.
	 *
	 * Note: Can be partially filled out in Team Preview, because certain
	 * forme information and shininess isn't visible there. In those
	 * cases, details can change during the first switch-in, but will
	 * otherwise not change over the course of a game.
	 *
	 * Examples: `Mimikyu, L50, F`, `Steelix, M, shiny`
	 */
	details = '';
	/**
	 * `` `${ident}|${details}` ``. Tracked for ease of searching.
	 *
	 * As with ident, blank before the first switch-in, and will only
	 * change during the first switch-in.
	 */
	searchid = '';

	side: Side;
	slot = 0;

	fainted = false;
	hp = 0;
	maxhp = 1000;
	level = 100;
	gender: GenderName = 'N';
	shiny = false;

	hpcolor: HPColor = 'g';
	moves: string[] = [];
	ability = '';
	baseAbility = '';
	item = '';
	itemEffect = '';
	prevItem = '';
	prevItemEffect = '';
	terastallized: string | '' = '';
	teraType = '';

	boosts: {[stat: string]: number} = {};
	status: StatusName | 'tox' | '' | '???' = '';
	statusStage = 0;
	volatiles: {[effectid: string]: EffectState} = {};
	turnstatuses: {[effectid: string]: EffectState} = {};
	movestatuses: {[effectid: string]: EffectState} = {};
	lastMove = '';

	/** [[moveName, ppUsed]] */
	moveTrack: [string, number][] = [];
	statusData = {sleepTurns: 0, toxicTurns: 0};
	timesAttacked = 0;

	sprite: PokemonSprite;

	constructor(data: PokemonDetails, side: Side) {
		this.side = side;
		this.speciesForme = data.speciesForme;

		this.details = data.details;
		this.name = data.name;
		this.level = data.level;
		this.shiny = data.shiny;
		this.gender = data.gender || 'N';
		this.ident = data.ident;
		this.terastallized = data.terastallized || '';
		this.searchid = data.searchid;

		this.sprite = side.battle.scene.addPokemonSprite(this);
	}

	isActive() {
		return this.side.active.includes(this);
	}

	/** @deprecated */
	private getHPColor(): HPColor {
		if (this.hpcolor) return this.hpcolor;
		let ratio = this.hp / this.maxhp;
		if (ratio > 0.5) return 'g';
		if (ratio > 0.2) return 'y';
		return 'r';
	}
	/** @deprecated */
	private getHPColorClass() {
		switch (this.getHPColor()) {
		case 'y': return 'hpbar hpbar-yellow';
		case 'r': return 'hpbar hpbar-red';
		}
		return 'hpbar';
	}
	static getPixelRange(pixels: number, color: HPColor | ''): [number, number] {
		let epsilon = 0.5 / 714;

		if (pixels === 0) return [0, 0];
		if (pixels === 1) return [0 + epsilon, 2 / 48 - epsilon];
		if (pixels === 9) {
			if (color === 'y') { // ratio is > 0.2
				return [0.2 + epsilon, 10 / 48 - epsilon];
			} else { // ratio is <= 0.2
				return [9 / 48, 0.2];
			}
		}
		if (pixels === 24) {
			if (color === 'g') { // ratio is > 0.5
				return [0.5 + epsilon, 25 / 48 - epsilon];
			} else { // ratio is exactly 0.5
				return [0.5, 0.5];
			}
		}
		if (pixels === 48) return [1, 1];

		return [pixels / 48, (pixels + 1) / 48 - epsilon];
	}
	static getFormattedRange(range: [number, number], precision: number, separator: string) {
		if (range[0] === range[1]) {
			let percentage = Math.abs(range[0] * 100);
			if (Math.floor(percentage) === percentage) {
				return percentage + '%';
			}
			return percentage.toFixed(precision) + '%';
		}
		let lower;
		let upper;
		if (precision === 0) {
			lower = Math.floor(range[0] * 100);
			upper = Math.ceil(range[1] * 100);
		} else {
			lower = (range[0] * 100).toFixed(precision);
			upper = (range[1] * 100).toFixed(precision);
		}
		return '' + lower + separator + upper + '%';
	}
	// Returns [min, max] damage dealt as a proportion of total HP from 0 to 1
	getDamageRange(damage: any): [number, number] {
		if (damage[1] !== 48) {
			let ratio = damage[0] / damage[1];
			return [ratio, ratio];
		} else if (damage.length === undefined) {
			// wrong pixel damage.
			// this case exists for backward compatibility only.
			return [damage[2] / 100, damage[2] / 100];
		}
		// pixel damage
		let oldrange = Pokemon.getPixelRange(damage[3], damage[4]);
		let newrange = Pokemon.getPixelRange(damage[3] + damage[0], this.hpcolor);
		if (damage[0] === 0) {
			// no change in displayed pixel width
			return [0, newrange[1] - newrange[0]];
		}
		if (oldrange[0] < newrange[0]) { // swap order
			let r = oldrange;
			oldrange = newrange;
			newrange = r;
		}
		return [oldrange[0] - newrange[1], oldrange[1] - newrange[0]];
	}
	healthParse(hpstring: string, parsedamage?: boolean, heal?: boolean):
		[number, number, number] | [number, number, number, number, HPColor] | null {
		// returns [delta, denominator, percent(, oldnum, oldcolor)] or null
		if (!hpstring || !hpstring.length) return null;
		let parenIndex = hpstring.lastIndexOf('(');
		if (parenIndex >= 0) {
			// old style damage and health reporting
			if (parsedamage) {
				let damage = parseFloat(hpstring);
				// unusual check preseved for backward compatbility
				if (isNaN(damage)) damage = 50;
				if (heal) {
					this.hp += this.maxhp * damage / 100;
					if (this.hp > this.maxhp) this.hp = this.maxhp;
				} else {
					this.hp -= this.maxhp * damage / 100;
				}
				// parse the absolute health information
				let ret = this.healthParse(hpstring);
				if (ret && (ret[1] === 100)) {
					// support for old replays with nearest-100th damage and health
					return [damage, 100, damage];
				}
				// complicated expressions preserved for backward compatibility
				let percent = Math.round(Math.ceil(damage * 48 / 100) / 48 * 100);
				let pixels = Math.ceil(damage * 48 / 100);
				return [pixels, 48, percent];
			}
			if (hpstring.substr(hpstring.length - 1) !== ')') {
				return null;
			}
			hpstring = hpstring.substr(parenIndex + 1, hpstring.length - parenIndex - 2);
		}

		let oldhp = this.fainted ? 0 : (this.hp || 1);
		let oldmaxhp = this.maxhp;
		let oldwidth = this.hpWidth(100);
		let oldcolor = this.hpcolor;

		this.side.battle.parseHealth(hpstring, this);
		if (oldmaxhp === 0) { // max hp not known before parsing this message
			oldmaxhp = oldhp = this.maxhp;
		}

		let oldnum = oldhp ? (Math.floor(this.maxhp * oldhp / oldmaxhp) || 1) : 0;
		let delta = this.hp - oldnum;
		let deltawidth = this.hpWidth(100) - oldwidth;
		return [delta, this.maxhp, deltawidth, oldnum, oldcolor];
	}
	checkDetails(details?: string) {
		if (!details) return false;
		if (details === this.details) return true;
		if (this.searchid) return false;
		if (details.indexOf(', shiny') >= 0) {
			if (this.checkDetails(details.replace(', shiny', ''))) return true;
		}
		// the actual forme was hidden on Team Preview
		details = details.replace(/(-[A-Za-z0-9-]+)?(, |$)/, '-*$2');
		return (details === this.details);
	}
	getIdent() {
		let slots = ['a', 'b', 'c', 'd', 'e', 'f'];
		return this.ident.substr(0, 2) + slots[this.slot] + this.ident.substr(2);
	}
	removeVolatile(volatile: ID) {
		this.side.battle.scene.removeEffect(this, volatile);
		if (!this.hasVolatile(volatile)) return;
		delete this.volatiles[volatile];
	}
	addVolatile(volatile: ID, ...args: any[]) {
		if (this.hasVolatile(volatile) && !args.length) return;
		this.volatiles[volatile] = [volatile, ...args] as EffectState;
		this.side.battle.scene.addEffect(this, volatile);
	}
	hasVolatile(volatile: ID) {
		return !!this.volatiles[volatile];
	}
	removeTurnstatus(volatile: ID) {
		this.side.battle.scene.removeEffect(this, volatile);
		if (!this.hasTurnstatus(volatile)) return;
		delete this.turnstatuses[volatile];
	}
	addTurnstatus(volatile: ID) {
		volatile = toID(volatile);
		this.side.battle.scene.addEffect(this, volatile);
		if (this.hasTurnstatus(volatile)) return;
		this.turnstatuses[volatile] = [volatile];
	}
	hasTurnstatus(volatile: ID) {
		return !!this.turnstatuses[volatile];
	}
	clearTurnstatuses() {
		for (let id in this.turnstatuses) {
			this.removeTurnstatus(id as ID);
		}
		this.turnstatuses = {};
		this.side.battle.scene.updateStatbar(this);
	}
	removeMovestatus(volatile: ID) {
		this.side.battle.scene.removeEffect(this, volatile);
		if (!this.hasMovestatus(volatile)) return;
		delete this.movestatuses[volatile];
	}
	addMovestatus(volatile: ID) {
		volatile = toID(volatile);
		if (this.hasMovestatus(volatile)) return;
		this.movestatuses[volatile] = [volatile];
		this.side.battle.scene.addEffect(this, volatile);
	}
	hasMovestatus(volatile: ID) {
		return !!this.movestatuses[volatile];
	}
	clearMovestatuses() {
		for (let id in this.movestatuses) {
			this.removeMovestatus(id as ID);
		}
		this.movestatuses = {};
	}
	clearVolatiles() {
		this.volatiles = {};
		this.clearTurnstatuses();
		this.clearMovestatuses();
		this.side.battle.scene.clearEffects(this);
	}
	rememberMove(moveName: string, pp = 1, recursionSource?: string) {
		if (recursionSource === this.ident) return;
		moveName = Dex.moves.get(moveName).name;
		if (moveName.charAt(0) === '*') return;
		if (moveName === 'Struggle') return;
		if (this.volatiles.transform) {
			// make sure there is no infinite recursion if both Pokemon are transformed into each other
			if (!recursionSource) recursionSource = this.ident;
			this.volatiles.transform[1].rememberMove(moveName, 0, recursionSource);
			moveName = '*' + moveName;
		}
		for (const entry of this.moveTrack) {
			if (moveName === entry[0]) {
				entry[1] += pp;
				if (entry[1] < 0) entry[1] = 0;
				return;
			}
		}
		this.moveTrack.push([moveName, pp]);
	}
	rememberAbility(ability: string, isNotBase?: boolean) {
		ability = Dex.abilities.get(ability).name;
		this.ability = ability;
		if (!this.baseAbility && !isNotBase) {
			this.baseAbility = ability;
		}
	}
	getBoost(boostStat: BoostStatName) {
		let boostStatTable = {
			atk: 'Atk',
			def: 'Def',
			spa: 'SpA',
			spd: 'SpD',
			spe: 'Spe',
			accuracy: 'Accuracy',
			evasion: 'Evasion',
			spc: 'Spc',
		};
		if (!this.boosts[boostStat]) {
			return '1&times;&nbsp;' + boostStatTable[boostStat];
		}
		if (this.boosts[boostStat] > 6) this.boosts[boostStat] = 6;
		if (this.boosts[boostStat] < -6) this.boosts[boostStat] = -6;
		const isRBY = this.side.battle.gen <= 1 && !this.side.battle.tier.includes('Stadium');
		if (!isRBY && (boostStat === 'accuracy' || boostStat === 'evasion')) {
			if (this.boosts[boostStat] > 0) {
				let goodBoostTable = [
					'1&times;', '1.33&times;', '1.67&times;', '2&times;', '2.33&times;', '2.67&times;', '3&times;',
				];
				// let goodBoostTable = ['Normal', '+1', '+2', '+3', '+4', '+5', '+6'];
				return '' + goodBoostTable[this.boosts[boostStat]] + '&nbsp;' + boostStatTable[boostStat];
			}
			let badBoostTable = [
				'1&times;', '0.75&times;', '0.6&times;', '0.5&times;', '0.43&times;', '0.38&times;', '0.33&times;',
			];
			// let badBoostTable = ['Normal', '&minus;1', '&minus;2', '&minus;3', '&minus;4', '&minus;5', '&minus;6'];
			return '' + badBoostTable[-this.boosts[boostStat]] + '&nbsp;' + boostStatTable[boostStat];
		}
		if (this.boosts[boostStat] > 0) {
			let goodBoostTable = [
				'1&times;', '1.5&times;', '2&times;', '2.5&times;', '3&times;', '3.5&times;', '4&times;',
			];
			// let goodBoostTable = ['Normal', '+1', '+2', '+3', '+4', '+5', '+6'];
			return '' + goodBoostTable[this.boosts[boostStat]] + '&nbsp;' + boostStatTable[boostStat];
		}
		let badBoostTable = [
			'1&times;', '0.67&times;', '0.5&times;', '0.4&times;', '0.33&times;', '0.29&times;', '0.25&times;',
		];
		// let badBoostTable = ['Normal', '&minus;1', '&minus;2', '&minus;3', '&minus;4', '&minus;5', '&minus;6'];
		return '' + badBoostTable[-this.boosts[boostStat]] + '&nbsp;' + boostStatTable[boostStat];
	}
	getWeightKg(serverPokemon?: ServerPokemon) {
		let autotomizeFactor = this.volatiles.autotomize?.[1] * 100 || 0;
		return Math.max(this.getSpecies(serverPokemon).weightkg - autotomizeFactor, 0.1);
	}
	getBoostType(boostStat: BoostStatName) {
		if (!this.boosts[boostStat]) return 'neutral';
		if (this.boosts[boostStat] > 0) return 'good';
		return 'bad';
	}
	clearVolatile() {
		this.ability = this.baseAbility;
		this.boosts = {};
		this.clearVolatiles();
		for (let i = 0; i < this.moveTrack.length; i++) {
			if (this.moveTrack[i][0].charAt(0) === '*') {
				this.moveTrack.splice(i, 1);
				i--;
			}
		}
		// this.lastMove = '';
		this.statusStage = 0;
		this.statusData.toxicTurns = 0;
		if (this.side.battle.gen === 5) this.statusData.sleepTurns = 0;
	}
	/**
	 * copyAll = false means Baton Pass,
	 * copyAll = true means Illusion breaking
	 * copyAll = 'shedtail' means Shed Tail
	 */
	copyVolatileFrom(pokemon: Pokemon, copySource?: | 'shedtail' | boolean) {
		this.boosts = pokemon.boosts;
		this.volatiles = pokemon.volatiles;
		// this.lastMove = pokemon.lastMove; // I think
		if (!copySource) {
			const volatilesToRemove = [
				'airballoon', 'attract', 'autotomize', 'disable', 'encore', 'foresight', 'gmaxchistrike', 'imprison', 'laserfocus', 'mimic', 'miracleeye', 'nightmare', 'saltcure', 'smackdown', 'stockpile1', 'stockpile2', 'stockpile3', 'syrupbomb', 'torment', 'typeadd', 'typechange', 'yawn',
			];
			for (const statName of Dex.statNamesExceptHP) {
				volatilesToRemove.push('protosynthesis' + statName);
				volatilesToRemove.push('quarkdrive' + statName);
			}
			for (const volatile of volatilesToRemove) {
				delete this.volatiles[volatile];
			}
		}
		if (copySource === 'shedtail') {
			for (let i in this.volatiles) {
				if (i === 'substitute') continue;
				delete this.volatiles[i];
			}
			this.boosts = {};
		}
		delete this.volatiles['transform'];
		delete this.volatiles['formechange'];

		pokemon.boosts = {};
		pokemon.volatiles = {};
		pokemon.side.battle.scene.removeTransform(pokemon);
		pokemon.statusStage = 0;
	}
	copyTypesFrom(pokemon: Pokemon, preterastallized = false) {
		const [types, addedType] = pokemon.getTypes(undefined, preterastallized);
		this.addVolatile('typechange' as ID, types.join('/'));
		if (addedType) {
			this.addVolatile('typeadd' as ID, addedType);
		} else {
			this.removeVolatile('typeadd' as ID);
		}
	}
	getTypes(serverPokemon?: ServerPokemon, preterastallized = false): [ReadonlyArray<TypeName>, TypeName | ''] {
		let types: ReadonlyArray<TypeName>;
		if (!preterastallized && this.terastallized && this.terastallized !== 'Stellar') {
			types = [this.terastallized as TypeName];
		} else if (this.volatiles.typechange) {
			types = this.volatiles.typechange[1].split('/');
		} else {
			types = this.getSpecies(serverPokemon).types;
		}
		if (this.hasTurnstatus('roost' as ID) && types.includes('Flying')) {
			types = types.filter(typeName => typeName !== 'Flying');
			if (!types.length) types = ['Normal'];
		}
		const addedType = (this.volatiles.typeadd ? this.volatiles.typeadd[1] : '');
		return [types, addedType];
	}
	isGrounded(serverPokemon?: ServerPokemon) {
		const battle = this.side.battle;
		if (battle.hasPseudoWeather('Gravity')) {
			return true;
		} else if (this.volatiles['ingrain'] && battle.gen >= 4) {
			return true;
		} else if (this.volatiles['smackdown']) {
			return true;
		}

		let item = toID(serverPokemon ? serverPokemon.item : this.item);
		let ability = toID(this.effectiveAbility(serverPokemon));
		if (battle.hasPseudoWeather('Magic Room') || this.volatiles['embargo'] || ability === 'klutz') {
			item = '' as ID;
		}

		if (item === 'ironball') {
			return true;
		}
		if (ability === 'levitate') {
			return false;
		}
		if (this.volatiles['magnetrise'] || this.volatiles['telekinesis']) {
			return false;
		}
		if (item === 'airballoon') {
			return false;
		}
		return !this.getTypeList(serverPokemon).includes('Flying');
	}
	effectiveAbility(serverPokemon?: ServerPokemon) {
		const ability = this.side.battle.dex.abilities.get(
			serverPokemon?.ability || this.ability || serverPokemon?.baseAbility || ''
		);
		if (
			this.fainted ||
			(this.volatiles['transform'] && ability.flags['notransform']) ||
			(!ability.flags['cantsuppress'] && (this.side.battle.ngasActive() || this.volatiles['gastroacid']))
		) {
			return '';
		}
		return ability.name;
	}
	getTypeList(serverPokemon?: ServerPokemon, preterastallized = false) {
		const [types, addedType] = this.getTypes(serverPokemon, preterastallized);
		return addedType ? types.concat(addedType) : types;
	}
	getSpeciesForme(serverPokemon?: ServerPokemon): string {
		return this.volatiles.formechange ? this.volatiles.formechange[1] :
			(serverPokemon ? serverPokemon.speciesForme : this.speciesForme);
	}
	getSpecies(serverPokemon?: ServerPokemon) {
		return this.side.battle.dex.species.get(this.getSpeciesForme(serverPokemon));
	}
	getBaseSpecies() {
		return this.side.battle.dex.species.get(this.speciesForme);
	}
	reset() {
		this.clearVolatile();
		this.hp = this.maxhp;
		this.fainted = false;
		this.status = '';
		this.moveTrack = [];
		this.name = this.name || this.speciesForme;
	}
	// This function is used for two things:
	//   1) The percentage to display beside the HP bar.
	//   2) The width to draw an HP bar.
	//
	// This function is NOT used in the calculation of any other displayed
	// percentages or ranges, which have their own, more complex, formulae.
	hpWidth(maxWidth: number) {
		if (this.fainted || !this.hp) return 0;

		// special case for low health...
		if (this.hp === 1 && this.maxhp > 45) return 1;

		if (this.maxhp === 48) {
			// Draw the health bar to the middle of the range.
			// This affects the width of the visual health bar *only*; it
			// does not affect the ranges displayed in any way.
			let range = Pokemon.getPixelRange(this.hp, this.hpcolor);
			let ratio = (range[0] + range[1]) / 2;
			return Math.round(maxWidth * ratio) || 1;
		}
		let percentage = Math.ceil(100 * this.hp / this.maxhp);
		if ((percentage === 100) && (this.hp < this.maxhp)) {
			percentage = 99;
		}
		return percentage * maxWidth / 100;
	}
	getHPText(precision = 1) {
		return Pokemon.getHPText(this, this.side.battle.reportExactHP, precision);
	}
	static getHPText(pokemon: PokemonHealth, exactHP: boolean, precision = 1) {
		if (exactHP) return pokemon.hp + '/' + pokemon.maxhp;
		if (pokemon.maxhp === 100) return pokemon.hp + '%';
		if (pokemon.maxhp !== 48) return (100 * pokemon.hp / pokemon.maxhp).toFixed(precision) + '%';
		let range = Pokemon.getPixelRange(pokemon.hp, pokemon.hpcolor);
		return Pokemon.getFormattedRange(range, precision, '–');
	}
	destroy() {
		if (this.sprite) this.sprite.destroy();
		this.sprite = null!;
		this.side = null!;
	}
}

export class Side {
	battle: Battle;
	name = '';
	id = '';
	sideid: SideID;
	n: number;
	isFar: boolean;
	foe: Side = null!;
	ally: Side | null = null;
	avatar: string = 'unknown';
	badges: string[] = [];
	rating: string = '';
	totalPokemon = 6;
	x = 0;
	y = 0;
	z = 0;
	missedPokemon: Pokemon = null!;

	wisher: Pokemon | null = null;

	active = [null] as (Pokemon | null)[];
	lastPokemon = null as Pokemon | null;
	pokemon = [] as Pokemon[];

	/** [effectName, levels, minDuration, maxDuration] */
	sideConditions: {[id: string]: [string, number, number, number]} = {};
	faintCounter = 0;

	constructor(battle: Battle, n: number) {
		this.battle = battle;
		this.n = n;
		this.sideid = ['p1', 'p2', 'p3', 'p4'][n] as SideID;
		this.isFar = !!(n % 2);
	}

	rollTrainerSprites() {
		let sprites = ['lucas', 'dawn', 'ethan', 'lyra', 'hilbert', 'hilda'];
		this.avatar = sprites[Math.floor(Math.random() * sprites.length)];
	}

	behindx(offset: number) {
		return this.x + (!this.isFar ? -1 : 1) * offset;
	}
	behindy(offset: number) {
		return this.y + (!this.isFar ? 1 : -1) * offset;
	}
	leftof(offset: number) {
		return (!this.isFar ? -1 : 1) * offset;
	}
	behind(offset: number) {
		return this.z + (!this.isFar ? -1 : 1) * offset;
	}

	clearPokemon() {
		for (const pokemon of this.pokemon) pokemon.destroy();
		this.pokemon = [];
		for (let i = 0; i < this.active.length; i++) this.active[i] = null;
		this.lastPokemon = null;
	}
	reset() {
		this.clearPokemon();
		this.sideConditions = {};
		this.faintCounter = 0;
	}
	setAvatar(avatar: string) {
		this.avatar = avatar;
	}
	setName(name: string, avatar?: string) {
		if (name) this.name = name;
		this.id = toID(this.name);
		if (avatar) {
			this.setAvatar(avatar);
		} else {
			this.rollTrainerSprites();
			if (this.foe && this.avatar === this.foe.avatar) this.rollTrainerSprites();
		}
	}
	addSideCondition(effect: Effect, persist: boolean) {
		let condition = effect.id;
		if (this.sideConditions[condition]) {
			if (condition === 'spikes' || condition === 'toxicspikes') {
				this.sideConditions[condition][1]++;
			}
			this.battle.scene.addSideCondition(this.n, condition);
			return;
		}
		// Side conditions work as: [effectName, levels, minDuration, maxDuration]
		switch (condition) {
		case 'auroraveil':
			this.sideConditions[condition] = [effect.name, 1, 5, 8];
			break;
		case 'reflect':
			this.sideConditions[condition] = [effect.name, 1, 5, this.battle.gen >= 4 ? 8 : 0];
			break;
		case 'safeguard':
			this.sideConditions[condition] = [effect.name, 1, persist ? 7 : 5, 0];
			break;
		case 'lightscreen':
			this.sideConditions[condition] = [effect.name, 1, 5, this.battle.gen >= 4 ? 8 : 0];
			break;
		case 'mist':
			this.sideConditions[condition] = [effect.name, 1, 5, 0];
			break;
		case 'tailwind':
			this.sideConditions[condition] = [effect.name, 1, this.battle.gen >= 5 ? persist ? 6 : 4 : persist ? 5 : 3, 0];
			break;
		case 'luckychant':
			this.sideConditions[condition] = [effect.name, 1, 5, 0];
			break;
		case 'stealthrock':
		case 'spikes':
		case 'toxicspikes':
		case 'stickyweb':
			this.sideConditions[condition] = [effect.name, 1, 0, 0];
			break;
		case 'gmaxwildfire':
		case 'gmaxvolcalith':
		case 'gmaxvinelash':
		case 'gmaxcannonade':
			this.sideConditions[condition] = [effect.name, 1, 4, 0];
			break;
		case 'grasspledge':
			this.sideConditions[condition] = ['Swamp', 1, 4, 0];
			break;
		case 'waterpledge':
			this.sideConditions[condition] = ['Rainbow', 1, 4, 0];
			break;
		case 'firepledge':
			this.sideConditions[condition] = ['Sea of Fire', 1, 4, 0];
			break;
		default:
			this.sideConditions[condition] = [effect.name, 1, 0, 0];
			break;
		}
		this.battle.scene.addSideCondition(this.n, condition);
	}
	removeSideCondition(condition: string) {
		const id = toID(condition);
		if (!this.sideConditions[id]) return;
		delete this.sideConditions[id];
		this.battle.scene.removeSideCondition(this.n, id);
	}
	addPokemon(name: string, ident: string, details: string, replaceSlot = -1) {
		const oldPokemon = replaceSlot >= 0 ? this.pokemon[replaceSlot] : undefined;

		const data = this.battle.parseDetails(name, ident, details);
		const poke = new Pokemon(data, this);
		if (oldPokemon) {
			poke.item = oldPokemon.item;
			poke.baseAbility = oldPokemon.baseAbility;
			poke.teraType = oldPokemon.teraType;
		}

		if (!poke.ability && poke.baseAbility) poke.ability = poke.baseAbility;
		poke.reset();
		if (oldPokemon?.moveTrack.length) poke.moveTrack = oldPokemon.moveTrack;

		if (replaceSlot >= 0) {
			this.pokemon[replaceSlot] = poke;
		} else {
			this.pokemon.push(poke);
		}
		if (this.pokemon.length > this.totalPokemon || this.battle.speciesClause) {
			// check for Illusion
			let existingTable: {[searchid: string]: number} = {};
			let toRemove = -1;
			for (let poke1i = 0; poke1i < this.pokemon.length; poke1i++) {
				let poke1 = this.pokemon[poke1i];
				if (!poke1.searchid) continue;
				if (poke1.searchid in existingTable) {
					let poke2i = existingTable[poke1.searchid];
					let poke2 = this.pokemon[poke2i];
					if (poke === poke1) {
						toRemove = poke2i;
					} else if (poke === poke2) {
						toRemove = poke1i;
					} else if (this.active.indexOf(poke1) >= 0) {
						toRemove = poke2i;
					} else if (this.active.indexOf(poke2) >= 0) {
						toRemove = poke1i;
					} else if (poke1.fainted && !poke2.fainted) {
						toRemove = poke2i;
					} else {
						toRemove = poke1i;
					}
					break;
				}
				existingTable[poke1.searchid] = poke1i;
			}
			if (toRemove >= 0) {
				if (this.pokemon[toRemove].fainted) {
					// A fainted Pokemon was actually a Zoroark
					let illusionFound = null;
					for (const curPoke of this.pokemon) {
						if (curPoke === poke) continue;
						if (curPoke.fainted) continue;
						if (this.active.indexOf(curPoke) >= 0) continue;
						if (curPoke.speciesForme === 'Zoroark' || curPoke.speciesForme === 'Zorua' || curPoke.ability === 'Illusion') {
							illusionFound = curPoke;
							break;
						}
					}
					if (!illusionFound) {
						// This is Hackmons; we'll just guess a random unfainted Pokemon.
						// This will keep the fainted Pokemon count correct, and will
						// eventually become correct as incorrect guesses are switched in
						// and reguessed.
						for (const curPoke of this.pokemon) {
							if (curPoke === poke) continue;
							if (curPoke.fainted) continue;
							if (this.active.indexOf(curPoke) >= 0) continue;
							illusionFound = curPoke;
							break;
						}
					}
					if (illusionFound) {
						illusionFound.fainted = true;
						illusionFound.hp = 0;
						illusionFound.status = '';
					}
				}
				this.pokemon.splice(toRemove, 1);
			}
		}
		this.battle.scene.updateSidebar(this);

		return poke;
	}

	switchIn(pokemon: Pokemon, kwArgs: KWArgs, slot = pokemon.slot) {
		this.active[slot] = pokemon;
		pokemon.slot = slot;
		pokemon.clearVolatile();
		pokemon.lastMove = '';
		this.battle.lastMove = 'switch-in';
		const effect = Dex.getEffect(kwArgs.from);
		if (['batonpass', 'zbatonpass', 'shedtail'].includes(effect.id)) {
			pokemon.copyVolatileFrom(this.lastPokemon!, effect.id === 'shedtail' ? 'shedtail' : false);
		}

		this.battle.scene.animSummon(pokemon, slot);
	}
	dragIn(pokemon: Pokemon, slot = pokemon.slot) {
		let oldpokemon = this.active[slot];
		if (oldpokemon === pokemon) return;
		this.lastPokemon = oldpokemon;
		if (oldpokemon) {
			this.battle.scene.animDragOut(oldpokemon);
			oldpokemon.clearVolatile();
		}
		pokemon.clearVolatile();
		pokemon.lastMove = '';
		this.battle.lastMove = 'switch-in';
		this.active[slot] = pokemon;
		pokemon.slot = slot;

		this.battle.scene.animDragIn(pokemon, slot);
	}
	replace(pokemon: Pokemon, slot = pokemon.slot) {
		let oldpokemon = this.active[slot];
		if (pokemon === oldpokemon) return;
		this.lastPokemon = oldpokemon;
		pokemon.clearVolatile();
		if (oldpokemon) {
			pokemon.lastMove = oldpokemon.lastMove;
			pokemon.hp = oldpokemon.hp;
			pokemon.maxhp = oldpokemon.maxhp;
			pokemon.hpcolor = oldpokemon.hpcolor;
			pokemon.status = oldpokemon.status;
			pokemon.copyVolatileFrom(oldpokemon, true);
			pokemon.statusData = {...oldpokemon.statusData};
			if (oldpokemon.terastallized) {
				pokemon.terastallized = oldpokemon.terastallized;
				pokemon.teraType = oldpokemon.terastallized;
				oldpokemon.terastallized = '';
				oldpokemon.teraType = '';
			}
			// we don't know anything about the illusioned pokemon except that it's not fainted
			// technically we also know its status but only at the end of the turn, not here
			oldpokemon.fainted = false;
			oldpokemon.hp = oldpokemon.maxhp;
			oldpokemon.status = '???';
		}
		this.active[slot] = pokemon;
		pokemon.slot = slot;

		if (oldpokemon) {
			this.battle.scene.animUnsummon(oldpokemon, true);
		}
		this.battle.scene.animSummon(pokemon, slot, true);
	}
	switchOut(pokemon: Pokemon, kwArgs: KWArgs, slot = pokemon.slot) {
		const effect = Dex.getEffect(kwArgs.from);
		if (!['batonpass', 'zbatonpass', 'shedtail'].includes(effect.id)) {
			pokemon.clearVolatile();
		} else {
			pokemon.removeVolatile('transform' as ID);
			pokemon.removeVolatile('formechange' as ID);
		}
		if (!['batonpass', 'zbatonpass', 'shedtail', 'teleport'].includes(effect.id)) {
			this.battle.log(['switchout', pokemon.ident], {from: effect.id});
		}
		pokemon.statusData.toxicTurns = 0;
		if (this.battle.gen === 5) pokemon.statusData.sleepTurns = 0;
		this.lastPokemon = pokemon;
		this.active[slot] = null;

		this.battle.scene.animUnsummon(pokemon);
	}
	swapTo(pokemon: Pokemon, slot: number) {
		if (pokemon.slot === slot) return;
		let target = this.active[slot];

		let oslot = pokemon.slot;

		pokemon.slot = slot;
		if (target) target.slot = oslot;

		this.active[slot] = pokemon;
		this.active[oslot] = target;

		this.battle.scene.animUnsummon(pokemon, true);
		if (target) this.battle.scene.animUnsummon(target, true);

		this.battle.scene.animSummon(pokemon, slot, true);
		if (target) this.battle.scene.animSummon(target, oslot, true);
	}
	swapWith(pokemon: Pokemon, target: Pokemon, kwArgs: KWArgs) {
		// method provided for backwards compatibility only
		if (pokemon === target) return;

		let oslot = pokemon.slot;
		let nslot = target.slot;

		pokemon.slot = nslot;
		target.slot = oslot;
		this.active[nslot] = pokemon;
		this.active[oslot] = target;

		this.battle.scene.animUnsummon(pokemon, true);
		this.battle.scene.animUnsummon(target, true);

		this.battle.scene.animSummon(pokemon, nslot, true);
		this.battle.scene.animSummon(target, oslot, true);
	}
	faint(pokemon: Pokemon, slot = pokemon.slot) {
		pokemon.clearVolatile();
		this.lastPokemon = pokemon;
		this.active[slot] = null;

		pokemon.fainted = true;
		pokemon.hp = 0;
		pokemon.terastallized = '';
		pokemon.details = pokemon.details.replace(/, tera:[a-z]+/i, '');
		pokemon.searchid = pokemon.searchid.replace(/, tera:[a-z]+/i, '');
		if (pokemon.side.faintCounter < 100) pokemon.side.faintCounter++;

		this.battle.scene.animFaint(pokemon);
	}
	destroy() {
		this.clearPokemon();
		this.battle = null!;
		this.foe = null!;
	}
}

export interface PokemonDetails {
	details: string;
	name: string;
	speciesForme: string;
	level: number;
	shiny: boolean;
	gender: GenderName | '';
	ident: string;
	terastallized: string;
	searchid: string;
}
export interface PokemonHealth {
	hp: number;
	maxhp: number;
	hpcolor: HPColor | '';
	status: StatusName | 'tox' | '' | '???';
	fainted?: boolean;
}
export interface ServerPokemon extends PokemonDetails, PokemonHealth {
	ident: string;
	details: string;
	condition: string;
	active: boolean;
	/** unboosted stats */
	stats: {
		atk: number,
		def: number,
		spa: number,
		spd: number,
		spe: number,
	};
	/** currently an ID, will revise to name */
	moves: string[];
	/** currently an ID, will revise to name */
	baseAbility: string;
	/** currently an ID, will revise to name */
	ability?: string;
	/** currently an ID, will revise to name */
	item: string;
	/** currently an ID, will revise to name */
	pokeball: string;
	/** false if the pokemon cannot gigantamax, otherwise a string containing the full name of its G-max move */
	gigantamax: string | false;
	/** always the Tera Type of the Pokemon, regardless of whether it is terastallized or not */
	teraType: string;
	/** falsy if the pokemon is not terastallized, otherwise it is the Tera Type of the Pokemon */
	terastallized: string;
}

export class Battle {
	scene: BattleSceneStub;

	viewpointSwitched = false;

	stepQueue: string[];
	/** See battle.instantAdd */
	preemptStepQueue: string[] = [];
	waitForAnimations: true | false | 'simult' = true;
	/** the index of `stepQueue` currently being animated */
	currentStep = 0;
	/** null = not seeking, 0 = seek start, Infinity = seek end, otherwise: seek turn number */
	seeking: number | null = null;

	activeMoveIsSpread: string | null = null;

	subscription: ((state:
		'playing' | 'paused' | 'turn' | 'atqueueend' | 'callback' | 'ended' | 'error'
	) => void) | null;

	mute = false;
	messageFadeTime = Dex.prefs('blitzanims') === true ? 40 : 300;
	messageShownTime = 1;
	/** for tracking when to accelerate animations in long battles full of double switches */
	turnsSinceMoved = 0;

	/**
	 * * `-1` = non-battle RoomGames, or hasn't hit Team Preview or `|start`
	 * * `0` = after Team Preview or `|start` but before `|turn|1`
	 */
	turn = -1;
	/**
	 * Are we at the end of the queue and waiting for more input?
	 *
	 * In addition to at the end of a battle, this is also true if you're
	 * playing/watching a battle live, and waiting for a player to make a move.
	 */
	atQueueEnd = false;
	/**
	 * Has the battle ever been played or fast-forwarded?
	 *
	 * This is not exactly `turn > 0` because if you start playing a replay,
	 * then pause before turn 1, `turn` will still be 0, but playback should
	 * be considered started (for the purposes of displaying "Play" vs "Resume")
	 */
	started = false;
	/**
	 * Has playback gotten to the point where a player has won or tied?
	 * (Affects whether BGM is playing)
	 */
	ended = false;
	isReplay = false;
	usesUpkeep = false;
	weather = '' as ID;
	pseudoWeather = [] as WeatherState[];
	weatherTimeLeft = 0;
	weatherMinTimeLeft = 0;
	/**
	 * The side from which perspective we're viewing. Should be identical to
	 * `nearSide` except in multi battles, where `nearSide` is always the first
	 * near side, and `mySide` is the active player.
	 */
	mySide: Side = null!;
	nearSide: Side = null!;
	farSide: Side = null!;
	p1: Side = null!;
	p2: Side = null!;
	p3?: Side = null!;
	p4?: Side = null!;
	pokemonControlled = 0;
	sides: Side[] = null!;
	myPokemon: ServerPokemon[] | null = null;
	myAllyPokemon: ServerPokemon[] | null = null;
	lastMove = '';

	gen = 8;
	dex: ModdedDex = Dex;
	teamPreviewCount = 0;
	speciesClause = false;
	tier = '';
	gameType: 'singles' | 'doubles' | 'triples' | 'multi' | 'freeforall' = 'singles';
	compatMode = true;
	rated: string | boolean = false;
	rules: {[ruleName: string]: 1 | 0} = {};
	isBlitz = false;
	reportExactHP = false;
	endLastTurnPending = false;
	totalTimeLeft = 0;
	graceTimeLeft = 0;
	/**
	 * true: timer on, state unknown
	 * false: timer off
	 * number: seconds left this turn
	 */
	kickingInactive: number | boolean = false;

	// options
	id = '';
	/** used to forward some information to the room in the old client */
	roomid = '';
	hardcoreMode = false;
	ignoreNicks = !!Dex.prefs('ignorenicks');
	ignoreOpponent = !!Dex.prefs('ignoreopp');
	ignoreSpects = !!Dex.prefs('ignorespects');
	debug: boolean;
	joinButtons = false;
	autoresize: boolean;

	/**
	 * The actual pause state. Will only be true if playback is actually
	 * paused, not just waiting for the opponent to make a move.
	 */
	paused: boolean;

	constructor(options: {
		$frame?: JQuery<HTMLElement>,
		$logFrame?: JQuery<HTMLElement>,
		id?: ID,
		log?: string[] | string,
		paused?: boolean,
		isReplay?: boolean,
		debug?: boolean,
		subscription?: Battle['subscription'],
		/** autoresize `$frame` for browsers below 640px width (mobile) */
		autoresize?: boolean,
	} = {}) {
		this.id = options.id || '';

		if (options.$frame && options.$logFrame) {
			this.scene = new BattleScene(this, options.$frame, options.$logFrame);
		} else if (!options.$frame && !options.$logFrame) {
			this.scene = new BattleSceneStub();
		} else {
			throw new Error(`You must specify $frame and $logFrame simultaneously`);
		}

		this.paused = !!options.paused;
		this.started = !this.paused;
		this.debug = !!options.debug;
		if (typeof options.log === 'string') options.log = options.log.split('\n');
		this.stepQueue = options.log || [];
		this.subscription = options.subscription || null;
		this.autoresize = !!options.autoresize;

		this.p1 = new Side(this, 0);
		this.p2 = new Side(this, 1);
		this.sides = [this.p1, this.p2];
		this.p2.foe = this.p1;
		this.p1.foe = this.p2;
		this.nearSide = this.mySide = this.p1;
		this.farSide = this.p2;

		this.resetStep();
		if (this.autoresize) {
			window.addEventListener('resize', this.onResize);
			this.onResize();
		}
	}

	onResize = () => {
		const width = $(window).width()!;
		if (width < 950 || this.hardcoreMode) {
			this.messageShownTime = 500;
		} else {
			this.messageShownTime = 1;
		}
		if (width && width < 640) {
			const scale = (width / 640);
			this.scene.$frame?.css('transform', 'scale(' + scale + ')');
			this.scene.$frame?.css('transform-origin', 'top left');
			this.scene.$frame?.css('margin-bottom', '' + (360 * scale - 360) + 'px');
			// this.$foeHint.css('transform', 'scale(' + scale + ')');
		} else {
			this.scene.$frame?.css('transform', 'none');
			// this.$foeHint.css('transform', 'none');
			this.scene.$frame?.css('margin-bottom', '0');
		}
	};

	subscribe(listener: Battle['subscription']) {
		this.subscription = listener;
	}

	removePseudoWeather(weather: string) {
		for (let i = 0; i < this.pseudoWeather.length; i++) {
			if (this.pseudoWeather[i][0] === weather) {
				this.pseudoWeather.splice(i, 1);
				this.scene.updateWeather();
				return;
			}
		}
	}
	addPseudoWeather(weather: string, minTimeLeft: number, timeLeft: number) {
		this.pseudoWeather.push([weather, minTimeLeft, timeLeft]);
		this.scene.updateWeather();
	}
	hasPseudoWeather(weather: string) {
		for (const [pseudoWeatherName] of this.pseudoWeather) {
			if (weather === pseudoWeatherName) {
				return true;
			}
		}
		return false;
	}
	getAllActive() {
		const pokemonList = [];
		// Sides 3 and 4 are synced with sides 1 and 2, so they don't need to be checked
		for (let i = 0; i < 2; i++) {
			const side = this.sides[i];
			for (const active of side.active) {
				if (active && !active.fainted) {
					pokemonList.push(active);
				}
			}
		}
		return pokemonList;
	}
	// Used in Pokemon#effectiveAbility over abilityActive to prevent infinite recursion
	ngasActive() {
		for (const active of this.getAllActive()) {
			if (active.ability === 'Neutralizing Gas' && !active.volatiles['gastroacid']) {
				return true;
			}
		}
		return false;
	}
	abilityActive(abilities: string | string[]) {
		if (typeof abilities === 'string') abilities = [abilities];
		abilities = abilities.map(toID);
		for (const active of this.getAllActive()) {
			if (abilities.includes(toID(active.effectiveAbility()))) {
				return true;
			}
		}
		return false;
	}
	reset() {
		this.paused = true;
		this.scene.pause();
		this.resetStep();
		this.subscription?.('paused');
	}
	resetStep() {
		// battle state
		this.turn = -1;
		this.started = !this.paused;
		this.ended = false;
		this.atQueueEnd = false;
		this.weather = '' as ID;
		this.weatherTimeLeft = 0;
		this.weatherMinTimeLeft = 0;
		this.pseudoWeather = [];
		this.lastMove = '';

		for (const side of this.sides) {
			if (side) side.reset();
		}
		this.myPokemon = null;
		this.myAllyPokemon = null;

		// DOM state
		this.scene.reset();

		// activity queue state
		this.activeMoveIsSpread = null;
		this.currentStep = 0;
		this.resetTurnsSinceMoved();
		this.nextStep();
	}
	destroy() {
		if (this.autoresize) {
			window.removeEventListener('resize', this.onResize);
		}
		this.scene.destroy();

		for (let i = 0; i < this.sides.length; i++) {
			if (this.sides[i]) this.sides[i].destroy();
			this.sides[i] = null!;
		}
		this.mySide = null!;
		this.nearSide = null!;
		this.farSide = null!;
		this.p1 = null!;
		this.p2 = null!;
		this.p3 = null!;
		this.p4 = null!;
	}

	log(args: Args, kwArgs?: KWArgs, preempt?: boolean) {
		this.scene.log.add(args, kwArgs, preempt);
	}

	resetToCurrentTurn() {
		this.seekTurn(this.ended ? Infinity : this.turn, true);
	}
	switchViewpoint() {
		this.setViewpoint(this.viewpointSwitched ? 'p1' : 'p2');
	}
	setViewpoint(sideid: SideID) {
		if (this.mySide.sideid === sideid) return;
		if (sideid.length !== 2 || !sideid.startsWith('p')) return;
		const side = this[sideid];
		if (!side) return;
		this.mySide = side;

		if ((side.n % 2) === this.p1.n) {
			this.viewpointSwitched = false;
			this.nearSide = this.p1;
			this.farSide = this.p2;
		} else {
			this.viewpointSwitched = true;
			this.nearSide = this.p2;
			this.farSide = this.p1;
		}
		this.nearSide.isFar = false;
		this.farSide.isFar = true;
		if (this.sides.length > 2) {
			this.sides[this.nearSide.n + 2].isFar = false;
			this.sides[this.farSide.n + 2].isFar = true;
		}

		this.resetToCurrentTurn();
	}

	//
	// activities
	//
	start() {
		this.log(['start']);
		this.resetTurnsSinceMoved();
	}
	winner(winner?: string) {
		this.log(['win', winner || '']);
		this.ended = true;
		this.subscription?.('ended');
	}
	prematureEnd() {
		this.log(['message', 'This replay ends here.']);
		this.ended = true;
		this.subscription?.('ended');
	}
	endLastTurn() {
		if (this.endLastTurnPending) {
			this.endLastTurnPending = false;
			this.scene.updateStatbars();
		}
	}
	setHardcoreMode(mode: boolean) {
		this.hardcoreMode = mode;
		this.scene.updateSidebars();
		this.scene.updateWeather(true);
	}
	setTurn(turnNum: number) {
		if (turnNum === this.turn + 1) {
			this.endLastTurnPending = true;
		}
		if (this.turn && !this.usesUpkeep) this.updateTurnCounters(); // for compatibility with old replays
		this.turn = turnNum;
		this.started = true;

		if (this.seeking === null) this.turnsSinceMoved++;

		this.scene.incrementTurn();

		if (this.seeking !== null) {
			if (turnNum >= this.seeking) {
				this.stopSeeking();
			}
		} else {
			this.subscription?.('turn');
		}
	}
	resetTurnsSinceMoved() {
		this.turnsSinceMoved = 0;
		this.scene.updateAcceleration();
	}
	changeWeather(weatherName: string, poke?: Pokemon, isUpkeep?: boolean, ability?: Effect) {
		let weather = toID(weatherName);
		if (!weather || weather === 'none') {
			weather = '' as ID;
		}
		if (isUpkeep) {
			if (this.weather && this.weatherTimeLeft) {
				this.weatherTimeLeft--;
				if (this.weatherMinTimeLeft !== 0) this.weatherMinTimeLeft--;
			}
			if (this.seeking === null) {
				this.scene.upkeepWeather();
			}
			return;
		}
		if (weather) {
			let isExtremeWeather = (weather === 'deltastream' || weather === 'desolateland' || weather === 'primordialsea');
			if (poke) {
				if (ability) {
					this.activateAbility(poke, ability.name);
				}
				this.weatherTimeLeft = (this.gen <= 5 || isExtremeWeather) ? 0 : 8;
				this.weatherMinTimeLeft = (this.gen <= 5 || isExtremeWeather) ? 0 : 5;
			} else if (isExtremeWeather) {
				this.weatherTimeLeft = 0;
				this.weatherMinTimeLeft = 0;
			} else {
				this.weatherTimeLeft = (this.gen <= 3 ? 5 : 8);
				this.weatherMinTimeLeft = (this.gen <= 3 ? 0 : 5);
			}
		}
		this.weather = weather;
		this.scene.updateWeather();
	}
	swapSideConditions() {
		const sideConditions = [
			'mist', 'lightscreen', 'reflect', 'spikes', 'safeguard', 'tailwind', 'toxicspikes', 'stealthrock', 'waterpledge', 'firepledge', 'grasspledge', 'stickyweb', 'auroraveil', 'gmaxsteelsurge', 'gmaxcannonade', 'gmaxvinelash', 'gmaxwildfire',
		];
		if (this.gameType === 'freeforall') {
			// TODO: Add FFA support
			return;
		} else {
			let side1 = this.sides[0];
			let side2 = this.sides[1];
			for (const id of sideConditions) {
				if (side1.sideConditions[id] && side2.sideConditions[id]) {
					[side1.sideConditions[id], side2.sideConditions[id]] = [
						side2.sideConditions[id], side1.sideConditions[id],
					];
					this.scene.addSideCondition(side1.n, id as ID);
					this.scene.addSideCondition(side2.n, id as ID);
				} else if (side1.sideConditions[id] && !side2.sideConditions[id]) {
					side2.sideConditions[id] = side1.sideConditions[id];
					this.scene.addSideCondition(side2.n, id as ID);
					side1.removeSideCondition(id);
				} else if (side2.sideConditions[id] && !side1.sideConditions[id]) {
					side1.sideConditions[id] = side2.sideConditions[id];
					this.scene.addSideCondition(side1.n, id as ID);
					side2.removeSideCondition(id);
				}
			}
		}
	}
	updateTurnCounters() {
		for (const pWeather of this.pseudoWeather) {
			if (pWeather[1]) pWeather[1]--;
			if (pWeather[2]) pWeather[2]--;
		}
		for (const side of this.sides) {
			for (const id in side.sideConditions) {
				let cond = side.sideConditions[id];
				if (cond[2]) cond[2]--;
				if (cond[3]) cond[3]--;
			}
		}
		for (const poke of [...this.nearSide.active, ...this.farSide.active]) {
			if (poke) {
				if (poke.status === 'tox') poke.statusData.toxicTurns++;
				poke.clearTurnstatuses();
			}
		}
		this.scene.updateWeather();
	}
	useMove(pokemon: Pokemon, move: Move, target: Pokemon | null, kwArgs: KWArgs) {
		let fromeffect = Dex.getEffect(kwArgs.from);
		this.activateAbility(pokemon, fromeffect);
		pokemon.clearMovestatuses();
		if (move.id === 'focuspunch') {
			pokemon.removeTurnstatus('focuspunch' as ID);
		}
		this.scene.updateStatbar(pokemon);
		if (fromeffect.id === 'sleeptalk') {
			pokemon.rememberMove(move.name, 0);
		}
		let callerMoveForPressure = null;
		// will not include effects that are conditions named after moves like Magic Coat and Snatch, which is good
		if (fromeffect.id && kwArgs.from.startsWith("move:")) {
			callerMoveForPressure = fromeffect as Move;
		}
		if (!fromeffect.id || callerMoveForPressure || fromeffect.id === 'pursuit') {
			let moveName = move.name;
			if (!callerMoveForPressure) {
				if (move.isZ) {
					pokemon.item = move.isZ;
					let item = Dex.items.get(move.isZ);
					if (item.zMoveFrom) moveName = item.zMoveFrom;
				} else if (move.name.slice(0, 2) === 'Z-') {
					moveName = moveName.slice(2);
					move = Dex.moves.get(moveName);
					if (window.BattleItems) {
						for (let item in BattleItems) {
							if (BattleItems[item].zMoveType === move.type) pokemon.item = item;
						}
					}
				}
			}
			let pp = 1;
			if (this.abilityActive('Pressure') && move.id !== 'stickyweb') {
				const foeTargets = [];
				const moveTarget = move.pressureTarget;

				if (
					!target && this.gameType === 'singles' &&
					!['self', 'allies', 'allySide', 'adjacentAlly', 'adjacentAllyOrSelf', 'allyTeam'].includes(moveTarget)
				) {
					// Hardcode for moves without a target in singles
					foeTargets.push(pokemon.side.foe.active[0]);
				} else if (['all', 'allAdjacent', 'allAdjacentFoes', 'foeSide'].includes(moveTarget)) {
					for (const active of this.getAllActive()) {
						if (active === pokemon) continue;
						// Pressure affects allies in gen 3 and 4
						if (this.gen <= 4 || (active.side !== pokemon.side && active.side.ally !== pokemon.side)) {
							foeTargets.push(active);
						}
					}
				} else if (target && target.side !== pokemon.side) {
					foeTargets.push(target);
				}

				for (const foe of foeTargets) {
					if (foe && !foe.fainted && foe.effectiveAbility() === 'Pressure') {
						pp += 1;
					}
				}
			}
			if (!callerMoveForPressure) {
				pokemon.rememberMove(moveName, pp);
			} else {
				pokemon.rememberMove(callerMoveForPressure.name, pp - 1); // 1 pp was already deducted from using the move itself
			}
		}
		pokemon.lastMove = move.id;
		this.lastMove = move.id;
		if (move.id === 'wish' || move.id === 'healingwish') {
			pokemon.side.wisher = pokemon;
		}
	}
	animateMove(pokemon: Pokemon, move: Move, target: Pokemon | null, kwArgs: KWArgs) {
		this.activeMoveIsSpread = kwArgs.spread;
		if (this.seeking !== null || kwArgs.still) return;

		if (!target) target = pokemon.side.foe.active[0];
		if (!target) target = pokemon.side.foe.missedPokemon;
		if (kwArgs.miss && target.side) {
			target = target.side.missedPokemon;
		}
		if (kwArgs.notarget) {
			return;
		}

		if (kwArgs.prepare || kwArgs.anim === 'prepare') {
			this.scene.runPrepareAnim(move.id, pokemon, target);
			return;
		}

		let usedMove = kwArgs.anim ? Dex.moves.get(kwArgs.anim) : move;
		if (!kwArgs.spread) {
			this.scene.runMoveAnim(usedMove.id, [pokemon, target]);
			return;
		}

		let targets = [pokemon];
		if (kwArgs.spread === '.') {
			//  no target was hit by the attack
			targets.push(target.side.missedPokemon);
		} else {
			for (const hitTarget of kwArgs.spread.split(',')) {
				const curTarget = this.getPokemon(hitTarget + ': ?');
				if (!curTarget) {
					this.log(['error', `Invalid spread move target: "${hitTarget}"`]);
					continue;
				}
				targets.push(curTarget);
			}
		}

		this.scene.runMoveAnim(usedMove.id, targets);
	}
	cantUseMove(pokemon: Pokemon, effect: Effect, move: Move, kwArgs: KWArgs) {
		pokemon.clearMovestatuses();
		this.scene.updateStatbar(pokemon);
		if (effect.id in BattleStatusAnims) {
			this.scene.runStatusAnim(effect.id, [pokemon]);
		}
		this.activateAbility(pokemon, effect);
		if (move.id) pokemon.rememberMove(move.name, 0);
		switch (effect.id) {
		case 'par':
			this.scene.resultAnim(pokemon, 'Paralyzed', 'par');
			break;
		case 'frz':
			this.scene.resultAnim(pokemon, 'Frozen', 'frz');
			break;
		case 'slp':
			this.scene.resultAnim(pokemon, 'Asleep', 'slp');
			pokemon.statusData.sleepTurns++;
			break;
		case 'truant':
			this.scene.resultAnim(pokemon, 'Loafing around', 'neutral');
			break;
		case 'recharge':
			this.scene.runOtherAnim('selfstatus' as ID, [pokemon]);
			this.scene.resultAnim(pokemon, 'Must recharge', 'neutral');
			break;
		case 'focuspunch':
			this.scene.resultAnim(pokemon, 'Lost focus', 'neutral');
			pokemon.removeTurnstatus('focuspunch' as ID);
			break;
		case 'shelltrap':
			this.scene.resultAnim(pokemon, 'Trap failed', 'neutral');
			pokemon.removeTurnstatus('shelltrap' as ID);
			break;
		case 'flinch':
			this.scene.resultAnim(pokemon, 'Flinched', 'neutral');
			pokemon.removeTurnstatus('focuspunch' as ID);
			break;
		case 'attract':
			this.scene.resultAnim(pokemon, 'Immobilized', 'neutral');
			break;
		}
		this.scene.animReset(pokemon);
	}

	activateAbility(pokemon: Pokemon | null, effectOrName: Effect | string, isNotBase?: boolean) {
		if (!pokemon || !effectOrName) return;
		if (typeof effectOrName !== 'string') {
			if (effectOrName.effectType !== 'Ability') return;
			effectOrName = effectOrName.name;
		}
		this.scene.abilityActivateAnim(pokemon, effectOrName);
		pokemon.rememberAbility(effectOrName, isNotBase);
	}

	runMinor(args: Args, kwArgs: KWArgs, nextArgs?: Args, nextKwargs?: KWArgs) {
		if (nextArgs && nextKwargs) {
			if (args[2] === 'Sturdy' && args[0] === '-activate') {
				args[2] = 'ability: Sturdy';
			}
			if (['-crit', '-supereffective', '-resisted'].includes(args[0]) || args[2] === 'ability: Sturdy') {
				kwArgs.then = '.';
			}
			if (args[0] === '-damage' && !kwArgs.from && args[1] !== nextArgs[1] && (
				['-crit', '-supereffective', '-resisted'].includes(nextArgs[0]) ||
				(nextArgs[0] === '-damage' && !nextKwargs.from)
			)) {
				kwArgs.then = '.';
			}
			if (args[0] === '-damage' && nextArgs[0] === '-damage' && kwArgs.from && kwArgs.from === nextKwargs.from) {
				kwArgs.then = '.';
			}
			if (args[0] === '-ability' && (args[2] === 'Intimidate' || args[3] === 'boost')) {
				kwArgs.then = '.';
			}
			if (args[0] === '-unboost' && nextArgs[0] === '-unboost') {
				kwArgs.then = '.';
			}
			if (args[0] === '-boost' && nextArgs[0] === '-boost') {
				kwArgs.then = '.';
			}
			if (args[0] === '-damage' && kwArgs.from === 'Leech Seed' && nextArgs[0] === '-heal' && nextKwargs.silent) {
				kwArgs.then = '.';
			}
			if (args[0] === 'detailschange' && nextArgs[0] === '-mega') {
				if (this.scene.closeMessagebar()) {
					this.currentStep--;
					return;
				}
				kwArgs.simult = '.';
			}
		}
		if (kwArgs.then) this.waitForAnimations = false;
		if (kwArgs.simult) this.waitForAnimations = 'simult';

		const CONSUMED = ['eaten', 'popped', 'consumed', 'held up'];
		switch (args[0]) {
		case '-damage': {
			let poke = this.getPokemon(args[1])!;
			let damage = poke.healthParse(args[2], true);
			if (damage === null) break;
			let range = poke.getDamageRange(damage);

			if (kwArgs.from) {
				let effect = Dex.getEffect(kwArgs.from);
				let ofpoke = this.getPokemon(kwArgs.of);
				this.activateAbility(ofpoke, effect);
				if (effect.effectType === 'Item') {
					const itemPoke = ofpoke || poke;
					if (itemPoke.prevItem !== effect.name && !CONSUMED.includes(itemPoke.prevItemEffect)) {
						itemPoke.item = effect.name;
					}
				}
				switch (effect.id) {
				case 'brn':
					this.scene.runStatusAnim('brn' as ID, [poke]);
					break;
				case 'psn':
					this.scene.runStatusAnim('psn' as ID, [poke]);
					break;
				case 'baddreams':
					this.scene.runStatusAnim('cursed' as ID, [poke]);
					break;
				case 'curse':
					this.scene.runStatusAnim('cursed' as ID, [poke]);
					break;
				case 'confusion':
					this.scene.runStatusAnim('confusedselfhit' as ID, [poke]);
					break;
				case 'leechseed':
					this.scene.runOtherAnim('leech' as ID, [ofpoke!, poke]);
					break;
				case 'bind':
				case 'wrap':
					this.scene.runOtherAnim('bound' as ID, [poke]);
					break;
				}
			} else {
				if (this.dex.moves.get(this.lastMove).category !== 'Status') {
					poke.timesAttacked++;
				}
				let damageinfo = '' + Pokemon.getFormattedRange(range, damage[1] === 100 ? 0 : 1, '\u2013');
				if (damage[1] !== 100) {
					let hover = '' + ((damage[0] < 0) ? '\u2212' : '') +
						Math.abs(damage[0]) + '/' + damage[1];
					if (damage[1] === 48) { // this is a hack
						hover += ' pixels';
					}
					// battle-log will convert this into <abbr>
					damageinfo = '||' + hover + '||' + damageinfo + '||';
				}
				args[3] = damageinfo;
			}
			this.scene.damageAnim(poke, Pokemon.getFormattedRange(range, 0, ' to '));
			this.log(args, kwArgs);
			break;
		}
		case '-heal': {
			let poke = this.getPokemon(args[1], Dex.getEffect(kwArgs.from).id === 'revivalblessing')!;
			let damage = poke.healthParse(args[2], true, true);
			if (damage === null) break;
			let range = poke.getDamageRange(damage);

			if (kwArgs.from) {
				let effect = Dex.getEffect(kwArgs.from);
				let ofpoke = this.getPokemon(kwArgs.of);
				this.activateAbility(ofpoke || poke, effect);
				if (effect.effectType === 'Item' && !CONSUMED.includes(poke.prevItemEffect)) {
					if (poke.prevItem !== effect.name) {
						poke.item = effect.name;
					}
				}
				switch (effect.id) {
				case 'lunardance':
					for (let trackedMove of poke.moveTrack) {
						trackedMove[1] = 0;
					}
					// falls through
				case 'healingwish':
					this.lastMove = 'healing-wish';
					this.scene.runResidualAnim('healingwish' as ID, poke);
					poke.side.wisher = null;
					poke.statusData.sleepTurns = 0;
					poke.statusData.toxicTurns = 0;
					break;
				case 'wish':
					this.scene.runResidualAnim('wish' as ID, poke);
					break;
				case 'revivalblessing':
					this.scene.runResidualAnim('wish' as ID, poke);
					const {siden} = this.parsePokemonId(args[1]);
					const side = this.sides[siden];
					poke.fainted = false;
					poke.status = '';
					this.scene.updateSidebar(side);
					break;
				}
			}
			this.scene.runOtherAnim('heal' as ID, [poke]);
			this.scene.healAnim(poke, Pokemon.getFormattedRange(range, 0, ' to '));
			this.log(args, kwArgs);
			break;
		}
		case '-sethp': {
			for (let k = 0; k < 2; k++) {
				let cpoke = this.getPokemon(args[1 + 2 * k]);
				if (cpoke) {
					let damage = cpoke.healthParse(args[2 + 2 * k])!;
					let range = cpoke.getDamageRange(damage);
					let formattedRange = Pokemon.getFormattedRange(range, 0, ' to ');
					let diff = damage[0];
					if (diff > 0) {
						this.scene.healAnim(cpoke, formattedRange);
					} else {
						this.scene.damageAnim(cpoke, formattedRange);
					}
				}
			}
			this.log(args, kwArgs);
			break;
		}
		case '-boost': {
			let poke = this.getPokemon(args[1])!;
			let stat = args[2] as BoostStatName;
			if (this.gen === 1 && stat === 'spd') break;
			if (this.gen === 1 && stat === 'spa') stat = 'spc';
			let amount = parseInt(args[3], 10);
			if (amount === 0) {
				this.scene.resultAnim(poke, 'already ' + poke.getBoost(stat), 'neutral');
				this.log(args, kwArgs);
				break;
			}
			if (!poke.boosts[stat]) {
				poke.boosts[stat] = 0;
			}
			poke.boosts[stat] += amount;

			if (!kwArgs.silent && kwArgs.from) {
				let effect = Dex.getEffect(kwArgs.from);
				let ofpoke = this.getPokemon(kwArgs.of);
				if (!(effect.id === 'weakarmor' && stat === 'spe')) {
					this.activateAbility(ofpoke || poke, effect);
				}
			}
			this.scene.resultAnim(poke, poke.getBoost(stat), 'good');
			this.log(args, kwArgs);
			break;
		}
		case '-unboost': {
			let poke = this.getPokemon(args[1])!;
			let stat = args[2] as BoostStatName;
			if (this.gen === 1 && stat === 'spd') break;
			if (this.gen === 1 && stat === 'spa') stat = 'spc';
			let amount = parseInt(args[3], 10);
			if (amount === 0) {
				this.scene.resultAnim(poke, 'already ' + poke.getBoost(stat), 'neutral');
				this.log(args, kwArgs);
				break;
			}
			if (!poke.boosts[stat]) {
				poke.boosts[stat] = 0;
			}
			poke.boosts[stat] -= amount;

			if (!kwArgs.silent && kwArgs.from) {
				let effect = Dex.getEffect(kwArgs.from);
				let ofpoke = this.getPokemon(kwArgs.of);
				this.activateAbility(ofpoke || poke, effect);
			}
			this.scene.resultAnim(poke, poke.getBoost(stat), 'bad');
			this.log(args, kwArgs);
			break;
		}
		case '-setboost': {
			let poke = this.getPokemon(args[1])!;
			let stat = args[2] as BoostStatName;
			let amount = parseInt(args[3], 10);
			poke.boosts[stat] = amount;
			this.scene.resultAnim(poke, poke.getBoost(stat), (amount > 0 ? 'good' : 'bad'));
			this.log(args, kwArgs);
			break;
		}
		case '-swapboost': {
			let poke = this.getPokemon(args[1])!;
			let poke2 = this.getPokemon(args[2])!;
			let stats = args[3] ? args[3].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
			for (const stat of stats) {
				let tmp = poke.boosts[stat];
				poke.boosts[stat] = poke2.boosts[stat];
				if (!poke.boosts[stat]) delete poke.boosts[stat];
				poke2.boosts[stat] = tmp;
				if (!poke2.boosts[stat]) delete poke2.boosts[stat];
			}
			this.scene.resultAnim(poke, 'Stats swapped', 'neutral');
			this.scene.resultAnim(poke2, 'Stats swapped', 'neutral');

			this.log(args, kwArgs);
			break;
		}
		case '-clearpositiveboost': {
			let poke = this.getPokemon(args[1])!;
			let ofpoke = this.getPokemon(args[2]);
			let effect = Dex.getEffect(args[3]);
			for (const stat in poke.boosts) {
				if (poke.boosts[stat] > 0) delete poke.boosts[stat];
			}
			this.scene.resultAnim(poke, 'Boosts lost', 'bad');

			if (effect.id) {
				switch (effect.id) {
				case 'spectralthief':
					// todo: update StealBoosts so it animates 1st on Spectral Thief
					this.scene.runOtherAnim('spectralthiefboost' as ID, [ofpoke!, poke]);
					break;
				}
			}
			this.log(args, kwArgs);
			break;
		}
		case '-clearnegativeboost': {
			let poke = this.getPokemon(args[1])!;
			for (const stat in poke.boosts) {
				if (poke.boosts[stat] < 0) delete poke.boosts[stat];
			}
			this.scene.resultAnim(poke, 'Restored', 'good');

			this.log(args, kwArgs);
			break;
		}
		case '-copyboost': {
			let poke = this.getPokemon(args[1])!;
			let frompoke = this.getPokemon(args[2])!;
			if (!kwArgs.silent && kwArgs.from) {
				let effect = Dex.getEffect(kwArgs.from);
				this.activateAbility(poke, effect);
			}
			let stats = args[3] ? args[3].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
			for (const stat of stats) {
				poke.boosts[stat] = frompoke.boosts[stat];
				if (!poke.boosts[stat]) delete poke.boosts[stat];
			}
			if (this.gen >= 6) {
				const volatilesToCopy = ['focusenergy', 'gmaxchistrike', 'laserfocus'];
				for (const volatile of volatilesToCopy) {
					if (frompoke.volatiles[volatile]) {
						poke.addVolatile(volatile as ID);
					} else {
						poke.removeVolatile(volatile as ID);
					}
				}
			}
			this.scene.resultAnim(poke, 'Stats copied', 'neutral');

			this.log(args, kwArgs);
			break;
		}
		case '-clearboost': {
			let poke = this.getPokemon(args[1])!;
			poke.boosts = {};
			if (!kwArgs.silent && kwArgs.from) {
				let effect = Dex.getEffect(kwArgs.from);
				let ofpoke = this.getPokemon(kwArgs.of);
				this.activateAbility(ofpoke || poke, effect);
			}
			this.scene.resultAnim(poke, 'Stats reset', 'neutral');

			this.log(args, kwArgs);
			break;
		}
		case '-invertboost': {
			let poke = this.getPokemon(args[1])!;
			for (const stat in poke.boosts) {
				poke.boosts[stat] = -poke.boosts[stat];
			}
			this.scene.resultAnim(poke, 'Stats inverted', 'neutral');

			this.log(args, kwArgs);
			break;
		}
		case '-clearallboost': {
			let timeOffset = this.scene.timeOffset;
			for (const active of this.getAllActive()) {
				active.boosts = {};
				this.scene.timeOffset = timeOffset;
				this.scene.resultAnim(active, 'Stats reset', 'neutral');
			}

			this.log(args, kwArgs);
			break;
		}
		case '-crit': {
			let poke = this.getPokemon(args[1]);
			if (poke) this.scene.resultAnim(poke, 'Critical hit', 'bad');
			if (this.activeMoveIsSpread) kwArgs.spread = '.';
			this.log(args, kwArgs);
			break;
		}
		case '-supereffective': {
			let poke = this.getPokemon(args[1]);
			if (poke) {
				this.scene.resultAnim(poke, 'Super-effective', 'bad');
				if (window.Config?.server?.afd) {
					this.scene.runOtherAnim('hitmark' as ID, [poke]);
				}
			}
			if (this.activeMoveIsSpread) kwArgs.spread = '.';
			this.log(args, kwArgs);
			break;
		}
		case '-resisted': {
			let poke = this.getPokemon(args[1]);
			if (poke) this.scene.resultAnim(poke, 'Resisted', 'neutral');
			if (this.activeMoveIsSpread) kwArgs.spread = '.';
			this.log(args, kwArgs);
			break;
		}
		case '-immune': {
			let poke = this.getPokemon(args[1])!;
			let fromeffect = Dex.getEffect(kwArgs.from);
			this.activateAbility(this.getPokemon(kwArgs.of) || poke, fromeffect);
			this.log(args, kwArgs);
			this.scene.resultAnim(poke, 'Immune', 'neutral');
			break;
		}
		case '-miss': {
			let target = this.getPokemon(args[2]);
			if (target) {
				this.scene.resultAnim(target, 'Missed', 'neutral');
			}
			this.log(args, kwArgs);
			break;
		}
		case '-fail': {
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(args[2]);
			let fromeffect = Dex.getEffect(kwArgs.from);
			let ofpoke = this.getPokemon(kwArgs.of);
			if (fromeffect.id === 'clearamulet') {
				ofpoke!.item = 'Clear Amulet';
			} else {
				this.activateAbility(ofpoke || poke, fromeffect);
			}
			switch (effect.id) {
			case 'brn':
				this.scene.resultAnim(poke, 'Already burned', 'neutral');
				break;
			case 'tox':
			case 'psn':
				this.scene.resultAnim(poke, 'Already poisoned', 'neutral');
				break;
			case 'slp':
				if (fromeffect.id === 'uproar') {
					this.scene.resultAnim(poke, 'Failed', 'neutral');
				} else {
					this.scene.resultAnim(poke, 'Already asleep', 'neutral');
				}
				break;
			case 'par':
				this.scene.resultAnim(poke, 'Already paralyzed', 'neutral');
				break;
			case 'frz':
				this.scene.resultAnim(poke, 'Already frozen', 'neutral');
				break;
			case 'unboost':
				this.scene.resultAnim(poke, 'Stat drop blocked', 'neutral');
				break;
			default:
				if (poke) {
					this.scene.resultAnim(poke, 'Failed', 'neutral');
				}
				break;
			}
			this.scene.animReset(poke);
			this.log(args, kwArgs);
			break;
		}
		case '-block': {
			let poke = this.getPokemon(args[1])!;
			let ofpoke = this.getPokemon(kwArgs.of);
			let effect = Dex.getEffect(args[2]);
			this.activateAbility(ofpoke || poke, effect);
			switch (effect.id) {
			case 'quickguard':
				poke.addTurnstatus('quickguard' as ID);
				this.scene.resultAnim(poke, 'Quick Guard', 'good');
				break;
			case 'wideguard':
				poke.addTurnstatus('wideguard' as ID);
				this.scene.resultAnim(poke, 'Wide Guard', 'good');
				break;
			case 'craftyshield':
				poke.addTurnstatus('craftyshield' as ID);
				this.scene.resultAnim(poke, 'Crafty Shield', 'good');
				break;
			case 'protect':
				poke.addTurnstatus('protect' as ID);
				this.scene.resultAnim(poke, 'Protected', 'good');
				break;

			case 'safetygoggles':
				poke.item = 'Safety Goggles';
				break;
			case 'protectivepads':
				poke.item = 'Protective Pads';
				break;
			case 'abilityshield':
				poke.item = 'Ability Shield';
				break;
			}
			this.log(args, kwArgs);
			break;
		}
		case '-center': case '-notarget': case '-ohko':
		case '-combine': case '-hitcount': case '-waiting': case '-zbroken': {
			this.log(args, kwArgs);
			break;
		}
		case '-zpower': {
			let poke = this.getPokemon(args[1])!;
			this.scene.runOtherAnim('zpower' as ID, [poke]);
			this.log(args, kwArgs);
			break;
		}
		case '-prepare': {
			let poke = this.getPokemon(args[1])!;
			let moveid = toID(args[2]);
			let target = this.getPokemon(args[3]) || poke.side.foe.active[0] || poke;
			this.scene.runPrepareAnim(moveid, poke, target);
			this.log(args, kwArgs);
			break;
		}
		case '-mustrecharge': {
			let poke = this.getPokemon(args[1])!;
			poke.addMovestatus('mustrecharge' as ID);
			this.scene.updateStatbar(poke);
			break;
		}
		case '-status': {
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(kwArgs.from);
			let ofpoke = this.getPokemon(kwArgs.of) || poke;
			poke.status = args[2] as StatusName;
			this.activateAbility(ofpoke || poke, effect);
			if (effect.effectType === 'Item') {
				ofpoke.item = effect.name;
			}

			switch (args[2]) {
			case 'brn':
				this.scene.resultAnim(poke, 'Burned', 'brn');
				this.scene.runStatusAnim('brn' as ID, [poke]);
				break;
			case 'tox':
				this.scene.resultAnim(poke, 'Toxic poison', 'psn');
				this.scene.runStatusAnim('psn' as ID, [poke]);
				poke.statusData.toxicTurns = (effect.name === "Toxic Orb" ? -1 : 0);
				break;
			case 'psn':
				this.scene.resultAnim(poke, 'Poisoned', 'psn');
				this.scene.runStatusAnim('psn' as ID, [poke]);
				break;
			case 'slp':
				this.scene.resultAnim(poke, 'Asleep', 'slp');
				if (effect.id === 'rest') {
					poke.statusData.sleepTurns = 0; // for Gen 2 use through Sleep Talk
				}
				break;
			case 'par':
				this.scene.resultAnim(poke, 'Paralyzed', 'par');
				this.scene.runStatusAnim('par' as ID, [poke]);
				break;
			case 'frz':
				this.scene.resultAnim(poke, 'Frozen', 'frz');
				this.scene.runStatusAnim('frz' as ID, [poke]);
				break;
			default:
				this.scene.updateStatbar(poke);
				break;
			}
			this.log(args, kwArgs);
			break;
		}
		case '-curestatus': {
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(kwArgs.from);

			if (effect.id) {
				switch (effect.id) {
				case 'flamewheel':
				case 'flareblitz':
				case 'fusionflare':
				case 'sacredfire':
				case 'scald':
				case 'steameruption':
					kwArgs.thaw = '.';
					break;
				}
			}
			if (poke) {
				poke.status = '';
				switch (args[2]) {
				case 'brn':
					this.scene.resultAnim(poke, 'Burn cured', 'good');
					break;
				case 'tox':
				case 'psn':
					poke.statusData.toxicTurns = 0;
					this.scene.resultAnim(poke, 'Poison cured', 'good');
					break;
				case 'slp':
					this.scene.resultAnim(poke, 'Woke up', 'good');
					poke.statusData.sleepTurns = 0;
					break;
				case 'par':
					this.scene.resultAnim(poke, 'Paralysis cured', 'good');
					break;
				case 'frz':
					this.scene.resultAnim(poke, 'Thawed', 'good');
					break;
				default:
					poke.removeVolatile('confusion' as ID);
					this.scene.resultAnim(poke, 'Cured', 'good');
				}
			}
			this.log(args, kwArgs);
			break;

		}
		case '-cureteam': { // For old gens when the whole team was always cured
			let poke = this.getPokemon(args[1])!;
			for (const target of poke.side.pokemon) {
				target.status = '';
				this.scene.updateStatbarIfExists(target);
			}

			this.scene.resultAnim(poke, 'Team Cured', 'good');
			this.log(args, kwArgs);
			break;
		}
		case '-item': {
			let poke = this.getPokemon(args[1])!;
			let item = Dex.items.get(args[2]);
			let effect = Dex.getEffect(kwArgs.from);
			let ofpoke = this.getPokemon(kwArgs.of);
			if (!poke) {
				if (effect.id === 'frisk') {
					const possibleTargets = ofpoke!.side.foe.active.filter(p => p !== null);
					if (possibleTargets.length === 1) {
						poke = possibleTargets[0]!;
					} else {
						this.activateAbility(ofpoke!, "Frisk");
						this.log(args, kwArgs);
						break;
					}
				} else {
					throw new Error('No Pokemon in -item message');
				}
			}
			poke.item = item.name;
			poke.itemEffect = '';
			poke.removeVolatile('airballoon' as ID);
			if (item.id === 'airballoon') poke.addVolatile('airballoon' as ID);

			if (effect.id) {
				switch (effect.id) {
				case 'pickup':
					this.activateAbility(poke, "Pickup");
					// falls through
				case 'recycle':
					poke.itemEffect = 'found';
					this.scene.resultAnim(poke, item.name, 'neutral');
					break;
				case 'frisk':
					this.activateAbility(ofpoke!, "Frisk");
					if (poke && poke !== ofpoke) { // used for gen 6
						poke.itemEffect = 'frisked';
						this.scene.resultAnim(poke, item.name, 'neutral');
					}
					break;
				case 'magician':
				case 'pickpocket':
					this.activateAbility(poke, effect.name);
					// falls through
				case 'thief':
				case 'covet':
					// simulate the removal of the item from the ofpoke
					ofpoke!.item = '';
					ofpoke!.itemEffect = '';
					ofpoke!.prevItem = item.name;
					ofpoke!.prevItemEffect = 'stolen';
					ofpoke!.addVolatile('itemremoved' as ID);
					poke.itemEffect = 'stolen';
					this.scene.resultAnim(poke, item.name, 'neutral');
					this.scene.resultAnim(ofpoke!, 'Item Stolen', 'bad');
					break;
				case 'harvest':
					poke.itemEffect = 'harvested';
					this.activateAbility(poke, "Harvest");
					this.scene.resultAnim(poke, item.name, 'neutral');
					break;
				case 'bestow':
					poke.itemEffect = 'bestowed';
					this.scene.resultAnim(poke, item.name, 'neutral');
					break;
				case 'switcheroo':
				case 'trick':
					poke.itemEffect = 'tricked';
					// falls through
				default:
					break;
				}
			} else {
				switch (item.id) {
				case 'airballoon':
					this.scene.resultAnim(poke, 'Balloon', 'good');
					break;
				}
			}
			this.log(args, kwArgs);
			break;
		}
		case '-enditem': {
			let poke = this.getPokemon(args[1])!;
			let item = Dex.items.get(args[2]);
			let effect = Dex.getEffect(kwArgs.from);
			if (this.gen > 4 || effect.id !== 'knockoff') {
				poke.item = '';
				poke.itemEffect = '';
				poke.prevItem = item.name;
				poke.prevItemEffect = '';
			}
			poke.removeVolatile('airballoon' as ID);
			poke.addVolatile('itemremoved' as ID);
			if (kwArgs.eat) {
				poke.prevItemEffect = 'eaten';
				this.scene.runOtherAnim('consume' as ID, [poke]);
				this.lastMove = item.id;
			} else if (kwArgs.weaken) {
				poke.prevItemEffect = 'eaten';
				this.lastMove = item.id;
			} else if (effect.id) {
				switch (effect.id) {
				case 'fling':
					poke.prevItemEffect = 'flung';
					break;
				case 'knockoff':
					if (this.gen <= 4) {
						poke.itemEffect = 'knocked off';
					} else {
						poke.prevItemEffect = 'knocked off';
					}
					this.scene.runOtherAnim('itemoff' as ID, [poke]);
					this.scene.resultAnim(poke, 'Item knocked off', 'neutral');
					break;
				case 'stealeat':
					poke.prevItemEffect = 'stolen';
					break;
				case 'gem':
					poke.prevItemEffect = 'consumed';
					break;
				case 'incinerate':
					poke.prevItemEffect = 'incinerated';
					break;
				}
			} else {
				switch (item.id) {
				case 'airballoon':
					poke.prevItemEffect = 'popped';
					poke.removeVolatile('airballoon' as ID);
					this.scene.resultAnim(poke, 'Balloon popped', 'neutral');
					break;
				case 'focussash':
					poke.prevItemEffect = 'consumed';
					this.scene.resultAnim(poke, 'Sash', 'neutral');
					break;
				case 'focusband':
					this.scene.resultAnim(poke, 'Focus Band', 'neutral');
					break;
				case 'redcard':
					poke.prevItemEffect = 'held up';
					break;
				default:
					poke.prevItemEffect = 'consumed';
					break;
				}
			}
			this.log(args, kwArgs);
			break;
		}
		case '-ability': {
			let poke = this.getPokemon(args[1])!;
			let ability = Dex.abilities.get(args[2]);
			let effect = Dex.getEffect(kwArgs.from);
			let ofpoke = this.getPokemon(kwArgs.of);
			poke.rememberAbility(ability.name, effect.id && !kwArgs.fail);

			if (kwArgs.silent) {
				// do nothing
			} else if (effect.id) {
				switch (effect.id) {
				case 'trace':
					this.activateAbility(poke, "Trace");
					this.scene.wait(500);
					this.activateAbility(poke, ability.name, true);
					ofpoke!.rememberAbility(ability.name);
					break;
				case 'powerofalchemy':
				case 'receiver':
					this.activateAbility(poke, effect.name);
					this.scene.wait(500);
					this.activateAbility(poke, ability.name, true);
					ofpoke!.rememberAbility(ability.name);
					break;
				case 'roleplay':
					this.activateAbility(poke, ability.name, true);
					ofpoke!.rememberAbility(ability.name);
					break;
				case 'desolateland':
				case 'primordialsea':
				case 'deltastream':
					if (kwArgs.fail) {
						this.activateAbility(poke, ability.name);
					}
					break;
				default:
					this.activateAbility(poke, ability.name);
					break;
				}
			} else {
				this.activateAbility(poke, ability.name);
			}
			this.scene.updateWeather();
			this.log(args, kwArgs);
			break;
		}
		case '-endability': {
			// deprecated; use |-start| for Gastro Acid
			// and the third arg of |-ability| for Entrainment et al
			let poke = this.getPokemon(args[1])!;
			let ability = Dex.abilities.get(args[2]);
			poke.ability = '(suppressed)';

			if (ability.id) {
				if (!poke.baseAbility) poke.baseAbility = ability.name;
			}
			this.log(args, kwArgs);
			break;
		}
		case 'detailschange': {
			let poke = this.getPokemon(args[1])!;
			poke.removeVolatile('formechange' as ID);
			poke.removeVolatile('typeadd' as ID);
			poke.removeVolatile('typechange' as ID);

			let newSpeciesForme = args[2];
			let commaIndex = newSpeciesForme.indexOf(',');
			if (commaIndex !== -1) {
				let level = newSpeciesForme.substr(commaIndex + 1).trim();
				if (level.charAt(0) === 'L') {
					poke.level = parseInt(level.substr(1), 10);
				}
				newSpeciesForme = args[2].substr(0, commaIndex);
			}
			let species = this.dex.species.get(newSpeciesForme);
			if (nextArgs) {
				if (nextArgs[0] === '-mega') {
					species = this.dex.species.get(this.dex.items.get(nextArgs[3]).megaStone);
				} else if (nextArgs[0] === '-primal' && nextArgs.length > 2) {
					if (nextArgs[2] === 'Red Orb') species = this.dex.species.get('Groudon-Primal');
					if (nextArgs[2] === 'Blue Orb') species = this.dex.species.get('Kyogre-Primal');
				}
			}

			poke.speciesForme = newSpeciesForme;
			poke.ability = poke.baseAbility = (species.abilities ? species.abilities['0'] : '');

			poke.details = args[2];
			poke.searchid = args[1].substr(0, 2) + args[1].substr(3) + '|' + args[2];

			this.scene.animTransform(poke, true, true);
			this.log(args, kwArgs);
			break;
		}
		case '-transform': {
			let poke = this.getPokemon(args[1])!;
			let tpoke = this.getPokemon(args[2])!;
			let effect = Dex.getEffect(kwArgs.from);
			if (poke === tpoke) throw new Error("Transforming into self");

			if (!kwArgs.silent) {
				this.activateAbility(poke, effect);
			}

			poke.boosts = {...tpoke.boosts};
			poke.copyTypesFrom(tpoke, true);
			poke.ability = tpoke.ability;
			poke.timesAttacked = tpoke.timesAttacked;
			const targetForme = tpoke.volatiles.formechange;
			const speciesForme = (targetForme && !targetForme[1].endsWith('-Gmax')) ? targetForme[1] : tpoke.speciesForme;
			const pokemon = tpoke;
			const shiny = tpoke.shiny;
			const gender = tpoke.gender;
			const level = tpoke.level;
			poke.addVolatile('transform' as ID, pokemon, shiny, gender, level);
			poke.addVolatile('formechange' as ID, speciesForme);
			for (const trackedMove of tpoke.moveTrack) {
				poke.rememberMove(trackedMove[0], 0);
			}
			this.scene.animTransform(poke);
			this.scene.resultAnim(poke, 'Transformed', 'good');
			this.log(['-transform', args[1], args[2], tpoke.speciesForme], kwArgs);
			break;
		}
		case '-formechange': {
			let poke = this.getPokemon(args[1])!;
			let species = Dex.species.get(args[2]);
			let fromeffect = Dex.getEffect(kwArgs.from);
			if (!poke.getSpeciesForme().endsWith('-Gmax') && !species.name.endsWith('-Gmax')) {
				poke.removeVolatile('typeadd' as ID);
				poke.removeVolatile('typechange' as ID);
				if (this.gen >= 6) poke.removeVolatile('autotomize' as ID);
			}

			if (!kwArgs.silent) {
				this.activateAbility(poke, fromeffect);
			}
			poke.addVolatile('formechange' as ID, species.name); // the formechange volatile reminds us to revert the sprite change on switch-out
			this.scene.animTransform(poke, true);
			this.log(args, kwArgs);
			break;
		}
		case '-mega': {
			let poke = this.getPokemon(args[1])!;
			let item = Dex.items.get(args[3]);
			if (args[3]) {
				poke.item = item.name;
			}
			this.log(args, kwArgs);
			break;
		}
		case '-primal': case '-burst': {
			this.log(args, kwArgs);
			break;
		}
		case '-terastallize': {
			let poke = this.getPokemon(args[1])!;
			let type = Dex.types.get(args[2]).name;
			let lockForme = false;
			poke.removeVolatile('typeadd' as ID);
			poke.teraType = type;
			poke.terastallized = type;
			poke.details += `, tera:${type}`;
			poke.searchid += `, tera:${type}`;
			if (poke.speciesForme.startsWith("Morpeko")) {
				lockForme = true;
				poke.speciesForme = poke.getSpeciesForme();
				poke.details = poke.details.replace("Morpeko", poke.speciesForme);
				poke.searchid = `${poke.ident}|${poke.details}`;
				delete poke.volatiles['formechange'];
			}
			this.scene.animTransform(poke, true, lockForme);
			this.scene.resetStatbar(poke);
			this.log(args, kwArgs);
			break;
		}
		case '-start': {
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(args[2]);
			let ofpoke = this.getPokemon(kwArgs.of);
			let fromeffect = Dex.getEffect(kwArgs.from);

			this.activateAbility(poke, effect);
			this.activateAbility(ofpoke || poke, fromeffect);
			switch (effect.id) {
			case 'typechange':
				if (poke.terastallized) break;
				if (ofpoke && fromeffect.id === 'reflecttype') {
					poke.copyTypesFrom(ofpoke);
				} else {
					const types = Dex.sanitizeName(args[3] || '???');
					poke.removeVolatile('typeadd' as ID);
					poke.addVolatile('typechange' as ID, types);
					if (!kwArgs.silent) {
						this.scene.typeAnim(poke, types);
					}
				}
				this.scene.updateStatbar(poke);
				break;
			case 'typeadd':
				const type = Dex.sanitizeName(args[3]);
				poke.addVolatile('typeadd' as ID, type);
				if (kwArgs.silent) break;
				this.scene.typeAnim(poke, type);
				break;
			case 'dynamax':
				poke.addVolatile('dynamax' as ID, !!args[3]);
				this.scene.animTransform(poke, true);
				break;
			case 'powertrick':
				this.scene.resultAnim(poke, 'Power Trick', 'neutral');
				break;
			case 'foresight':
			case 'miracleeye':
				this.scene.resultAnim(poke, 'Identified', 'bad');
				break;
			case 'telekinesis':
				this.scene.resultAnim(poke, 'Telekinesis', 'neutral');
				break;
			case 'confusion':
				if (!kwArgs.already) {
					this.scene.runStatusAnim('confused' as ID, [poke]);
					this.scene.resultAnim(poke, 'Confused', 'bad');
				}
				break;
			case 'leechseed':
				this.scene.updateStatbar(poke);
				break;
			case 'healblock':
				this.scene.resultAnim(poke, 'Heal Block', 'bad');
				break;
			case 'yawn':
				this.scene.resultAnim(poke, 'Drowsy', 'slp');
				break;
			case 'taunt':
				this.scene.resultAnim(poke, 'Taunted', 'bad');
				break;
			case 'imprison':
				this.scene.resultAnim(poke, 'Imprisoning', 'good');
				break;
			case 'disable':
				this.scene.resultAnim(poke, 'Disabled', 'bad');
				break;
			case 'embargo':
				this.scene.resultAnim(poke, 'Embargo', 'bad');
				break;
			case 'torment':
				this.scene.resultAnim(poke, 'Tormented', 'bad');
				break;
			case 'ingrain':
				this.scene.resultAnim(poke, 'Ingrained', 'good');
				break;
			case 'aquaring':
				this.scene.resultAnim(poke, 'Aqua Ring', 'good');
				break;
			case 'stockpile1':
				this.scene.resultAnim(poke, 'Stockpile', 'good');
				break;
			case 'stockpile2':
				poke.removeVolatile('stockpile1' as ID);
				this.scene.resultAnim(poke, 'Stockpile&times;2', 'good');
				break;
			case 'stockpile3':
				poke.removeVolatile('stockpile2' as ID);
				this.scene.resultAnim(poke, 'Stockpile&times;3', 'good');
				break;
			case 'perish0':
				poke.removeVolatile('perish1' as ID);
				break;
			case 'perish1':
				poke.removeVolatile('perish2' as ID);
				this.scene.resultAnim(poke, 'Perish next turn', 'bad');
				break;
			case 'perish2':
				poke.removeVolatile('perish3' as ID);
				this.scene.resultAnim(poke, 'Perish in 2', 'bad');
				break;
			case 'perish3':
				if (!kwArgs.silent) this.scene.resultAnim(poke, 'Perish in 3', 'bad');
				break;
			case 'encore':
				this.scene.resultAnim(poke, 'Encored', 'bad');
				break;
			case 'bide':
				this.scene.resultAnim(poke, 'Bide', 'good');
				break;
			case 'attract':
				this.scene.resultAnim(poke, 'Attracted', 'bad');
				break;
			case 'autotomize':
				this.scene.resultAnim(poke, 'Lightened', 'good');
				if (poke.volatiles.autotomize) {
					poke.volatiles.autotomize[1]++;
				} else {
					poke.addVolatile('autotomize' as ID, 1);
				}
				break;
			case 'focusenergy':
				this.scene.resultAnim(poke, '+Crit rate', 'good');
				break;
			case 'curse':
				this.scene.resultAnim(poke, 'Cursed', 'bad');
				break;
			case 'nightmare':
				this.scene.resultAnim(poke, 'Nightmare', 'bad');
				break;
			case 'magnetrise':
				this.scene.resultAnim(poke, 'Magnet Rise', 'good');
				break;
			case 'smackdown':
				this.scene.resultAnim(poke, 'Smacked Down', 'bad');
				poke.removeVolatile('magnetrise' as ID);
				poke.removeVolatile('telekinesis' as ID);
				if (poke.lastMove === 'fly' || poke.lastMove === 'bounce') this.scene.animReset(poke);
				break;
			case 'substitute':
				if (kwArgs.damage) {
					this.scene.resultAnim(poke, 'Damage', 'bad');
				} else if (kwArgs.block) {
					this.scene.resultAnim(poke, 'Blocked', 'neutral');
				}
				break;

			// Gen 1-2
			case 'mist':
				this.scene.resultAnim(poke, 'Mist', 'good');
				break;
			// Gen 1
			case 'lightscreen':
				this.scene.resultAnim(poke, 'Light Screen', 'good');
				break;
			case 'reflect':
				this.scene.resultAnim(poke, 'Reflect', 'good');
				break;
			}
			if (!(effect.id === 'typechange' && poke.terastallized)) {
				poke.addVolatile(effect.id);
			}
			this.scene.updateStatbar(poke);
			this.log(args, kwArgs);
			break;
		}
		case '-end': {
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(args[2]);
			let fromeffect = Dex.getEffect(kwArgs.from);
			poke.removeVolatile(effect.id);

			if (kwArgs.silent && !(effect.id === 'protosynthesis' || effect.id === 'quarkdrive')) {
				// do nothing
			} else {
				switch (effect.id) {
				case 'dynamax':
					this.scene.animTransform(poke);
					break;
				case 'powertrick':
					this.scene.resultAnim(poke, 'Power Trick', 'neutral');
					break;
				case 'telekinesis':
					this.scene.resultAnim(poke, 'Telekinesis&nbsp;ended', 'neutral');
					break;
				case 'skydrop':
					if (kwArgs.interrupt) {
						this.scene.anim(poke, {time: 100});
					}
					break;
				case 'confusion':
					this.scene.resultAnim(poke, 'Confusion&nbsp;ended', 'good');
					break;
				case 'leechseed':
					if (fromeffect.id === 'rapidspin') {
						this.scene.resultAnim(poke, 'De-seeded', 'good');
					}
					break;
				case 'healblock':
					this.scene.resultAnim(poke, 'Heal Block ended', 'good');
					break;
				case 'attract':
					this.scene.resultAnim(poke, 'Attract&nbsp;ended', 'good');
					break;
				case 'taunt':
					this.scene.resultAnim(poke, 'Taunt&nbsp;ended', 'good');
					break;
				case 'disable':
					this.scene.resultAnim(poke, 'Disable&nbsp;ended', 'good');
					break;
				case 'embargo':
					this.scene.resultAnim(poke, 'Embargo ended', 'good');
					break;
				case 'torment':
					this.scene.resultAnim(poke, 'Torment&nbsp;ended', 'good');
					break;
				case 'encore':
					this.scene.resultAnim(poke, 'Encore&nbsp;ended', 'good');
					break;
				case 'bide':
					this.scene.runOtherAnim('bideunleash' as ID, [poke]);
					break;
				case 'illusion':
					this.scene.resultAnim(poke, 'Illusion ended', 'bad');
					poke.rememberAbility('Illusion');
					break;
				case 'slowstart':
					this.scene.resultAnim(poke, 'Slow Start ended', 'good');
					break;
				case 'perishsong': // for backwards compatibility
					poke.removeVolatile('perish3' as ID);
					break;
				case 'substitute':
					this.scene.resultAnim(poke, 'Faded', 'bad');
					break;
				case 'stockpile':
					poke.removeVolatile('stockpile1' as ID);
					poke.removeVolatile('stockpile2' as ID);
					poke.removeVolatile('stockpile3' as ID);
					break;
				case 'protosynthesis':
					poke.removeVolatile('protosynthesisatk' as ID);
					poke.removeVolatile('protosynthesisdef' as ID);
					poke.removeVolatile('protosynthesisspa' as ID);
					poke.removeVolatile('protosynthesisspd' as ID);
					poke.removeVolatile('protosynthesisspe' as ID);
					break;
				case 'quarkdrive':
					poke.removeVolatile('quarkdriveatk' as ID);
					poke.removeVolatile('quarkdrivedef' as ID);
					poke.removeVolatile('quarkdrivespa' as ID);
					poke.removeVolatile('quarkdrivespd' as ID);
					poke.removeVolatile('quarkdrivespe' as ID);
					break;
				default:
					if (effect.effectType === 'Move') {
						if (effect.name === 'Doom Desire') {
							this.scene.runOtherAnim('doomdesirehit' as ID, [poke]);
						}
						if (effect.name === 'Future Sight') {
							this.scene.runOtherAnim('futuresighthit' as ID, [poke]);
						}
					}
				}
			}
			this.scene.updateStatbar(poke);
			this.log(args, kwArgs);
			break;
		}
		case '-singleturn': {
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(args[2]);
			if (effect.id === 'roost' && !poke.getTypeList().includes('Flying')) {
				break;
			}
			poke.addTurnstatus(effect.id);
			switch (effect.id) {
			case 'roost':
				this.scene.resultAnim(poke, 'Landed', 'neutral');
				break;
			case 'quickguard':
				this.scene.resultAnim(poke, 'Quick Guard', 'good');
				break;
			case 'wideguard':
				this.scene.resultAnim(poke, 'Wide Guard', 'good');
				break;
			case 'craftyshield':
				this.scene.resultAnim(poke, 'Crafty Shield', 'good');
				break;
			case 'matblock':
				this.scene.resultAnim(poke, 'Mat Block', 'good');
				break;
			case 'protect':
				this.scene.resultAnim(poke, 'Protected', 'good');
				break;
			case 'endure':
				this.scene.resultAnim(poke, 'Enduring', 'good');
				break;
			case 'helpinghand':
				this.scene.resultAnim(poke, 'Helping Hand', 'good');
				break;
			case 'focuspunch':
				this.scene.resultAnim(poke, 'Focusing', 'neutral');
				poke.rememberMove(effect.name, 0);
				break;
			case 'shelltrap':
				this.scene.resultAnim(poke, 'Trap set', 'neutral');
				poke.rememberMove(effect.name, 0);
				break;
			case 'beakblast':
				this.scene.runOtherAnim('bidecharge' as ID, [poke]);
				this.scene.resultAnim(poke, 'Beak Blast', 'neutral');
				break;
			}
			this.scene.updateStatbar(poke);
			this.log(args, kwArgs);
			break;
		}
		case '-singlemove': {
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(args[2]);
			poke.addMovestatus(effect.id);
			switch (effect.id) {
			case 'grudge':
				this.scene.resultAnim(poke, 'Grudge', 'neutral');
				break;
			case 'destinybond':
				this.scene.resultAnim(poke, 'Destiny Bond', 'neutral');
				break;
			}
			this.scene.updateStatbar(poke);
			this.log(args, kwArgs);
			break;
		}
		case '-activate': {
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(args[2]);
			let target = this.getPokemon(args[3]);
			this.activateAbility(poke, effect);
			switch (effect.id) {
			case 'poltergeist':
				poke.item = kwArgs.item;
				poke.itemEffect = 'disturbed';
				break;
			case 'grudge':
				poke.rememberMove(kwArgs.move, Infinity);
				break;
			case 'substitute':
				if (kwArgs.damage) {
					this.scene.resultAnim(poke, 'Damage', 'bad');
				} else if (kwArgs.block) {
					this.scene.resultAnim(poke, 'Blocked', 'neutral');
				}
				break;
			case 'attract':
				this.scene.runStatusAnim('attracted' as ID, [poke]);
				break;
			case 'bide':
				this.scene.runOtherAnim('bidecharge' as ID, [poke]);
				break;

			// move activations
			case 'aromatherapy':
				this.scene.resultAnim(poke, 'Team Cured', 'good');
				break;
			case 'healbell':
				this.scene.resultAnim(poke, 'Team Cured', 'good');
				break;
			case 'brickbreak':
				target!.side.removeSideCondition('Reflect');
				target!.side.removeSideCondition('LightScreen');
				break;
			case 'hyperspacefury':
			case 'hyperspacehole':
			case 'phantomforce':
			case 'shadowforce':
			case 'feint':
				this.scene.resultAnim(poke, 'Protection broken', 'bad');
				poke.removeTurnstatus('protect' as ID);
				for (const curTarget of poke.side.pokemon) {
					curTarget.removeTurnstatus('wideguard' as ID);
					curTarget.removeTurnstatus('quickguard' as ID);
					curTarget.removeTurnstatus('craftyshield' as ID);
					curTarget.removeTurnstatus('matblock' as ID);
					this.scene.updateStatbar(curTarget);
				}
				break;
			case 'eeriespell':
			case 'gmaxdepletion':
			case 'spite':
				let move = Dex.moves.get(kwArgs.move).name;
				let pp = Number(kwArgs.number);
				if (isNaN(pp)) pp = 4;
				poke.rememberMove(move, pp);
				break;
			case 'gravity':
				poke.removeVolatile('magnetrise' as ID);
				poke.removeVolatile('telekinesis' as ID);
				this.scene.anim(poke, {time: 100});
				break;
			case 'skillswap': case 'wanderingspirit':
				if (this.gen <= 4) break;
				let pokeability = Dex.sanitizeName(kwArgs.ability) || target!.ability;
				let targetability = Dex.sanitizeName(kwArgs.ability2) || poke.ability;
				if (pokeability) {
					poke.ability = pokeability;
					if (!target!.baseAbility) target!.baseAbility = pokeability;
				}
				if (targetability) {
					target!.ability = targetability;
					if (!poke.baseAbility) poke.baseAbility = targetability;
				}
				if (poke.side !== target!.side) {
					this.activateAbility(poke, pokeability, true);
					this.activateAbility(target, targetability, true);
				}
				break;

			// ability activations
			case 'electromorphosis':
			case 'windpower':
				poke.addMovestatus('charge' as ID);
				break;
			case 'forewarn':
				if (target) {
					target.rememberMove(kwArgs.move, 0);
				} else {
					let foeActive = [] as Pokemon[];
					for (const maybeTarget of poke.side.foe.active) {
						if (maybeTarget && !maybeTarget.fainted) foeActive.push(maybeTarget);
					}
					if (foeActive.length === 1) {
						foeActive[0].rememberMove(kwArgs.move, 0);
					}
				}
				break;
			case 'lingeringaroma':
			case 'mummy':
				if (!kwArgs.ability) break; // if Mummy activated but failed, no ability will have been sent
				let ability = Dex.abilities.get(kwArgs.ability);
				this.activateAbility(target, ability.name);
				this.activateAbility(poke, effect.name);
				this.scene.wait(700);
				this.activateAbility(target, effect.name, true);
				break;

			// item activations
			case 'leppaberry':
			case 'mysteryberry':
				poke.rememberMove(kwArgs.move, effect.id === 'leppaberry' ? -10 : -5);
				break;
			case 'focusband':
				poke.item = 'Focus Band';
				break;
			case 'quickclaw':
				poke.item = 'Quick Claw';
				break;
			case 'abilityshield':
				poke.item = 'Ability Shield';
				break;
			default:
				if (kwArgs.broken) { // for custom moves that break protection
					this.scene.resultAnim(poke, 'Protection broken', 'bad');
				}
			}
			this.log(args, kwArgs);
			break;
		}
		case '-sidestart': {
			let side = this.getSide(args[1]);
			let effect = Dex.getEffect(args[2]);
			side.addSideCondition(effect, !!kwArgs.persistent);

			switch (effect.id) {
			case 'tailwind':
			case 'auroraveil':
			case 'reflect':
			case 'lightscreen':
			case 'safeguard':
			case 'mist':
			case 'gmaxwildfire':
			case 'gmaxvolcalith':
			case 'gmaxvinelash':
			case 'gmaxcannonade':
			case 'grasspledge':
			case 'firepledge':
			case 'waterpledge':
				this.scene.updateWeather();
				break;
			}
			this.log(args, kwArgs);
			break;
		}
		case '-sideend': {
			let side = this.getSide(args[1]);
			let effect = Dex.getEffect(args[2]);
			// let from = Dex.getEffect(kwArgs.from);
			// let ofpoke = this.getPokemon(kwArgs.of);
			side.removeSideCondition(effect.name);
			this.log(args, kwArgs);
			break;
		}
		case '-swapsideconditions': {
			this.swapSideConditions();
			this.scene.updateWeather();
			this.log(args, kwArgs);
			break;
		}
		case '-weather': {
			let effect = Dex.getEffect(args[1]);
			let poke = this.getPokemon(kwArgs.of) || undefined;
			let ability = Dex.getEffect(kwArgs.from);
			if (!effect.id || effect.id === 'none') {
				kwArgs.from = this.weather;
			}
			this.changeWeather(effect.name, poke, !!kwArgs.upkeep, ability);
			this.log(args, kwArgs);
			break;
		}
		case '-fieldstart': {
			let effect = Dex.getEffect(args[1]);
			let poke = this.getPokemon(kwArgs.of);
			let fromeffect = Dex.getEffect(kwArgs.from);
			this.activateAbility(poke, fromeffect);
			let minTimeLeft = 5;
			let maxTimeLeft = 0;
			if (effect.id.endsWith('terrain')) {
				for (let i = this.pseudoWeather.length - 1; i >= 0; i--) {
					let pwID = toID(this.pseudoWeather[i][0]);
					if (pwID.endsWith('terrain')) {
						this.pseudoWeather.splice(i, 1);
						continue;
					}
				}
				if (this.gen > 6) maxTimeLeft = 8;
			}
			if (kwArgs.persistent) minTimeLeft += 2;
			this.addPseudoWeather(effect.name, minTimeLeft, maxTimeLeft);

			switch (effect.id) {
			case 'gravity':
				if (this.seeking !== null) break;
				for (const active of this.getAllActive()) {
					this.scene.runOtherAnim('gravity' as ID, [active]);
				}
				break;
			}
			this.log(args, kwArgs);
			break;
		}
		case '-fieldend': {
			let effect = Dex.getEffect(args[1]);
			// let poke = this.getPokemon(kwArgs.of);
			this.removePseudoWeather(effect.name);
			this.log(args, kwArgs);
			break;
		}
		case '-fieldactivate': {
			let effect = Dex.getEffect(args[1]);
			switch (effect.id) {
			case 'perishsong':
				this.scene.updateStatbars();
				break;
			}
			this.log(args, kwArgs);
			break;
		}
		case '-anim': {
			let poke = this.getPokemon(args[1])!;
			let move = Dex.moves.get(args[2]);
			if (this.checkActive(poke)) return;
			let poke2 = this.getPokemon(args[3]);
			this.scene.beforeMove(poke);
			this.animateMove(poke, move, poke2, kwArgs);
			this.scene.afterMove(poke);
			break;
		}
		case '-hint': case '-message': case '-candynamax': {
			this.log(args, kwArgs);
			break;
		}
		default: {
			throw new Error(`Unrecognized minor action: ${args[0]}`);
			break;
		}}
	}
	/*
	parseSpriteData(name) {
		let siden = 0,
			foe = false;
		while (true) {
			if (name.substr(0, 6) === 'foeof-') {
				foe = true;
				name = name.substr(6);
			} else if (name.substr(0, 9) === 'switched-') name = name.substr(9);
			else if (name.substr(0, 9) === 'existing-') name = name.substr(9);
			else if (name.substr(0, 4) === 'foe-') {
				siden = this.p2.n;
				name = name.substr(4);
			} else if (name.substr(0, 5) === 'ally-') {
				siden = this.p1.n;
				name = name.substr(5);
			} else break;
		}
		if (name.substr(name.length - 1) === ')') {
			let parenIndex = name.lastIndexOf('(');
			if (parenIndex > 0) {
				let species = name.substr(parenIndex + 1);
				name = species.substr(0, species.length - 1);
			}
		}
		if (foe) siden = (siden ? 0 : 1);

		let data = Dex.species.get(name);
		return data.spriteData[siden];
	}
	*/
	/**
	 * @param name Leave blank for Team Preview
	 * @param pokemonid Leave blank for Team Preview
	 * @param details
	 * @param output
	 */
	parseDetails(name: string, pokemonid: string, details: string, output: PokemonDetails = {} as any) {
		const isTeamPreview = !name;
		output.details = details;
		output.name = name;
		output.speciesForme = name;
		output.level = 100;
		output.shiny = false;
		output.gender = '';
		output.ident = (!isTeamPreview ? pokemonid : '');
		output.searchid = (!isTeamPreview ? `${pokemonid}|${details}` : '');
		let splitDetails = details.split(', ');
		if (splitDetails[splitDetails.length - 1].startsWith('tera:')) {
			output.terastallized = splitDetails[splitDetails.length - 1].slice(5);
			splitDetails.pop();
		}
		if (splitDetails[splitDetails.length - 1] === 'shiny') {
			output.shiny = true;
			splitDetails.pop();
		}
		if (splitDetails[splitDetails.length - 1] === 'M' || splitDetails[splitDetails.length - 1] === 'F') {
			output.gender = splitDetails[splitDetails.length - 1] as GenderName;
			splitDetails.pop();
		}
		if (splitDetails[1]) {
			output.level = parseInt(splitDetails[1].substr(1), 10) || 100;
		}
		if (splitDetails[0]) {
			output.speciesForme = splitDetails[0];
		}
		return output;
	}
	parseHealth(hpstring: string, output: PokemonHealth = {} as any) {
		let [hp, status] = hpstring.split(' ');

		// hp parse
		output.hpcolor = '';
		if (hp === '0' || hp === '0.0') {
			if (!output.maxhp) output.maxhp = 100;
			output.hp = 0;
		} else if (hp.indexOf('/') > 0) {
			let [curhp, maxhp] = hp.split('/');
			if (isNaN(parseFloat(curhp)) || isNaN(parseFloat(maxhp))) {
				return null;
			}
			output.hp = parseFloat(curhp);
			output.maxhp = parseFloat(maxhp);
			if (output.hp > output.maxhp) output.hp = output.maxhp;
			const colorchar = maxhp.slice(-1);
			if (colorchar === 'y' || colorchar === 'g') {
				output.hpcolor = colorchar;
			}
		} else if (!isNaN(parseFloat(hp))) {
			if (!output.maxhp) output.maxhp = 100;
			output.hp = output.maxhp * parseFloat(hp) / 100;
		}

		// status parse
		if (!status) {
			output.status = '';
		} else if (status === 'par' || status === 'brn' || status === 'slp' || status === 'frz' || status === 'tox') {
			output.status = status;
		} else if (status === 'psn' && output.status !== 'tox') {
			output.status = status;
		} else if (status === 'fnt') {
			output.hp = 0;
			output.fainted = true;
		}
		return output;
	}
	parsePokemonId(pokemonid: string) {
		let name = pokemonid;

		let siden = -1;
		let slot = -1; // if there is an explicit slot for this pokemon
		if (/^p[1-9]($|: )/.test(name)) {
			siden = parseInt(name.charAt(1), 10) - 1;
			name = name.slice(4);
		} else if (/^p[1-9][a-f]: /.test(name)) {
			const slotChart: {[k: string]: number} = {a: 0, b: 1, c: 2, d: 3, e: 4, f: 5};
			siden = parseInt(name.charAt(1), 10) - 1;
			slot = slotChart[name.charAt(2)];
			name = name.slice(5);
			pokemonid = `p${siden + 1}: ${name}`;
		}
		return {name, siden, slot, pokemonid};
	}
	getSwitchedPokemon(pokemonid: string, details: string) {
		if (pokemonid === '??') throw new Error(`pokemonid not passed`);
		const {name, siden, slot, pokemonid: parsedPokemonid} = this.parsePokemonId(pokemonid);
		pokemonid = parsedPokemonid;

		const searchid = `${pokemonid}|${details}`;
		const side = this.sides[siden];

		// search inactive revealed pokemon
		for (let i = 0; i < side.pokemon.length; i++) {
			let pokemon = side.pokemon[i];
			if (pokemon.fainted) continue;
			// already active, can't be switching in
			if (side.active.includes(pokemon)) continue;
			// just switched out, can't be switching in
			if (pokemon === side.lastPokemon && !side.active[slot]) continue;

			if (pokemon.searchid === searchid) {
				// exact match
				if (slot >= 0) pokemon.slot = slot;
				return pokemon;
			}
			if (!pokemon.searchid && pokemon.checkDetails(details)) {
				// switch-in matches Team Preview entry
				pokemon = side.addPokemon(name, pokemonid, details, i);
				if (slot >= 0) pokemon.slot = slot;
				return pokemon;
			}
		}

		// pokemon not found, create a new pokemon object for it
		const pokemon = side.addPokemon(name, pokemonid, details);
		if (slot >= 0) pokemon.slot = slot;
		return pokemon;
	}
	rememberTeamPreviewPokemon(sideid: string, details: string) {
		const {siden} = this.parsePokemonId(sideid);

		return this.sides[siden].addPokemon('', '', details);
	}
	findCorrespondingPokemon(serverPokemon: {ident: string, details: string}) {
		const {siden} = this.parsePokemonId(serverPokemon.ident);
		const searchid = `${serverPokemon.ident}|${serverPokemon.details}`;
		for (const pokemon of this.sides[siden].pokemon) {
			if (pokemon.searchid === searchid) {
				return pokemon;
			}
		}
		return null;
	}
	getPokemon(pokemonid: string | undefined, faintedOnly = false) {
		if (!pokemonid || pokemonid === '??' || pokemonid === 'null' || pokemonid === 'false') {
			return null;
		}
		const {siden, slot, pokemonid: parsedPokemonid} = this.parsePokemonId(pokemonid);
		pokemonid = parsedPokemonid;

		/** if true, don't match an active pokemon */
		const isInactive = (slot < 0);
		const side = this.sides[siden];

		// search player's pokemon
		if (!isInactive && side.active[slot]) return side.active[slot];

		for (const pokemon of side.pokemon) {
			if (isInactive && !this.compatMode && side.active.includes(pokemon)) continue;
			if (faintedOnly && pokemon.hp) continue;
			if (pokemon.ident === pokemonid) { // name matched, good enough
				if (slot >= 0) pokemon.slot = slot;
				return pokemon;
			}
		}

		return null;
	}
	getSide(sidename: string): Side {
		if (sidename === 'p1' || sidename.startsWith('p1:')) return this.p1;
		if (sidename === 'p2' || sidename.startsWith('p2:')) return this.p2;
		if ((sidename === 'p3' || sidename.startsWith('p3:')) && this.p3) return this.p3;
		if ((sidename === 'p4' || sidename.startsWith('p4:')) && this.p4) return this.p4;
		if (this.nearSide.id === sidename) return this.nearSide;
		if (this.farSide.id === sidename) return this.farSide;
		if (this.nearSide.name === sidename) return this.nearSide;
		if (this.farSide.name === sidename) return this.farSide;
		return {
			name: sidename,
			id: sidename.replace(/ /g, ''),
		} as any;
	}

	add(command?: string) {
		if (command) this.stepQueue.push(command);

		if (this.atQueueEnd && this.currentStep < this.stepQueue.length) {
			this.atQueueEnd = false;
			this.nextStep();
		}
	}
	/**
	 * PS's preempt system is intended to show chat messages immediately,
	 * instead of waiting for the battle to get to the point where the
	 * message was said.
	 *
	 * In addition to being a nice quality-of-life feature, it's also
	 * important to make sure timer updates happen in real-time.
	 */
	instantAdd(command: string) {
		this.run(command, true);
		this.preemptStepQueue.push(command);
		this.add(command);
	}
	runMajor(args: Args, kwArgs: KWArgs, preempt?: boolean) {
		switch (args[0]) {
		case 'start': {
			this.nearSide.active[0] = null;
			this.farSide.active[0] = null;
			this.scene.resetSides();
			this.start();
			break;
		}
		case 'upkeep': {
			this.usesUpkeep = true;
			this.updateTurnCounters();
			// Prevents getSwitchedPokemon from skipping over a Pokemon that switched out mid turn (e.g. U-turn)
			for (const side of this.sides) {
				side.lastPokemon = null;
			}
			break;
		}
		case 'turn': {
			this.setTurn(parseInt(args[1], 10));
			this.log(args);
			break;
		}
		case 'tier': {
			this.tier = args[1];
			if (this.tier.slice(-13) === 'Random Battle') {
				this.speciesClause = true;
			}
			if (this.tier.slice(-8) === ' (Blitz)') {
				this.messageFadeTime = 40;
				this.isBlitz = true;
			}
			if (this.tier.includes(`Let's Go`)) {
				this.dex = Dex.mod('gen7letsgo' as ID);
			}
			if (this.tier.includes('Super Staff Bros')) {
				this.dex = Dex.mod('gen9ssb' as ID);
			}
			this.log(args);
			break;
		}
		case 'gametype': {
			this.gameType = args[1] as any;
			this.compatMode = false;
			switch (args[1]) {
			case 'multi':
			case 'freeforall':
				this.pokemonControlled = 1;
				if (!this.p3) this.p3 = new Side(this, 2);
				if (!this.p4) this.p4 = new Side(this, 3);
				this.p3.foe = this.p2;
				this.p4.foe = this.p1;

				if (args[1] === 'multi') {
					this.p4.ally = this.p2;
					this.p3.ally = this.p1;
					this.p1.ally = this.p3;
					this.p2.ally = this.p4;
				}

				this.p3.isFar = this.p1.isFar;
				this.p4.isFar = this.p2.isFar;
				this.sides = [this.p1, this.p2, this.p3, this.p4];
				// intentionally sync p1/p3 and p2/p4's active arrays
				this.p1.active = this.p3.active = [null, null];
				this.p2.active = this.p4.active = [null, null];
				break;
			case 'doubles':
				this.nearSide.active = [null, null];
				this.farSide.active = [null, null];
				break;
			case 'triples':
			case 'rotation':
				this.nearSide.active = [null, null, null];
				this.farSide.active = [null, null, null];
				break;
			default:
				for (const side of this.sides) side.active = [null];
				break;
			}
			if (!this.pokemonControlled) this.pokemonControlled = this.nearSide.active.length;
			this.scene.updateGen();
			this.scene.resetSides();
			break;
		}
		case 'rule': {
			let ruleName = args[1].split(': ')[0];
			if (ruleName === 'Species Clause') this.speciesClause = true;
			if (ruleName === 'Blitz') {
				this.messageFadeTime = 40;
				this.isBlitz = true;
			}
			if (ruleName === 'Exact HP Mod') this.reportExactHP = true;
			this.rules[ruleName] = 1;
			this.log(args);
			break;
		}
		case 'rated': {
			this.rated = args[1] || true;
			this.scene.updateGen();
			this.log(args);
			break;
		}
		case 'inactive': {
			if (!this.kickingInactive) this.kickingInactive = true;
			if (args[1].slice(0, 11) === "Time left: ") {
				let [time, totalTime, graceTime] = args[1].split(' | ');
				this.kickingInactive = parseInt(time.slice(11), 10) || true;
				this.totalTimeLeft = parseInt(totalTime, 10);
				this.graceTimeLeft = parseInt(graceTime || '', 10) || 0;
				if (this.totalTimeLeft === this.kickingInactive) this.totalTimeLeft = 0;
				return;
			} else if (args[1].slice(0, 9) === "You have ") {
				// this is ugly but parseInt is documented to work this way
				// so I'm going to be lazy and not chop off the rest of the
				// sentence
				this.kickingInactive = parseInt(args[1].slice(9), 10) || true;
				return;
			} else if (args[1].slice(-14) === ' seconds left.') {
				let hasIndex = args[1].indexOf(' has ');
				let userid = window.app?.user?.get('userid');
				if (toID(args[1].slice(0, hasIndex)) === userid) {
					this.kickingInactive = parseInt(args[1].slice(hasIndex + 5), 10) || true;
				}
			} else if (args[1].slice(-27) === ' 15 seconds left this turn.') {
				if (this.isBlitz) return;
			}
			this.log(args, undefined, preempt);
			break;
		}
		case 'inactiveoff': {
			this.kickingInactive = false;
			this.log(args, undefined, preempt);
			break;
		}
		case 'join': case 'j': case 'J': {
			if (this.roomid) {
				let room = app!.rooms[this.roomid];
				let user = BattleTextParser.parseNameParts(args[1]);
				let userid = toUserid(user.name);
				if (!room.users[userid]) room.userCount.users++;
				room.users[userid] = user;
				room.userList.add(userid);
				room.userList.updateUserCount();
				room.userList.updateNoUsersOnline();
			}
			this.log(args, undefined, preempt);
			break;
		}
		case 'leave': case 'l': case 'L': {
			if (this.roomid) {
				let room = app!.rooms[this.roomid];
				let user = args[1];
				let userid = toUserid(user);
				if (room.users[userid]) room.userCount.users--;
				delete room.users[userid];
				room.userList.remove(userid);
				room.userList.updateUserCount();
				room.userList.updateNoUsersOnline();
			}
			this.log(args, undefined, preempt);
			break;
		}
		case 'name': case 'n': case 'N': {
			if (this.roomid) {
				let room = app!.rooms[this.roomid];
				let user = BattleTextParser.parseNameParts(args[1]);
				let oldid = args[2];
				if (toUserid(oldid) === app!.user.get('userid')) {
					app!.user.set({
						away: user.away,
						status: user.status,
					});
				}
				let userid = toUserid(user.name);
				room.users[userid] = user;
				room.userList.remove(oldid);
				room.userList.add(userid);
			}
			if (!this.ignoreSpects) {
				this.log(args, undefined, preempt);
			}
			break;
		}
		case 'player': {
			let side = this.getSide(args[1]);
			side.setName(args[2]);
			if (args[3]) side.setAvatar(args[3]);
			if (args[4]) side.rating = args[4];
			if (this.joinButtons) this.scene.hideJoinButtons();
			this.log(args);
			this.scene.updateSidebar(side);
			break;
		}
		case 'badge': {
			let side = this.getSide(args[1]);
			// handle all the rendering further down
			const badge = args.slice(2).join('|');
			// (don't allow duping)
			if (!side.badges.includes(badge)) side.badges.push(badge);
			this.scene.updateSidebar(side);
			break;
		}
		case 'teamsize': {
			let side = this.getSide(args[1]);
			side.totalPokemon = parseInt(args[2], 10);
			this.scene.updateSidebar(side);
			break;
		}
		case 'win': case 'tie': {
			this.winner(args[0] === 'tie' ? undefined : args[1]);
			break;
		}
		case 'prematureend': {
			this.prematureEnd();
			break;
		}
		case 'clearpoke': {
			this.p1.clearPokemon();
			this.p2.clearPokemon();
			break;
		}
		case 'poke': {
			let pokemon = this.rememberTeamPreviewPokemon(args[1], args[2])!;
			if (args[3] === 'mail') {
				pokemon.item = '(mail)';
			} else if (args[3] === 'item') {
				pokemon.item = '(exists)';
			}
			break;
		}
		case 'updatepoke': {
			const {siden} = this.parsePokemonId(args[1]);
			const side = this.sides[siden];
			for (let i = 0; i < side.pokemon.length; i++) {
				const pokemon = side.pokemon[i];
				if (pokemon.details !== args[2] && pokemon.checkDetails(args[2])) {
					side.addPokemon('', '', args[2], i);
					break;
				}
			}
			break;
		}
		case 'teampreview': {
			this.teamPreviewCount = parseInt(args[1], 10);
			this.scene.teamPreview();
			break;
		}
		case 'showteam': {
			const team = Teams.unpack(args[2]);
			if (!team.length) return;
			const side = this.getSide(args[1]);
			side.clearPokemon();
			for (const set of team) {
				const details = set.species + (!set.level || set.level === 100 ? '' : ', L' + set.level) +
					(!set.gender || set.gender === 'N' ? '' : ', ' + set.gender) + (set.shiny ? ', shiny' : '');
				const pokemon = side.addPokemon('', '', details);
				if (set.item) pokemon.item = set.item;
				if (set.ability) pokemon.rememberAbility(set.ability);
				for (const move of set.moves) {
					pokemon.rememberMove(move, 0);
				}
				if (set.teraType) pokemon.teraType = set.teraType;
			}
			this.log(args, kwArgs);
			break;
		}
		case 'switch': case 'drag': case 'replace': {
			this.endLastTurn();
			let poke = this.getSwitchedPokemon(args[1], args[2])!;
			let slot = poke.slot;
			poke.healthParse(args[3]);
			poke.removeVolatile('itemremoved' as ID);
			poke.terastallized = args[2].match(/tera:([a-z]+)$/i)?.[1] || '';
			if (args[0] === 'switch') {
				if (poke.side.active[slot]) {
					poke.side.switchOut(poke.side.active[slot]!, kwArgs);
				}
				poke.side.switchIn(poke, kwArgs);
			} else if (args[0] === 'replace') {
				poke.side.replace(poke);
			} else {
				poke.side.dragIn(poke);
			}
			this.scene.updateWeather();
			this.log(args, kwArgs);
			break;
		}
		case 'faint': {
			let poke = this.getPokemon(args[1])!;
			poke.side.faint(poke);
			this.log(args, kwArgs);
			break;
		}
		case 'swap': {
			if (isNaN(Number(args[2]))) {
				const poke = this.getPokemon(args[1])!;
				poke.side.swapWith(poke, this.getPokemon(args[2])!, kwArgs);
			} else {
				const poke = this.getPokemon(args[1])!;
				const targetIndex = parseInt(args[2], 10);
				if (kwArgs.from) {
					const target = poke.side.active[targetIndex];
					if (target) args[2] = target.ident;
				}
				poke.side.swapTo(poke, targetIndex);
			}
			this.log(args, kwArgs);
			break;
		}
		case 'move': {
			this.endLastTurn();
			this.resetTurnsSinceMoved();
			let poke = this.getPokemon(args[1])!;
			let move = Dex.moves.get(args[2]);
			if (this.checkActive(poke)) return;
			let poke2 = this.getPokemon(args[3]);
			this.scene.beforeMove(poke);
			this.useMove(poke, move, poke2, kwArgs);
			this.animateMove(poke, move, poke2, kwArgs);
			this.log(args, kwArgs);
			this.scene.afterMove(poke);
			break;
		}
		case 'cant': {
			this.endLastTurn();
			this.resetTurnsSinceMoved();
			let poke = this.getPokemon(args[1])!;
			let effect = Dex.getEffect(args[2]);
			let move = Dex.moves.get(args[3]);
			this.cantUseMove(poke, effect, move, kwArgs);
			this.log(args, kwArgs);
			break;
		}
		case 'gen': {
			this.gen = parseInt(args[1], 10);
			this.dex = Dex.forGen(this.gen);
			this.scene.updateGen();
			this.log(args);
			break;
		}
		case 'callback': {
			this.subscription?.('callback');
			break;
		}
		case 'fieldhtml': {
			this.scene.setFrameHTML(BattleLog.sanitizeHTML(args[1]));
			break;
		}
		case 'controlshtml': {
			this.scene.setControlsHTML(BattleLog.sanitizeHTML(args[1]));
			break;
		}
		case 'custom': {
			// Style is always |custom|-subprotocol|pokemon|additional info
			if (args[1] === '-endterastallize') {
				let poke = this.getPokemon(args[2])!;
				poke.removeVolatile('terastallize' as ID);
				poke.teraType = '';
				poke.terastallized = '';
				poke.details = poke.details.replace(/, tera:[a-z]+/i, '');
				poke.searchid = poke.searchid.replace(/, tera:[a-z]+/i, '');
				this.scene.animTransform(poke);
				this.scene.resetStatbar(poke);
				this.log(args, kwArgs);
			}
			break;
		}
		default: {
			this.log(args, kwArgs, preempt);
			break;
		}}
	}

	run(str: string, preempt?: boolean) {
		if (!preempt && this.preemptStepQueue.length && str === this.preemptStepQueue[0]) {
			this.preemptStepQueue.shift();
			this.scene.preemptCatchup();
			return;
		}
		if (!str) return;
		const {args, kwArgs} = BattleTextParser.parseBattleLine(str);

		if (this.scene.maybeCloseMessagebar(args, kwArgs)) {
			this.currentStep--;
			this.activeMoveIsSpread = null;
			return;
		}

		// parse the next line if it's a minor: runMinor needs it parsed to determine when to merge minors
		let nextArgs: Args = [''];
		let nextKwargs: KWArgs = {};
		const nextLine = this.stepQueue[this.currentStep + 1] || '';
		if (nextLine.slice(0, 2) === '|-') {
			({args: nextArgs, kwArgs: nextKwargs} = BattleTextParser.parseBattleLine(nextLine));
		}

		if (this.debug) {
			if (args[0].charAt(0) === '-' || args[0] === 'detailschange') {
				this.runMinor(args, kwArgs, nextArgs, nextKwargs);
			} else {
				this.runMajor(args, kwArgs, preempt);
			}
		} else {
			try {
				if (args[0].charAt(0) === '-' || args[0] === 'detailschange') {
					this.runMinor(args, kwArgs, nextArgs, nextKwargs);
				} else {
					this.runMajor(args, kwArgs, preempt);
				}
			} catch (err: any) {
				this.log(['majorerror', 'Error parsing: ' + str + ' (' + err + ')']);
				if (err.stack) {
					let stack = ('' + err.stack).split('\n');
					for (const line of stack) {
						if (/\brun\b/.test(line)) {
							break;
						}
						this.log(['error', line]);
					}
				}
				this.subscription?.('error');
			}
		}

		if (nextLine.startsWith('|start') || args[0] === 'teampreview') {
			if (this.turn === -1) {
				this.turn = 0;
				this.scene.updateBgm();
			}
		}
	}
	checkActive(poke: Pokemon) {
		if (!poke.side.active[poke.slot]) {
			// SOMEONE jumped in in the middle of a replay. <_<
			poke.side.replace(poke);
		}
		return false;
	}

	pause() {
		this.paused = true;
		this.scene.pause();
		this.subscription?.('paused');
	}
	/**
	 * Properties relevant to battle playback, for replay UI implementers:
	 * - `ended`: has the game ended in a win/loss?
	 * - `atQueueEnd`: is animation caught up to the end of the battle queue, waiting for more input?
	 * - `seeking`: are we trying to skip to a specific turn
	 * - `turn`: what turn are we currently on? `-1` if we haven't started yet, `0` at team preview
	 * - `paused`: are we playing at all?
	 */
	play() {
		this.paused = false;
		this.started = true;
		this.scene.resume();
		this.nextStep();
		this.subscription?.('playing');
	}
	skipTurn() {
		this.seekBy(1);
	}
	seekBy(deltaTurn: number) {
		if (this.seeking === Infinity && deltaTurn < 0) {
			return this.seekTurn(this.turn + 1);
		}
		this.seekTurn((this.seeking ?? this.turn) + deltaTurn);
	}
	seekTurn(turn: number, forceReset?: boolean) {
		if (isNaN(turn)) return;
		turn = Math.max(Math.floor(turn), 0);

		if (this.seeking !== null && turn > this.turn && !forceReset) {
			this.seeking = turn;
			return;
		}

		if (turn === 0) {
			this.seeking = null;
			this.resetStep();
			this.scene.animationOn();
			if (this.paused) this.subscription?.('paused');
			return;
		}

		this.seeking = turn;

		if (turn <= this.turn || forceReset) {
			this.scene.animationOff();
			this.resetStep();
		} else if (this.atQueueEnd) {
			this.scene.animationOn();
			this.seeking = null;
		} else {
			this.scene.animationOff();
			this.nextStep();
		}
	}
	stopSeeking() {
		this.seeking = null;
		this.scene.animationOn();
		this.subscription?.(this.paused ? 'paused' : 'playing');
	}
	shouldStep() {
		if (this.atQueueEnd) return false;
		if (this.seeking !== null) return true;
		return !(this.paused && this.turn >= 0);
	}
	nextStep() {
		if (!this.shouldStep()) return;

		let time = Date.now();
		this.scene.startAnimations();
		let animations = undefined;

		let interruptionCount: number;
		do {
			this.waitForAnimations = true;
			if (this.currentStep >= this.stepQueue.length) {
				this.atQueueEnd = true;
				if (!this.ended && this.isReplay) this.prematureEnd();
				this.stopSeeking();
				if (this.ended) {
					this.scene.updateBgm();
				}
				this.subscription?.('atqueueend');
				return;
			}

			this.run(this.stepQueue[this.currentStep]);
			this.currentStep++;
			if (this.waitForAnimations === true) {
				animations = this.scene.finishAnimations();
			} else if (this.waitForAnimations === 'simult') {
				this.scene.timeOffset = 0;
			}

			if (Date.now() - time > 300) {
				interruptionCount = this.scene.interruptionCount;
				setTimeout(() => {
					if (interruptionCount === this.scene.interruptionCount) {
						this.nextStep();
					}
				}, 1);
				return;
			}
		} while (!animations && this.shouldStep());

		if (this.paused && this.turn >= 0 && this.seeking === null) {
			// initial Play button, team preview
			this.scene.pause();
			return;
		}

		if (!animations) return;

		interruptionCount = this.scene.interruptionCount;
		animations.done(() => {
			if (interruptionCount === this.scene.interruptionCount) {
				this.nextStep();
			}
		});
	}

	setQueue(queue: string[]) {
		this.stepQueue = queue;
		this.resetStep();
	}

	setMute(mute: boolean) {
		this.scene.setMute(mute);
	}
}

if (typeof require === 'function') {
	// in Node
	(global as any).Battle = Battle;
	(global as any).Pokemon = Pokemon;
}
