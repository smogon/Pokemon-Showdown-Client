/**
 * Pokemon Showdown Tooltips
 *
 * A file for generating tooltips for battles. This should be IE7+ and
 * use the DOM directly.
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

class ModifiableValue {
	value = 0;
	maxValue = 0;
	comment: string[];
	battle: Battle;
	pokemon: Pokemon;
	serverPokemon: ServerPokemon;
	itemName: string;
	abilityName: string;
	weatherName: string;
	isAccuracy = false;
	constructor(battle: Battle, pokemon: Pokemon, serverPokemon: ServerPokemon) {
		this.comment = [];
		this.battle = battle;
		this.pokemon = pokemon;
		this.serverPokemon = serverPokemon;

		this.itemName = this.battle.dex.items.get(serverPokemon.item).name;
		const ability = serverPokemon.ability || pokemon?.ability || serverPokemon.baseAbility;
		this.abilityName = this.battle.dex.abilities.get(ability).name;
		this.weatherName = battle.weather === 'snow' ? 'Snow' : this.battle.dex.moves.get(battle.weather).exists ?
			this.battle.dex.moves.get(battle.weather).name : this.battle.dex.abilities.get(battle.weather).name;
	}
	reset(value = 0, isAccuracy?: boolean) {
		this.value = value;
		this.maxValue = 0;
		this.isAccuracy = !!isAccuracy;
		this.comment = [];
	}
	tryItem(itemName: string) {
		if (itemName !== this.itemName) return false;
		if (this.battle.hasPseudoWeather('Magic Room')) {
			this.comment.push(` (${itemName} suppressed by Magic Room)`);
			return false;
		}
		if (this.pokemon?.volatiles['embargo']) {
			this.comment.push(` (${itemName} suppressed by Embargo)`);
			return false;
		}
		const ignoreKlutz = [
			"Macho Brace", "Power Anklet", "Power Band", "Power Belt", "Power Bracer", "Power Lens", "Power Weight",
		];
		if (this.tryAbility('Klutz') && !ignoreKlutz.includes(itemName)) {
			this.comment.push(` (${itemName} suppressed by Klutz)`);
			return false;
		}
		return true;
	}
	tryAbility(abilityName: string) {
		if (abilityName !== this.abilityName) return false;
		if (this.pokemon?.volatiles['gastroacid']) {
			this.comment.push(` (${abilityName} suppressed by Gastro Acid)`);
			return false;
		}
		// Check for Neutralizing Gas
		if (!this.pokemon?.effectiveAbility(this.serverPokemon)) return false;
		return true;
	}
	tryWeather(weatherName?: string) {
		if (!this.weatherName) return false;
		if (!weatherName) weatherName = this.weatherName;
		else if (weatherName !== this.weatherName) return false;
		for (const side of this.battle.sides) {
			for (const active of side.active) {
				if (active && ['Air Lock', 'Cloud Nine'].includes(active.ability)) {
					this.comment.push(` (${weatherName} suppressed by ${active.ability})`);
					return false;
				}
			}
		}
		return true;
	}
	itemModify(factor: number, itemName?: string) {
		if (!itemName) itemName = this.itemName;
		if (!itemName) return false;
		if (!this.tryItem(itemName)) return false;
		return this.modify(factor, itemName);
	}
	abilityModify(factor: number, abilityName: string) {
		if (!this.tryAbility(abilityName)) return false;
		return this.modify(factor, abilityName);
	}
	weatherModify(factor: number, weatherName?: string, name?: string) {
		if (!weatherName) weatherName = this.weatherName;
		if (!weatherName) return false;
		if (!this.tryWeather(weatherName)) return false;
		return this.modify(factor, name || weatherName);
	}
	modify(factor: number, name?: string) {
		if (factor === 0) {
			if (name) this.comment.push(` (${name})`);
			this.value = 0;
			this.maxValue = 0;
			return true;
		}
		if (name) this.comment.push(` (${this.round(factor)}&times; from ${name})`);
		this.value *= factor;
		if (!(name === 'Technician' && this.maxValue > 60)) this.maxValue *= factor;
		if (this.battle.tier.includes('Super Staff Bros') &&
			!(name === 'Confirmed Town' && this.maxValue > 60)) this.maxValue *= factor;
		return true;
	}
	set(value: number, reason?: string) {
		if (reason) this.comment.push(` (${reason})`);
		this.value = value;
		this.maxValue = 0;
		return true;
	}
	setRange(value: number, maxValue: number, reason?: string) {
		if (reason) this.comment.push(` (${reason})`);
		this.value = value;
		this.maxValue = maxValue;
		return true;
	}
	round(value: number) {
		return value ? Number(value.toFixed(2)) : 0;
	}
	toString() {
		let valueString;
		if (this.isAccuracy) {
			valueString = this.value ? `${this.round(this.value)}%` : `can't miss`;
		} else {
			valueString = this.value ? `${this.round(this.value)}` : ``;
		}
		if (this.maxValue) {
			valueString += ` to ${this.round(this.maxValue)}` + (this.isAccuracy ? '%' : '');
		}
		return valueString + this.comment.join('');
	}
}

class BattleTooltips {
	battle: Battle;

	constructor(battle: Battle) {
		this.battle = battle;
	}

	// tooltips
	// Touch delay, pressing finger more than that time will cause the tooltip to open.
	// Shorter time will cause the button to click
	static LONG_TAP_DELAY = 350; // ms
	static longTapTimeout = 0;
	static elem: HTMLDivElement | null = null;
	static parentElem: HTMLElement | null = null;
	static isLocked = false;
	static isPressed = false;

	static hideTooltip() {
		if (!BattleTooltips.elem) return;
		BattleTooltips.cancelLongTap();
		BattleTooltips.elem.parentNode!.removeChild(BattleTooltips.elem);
		BattleTooltips.elem = null;
		BattleTooltips.parentElem = null;
		BattleTooltips.isLocked = false;
		$('#tooltipwrapper').removeClass('tooltip-locked');
	}

	static cancelLongTap() {
		if (BattleTooltips.longTapTimeout) {
			clearTimeout(BattleTooltips.longTapTimeout);
			BattleTooltips.longTapTimeout = 0;
		}
	}

	lockTooltip() {
		if (BattleTooltips.elem && !BattleTooltips.isLocked) {
			BattleTooltips.isLocked = true;
			if (BattleTooltips.isPressed) {
				$(BattleTooltips.parentElem!).removeClass('pressed');
				BattleTooltips.isPressed = false;
			}
			$('#tooltipwrapper').addClass('tooltip-locked');
		}
	}

	handleTouchEnd(e: TouchEvent) {
		BattleTooltips.cancelLongTap();

		if (!BattleTooltips.isLocked) BattleTooltips.hideTooltip();
	}

	listen(elem: HTMLElement | JQuery<HTMLElement>) {
		const $elem = $(elem);
		$elem.on('mouseover', '.has-tooltip', this.showTooltipEvent);
		$elem.on('click', '.has-tooltip', this.clickTooltipEvent);
		$elem.on('focus', '.has-tooltip', this.showTooltipEvent);
		$elem.on('mouseout', '.has-tooltip', BattleTooltips.unshowTooltip);
		$elem.on('mousedown', '.has-tooltip', this.holdLockTooltipEvent);
		$elem.on('blur', '.has-tooltip', BattleTooltips.unshowTooltip);
		$elem.on('mouseup', '.has-tooltip', BattleTooltips.unshowTooltip);

		$elem.on('touchstart', '.has-tooltip', e => {
			e.preventDefault();
			this.holdLockTooltipEvent(e);
			if (!BattleTooltips.parentElem) {
				// should never happen, but in case there's a bug in the tooltip handler
				BattleTooltips.parentElem = e.currentTarget;
			}
			$(BattleTooltips.parentElem!).addClass('pressed');
			BattleTooltips.isPressed = true;
		});
		$elem.on('touchend', '.has-tooltip', e => {
			e.preventDefault();
			if (e.currentTarget === BattleTooltips.parentElem && BattleTooltips.isPressed) {
				BattleTooltips.parentElem!.click();
			}
			BattleTooltips.unshowTooltip();
		});
		$elem.on('touchleave', '.has-tooltip', BattleTooltips.unshowTooltip);
		$elem.on('touchcancel', '.has-tooltip', BattleTooltips.unshowTooltip);
	}

	clickTooltipEvent = (e: Event) => {
		if (BattleTooltips.isLocked) {
			e.preventDefault();
			e.stopImmediatePropagation();
		}
	};
	/**
	 * An event that will lock a tooltip if held down
	 *
	 * (Namely, a long-tap or long-click)
	 */
	holdLockTooltipEvent = (e: JQuery.TriggeredEvent) => {
		if (BattleTooltips.isLocked) BattleTooltips.hideTooltip();
		const target = e.currentTarget as HTMLElement;
		this.showTooltip(target);
		let factor = (e.type === 'mousedown' && target.tagName === 'BUTTON' ? 2 : 1);

		BattleTooltips.longTapTimeout = setTimeout(() => {
			BattleTooltips.longTapTimeout = 0;
			this.lockTooltip();
		}, BattleTooltips.LONG_TAP_DELAY * factor);
	};

	showTooltipEvent = (e: Event) => {
		if (BattleTooltips.isLocked) return;
		this.showTooltip(e.currentTarget as HTMLElement);
	};

	/**
	 * Only hides tooltips if they're not locked
	 */
	static unshowTooltip() {
		if (BattleTooltips.isLocked) return;
		if (BattleTooltips.isPressed) {
			$(BattleTooltips.parentElem!).removeClass('pressed');
			BattleTooltips.isPressed = false;
		}
		BattleTooltips.hideTooltip();
	}

	showTooltip(elem: HTMLElement) {
		const args = (elem.dataset.tooltip || '').split('|');
		const [type] = args;
		/**
		 * If false, we instead attach the tooltip above the parent element.
		 * This is important for the move/switch menus so the tooltip doesn't
		 * cover up buttons above the hovered button.
		 */
		let ownHeight = !!elem.dataset.ownheight;

		let buf: string;
		switch (type) {
		case 'move':
		case 'zmove':
		case 'maxmove': { // move|MOVE|ACTIVEPOKEMON|[GMAXMOVE]
			let move = this.battle.dex.moves.get(args[1]);
			let teamIndex = parseInt(args[2], 10);
			let pokemon = this.battle.nearSide.active[
				teamIndex + this.battle.pokemonControlled * Math.floor(this.battle.mySide.n / 2)
			];
			let gmaxMove = args[3] ? this.battle.dex.moves.get(args[3]) : undefined;
			if (!pokemon) return false;
			let serverPokemon = this.battle.myPokemon![teamIndex];
			buf = this.showMoveTooltip(move, type, pokemon, serverPokemon, gmaxMove);
			break;
		}

		case 'pokemon': { // pokemon|SIDE|POKEMON
			// mouse over sidebar pokemon
			// pokemon definitely exists, serverPokemon always ignored
			let sideIndex = parseInt(args[1], 10);
			let side = this.battle.sides[sideIndex];
			let pokemon = side.pokemon[parseInt(args[2], 10)];
			if (args[3] === 'illusion') {
				buf = '';
				const species = pokemon.getBaseSpecies().baseSpecies;
				let index = 1;
				for (const otherPokemon of side.pokemon) {
					if (otherPokemon.getBaseSpecies().baseSpecies === species) {
						buf += this.showPokemonTooltip(otherPokemon, null, false, index);
						index++;
					}
				}
			} else {
				buf = this.showPokemonTooltip(pokemon);
			}
			break;
		}
		case 'activepokemon': { // activepokemon|SIDE|ACTIVE
			// mouse over active pokemon
			// pokemon definitely exists, serverPokemon maybe
			let sideIndex = parseInt(args[1], 10);
			let side = this.battle.sides[+this.battle.viewpointSwitched ^ sideIndex];
			let activeIndex = parseInt(args[2], 10);
			let pokemonIndex = activeIndex;
			if (activeIndex >= 1 && this.battle.sides.length > 2) {
				pokemonIndex -= 1;
				side = this.battle.sides[side.n + 2];
			}
			let pokemon = side.active[activeIndex];
			let serverPokemon = null;
			if (side === this.battle.mySide && this.battle.myPokemon) {
				serverPokemon = this.battle.myPokemon[pokemonIndex];
			}
			if (side === this.battle.mySide.ally && this.battle.myAllyPokemon) {
				serverPokemon = this.battle.myAllyPokemon[pokemonIndex];
			}
			if (!pokemon) return false;
			buf = this.showPokemonTooltip(pokemon, serverPokemon, true);
			break;
		}
		case 'switchpokemon': { // switchpokemon|POKEMON
			// mouse over switchable pokemon
			// serverPokemon definitely exists, sidePokemon maybe
			// let side = this.battle.mySide;
			let activeIndex = parseInt(args[1], 10);
			let pokemon = null;
			/* if (activeIndex < side.active.length && activeIndex < this.battle.pokemonControlled) {
				pokemon = side.active[activeIndex];
				if (pokemon && pokemon.side === side.ally) pokemon = null;
			} */
			let serverPokemon = this.battle.myPokemon![activeIndex];
			buf = this.showPokemonTooltip(pokemon, serverPokemon);
			break;
		}
		case 'allypokemon': { // allypokemon|POKEMON
			// mouse over ally's pokemon in multi battles
			// serverPokemon definitely exists, sidePokemon maybe
			// let side = this.battle.mySide.ally;
			let activeIndex = parseInt(args[1], 10);
			let pokemon = null;
			/*if (activeIndex < side.pokemon.length) {
				pokemon = side.pokemon[activeIndex] || side.ally ? side.ally.pokemon[activeIndex] : null;
			}*/
			let serverPokemon = this.battle.myAllyPokemon ? this.battle.myAllyPokemon[activeIndex] : null;
			buf = this.showPokemonTooltip(pokemon, serverPokemon);
			break;
		}
		case 'field': {
			buf = this.showFieldTooltip();
			break;
		}
		default:
			// "throws" an error without crashing
			Promise.resolve(new Error(`unrecognized type`));
			buf = `<p class="message-error" style="white-space: pre-wrap">${new Error(`unrecognized type`).stack}</p>`;
		}

		this.placeTooltip(buf, elem, ownHeight, type);
		return true;
	}

	placeTooltip(innerHTML: string, hoveredElem?: HTMLElement, notRelativeToParent?: boolean, type?: string) {
		let $elem;
		if (hoveredElem) {
			$elem = $(hoveredElem);
		} else {
			$elem = (this.battle.scene as BattleScene).$turn;
			notRelativeToParent = true;
		}

		let hoveredX1 = $elem.offset()!.left;

		if (!notRelativeToParent) {
			$elem = $elem.parent();
		}

		let hoveredY1 = $elem.offset()!.top;
		let hoveredY2 = hoveredY1 + $elem.outerHeight()!;

		// (x, y) are the left and top offsets of #tooltipwrapper, which mark the
		// BOTTOM LEFT CORNER of the tooltip

		let x = Math.max(hoveredX1 - 2, 0);
		let y = Math.max(hoveredY1 - 5, 0);

		let $wrapper = $('#tooltipwrapper');
		if (!$wrapper.length) {
			$wrapper = $(`<div id="tooltipwrapper" role="tooltip"></div>`);
			$(document.body).append($wrapper);
			$wrapper.on('click', e => {
				try {
					const selection = window.getSelection()!;
					if (selection.type === 'Range') return;
				} catch (err) {}
				BattleTooltips.hideTooltip();
			});
		} else {
			$wrapper.removeClass('tooltip-locked');
		}
		$wrapper.css({
			left: x,
			top: y,
		});
		innerHTML = `<div class="tooltipinner"><div class="tooltip tooltip-${type}">${innerHTML}</div></div>`;
		$wrapper.html(innerHTML).appendTo(document.body);
		BattleTooltips.elem = $wrapper.find('.tooltip')[0] as HTMLDivElement;
		BattleTooltips.isLocked = false;

		let height = $(BattleTooltips.elem).outerHeight()!;
		if (y - height < 1) {
			// tooltip is too tall to fit above the element:
			// try to fit it below it instead
			y = hoveredY2 + height + 5;
			if (y > document.documentElement.clientHeight) {
				// tooltip is also too tall to fit below the element:
				// just place it at the top of the screen
				y = height + 1;
			}
			$wrapper.css('top', y);
		} else if (y < 75) {
			// tooltip is pretty high up, put it below the element if it fits
			y = hoveredY2 + height + 5;
			if (y < document.documentElement.clientHeight) {
				// it fits
				$wrapper.css('top', y);
			}
		}

		let width = $(BattleTooltips.elem).outerWidth()!;
		if (x > document.documentElement.clientWidth - width - 2) {
			x = document.documentElement.clientWidth - width - 2;
			$wrapper.css('left', x);
		}

		BattleTooltips.parentElem = hoveredElem || null;
		return true;
	}

	hideTooltip() {
		BattleTooltips.hideTooltip();
	}

	static zMoveEffects: {[zEffect: string]: string} = {
		'clearnegativeboost': "Restores negative stat stages to 0",
		'crit2': "Crit ratio +2",
		'heal': "Restores HP 100%",
		'curse': "Restores HP 100% if user is Ghost type, otherwise Attack +1",
		'redirect': "Redirects opposing attacks to user",
		'healreplacement': "Restores replacement's HP 100%",
	};

	getStatusZMoveEffect(move: Move) {
		if (move.zMove!.effect! in BattleTooltips.zMoveEffects) {
			return BattleTooltips.zMoveEffects[move.zMove!.effect!];
		}
		let boostText = '';
		if (move.zMove!.boost) {
			let boosts = Object.keys(move.zMove!.boost) as StatName[];
			boostText = boosts.map(stat =>
				BattleTextParser.stat(stat) + ' +' + move.zMove!.boost![stat]
			).join(', ');
		}
		return boostText;
	}

	static zMoveTable: {[type in TypeName]: string} = {
		Poison: "Acid Downpour",
		Fighting: "All-Out Pummeling",
		Dark: "Black Hole Eclipse",
		Grass: "Bloom Doom",
		Normal: "Breakneck Blitz",
		Rock: "Continental Crush",
		Steel: "Corkscrew Crash",
		Dragon: "Devastating Drake",
		Electric: "Gigavolt Havoc",
		Water: "Hydro Vortex",
		Fire: "Inferno Overdrive",
		Ghost: "Never-Ending Nightmare",
		Bug: "Savage Spin-Out",
		Psychic: "Shattered Psyche",
		Ice: "Subzero Slammer",
		Flying: "Supersonic Skystrike",
		Ground: "Tectonic Rage",
		Fairy: "Twinkle Tackle",
		Stellar: "",
		"???": "",
	};

	static maxMoveTable: {[type in TypeName]: string} = {
		Poison: "Max Ooze",
		Fighting: "Max Knuckle",
		Dark: "Max Darkness",
		Grass: "Max Overgrowth",
		Normal: "Max Strike",
		Rock: "Max Rockfall",
		Steel: "Max Steelspike",
		Dragon: "Max Wyrmwind",
		Electric: "Max Lightning",
		Water: "Max Geyser",
		Fire: "Max Flare",
		Ghost: "Max Phantasm",
		Bug: "Max Flutterby",
		Psychic: "Max Mindstorm",
		Ice: "Max Hailstorm",
		Flying: "Max Airstream",
		Ground: "Max Quake",
		Fairy: "Max Starfall",
		Stellar: "",
		"???": "",
	};

	getMaxMoveFromType(type: TypeName, gmaxMove?: string | Move) {
		if (gmaxMove) {
			if (typeof gmaxMove === 'string') gmaxMove = this.battle.dex.moves.get(gmaxMove);
			if (type === gmaxMove.type) return gmaxMove;
		}
		return this.battle.dex.moves.get(BattleTooltips.maxMoveTable[type]);
	}

	showMoveTooltip(move: Move, isZOrMax: string, pokemon: Pokemon, serverPokemon: ServerPokemon, gmaxMove?: Move) {
		let text = '';

		let zEffect = '';
		let foeActive = pokemon.side.foe.active;
		if (this.battle.gameType === 'freeforall') {
			foeActive = [...foeActive, ...pokemon.side.active].filter(active => active !== pokemon);
		}
		// TODO: move this somewhere it makes more sense
		if (pokemon.ability === '(suppressed)') serverPokemon.ability = '(suppressed)';
		let ability = toID(serverPokemon.ability || pokemon.ability || serverPokemon.baseAbility);
		let item = this.battle.dex.items.get(serverPokemon.item);

		let value = new ModifiableValue(this.battle, pokemon, serverPokemon);
		let [moveType, category] = this.getMoveType(move, value, gmaxMove || isZOrMax === 'maxmove');
		let categoryDiff = move.category !== category;

		if (isZOrMax === 'zmove') {
			if (item.zMoveFrom === move.name) {
				move = this.battle.dex.moves.get(item.zMove as string);
			} else if (move.category === 'Status') {
				move = new Move(move.id, "", {
					...move,
					name: 'Z-' + move.name,
				});
				zEffect = this.getStatusZMoveEffect(move);
			} else {
				let moveName = BattleTooltips.zMoveTable[item.zMoveType as TypeName];
				let zMove = this.battle.dex.moves.get(moveName);
				let movePower = move.zMove!.basePower;
				// the different Hidden Power types don't have a Z power set, fall back on base move
				if (!movePower && move.id.startsWith('hiddenpower')) {
					movePower = this.battle.dex.moves.get('hiddenpower').zMove!.basePower;
				}
				if (move.id === 'weatherball') {
					switch (this.battle.weather) {
					case 'sunnyday':
					case 'desolateland':
						zMove = this.battle.dex.moves.get(BattleTooltips.zMoveTable['Fire']);
						break;
					case 'raindance':
					case 'primordialsea':
						zMove = this.battle.dex.moves.get(BattleTooltips.zMoveTable['Water']);
						break;
					case 'sandstorm':
						zMove = this.battle.dex.moves.get(BattleTooltips.zMoveTable['Rock']);
						break;
					case 'hail':
					case 'snow':
						zMove = this.battle.dex.moves.get(BattleTooltips.zMoveTable['Ice']);
						break;
					}
				}
				move = new Move(zMove.id, zMove.name, {
					...zMove,
					category: move.category,
					basePower: movePower,
				});
				categoryDiff = false;
			}
		} else if (isZOrMax === 'maxmove') {
			if (move.category === 'Status') {
				move = this.battle.dex.moves.get('Max Guard');
			} else {
				let maxMove = this.getMaxMoveFromType(moveType, gmaxMove);
				const basePower = ['gmaxdrumsolo', 'gmaxfireball', 'gmaxhydrosnipe'].includes(maxMove.id) ?
					maxMove.basePower : move.maxMove.basePower;
				move = new Move(maxMove.id, maxMove.name, {
					...maxMove,
					category: move.category,
					basePower,
				});
				categoryDiff = false;
			}
		}

		if (categoryDiff) {
			move = new Move(move.id, move.name, {
				...move,
				category,
			});
		}

		text += '<h2>' + move.name + '<br />';

		text += Dex.getTypeIcon(moveType);
		text += ` ${Dex.getCategoryIcon(category)}</h2>`;

		// Check if there are more than one active Pokémon to check for multiple possible BPs.
		let showingMultipleBasePowers = false;
		if (category !== 'Status' && foeActive.length > 1) {
			// We check if there is a difference in base powers to note it.
			// Otherwise, it is just shown as in singles.
			// The trick is that we need to calculate it first for each Pokémon to see if it changes.
			let prevBasePower: string | null = null;
			let basePower: string = '';
			let difference = false;
			let basePowers = [];
			for (const active of foeActive) {
				if (!active) continue;
				value = this.getMoveBasePower(move, moveType, value, active);
				basePower = '' + value;
				if (prevBasePower === null) prevBasePower = basePower;
				if (prevBasePower !== basePower) difference = true;
				basePowers.push('Base power vs ' + active.name + ': ' + basePower);
			}
			if (difference) {
				text += '<p>' + basePowers.join('<br />') + '</p>';
				showingMultipleBasePowers = true;
			}
			// Falls through to not to repeat code on showing the base power.
		}
		if (!showingMultipleBasePowers && category !== 'Status') {
			let activeTarget = foeActive[0] || foeActive[1] || foeActive[2];
			value = this.getMoveBasePower(move, moveType, value, activeTarget);
			text += '<p>Base power: ' + value + '</p>';
		}

		let accuracy = this.getMoveAccuracy(move, value);

		// Deal with Nature Power special case, indicating which move it calls.
		if (move.id === 'naturepower') {
			let calls;
			if (this.battle.gen > 5) {
				if (this.battle.hasPseudoWeather('Electric Terrain')) {
					calls = 'Thunderbolt';
				} else if (this.battle.hasPseudoWeather('Grassy Terrain')) {
					calls = 'Energy Ball';
				} else if (this.battle.hasPseudoWeather('Misty Terrain')) {
					calls = 'Moonblast';
				} else if (this.battle.hasPseudoWeather('Psychic Terrain')) {
					calls = 'Psychic';
				} else {
					calls = 'Tri Attack';
				}
			} else if (this.battle.gen > 3) {
				// In gens 4 and 5 it calls Earthquake.
				calls = 'Earthquake';
			} else {
				// In gen 3 it calls Swift, so it retains its normal typing.
				calls = 'Swift';
			}
			let calledMove = this.battle.dex.moves.get(calls);
			text += 'Calls ' + Dex.getTypeIcon(this.getMoveType(calledMove, value)[0]) + ' ' + calledMove.name;
		}

		text += '<p>Accuracy: ' + accuracy + '</p>';
		if (zEffect) text += '<p>Z-Effect: ' + zEffect + '</p>';

		if (this.battle.hardcoreMode) {
			text += '<p class="tooltip-section">' + move.shortDesc + '</p>';
		} else {
			text += '<p class="tooltip-section">';
			if (move.priority > 1) {
				text += 'Nearly always moves first <em>(priority +' + move.priority + ')</em>.</p><p>';
			} else if (move.priority <= -1) {
				text += 'Nearly always moves last <em>(priority &minus;' + (-move.priority) + ')</em>.</p><p>';
			} else if (move.priority === 1) {
				text += 'Usually moves first <em>(priority +' + move.priority + ')</em>.</p><p>';
			} else {
				if (move.id === 'grassyglide' && this.battle.hasPseudoWeather('Grassy Terrain')) {
					text += 'Usually moves first <em>(priority +1)</em>.</p><p>';
				}
			}

			text += '' + (move.desc || move.shortDesc || '') + '</p>';

			if (this.battle.gameType === 'doubles' || this.battle.gameType === 'multi') {
				if (move.target === 'allAdjacent') {
					text += '<p>&#x25ce; Hits both foes and ally.</p>';
				} else if (move.target === 'allAdjacentFoes') {
					text += '<p>&#x25ce; Hits both foes.</p>';
				}
			} else if (this.battle.gameType === 'triples') {
				if (move.target === 'allAdjacent') {
					text += '<p>&#x25ce; Hits adjacent foes and allies.</p>';
				} else if (move.target === 'allAdjacentFoes') {
					text += '<p>&#x25ce; Hits adjacent foes.</p>';
				} else if (move.target === 'any') {
					text += '<p>&#x25ce; Can target distant Pok&eacute;mon in Triples.</p>';
				}
			} else if (this.battle.gameType === 'freeforall') {
				if (move.target === 'allAdjacent' || move.target === 'allAdjacentFoes') {
					text += '<p>&#x25ce; Hits all foes.</p>';
				} else if (move.target === 'adjacentAlly') {
					text += '<p>&#x25ce; Can target any foe in Free-For-All.</p>';
				}
			}

			if (move.flags.defrost) {
				text += `<p class="movetag">The user thaws out if it is frozen.</p>`;
			}
			if (!move.flags.protect && !['self', 'allySide'].includes(move.target)) {
				text += `<p class="movetag">Not blocked by Protect <small>(and Detect, King's Shield, Spiky Shield)</small></p>`;
			}
			if (move.flags.bypasssub) {
				text += `<p class="movetag">Bypasses Substitute <small>(but does not break it)</small></p>`;
			}
			if (!move.flags.reflectable && !['self', 'allySide'].includes(move.target) && move.category === 'Status') {
				text += `<p class="movetag">&#x2713; Not bounceable <small>(can't be bounced by Magic Coat/Bounce)</small></p>`;
			}

			if (move.flags.contact) {
				text += `<p class="movetag">&#x2713; Contact <small>(triggers Iron Barbs, Spiky Shield, etc)</small></p>`;
			}
			if (move.flags.sound) {
				text += `<p class="movetag">&#x2713; Sound <small>(doesn't affect Soundproof pokemon)</small></p>`;
			}
			if (move.flags.powder && this.battle.gen > 5) {
				text += `<p class="movetag">&#x2713; Powder <small>(doesn't affect Grass, Overcoat, Safety Goggles)</small></p>`;
			}
			if (move.flags.punch && ability === 'ironfist') {
				text += `<p class="movetag">&#x2713; Fist <small>(boosted by Iron Fist)</small></p>`;
			}
			if (move.flags.pulse && ability === 'megalauncher') {
				text += `<p class="movetag">&#x2713; Pulse <small>(boosted by Mega Launcher)</small></p>`;
			}
			if (move.flags.bite && ability === 'strongjaw') {
				text += `<p class="movetag">&#x2713; Bite <small>(boosted by Strong Jaw)</small></p>`;
			}
			if ((move.recoil || move.hasCrashDamage) && ability === 'reckless') {
				text += `<p class="movetag">&#x2713; Recoil <small>(boosted by Reckless)</small></p>`;
			}
			if (move.flags.bullet) {
				text += `<p class="movetag">&#x2713; Bullet-like <small>(doesn't affect Bulletproof pokemon)</small></p>`;
			}
			if (move.flags.slicing) {
				text += `<p class="movetag">&#x2713; Slicing <small>(boosted by Sharpness)</small></p>`;
			}
			if (move.flags.wind) {
				text += `<p class="movetag">&#x2713; Wind <small>(activates Wind Power and Wind Rider)</small></p>`;
			}
		}
		return text;
	}

	/**
	 * Needs either a Pokemon or a ServerPokemon, but note that neither
	 * are guaranteed: If you hover over a possible switch-in that's
	 * never been switched in before, you'll only have a ServerPokemon,
	 * and if you hover over an opponent's pokemon, you'll only have a
	 * Pokemon.
	 *
	 * isActive is true if hovering over a pokemon in the battlefield,
	 * and false if hovering over a pokemon in the Switch menu.
	 *
	 * @param clientPokemon
	 * @param serverPokemon
	 * @param isActive
	 */
	showPokemonTooltip(
		clientPokemon: Pokemon | null, serverPokemon?: ServerPokemon | null, isActive?: boolean, illusionIndex?: number
	) {
		const pokemon = clientPokemon || serverPokemon!;
		let text = '';
		let genderBuf = '';
		const gender = pokemon.gender;
		if (gender === 'M' || gender === 'F') {
			genderBuf = ` <img src="${Dex.fxPrefix}gender-${gender.toLowerCase()}.png" alt="${gender}" width="7" height="10" class="pixelated" /> `;
		}

		let name = BattleLog.escapeHTML(pokemon.name);
		if (pokemon.speciesForme !== pokemon.name) {
			name += ' <small>(' + BattleLog.escapeHTML(pokemon.speciesForme) + ')</small>';
		}

		let levelBuf = (pokemon.level !== 100 ? ` <small>L${pokemon.level}</small>` : ``);
		if (!illusionIndex || illusionIndex === 1) {
			text += `<h2>${name}${genderBuf}${illusionIndex ? '' : levelBuf}<br />`;

			if (clientPokemon?.volatiles.formechange) {
				if (clientPokemon.volatiles.transform) {
					text += `<small>(Transformed into ${clientPokemon.volatiles.formechange[1]})</small><br />`;
				} else {
					text += `<small>(Changed forme: ${clientPokemon.volatiles.formechange[1]})</small><br />`;
				}
			}

			let types = serverPokemon?.terastallized ? [serverPokemon.teraType] : this.getPokemonTypes(pokemon);
			let knownPokemon = serverPokemon || clientPokemon!;

			if (pokemon.terastallized) {
				text += `<small>(Terastallized)</small><br />`;
			} else if (clientPokemon?.volatiles.typechange || clientPokemon?.volatiles.typeadd) {
				text += `<small>(Type changed)</small><br />`;
			}
			text += `<span class="textaligned-typeicons">${types.map(type => Dex.getTypeIcon(type)).join(' ')}</span>`;
			if (pokemon.terastallized) {
				text += `&nbsp; &nbsp; <small>(base: <span class="textaligned-typeicons">${this.getPokemonTypes(pokemon, true).map(type => Dex.getTypeIcon(type)).join(' ')}</span>)</small>`;
			} else if (knownPokemon.teraType && !this.battle.rules['Terastal Clause']) {
				text += `&nbsp; &nbsp; <small>(Tera Type: <span class="textaligned-typeicons">${Dex.getTypeIcon(knownPokemon.teraType)}</span>)</small>`;
			}
			text += `</h2>`;
		}

		if (illusionIndex) {
			text += `<p class="tooltip-section"><strong>Possible Illusion #${illusionIndex}</strong>${levelBuf}</p>`;
		}

		if (pokemon.fainted) {
			text += '<p><small>HP:</small> (fainted)</p>';
		} else if (this.battle.hardcoreMode) {
			if (serverPokemon) {
				text += '<p><small>HP:</small> ' + serverPokemon.hp + '/' + serverPokemon.maxhp + (pokemon.status ? ' <span class="status ' + pokemon.status + '">' + pokemon.status.toUpperCase() + '</span>' : '') + '</p>';
			}
		} else {
			let exacthp = '';
			if (serverPokemon) {
				exacthp = ' (' + serverPokemon.hp + '/' + serverPokemon.maxhp + ')';
			} else if (pokemon.maxhp === 48) {
				exacthp = ' <small>(' + pokemon.hp + '/' + pokemon.maxhp + ' pixels)</small>';
			}
			text += '<p><small>HP:</small> ' + Pokemon.getHPText(pokemon, this.battle.reportExactHP) + exacthp + (pokemon.status ? ' <span class="status ' + pokemon.status + '">' + pokemon.status.toUpperCase() + '</span>' : '');
			if (clientPokemon) {
				if (pokemon.status === 'tox') {
					if (pokemon.ability === 'Poison Heal' || pokemon.ability === 'Magic Guard') {
						text += ' <small>Would take if ability removed: ' + Math.floor(100 / 16 * Math.min(clientPokemon.statusData.toxicTurns + 1, 15)) + '%</small>';
					} else {
						text += ' Next damage: ' + Math.floor(100 / (clientPokemon.volatiles['dynamax'] ? 32 : 16) * Math.min(clientPokemon.statusData.toxicTurns + 1, 15)) + '%';
					}
				} else if (pokemon.status === 'slp') {
					text += ' Turns asleep: ' + clientPokemon.statusData.sleepTurns;
				}
			}
			text += '</p>';
		}

		const supportsAbilities = this.battle.gen > 2 && !this.battle.tier.includes("Let's Go");

		let abilityText = '';
		if (supportsAbilities) {
			abilityText = this.getPokemonAbilityText(
				clientPokemon, serverPokemon, isActive, !!illusionIndex && illusionIndex > 1
			);
		}

		let itemText = '';
		if (serverPokemon) {
			let item = '';
			let itemEffect = '';
			if (clientPokemon?.prevItem) {
				item = 'None';
				let prevItem = this.battle.dex.items.get(clientPokemon.prevItem).name;
				itemEffect += clientPokemon.prevItemEffect ? prevItem + ' was ' + clientPokemon.prevItemEffect : 'was ' + prevItem;
			}
			if (serverPokemon.item) item = this.battle.dex.items.get(serverPokemon.item).name;
			if (itemEffect) itemEffect = ' (' + itemEffect + ')';
			if (item) itemText = '<small>Item:</small> ' + item + itemEffect;
		} else if (clientPokemon) {
			let item = '';
			let itemEffect = clientPokemon.itemEffect || '';
			if (clientPokemon.prevItem) {
				item = 'None';
				if (itemEffect) itemEffect += '; ';
				let prevItem = this.battle.dex.items.get(clientPokemon.prevItem).name;
				itemEffect += clientPokemon.prevItemEffect ? prevItem + ' was ' + clientPokemon.prevItemEffect : 'was ' + prevItem;
			}
			if (pokemon.item) item = this.battle.dex.items.get(pokemon.item).name;
			if (itemEffect) itemEffect = ' (' + itemEffect + ')';
			if (item) itemText = '<small>Item:</small> ' + item + itemEffect;
		}

		if (abilityText || itemText) {
			text += '<p>';
			text += abilityText;
			if (abilityText && itemText) {
				// ability/item on one line for your own switch tooltips, two lines everywhere else
				text += (!isActive && serverPokemon ? ' / ' : '</p><p>');
			}
			text += itemText;
			text += '</p>';
		}

		text += this.renderStats(clientPokemon, serverPokemon, !isActive);

		if (serverPokemon && !isActive) {
			// move list
			text += `<p class="tooltip-section">`;
			const battlePokemon = clientPokemon || this.battle.findCorrespondingPokemon(pokemon);
			for (const moveid of serverPokemon.moves) {
				const move = this.battle.dex.moves.get(moveid);
				let moveName = `&#8226; ${move.name}`;
				if (battlePokemon?.moveTrack) {
					for (const row of battlePokemon.moveTrack) {
						if (moveName === row[0]) {
							moveName = this.getPPUseText(row, true);
							break;
						}
					}
				}
				text += `${moveName}<br />`;
			}
			text += '</p>';
		} else if (!this.battle.hardcoreMode && clientPokemon?.moveTrack.length) {
			// move list (guessed)
			text += `<p class="tooltip-section">`;
			for (const row of clientPokemon.moveTrack) {
				text += `${this.getPPUseText(row)}<br />`;
			}
			if (clientPokemon.moveTrack.filter(([moveName]) => {
				if (moveName.charAt(0) === '*') return false;
				const move = this.battle.dex.moves.get(moveName);
				return !move.isZ && !move.isMax && move.name !== 'Mimic';
			}).length > 4) {
				text += `(More than 4 moves is usually a sign of Illusion Zoroark/Zorua.) `;
			}
			if (this.battle.gen === 3) {
				text += `(Pressure is not visible in Gen 3, so in certain situations, more PP may have been lost than shown here.) `;
			}
			if (this.pokemonHasClones(clientPokemon)) {
				text += `(Your opponent has two indistinguishable Pokémon, making it impossible for you to tell which one has which moves/ability/item.) `;
			}
			text += `</p>`;
		}
		return text;
	}

	showFieldTooltip() {
		const scene = this.battle.scene as BattleScene;
		let buf = `<table style="border: 0; border-collapse: collapse; vertical-align: top; padding: 0; width: 100%"><tr>`;

		let atLeastOne = false;
		for (const side of this.battle.sides) {
			const sideConditions = scene.sideConditionsLeft(side, true);
			if (sideConditions) atLeastOne = true;
			buf += `<td><p class="tooltip-section"><strong>${BattleLog.escapeHTML(side.name)}</strong>${sideConditions || "<br />(no conditions)"}</p></td>`;
		}
		buf += `</tr><table>`;
		if (!atLeastOne) buf = ``;

		let weatherbuf = scene.weatherLeft() || `(no weather)`;
		if (weatherbuf.startsWith('<br />')) {
			weatherbuf = weatherbuf.slice(6);
		}
		buf = `<p>${weatherbuf}</p>` + buf;
		return `<p>${buf}</p>`;
	}

	/**
	 * Does this Pokémon's trainer have two of these Pokémon that are
	 * indistinguishable? (Same nickname, species, forme, level, gender,
	 * and shininess.)
	 */
	pokemonHasClones(pokemon: Pokemon) {
		const side = pokemon.side;
		if (side.battle.speciesClause) return false;
		for (const ally of side.pokemon) {
			if (pokemon !== ally && pokemon.searchid === ally.searchid) {
				return true;
			}
		}
		return false;
	}

	calculateModifiedStats(clientPokemon: Pokemon | null, serverPokemon: ServerPokemon, statStagesOnly?: boolean) {
		let stats = {...serverPokemon.stats};
		let pokemon = clientPokemon || serverPokemon;
		const isPowerTrick = clientPokemon?.volatiles['powertrick'];
		for (const statName of Dex.statNamesExceptHP) {
			let sourceStatName = statName;
			if (isPowerTrick) {
				if (statName === 'atk') sourceStatName = 'def';
				if (statName === 'def') sourceStatName = 'atk';
			}
			stats[statName] = serverPokemon.stats[sourceStatName];
			if (!clientPokemon) continue;

			const clientStatName = clientPokemon.boosts.spc && (statName === 'spa' || statName === 'spd') ? 'spc' : statName;
			const boostLevel = clientPokemon.boosts[clientStatName];
			if (boostLevel) {
				let boostTable = [1, 1.5, 2, 2.5, 3, 3.5, 4];
				if (boostLevel > 0) {
					stats[statName] *= boostTable[boostLevel];
				} else {
					if (this.battle.gen <= 2) boostTable = [1, 100 / 66, 2, 2.5, 100 / 33, 100 / 28, 4];
					stats[statName] /= boostTable[-boostLevel];
				}
				stats[statName] = Math.floor(stats[statName]);
			}
		}
		if (statStagesOnly) return stats;

		const ability = toID(
			clientPokemon?.effectiveAbility(serverPokemon) ?? (serverPokemon.ability || serverPokemon.baseAbility)
		);

		// check for burn, paralysis, guts, quick feet
		if (pokemon.status) {
			if (this.battle.gen > 2 && ability === 'guts') {
				stats.atk = Math.floor(stats.atk * 1.5);
			} else if (this.battle.gen < 2 && pokemon.status === 'brn') {
				stats.atk = Math.floor(stats.atk * 0.5);
			}

			// Paralysis is calculated later in newer generations, so we need to apply it early here
			if (this.battle.gen <= 2 && pokemon.status === 'par') {
				stats.spe = Math.floor(stats.spe * 0.25);
			}
		}

		// gen 1 doesn't support items
		if (this.battle.gen <= 1) {
			for (const statName of Dex.statNamesExceptHP) {
				if (stats[statName] > 999) stats[statName] = 999;
			}
			return stats;
		}

		let item = toID(serverPokemon.item);
		let speedHalvingEVItems = ['machobrace', 'poweranklet', 'powerband', 'powerbelt', 'powerbracer', 'powerlens', 'powerweight'];
		if (
			(ability === 'klutz' && !speedHalvingEVItems.includes(item)) ||
			this.battle.hasPseudoWeather('Magic Room') ||
			clientPokemon?.volatiles['embargo']
		) {
			item = '' as ID;
		}

		const species = this.battle.dex.species.get(serverPokemon.speciesForme).baseSpecies;
		const isTransform = clientPokemon?.volatiles.transform;
		const speciesName = isTransform && clientPokemon?.volatiles.formechange?.[1] && this.battle.gen <= 4 ?
			this.battle.dex.species.get(clientPokemon.volatiles.formechange[1]).baseSpecies : species;

		let speedModifiers = [];

		// check for light ball, thick club, metal/quick powder
		// the only stat modifying items in gen 2 were light ball, thick club, metal powder
		if (item === 'lightball' && speciesName === 'Pikachu' && this.battle.gen !== 4) {
			if (this.battle.gen > 4) stats.atk *= 2;
			stats.spa *= 2;
		}

		if (item === 'thickclub') {
			if (speciesName === 'Marowak' || speciesName === 'Cubone') {
				stats.atk *= 2;
			}
		}

		if (speciesName === 'Ditto' && !(clientPokemon && 'transform' in clientPokemon.volatiles)) {
			if (item === 'quickpowder') {
				speedModifiers.push(2);
			}
			if (item === 'metalpowder') {
				if (this.battle.gen === 2) {
					stats.def = Math.floor(stats.def * 1.5);
					stats.spd = Math.floor(stats.spd * 1.5);
				} else {
					stats.def *= 2;
				}
			}
		}

		// check abilities other than Guts and Quick Feet
		// check items other than light ball, thick club, metal/quick powder
		if (this.battle.gen <= 2) {
			return stats;
		}

		let weather = this.battle.weather;
		if (this.battle.abilityActive(['Air Lock', 'Cloud Nine'])) {
			weather = '' as ID;
		}

		if (item === 'choiceband' && !clientPokemon?.volatiles['dynamax']) {
			stats.atk = Math.floor(stats.atk * 1.5);
		}
		if (ability === 'purepower' || ability === 'hugepower') {
			stats.atk *= 2;
		}
		if (ability === 'hustle' || (ability === 'gorillatactics' && !clientPokemon?.volatiles['dynamax'])) {
			stats.atk = Math.floor(stats.atk * 1.5);
		}
		if (weather) {
			if (this.battle.gen >= 4 && this.pokemonHasType(pokemon, 'Rock') && weather === 'sandstorm') {
				stats.spd = Math.floor(stats.spd * 1.5);
			}
			if (this.pokemonHasType(pokemon, 'Ice') && weather === 'snow') {
				stats.def = Math.floor(stats.def * 1.5);
			}
			if (ability === 'sandrush' && weather === 'sandstorm') {
				speedModifiers.push(2);
			}
			if (ability === 'slushrush' && (weather === 'hail' || weather === 'snow')) {
				speedModifiers.push(2);
			}
			if (item !== 'utilityumbrella') {
				if (weather === 'sunnyday' || weather === 'desolateland') {
					if (ability === 'chlorophyll') {
						speedModifiers.push(2);
					}
					if (ability === 'solarpower') {
						stats.spa = Math.floor(stats.spa * 1.5);
					}
					if (ability === 'orichalcumpulse') {
						stats.atk = Math.floor(stats.atk * 1.3333);
					}
					let allyActive = clientPokemon?.side.active;
					if (allyActive) {
						for (const ally of allyActive) {
							if (!ally || ally.fainted) continue;
							let allyAbility = this.getAllyAbility(ally);
							if (allyAbility === 'Flower Gift' && (ally.getSpecies().baseSpecies === 'Cherrim' || this.battle.gen <= 4)) {
								stats.atk = Math.floor(stats.atk * 1.5);
								stats.spd = Math.floor(stats.spd * 1.5);
							}
						}
					}
				}
				if (weather === 'raindance' || weather === 'primordialsea') {
					if (ability === 'swiftswim') {
						speedModifiers.push(2);
					}
				}
			}
		}
		if (ability === 'defeatist' && serverPokemon.hp <= serverPokemon.maxhp / 2) {
			stats.atk = Math.floor(stats.atk * 0.5);
			stats.spa = Math.floor(stats.spa * 0.5);
		}
		if (clientPokemon) {
			if (clientPokemon.volatiles['slowstart']) {
				stats.atk = Math.floor(stats.atk * 0.5);
				speedModifiers.push(0.5);
			}
			if (ability === 'unburden' && clientPokemon.volatiles['itemremoved'] && !item) {
				speedModifiers.push(2);
			}
			for (const statName of Dex.statNamesExceptHP) {
				if (clientPokemon.volatiles['protosynthesis' + statName] || clientPokemon.volatiles['quarkdrive' + statName]) {
					if (statName === 'spe') {
						speedModifiers.push(1.5);
					} else {
						stats[statName] = Math.floor(stats[statName] * 1.3);
					}
				}
			}
		}
		if (pokemon.status) {
			if (ability === 'marvelscale') {
				stats.def = Math.floor(stats.def * 1.5);
			}
			if (ability === 'quickfeet') {
				speedModifiers.push(1.5);
			}
		}
		const isNFE = this.battle.dex.species.get(serverPokemon.speciesForme).evos?.some(evo => {
			const evoSpecies = this.battle.dex.species.get(evo);
			return !evoSpecies.isNonstandard ||
					evoSpecies.isNonstandard === this.battle.dex.species.get(serverPokemon.speciesForme)?.isNonstandard ||
					// Pokemon with Hisui evolutions
					evoSpecies.isNonstandard === "Unobtainable";
		});
		if (item === 'eviolite' && (isNFE || this.battle.dex.species.get(serverPokemon.speciesForme).id === 'dipplin')) {
			stats.def = Math.floor(stats.def * 1.5);
			stats.spd = Math.floor(stats.spd * 1.5);
		}
		if (ability === 'grasspelt' && this.battle.hasPseudoWeather('Grassy Terrain')) {
			stats.def = Math.floor(stats.def * 1.5);
		}
		if (this.battle.hasPseudoWeather('Electric Terrain')) {
			if (ability === 'surgesurfer') {
				speedModifiers.push(2);
			}
			if (ability === 'hadronengine') {
				stats.spa = Math.floor(stats.spa * 1.3333);
			}
		}
		if (item === 'choicespecs' && !clientPokemon?.volatiles['dynamax']) {
			stats.spa = Math.floor(stats.spa * 1.5);
		}
		if (item === 'deepseatooth' && species === 'Clamperl') {
			stats.spa *= 2;
		}
		if (item === 'souldew' && this.battle.gen <= 6 && (species === 'Latios' || species === 'Latias')) {
			stats.spa = Math.floor(stats.spa * 1.5);
			stats.spd = Math.floor(stats.spd * 1.5);
		}
		if (clientPokemon && (ability === 'plus' || ability === 'minus')) {
			let allyActive = clientPokemon.side.active;
			if (allyActive.length > 1) {
				let abilityName = (ability === 'plus' ? 'Plus' : 'Minus');
				for (const ally of allyActive) {
					if (!ally || ally === clientPokemon || ally.fainted) continue;
					let allyAbility = this.getAllyAbility(ally);
					if (allyAbility !== 'Plus' && allyAbility !== 'Minus') continue;
					if (this.battle.gen <= 4 && allyAbility === abilityName) continue;
					stats.spa = Math.floor(stats.spa * 1.5);
					break;
				}
			}
		}
		if (item === 'assaultvest') {
			stats.spd = Math.floor(stats.spd * 1.5);
		}
		if (item === 'deepseascale' && species === 'Clamperl') {
			stats.spd *= 2;
		}
		if (item === 'choicescarf' && !clientPokemon?.volatiles['dynamax']) {
			speedModifiers.push(1.5);
		}
		if (item === 'ironball' || speedHalvingEVItems.includes(item)) {
			speedModifiers.push(0.5);
		}
		if (ability === 'furcoat') {
			stats.def *= 2;
		}
		if (this.battle.abilityActive('Vessel of Ruin')) {
			if (ability !== 'vesselofruin') {
				stats.spa = Math.floor(stats.spa * 0.75);
			}
		}
		if (this.battle.abilityActive('Sword of Ruin')) {
			if (ability !== 'swordofruin') {
				stats.def = Math.floor(stats.def * 0.75);
			}
		}
		if (this.battle.abilityActive('Tablets of Ruin')) {
			if (ability !== 'tabletsofruin') {
				stats.atk = Math.floor(stats.atk * 0.75);
			}
		}
		if (this.battle.abilityActive('Beads of Ruin')) {
			if (ability !== 'beadsofruin') {
				stats.spd = Math.floor(stats.spd * 0.75);
			}
		}

		// SSB
		if (this.battle.tier.includes('Super Staff Bros')) {
			if (pokemon.name === 'Felucia') {
				speedModifiers.push(1.5);
			}
			if (ability === 'misspelled') {
				stats.spa = Math.floor(stats.spa * 1.5);
			}
			if (ability === 'fortifyingfrost' && weather === 'snow') {
				stats.spa = Math.floor(stats.spa * 1.5);
				stats.spd = Math.floor(stats.spd * 1.5);
			}
			if (weather === 'deserteddunes' && this.pokemonHasType(pokemon, 'Rock')) {
				stats.spd = Math.floor(stats.spd * 1.5);
			}
			if (pokemon.status && ability === 'fortifiedmetal') {
				stats.atk = Math.floor(stats.atk * 1.5);
			}
			if (ability === 'grassyemperor' && this.battle.hasPseudoWeather('Grassy Terrain')) {
				stats.atk = Math.floor(stats.atk * 1.3333);
			}
			if (ability === 'magicalmysterycharge' && this.battle.hasPseudoWeather('Electric Terrain')) {
				stats.spd = Math.floor(stats.spd * 1.5);
			}
			if (ability === 'youkaiofthedusk' || ability === 'galeguard') {
				stats.def *= 2;
			}
			if (ability === 'climatechange') {
				if (weather === 'snow') {
					stats.def = Math.floor(stats.def * 1.5);
					stats.spd = Math.floor(stats.spd * 1.5);
				}
				if (weather === 'sunnyday' || weather === 'desolateland') stats.spa = Math.floor(stats.spa * 1.5);
			}
			if (item !== 'utilityumbrella' && ability === 'ridethesun' &&
				(weather === 'sunnyday' || weather === 'desolateland')) {
				speedModifiers.push(2);
			}
			if (ability === 'soulsurfer' && this.battle.hasPseudoWeather('Electric Terrain')) {
				speedModifiers.push(2);
			}
			if (item === 'eviolite' && this.battle.dex.species.get(serverPokemon.speciesForme).id === 'pichuspikyeared') {
				stats.def = Math.floor(stats.def * 1.5);
				stats.spd = Math.floor(stats.spd * 1.5);
			}
			if (this.battle.abilityActive('quagofruin')) {
				if (ability !== 'quagofruin') {
					stats.def = Math.floor(stats.def * 0.85);
				}
			}
			if (this.battle.abilityActive('clodofruin')) {
				if (ability !== 'clodofruin') {
					stats.atk = Math.floor(stats.atk * 0.85);
				}
			}
			if (this.battle.abilityActive('blitzofruin')) {
				if (ability !== 'blitzofruin') {
					speedModifiers.push(0.75);
				}
			}
			if (this.battle.hasPseudoWeather('Anfield Atmosphere') && ability === 'youllneverwalkalone') {
				stats.atk = Math.floor(stats.atk * 1.25);
				stats.def = Math.floor(stats.def * 1.25);
				stats.spd = Math.floor(stats.spd * 1.25);
				speedModifiers.push(1.25);
			}
			if (clientPokemon) {
				if (clientPokemon.volatiles['boiled']) {
					stats.spa = Math.floor(stats.spa * 1.5);
				}
				for (const statName of Dex.statNamesExceptHP) {
					if (clientPokemon.volatiles['ultramystik']) {
						if (statName === 'spe') {
							speedModifiers.push(1.3);
						} else {
							stats[statName] = Math.floor(stats[statName] * 1.3);
						}
					}
				}
			}
		}

		const sideConditions = this.battle.mySide.sideConditions;
		if (sideConditions['tailwind']) {
			speedModifiers.push(2);
		}
		if (sideConditions['grasspledge']) {
			speedModifiers.push(0.25);
		}

		let chainedSpeedModifier = 1;
		for (const modifier of speedModifiers) {
			chainedSpeedModifier *= modifier;
		}
		// Chained modifiers round down on 0.5
		stats.spe = stats.spe * chainedSpeedModifier;
		stats.spe = stats.spe % 1 > 0.5 ? Math.ceil(stats.spe) : Math.floor(stats.spe);

		if (pokemon.status === 'par' && ability !== 'quickfeet') {
			if (this.battle.gen > 6) {
				stats.spe = Math.floor(stats.spe * 0.5);
			} else {
				stats.spe = Math.floor(stats.spe * 0.25);
			}
		}

		return stats;
	}

	renderStats(clientPokemon: Pokemon | null, serverPokemon?: ServerPokemon | null, short?: boolean) {
		const isTransformed = clientPokemon?.volatiles.transform;
		if (!serverPokemon || isTransformed) {
			if (!clientPokemon) throw new Error('Must pass either clientPokemon or serverPokemon');
			let [min, max] = this.getSpeedRange(clientPokemon);
			return '<p><small>Spe</small> ' + min + ' to ' + max + ' <small>(before items/abilities/modifiers)</small></p>';
		}
		const stats = serverPokemon.stats;
		const modifiedStats = this.calculateModifiedStats(clientPokemon, serverPokemon);

		let buf = '<p>';

		if (!short) {
			let hasModifiedStat = false;
			for (const statName of Dex.statNamesExceptHP) {
				if (this.battle.gen === 1 && statName === 'spd') continue;
				let statLabel = this.battle.gen === 1 && statName === 'spa' ? 'spc' : statName;
				buf += statName === 'atk' ? '<small>' : '<small> / ';
				buf += '' + BattleText[statLabel].statShortName + '&nbsp;</small>';
				buf += '' + stats[statName];
				if (modifiedStats[statName] !== stats[statName]) hasModifiedStat = true;
			}
			buf += '</p>';

			if (!hasModifiedStat) return buf;

			buf += '<p><small>(After stat modifiers:)</small></p>';
			buf += '<p>';
		}

		for (const statName of Dex.statNamesExceptHP) {
			if (this.battle.gen === 1 && statName === 'spd') continue;
			let statLabel = this.battle.gen === 1 && statName === 'spa' ? 'spc' : statName;
			buf += statName === 'atk' ? '<small>' : '<small> / ';
			buf += '' + BattleText[statLabel].statShortName + '&nbsp;</small>';
			if (modifiedStats[statName] === stats[statName]) {
				buf += '' + modifiedStats[statName];
			} else if (modifiedStats[statName] < stats[statName]) {
				buf += '<strong class="stat-lowered">' + modifiedStats[statName] + '</strong>';
			} else {
				buf += '<strong class="stat-boosted">' + modifiedStats[statName] + '</strong>';
			}
		}
		buf += '</p>';
		return buf;
	}

	getPPUseText(moveTrackRow: [string, number], showKnown?: boolean) {
		let [moveName, ppUsed] = moveTrackRow;
		let move;
		let maxpp;
		if (moveName.charAt(0) === '*') {
			// Transformed move
			move = this.battle.dex.moves.get(moveName.substr(1));
			maxpp = 5;
		} else {
			move = this.battle.dex.moves.get(moveName);
			maxpp = (move.pp === 1 || move.noPPBoosts ? move.pp : move.pp * 8 / 5);
			if (this.battle.gen < 3) maxpp = Math.min(61, maxpp);
		}
		const bullet = moveName.charAt(0) === '*' || move.isZ ? '<span style="color:#888">&#8226;</span>' : '&#8226;';
		if (ppUsed === Infinity) {
			return `${bullet} ${move.name} <small>(0/${maxpp})</small>`;
		}
		if (ppUsed || moveName.charAt(0) === '*') {
			return `${bullet} ${move.name} <small>(${maxpp - ppUsed}/${maxpp})</small>`;
		}
		return `${bullet} ${move.name} ${showKnown ? ' <small>(revealed)</small>' : ''}`;
	}

	ppUsed(move: Move, pokemon: Pokemon) {
		for (let [moveName, ppUsed] of pokemon.moveTrack) {
			if (moveName.charAt(0) === '*') moveName = moveName.substr(1);
			if (move.name === moveName) return ppUsed;
		}
		return 0;
	}

	/**
	 * Calculates possible Speed stat range of an opponent
	 */
	getSpeedRange(pokemon: Pokemon): [number, number] {
		const tr = Math.trunc || Math.floor;
		const species = pokemon.getSpecies();
		let rules = this.battle.rules;
		let baseSpe = species.baseStats.spe;
		if (rules['Scalemons Mod']) {
			const bstWithoutHp = species.bst - species.baseStats.hp;
			const scale = 600 - species.baseStats.hp;
			baseSpe = tr(baseSpe * scale / bstWithoutHp);
			if (baseSpe < 1) baseSpe = 1;
			if (baseSpe > 255) baseSpe = 255;
		}
		if (rules['Frantic Fusions Mod']) {
			const fusionSpecies = this.battle.dex.species.get(pokemon.name);
			if (fusionSpecies.exists && fusionSpecies.name !== species.name) {
				baseSpe = baseSpe + tr(fusionSpecies.baseStats.spe / 4);
				if (baseSpe < 1) baseSpe = 1;
				if (baseSpe > 255) baseSpe = 255;
			}
		}
		if (rules['Flipped Mod']) {
			baseSpe = species.baseStats.hp;
			if (baseSpe < 1) baseSpe = 1;
			if (baseSpe > 255) baseSpe = 255;
		}
		if (rules['350 Cup Mod'] && species.bst <= 350) {
			baseSpe *= 2;
			if (baseSpe < 1) baseSpe = 1;
			if (baseSpe > 255) baseSpe = 255;
		}
		let level = pokemon.volatiles.transform?.[4] || pokemon.level;
		let tier = this.battle.tier;
		let gen = this.battle.gen;
		let isCGT = tier.includes('Computer-Generated Teams');
		let isRandomBattle = tier.includes('Random Battle') ||
			(tier.includes('Random') && tier.includes('Battle') && gen >= 6) || isCGT;

		let minNature = (isRandomBattle || gen < 3) ? 1 : 0.9;
		let maxNature = (isRandomBattle || gen < 3) ? 1 : 1.1;
		let maxIv = (gen < 3) ? 30 : 31;

		let min;
		let max;
		if (tier.includes("Let's Go")) {
			min = tr(tr(tr(2 * baseSpe * level / 100 + 5) * minNature) * tr((70 / 255 / 10 + 1) * 100) / 100);
			max = tr(tr(tr((2 * baseSpe + maxIv) * level / 100 + 5) * maxNature) * tr((70 / 255 / 10 + 1) * 100) / 100);
			if (tier.includes('No Restrictions')) max += 200;
			else if (tier.includes('Random')) max += 20;
		} else {
			let maxIvEvOffset = maxIv + ((isRandomBattle && gen >= 3) ? 21 : 63);
			max = tr(tr((2 * baseSpe + maxIvEvOffset) * level / 100 + 5) * maxNature);
			min = isCGT ? max : tr(tr(2 * baseSpe * level / 100 + 5) * minNature);
		}
		return [min, max];
	}

	/**
	 * Gets the proper current type for moves with a variable type.
	 */
	getMoveType(move: Move, value: ModifiableValue, forMaxMove?: boolean | Move): [TypeName, 'Physical' | 'Special' | 'Status'] {
		const pokemon = value.pokemon;
		const serverPokemon = value.serverPokemon;

		let moveType = move.type;
		let category = move.category;
		if (category === 'Status' && forMaxMove) return ['Normal', 'Status']; // Max Guard
		// can happen in obscure situations
		if (!pokemon) return [moveType, category];

		let pokemonTypes = pokemon.getTypeList(serverPokemon);
		value.reset();
		if (move.id === 'revelationdance') {
			moveType = pokemonTypes[0];
		}
		// Moves that require an item to change their type.
		let item = this.battle.dex.items.get(value.itemName);
		if (move.id === 'multiattack' && item.onMemory) {
			if (value.itemModify(0)) moveType = item.onMemory;
		}
		if (move.id === 'judgment' && item.onPlate && !item.zMoveType) {
			if (value.itemModify(0)) moveType = item.onPlate;
		}
		if (move.id === 'technoblast' && item.onDrive) {
			if (value.itemModify(0)) moveType = item.onDrive;
		}
		if (move.id === 'naturalgift' && item.naturalGift) {
			if (value.itemModify(0)) moveType = item.naturalGift.type;
		}
		// Weather and pseudo-weather type changes.
		if (move.id === 'weatherball' && value.weatherModify(0)) {
			switch (this.battle.weather) {
			case 'sunnyday':
			case 'desolateland':
				if (item.id === 'utilityumbrella') break;
				moveType = 'Fire';
				break;
			case 'raindance':
			case 'primordialsea':
				if (item.id === 'utilityumbrella') break;
				moveType = 'Water';
				break;
			case 'sandstorm':
				moveType = 'Rock';
				break;
			case 'hail':
			case 'snow':
				moveType = 'Ice';
				break;
			}
		}
		if (move.id === 'terrainpulse' && pokemon.isGrounded(serverPokemon)) {
			if (this.battle.hasPseudoWeather('Electric Terrain')) {
				moveType = 'Electric';
			} else if (this.battle.hasPseudoWeather('Grassy Terrain')) {
				moveType = 'Grass';
			} else if (this.battle.hasPseudoWeather('Misty Terrain')) {
				moveType = 'Fairy';
			} else if (this.battle.hasPseudoWeather('Psychic Terrain')) {
				moveType = 'Psychic';
			}
		}
		if (move.id === 'terablast' && pokemon.terastallized) {
			moveType = pokemon.terastallized as TypeName;
		}
		if (move.id === 'terastarstorm' && pokemon.getSpeciesForme() === 'Terapagos-Stellar') {
			moveType = 'Stellar';
		}

		// Aura Wheel as Morpeko-Hangry changes the type to Dark
		if (move.id === 'aurawheel' && pokemon.getSpeciesForme() === 'Morpeko-Hangry') {
			moveType = 'Dark';
		}
		// Raging Bull's type depends on the Tauros forme
		if (move.id === 'ragingbull') {
			switch (pokemon.getSpeciesForme()) {
			case 'Tauros-Paldea-Combat':
				moveType = 'Fighting';
				break;
			case 'Tauros-Paldea-Blaze':
				moveType = 'Fire';
				break;
			case 'Tauros-Paldea-Aqua':
				moveType = 'Water';
				break;
			}
		}
		// Ivy Cudgel's type depends on the Ogerpon forme
		if (move.id === 'ivycudgel') {
			switch (pokemon.getSpeciesForme()) {
			case 'Ogerpon-Wellspring': case 'Ogerpon-Wellspring-Tera':
				moveType = 'Water';
				break;
			case 'Ogerpon-Hearthflame': case 'Ogerpon-Hearthflame-Tera':
				moveType = 'Fire';
				break;
			case 'Ogerpon-Cornerstone': case 'Ogerpon-Cornerstone-Tera':
				moveType = 'Rock';
				break;
			}
		}

		// Other abilities that change the move type.
		const noTypeOverride = [
			'judgment', 'multiattack', 'naturalgift', 'revelationdance', 'struggle', 'technoblast', 'terrainpulse', 'weatherball',
		];
		const allowTypeOverride = !noTypeOverride.includes(move.id) && (move.id !== 'terablast' || !pokemon.terastallized);
		if (allowTypeOverride) {
			if (this.battle.rules['Revelationmons Mod']) {
				const [types] = pokemon.getTypes(serverPokemon);
				for (let i = 0; i < types.length; i++) {
					if (serverPokemon.moves[i] && move.id === toID(serverPokemon.moves[i])) {
						moveType = types[i];
					}
				}
			}

			if (category !== 'Status' && !move.isZ && !move.id.startsWith('hiddenpower')) {
				if (moveType === 'Normal') {
					if (value.abilityModify(0, 'Aerilate')) moveType = 'Flying';
					if (value.abilityModify(0, 'Galvanize')) moveType = 'Electric';
					if (value.abilityModify(0, 'Pixilate')) moveType = 'Fairy';
					if (value.abilityModify(0, 'Refrigerate')) moveType = 'Ice';
				}
				if (value.abilityModify(0, 'Normalize')) moveType = 'Normal';
			}

			// There aren't any max moves with the sound flag, but if there were, Liquid Voice would make them water type
			const isSound = !!(
				forMaxMove ?
				this.getMaxMoveFromType(moveType, forMaxMove !== true && forMaxMove || undefined) : move
			).flags['sound'];
			if (isSound && value.abilityModify(0, 'Liquid Voice')) {
				moveType = 'Water';
			}
		}

		if (move.id === 'photongeyser' || move.id === 'lightthatburnsthesky' ||
			(move.id === 'terablast' && pokemon.terastallized) ||
			(move.id === 'terastarstorm' && pokemon.getSpeciesForme() === 'Terapagos-Stellar')) {
			const stats = this.calculateModifiedStats(pokemon, serverPokemon, true);
			if (stats.atk > stats.spa) category = 'Physical';
		}

		// SSB
		if (this.battle.tier.includes('Super Staff Bros')) {
			if (allowTypeOverride && category !== "Status" && !move.isZ && !move.id.startsWith('hiddenpower')) {
				if (value.abilityModify(0, 'Acetosa')) moveType = 'Grass';
				if (value.abilityModify(0, 'I Can Hear The Heart Beating As One') && moveType === 'Normal') moveType = 'Fairy';
			}
			if (move.id === 'tsignore' || move.id === 'o') {
				const stats = this.calculateModifiedStats(pokemon, serverPokemon, true);
				if (stats.atk > stats.spa) category = 'Physical';
			}
			if (move.id === 'tsignore' && pokemon.getSpeciesForme().startsWith('Meloetta') &&
				pokemon.terastallized) {
				moveType = 'Stellar';
			}
			if (move.id === 'weatherball' && value.weatherModify(0)) {
				if (this.battle.weather === 'stormsurge') moveType = 'Water';
				if (this.battle.weather === 'deserteddunes') moveType = 'Rock';
			}
			if (move.id === 'o' || move.id === 'worriednoises') {
				moveType = pokemonTypes[0];
			}
			if (move.id === 'dillydally') {
				moveType = pokemonTypes[pokemonTypes.length - 1];
			}
			if (move.id === 'magicalfocus') {
				if (this.battle.turn % 3 === 1) {
					moveType = 'Fire';
				} else if (this.battle.turn % 3 === 2) {
					moveType = 'Electric';
				} else {
					moveType = 'Ice';
				}
			}
			if (move.id === 'hydrostatics' && pokemon.terastallized) {
				moveType = 'Water';
			}
			if (move.id === 'asongoficeandfire' && pokemon.getSpeciesForme() === 'Volcarona') moveType = 'Ice';
			if (this.battle.abilityActive('dynamictyping')) {
				moveType = '???';
			}
			if (move.id === 'alting') {
				moveType = '???';
				if (pokemon.shiny) {
					category = 'Special';
				}
			}
		}
		return [moveType, category];
	}

	// Gets the current accuracy for a move.
	getMoveAccuracy(move: Move, value: ModifiableValue, target?: Pokemon) {
		value.reset(move.accuracy === true ? 0 : move.accuracy, true);

		let pokemon = value.pokemon!;
		// Sure-hit accuracy
		if (move.id === 'toxic' && this.battle.gen >= 6 && this.pokemonHasType(pokemon, 'Poison')) {
			value.set(0, "Poison type");
			return value;
		}
		if (move.id === 'blizzard' && this.battle.gen >= 4) {
			value.weatherModify(0, 'Hail');
			value.weatherModify(0, 'Snow');
		}
		if (['hurricane', 'thunder', 'bleakwindstorm', 'wildboltstorm', 'sandsearstorm'].includes(move.id)) {
			value.weatherModify(0, 'Rain Dance');
			value.weatherModify(0, 'Primordial Sea');
		}
		value.abilityModify(0, 'No Guard');
		if (!value.value) return value;

		// OHKO moves don't use standard accuracy / evasion modifiers
		if (move.ohko) {
			if (this.battle.gen === 1) {
				value.set(value.value, `fails if target's Speed is higher`);
				return value;
			}
			if (move.id === 'sheercold' && this.battle.gen >= 7 && !this.pokemonHasType(pokemon, 'Ice')) {
				value.set(20, 'not Ice-type');
			}
			if (target) {
				if (pokemon.level < target.level) {
					value.reset(0);
					value.set(0, "FAILS: target's level is higher");
				} else if (pokemon.level > target.level) {
					value.set(value.value + pokemon.level - target.level, "+1% per level above target");
				}
			} else {
				if (pokemon.level < 100) value.set(value.value, "fails if target's level is higher");
				if (pokemon.level > 1) value.set(value.value, "+1% per level above target");
			}
			return value;
		}

		// Accuracy modifiers start

		let accuracyModifiers = [];
		if (this.battle.hasPseudoWeather('Gravity')) {
			accuracyModifiers.push(6840);
			value.modify(5 / 3, "Gravity");
		}

		for (const active of pokemon.side.active) {
			if (!active || active.fainted) continue;
			const ability = this.getAllyAbility(active);
			if (ability === 'Victory Star') {
				accuracyModifiers.push(4506);
				value.modify(1.1, "Victory Star");
			}
		}

		if (value.tryAbility('Hustle') && move.category === 'Physical') {
			accuracyModifiers.push(3277);
			value.abilityModify(0.8, "Hustle");
		} else if (value.tryAbility('Compound Eyes')) {
			accuracyModifiers.push(5325);
			value.abilityModify(1.3, "Compound Eyes");
		}

		if (value.tryItem('Wide Lens')) {
			accuracyModifiers.push(4505);
			value.itemModify(1.1, "Wide Lens");
		}

		// SSB
		if (this.battle.tier.includes('Super Staff Bros')) {
			if (move.id === 'alting' && pokemon.shiny) {
				value.set(100);
			}
			if (move.flags['wind'] && this.battle.weather === 'stormsurge') {
				value.weatherModify(0, 'Storm Surge');
			}
			if (value.tryAbility('Misspelled') && move.category === 'Special') {
				accuracyModifiers.push(3277);
				value.abilityModify(0.8, "Misspelled");
			}
			if (value.tryAbility('Hydrostatic Positivity') && ['Electric', 'Water'].includes(move.type)) {
				accuracyModifiers.push(5325);
				value.abilityModify(1.3, "Hydrostatic Positivity");
			}
			if (value.tryAbility('Hardcore Hustle')) {
				for (let i = 1; i <= 5 && i <= pokemon.side.faintCounter; i++) {
					if (pokemon.volatiles[`fallen${i}`]) {
						value.abilityModify([1, 0.95, 0.90, 0.85, 0.80, 0.75][i], "Hardcore Hustle");
					}
				}
			}
			if (value.tryAbility('See No Evil, Hear No Evil, Speak No Evil') &&
				pokemon.getSpeciesForme().includes('Wellspring')) {
				value.abilityModify(0, 'See No Evil, Hear No Evil, Speak No Evil');
			}
			value.abilityModify(0, 'Sure Hit Sorcery');
			value.abilityModify(0, 'Eyes of Eternity');
			if (!value.value) return value;
		}

		// Chaining modifiers
		let chain = 4096;
		for (const mod of accuracyModifiers) {
			if (mod !== 4096) {
				chain = (chain * mod + 2048) >> 12;
			}
		}

		// Applying modifiers
		value.set(move.accuracy as number);

		if (move.id === 'hurricane' || move.id === 'thunder') {
			if (value.tryWeather('Sunny Day')) value.set(50, 'Sunny Day');
			if (value.tryWeather('Desolate Land')) value.set(50, 'Desolate Land');
		}

		// Chained modifiers round down on 0.5
		let accuracyAfterChain = (value.value * chain) / 4096;
		accuracyAfterChain = accuracyAfterChain % 1 > 0.5 ? Math.ceil(accuracyAfterChain) : Math.floor(accuracyAfterChain);
		value.set(accuracyAfterChain);

		// Unlike for Atk, Def, etc. accuracy and evasion boosts are applied after modifiers
		if (pokemon?.boosts.accuracy) {
			if (pokemon.boosts.accuracy > 0) {
				value.set(Math.floor(value.value * (pokemon.boosts.accuracy + 3) / 3));
			} else {
				value.set(Math.floor(value.value * 3 / (3 - pokemon.boosts.accuracy)));
			}
		}

		// 1/256 glitch
		if (this.battle.gen === 1 && !toID(this.battle.tier).includes('stadium')) {
			value.set((Math.floor(value.value * 255 / 100) / 256) * 100);
		}
		return value;
	}

	// Gets the proper current base power for moves which have a variable base power.
	// Takes into account the target for some moves.
	// If it is unsure of the actual base power, it gives an estimate.
	getMoveBasePower(move: Move, moveType: TypeName, value: ModifiableValue, target: Pokemon | null = null) {
		const pokemon = value.pokemon!;
		const serverPokemon = value.serverPokemon;

		// apply modifiers for moves that depend on the actual stats
		const modifiedStats = this.calculateModifiedStats(pokemon, serverPokemon);

		value.reset(move.basePower);

		if (move.id === 'acrobatics') {
			if (!serverPokemon.item) {
				value.modify(2, "Acrobatics + no item");
			}
		}
		let variableBPCap = ['crushgrip', 'wringout'].includes(move.id) ? 120 : move.id === 'hardpress' ? 100 : undefined;
		if (variableBPCap && target) {
			value.set(
				Math.floor(
					Math.floor((variableBPCap * (100 * Math.floor(target.hp * 4096 / target.maxhp)) + 2048 - 1) / 4096) / 100
				) || 1,
				'approximate'
			);
		}
		if (move.id === 'terablast' && pokemon.terastallized === 'Stellar') {
			value.set(100, 'Tera Stellar boost');
		}
		if (move.id === 'brine' && target && target.hp * 2 <= target.maxhp) {
			value.modify(2, 'Brine + target below half HP');
		}
		if (move.id === 'eruption' || move.id === 'waterspout' || move.id === 'dragonenergy') {
			value.set(Math.floor(150 * pokemon.hp / pokemon.maxhp) || 1);
		}
		if (move.id === 'facade' && !['', 'slp', 'frz'].includes(pokemon.status)) {
			value.modify(2, 'Facade + status');
		}
		if (move.id === 'flail' || move.id === 'reversal') {
			let multiplier;
			let ratios;
			if (this.battle.gen > 4) {
				multiplier = 48;
				ratios = [2, 5, 10, 17, 33];
			} else {
				multiplier = 64;
				ratios = [2, 6, 13, 22, 43];
			}
			let ratio = pokemon.hp * multiplier / pokemon.maxhp;
			let basePower;
			if (ratio < ratios[0]) basePower = 200;
			else if (ratio < ratios[1]) basePower = 150;
			else if (ratio < ratios[2]) basePower = 100;
			else if (ratio < ratios[3]) basePower = 80;
			else if (ratio < ratios[4]) basePower = 40;
			else basePower = 20;
			value.set(basePower);
		}
		if (['hex', 'infernalparade'].includes(move.id) && target?.status) {
			value.modify(2, move.name + ' + status');
		}
		if (move.id === 'lastrespects') {
			value.set(Math.min(50 + 50 * pokemon.side.faintCounter));
		}
		if (move.id === 'punishment' && target) {
			let boostCount = 0;
			for (const boost of Object.values(target.boosts)) {
				if (boost > 0) boostCount += boost;
			}
			value.set(Math.min(60 + 20 * boostCount, 200));
		}
		if (move.id === 'smellingsalts' && target) {
			if (target.status === 'par') {
				value.modify(2, 'Smelling Salts + Paralysis');
			}
		}
		if (['storedpower', 'powertrip'].includes(move.id) && target) {
			let boostCount = 0;
			for (const boost of Object.values(pokemon.boosts)) {
				if (boost > 0) boostCount += boost;
			}
			value.set(20 + 20 * boostCount);
		}
		if (move.id === 'trumpcard') {
			const ppLeft = 5 - this.ppUsed(move, pokemon);
			let basePower = 40;
			if (ppLeft === 1) basePower = 200;
			else if (ppLeft === 2) basePower = 80;
			else if (ppLeft === 3) basePower = 60;
			else if (ppLeft === 4) basePower = 50;
			value.set(basePower);
		}
		if (move.id === 'magnitude') {
			value.setRange(10, 150);
		}
		if (['venoshock', 'barbbarrage'].includes(move.id) && target) {
			if (['psn', 'tox'].includes(target.status)) {
				value.modify(2, move.name + ' + Poison');
			}
		}
		if (move.id === 'wakeupslap' && target) {
			if (target.status === 'slp') {
				value.modify(2, 'Wake-Up Slap + Sleep');
			}
		}
		if (move.id === 'weatherball') {
			if (this.battle.weather !== 'deltastream') {
				value.weatherModify(2);
			}
		}
		if (move.id === 'hydrosteam') {
			value.weatherModify(1.5, 'Sunny Day');
		}
		if (move.id === 'psyblade' && this.battle.hasPseudoWeather('Electric Terrain')) {
			value.modify(1.5, 'Electric Terrain');
		}
		if (move.id === 'terrainpulse' && pokemon.isGrounded(serverPokemon)) {
			if (
				this.battle.hasPseudoWeather('Electric Terrain') ||
				this.battle.hasPseudoWeather('Grassy Terrain') ||
				this.battle.hasPseudoWeather('Misty Terrain') ||
				this.battle.hasPseudoWeather('Psychic Terrain')
			) {
				value.modify(2, 'Terrain Pulse boost');
			}
		}
		if (
			move.id === 'watershuriken' && pokemon.getSpeciesForme() === 'Greninja-Ash' && pokemon.ability === 'Battle Bond'
		) {
			value.set(20, 'Battle Bond');
		}
		// Moves that check opponent speed
		if (move.id === 'electroball' && target) {
			let [minSpe, maxSpe] = this.getSpeedRange(target);
			let minRatio = (modifiedStats.spe / maxSpe);
			let maxRatio = (modifiedStats.spe / minSpe);
			let min;
			let max;

			if (minRatio >= 4) min = 150;
			else if (minRatio >= 3) min = 120;
			else if (minRatio >= 2) min = 80;
			else if (minRatio >= 1) min = 60;
			else min = 40;

			if (maxRatio >= 4) max = 150;
			else if (maxRatio >= 3) max = 120;
			else if (maxRatio >= 2) max = 80;
			else if (maxRatio >= 1) max = 60;
			else max = 40;

			value.setRange(min, max);
		}
		if (move.id === 'gyroball' && target) {
			let [minSpe, maxSpe] = this.getSpeedRange(target);
			let min = (Math.floor(25 * minSpe / modifiedStats.spe) || 1);
			if (min > 150) min = 150;
			let max = (Math.floor(25 * maxSpe / modifiedStats.spe) || 1);
			if (max > 150) max = 150;
			value.setRange(min, max);
		}
		// Moves which have base power changed due to items
		if (serverPokemon.item) {
			let item = this.battle.dex.items.get(serverPokemon.item);
			if (move.id === 'fling' && item.fling) {
				value.itemModify(item.fling.basePower);
			}
			if (move.id === 'naturalgift') {
				value.itemModify(item.naturalGift.basePower);
			}
		}
		// Moves which have base power changed according to weight
		if (['lowkick', 'grassknot', 'heavyslam', 'heatcrash'].includes(move.id) && this.battle.gen > 2) {
			let isGKLK = ['lowkick', 'grassknot'].includes(move.id);
			if (target) {
				let targetWeight = target.getWeightKg();
				let pokemonWeight = pokemon.getWeightKg(serverPokemon);
				let basePower;
				if (isGKLK) {
					basePower = 20;
					if (targetWeight >= 200) basePower = 120;
					else if (targetWeight >= 100) basePower = 100;
					else if (targetWeight >= 50) basePower = 80;
					else if (targetWeight >= 25) basePower = 60;
					else if (targetWeight >= 10) basePower = 40;
				} else {
					basePower = 40;
					if (pokemonWeight >= targetWeight * 5) basePower = 120;
					else if (pokemonWeight >= targetWeight * 4) basePower = 100;
					else if (pokemonWeight >= targetWeight * 3) basePower = 80;
					else if (pokemonWeight >= targetWeight * 2) basePower = 60;
				}
				if (target.volatiles['dynamax']) {
					value.set(0, 'blocked by target\'s Dynamax');
				} else {
					value.set(basePower);
				}
			} else {
				value.setRange(isGKLK ? 20 : 40, 120);
			}
		}
		// Base power based on times hit
		if (move.id === 'ragefist') {
			value.set(Math.min(350, 50 + 50 * pokemon.timesAttacked),
				pokemon.timesAttacked > 0
					? `Hit ${pokemon.timesAttacked} time${pokemon.timesAttacked > 1 ? 's' : ''}`
					: undefined);
		}
		if (!value.value) return value;

		// Other ability boosts
		if (pokemon.status === 'brn' && move.category === 'Special') {
			value.abilityModify(1.5, "Flare Boost");
		}
		if (move.flags['punch']) {
			value.abilityModify(1.2, 'Iron Fist');
		}
		if (move.flags['pulse']) {
			value.abilityModify(1.5, "Mega Launcher");
		}
		if (move.flags['bite']) {
			value.abilityModify(1.5, "Strong Jaw");
		}
		if (value.value <= 60) {
			value.abilityModify(1.5, "Technician");
		}
		if (['psn', 'tox'].includes(pokemon.status) && move.category === 'Physical') {
			value.abilityModify(1.5, "Toxic Boost");
		}
		if (['Rock', 'Ground', 'Steel'].includes(moveType) && this.battle.weather === 'sandstorm') {
			if (value.tryAbility("Sand Force")) value.weatherModify(1.3, "Sandstorm", "Sand Force");
		}
		if (move.secondaries) {
			value.abilityModify(1.3, "Sheer Force");
		}
		if (move.flags['contact']) {
			value.abilityModify(1.3, "Tough Claws");
		}
		if (move.flags['sound']) {
			value.abilityModify(1.3, "Punk Rock");
		}
		if (move.flags['slicing']) {
			value.abilityModify(1.5, "Sharpness");
		}
		for (let i = 1; i <= 5 && i <= pokemon.side.faintCounter; i++) {
			if (pokemon.volatiles[`fallen${i}`]) {
				value.abilityModify(1 + 0.1 * i, "Supreme Overlord");
			}
		}
		if (target) {
			if (["MF", "FM"].includes(pokemon.gender + target.gender)) {
				value.abilityModify(0.75, "Rivalry");
			} else if (["MM", "FF"].includes(pokemon.gender + target.gender)) {
				value.abilityModify(1.25, "Rivalry");
			}
		}
		const noTypeOverride = [
			'judgment', 'multiattack', 'naturalgift', 'revelationdance', 'struggle', 'technoblast', 'terrainpulse', 'weatherball',
		];
		const allowTypeOverride = !noTypeOverride.includes(move.id) && (move.id !== 'terablast' || !pokemon.terastallized);
		if (
			move.category !== 'Status' && allowTypeOverride && !move.isZ && !move.isMax &&
			!move.id.startsWith('hiddenpower')
		) {
			if (move.type === 'Normal') {
				value.abilityModify(this.battle.gen > 6 ? 1.2 : 1.3, "Aerilate");
				value.abilityModify(this.battle.gen > 6 ? 1.2 : 1.3, "Galvanize");
				value.abilityModify(this.battle.gen > 6 ? 1.2 : 1.3, "Pixilate");
				value.abilityModify(this.battle.gen > 6 ? 1.2 : 1.3, "Refrigerate");
			}
			if (this.battle.gen > 6) {
				value.abilityModify(1.2, "Normalize");
			}
		}
		if (move.recoil || move.hasCrashDamage) {
			value.abilityModify(1.2, 'Reckless');
		}

		if (move.category !== 'Status') {
			let auraBoosted = '';
			let auraBroken = false;
			for (const ally of pokemon.side.active) {
				if (!ally || ally.fainted) continue;
				let allyAbility = this.getAllyAbility(ally);
				if (moveType === 'Fairy' && allyAbility === 'Fairy Aura') {
					auraBoosted = 'Fairy Aura';
				} else if (moveType === 'Dark' && allyAbility === 'Dark Aura') {
					auraBoosted = 'Dark Aura';
				} else if (allyAbility === 'Aura Break') {
					auraBroken = true;
				} else if (allyAbility === 'Battery' && ally !== pokemon && move.category === 'Special') {
					value.modify(1.3, 'Battery');
				} else if (allyAbility === 'Power Spot' && ally !== pokemon) {
					value.modify(1.3, 'Power Spot');
				} else if (allyAbility === 'Steely Spirit' && moveType === 'Steel') {
					value.modify(1.5, 'Steely Spirit');
				}
			}
			for (const foe of pokemon.side.foe.active) {
				if (!foe || foe.fainted) continue;
				if (foe.ability === 'Fairy Aura' && moveType === 'Fairy') {
					auraBoosted = 'Fairy Aura';
				} else if (foe.ability === 'Dark Aura' && moveType === 'Dark') {
					auraBoosted = 'Dark Aura';
				} else if (foe.ability === 'Aura Break') {
					auraBroken = true;
				}
			}
			if (auraBoosted) {
				if (auraBroken) {
					value.modify(0.75, auraBoosted + ' + Aura Break');
				} else {
					value.modify(1.33, auraBoosted);
				}
			}
		}

		// Terrain
		if ((this.battle.hasPseudoWeather('Electric Terrain') && moveType === 'Electric') ||
			(this.battle.hasPseudoWeather('Grassy Terrain') && moveType === 'Grass') ||
			(this.battle.hasPseudoWeather('Psychic Terrain') && moveType === 'Psychic')) {
			if (pokemon.isGrounded(serverPokemon)) {
				value.modify(this.battle.gen > 7 ? 1.3 : 1.5, 'Terrain boost');
			}
		} else if (this.battle.hasPseudoWeather('Misty Terrain') && moveType === 'Dragon') {
			if (target ? target.isGrounded() : true) {
				value.modify(0.5, 'Misty Terrain + grounded target');
			}
		} else if (
			this.battle.hasPseudoWeather('Grassy Terrain') && ['earthquake', 'bulldoze', 'magnitude'].includes(move.id)
		) {
			if (target ? target.isGrounded() : true) {
				value.modify(0.5, 'Grassy Terrain + grounded target');
			}
		}
		if (
			move.id === 'expandingforce' &&
			this.battle.hasPseudoWeather('Psychic Terrain') &&
			pokemon.isGrounded(serverPokemon)
		) {
			value.modify(1.5, 'Expanding Force + Psychic Terrain boost');
		}
		if (move.id === 'mistyexplosion' && this.battle.hasPseudoWeather('Misty Terrain')) {
			value.modify(1.5, 'Misty Explosion + Misty Terrain boost');
		}
		if (move.id === 'risingvoltage' && this.battle.hasPseudoWeather('Electric Terrain') && target?.isGrounded()) {
			value.modify(2, 'Rising Voltage + Electric Terrain boost');
		}

		// Item
		value = this.getItemBoost(move, value, moveType);

		// Terastal base power floor
		if (
			pokemon.terastallized && (pokemon.terastallized === move.type || pokemon.terastallized === 'Stellar') &&
			value.value < 60 && move.priority <= 0 && !move.multihit && !(
				(move.basePower === 0 || move.basePower === 150) && move.basePowerCallback
			)
		) {
			value.set(60, 'Tera type BP minimum');
		}

		// Burn isn't really a base power modifier, so it needs to be applied after the Tera BP floor
		if (this.battle.gen > 2 && serverPokemon.status === 'brn' && move.id !== 'facade' && move.category === 'Physical') {
			if (!value.tryAbility("Guts")) value.modify(0.5, 'Burn');
		}

		if (
			move.id === 'steelroller' &&
			!this.battle.hasPseudoWeather('Electric Terrain') &&
			!this.battle.hasPseudoWeather('Grassy Terrain') &&
			!this.battle.hasPseudoWeather('Misty Terrain') &&
			!this.battle.hasPseudoWeather('Psychic Terrain')
		) {
			value.set(0, 'no Terrain');
		}

		// SSB
		if (this.battle.tier.includes('Super Staff Bros')) {
			if (move.id === 'bodycount') {
				value.set(50 + 50 * pokemon.side.faintCounter,
					pokemon.side.faintCounter > 0
						? `${pokemon.side.faintCounter} teammate${pokemon.side.faintCounter > 1 ? 's' : ''} KOed`
						: undefined);
			}
			// Base power based on times hit
			if (move.id === 'vengefulmood') {
				value.set(Math.min(140, 60 + 20 * pokemon.timesAttacked),
					pokemon.timesAttacked > 0
						? `Hit ${pokemon.timesAttacked} time${pokemon.timesAttacked > 1 ? 's' : ''}`
						: undefined);
			}
			if (move.id === 'alting' && pokemon.shiny) {
				value.set(69, 'Shiny');
			}
			if (move.id === 'darkmooncackle') {
				let boostCount = 0;
				for (const boost of Object.values(pokemon.boosts)) {
					if (boost > 0) boostCount += boost;
				}
				value.set(30 + 20 * boostCount);
			}
			if (move.id === 'buildingcharacter' && target?.terastallized) {
				value.modify(2, 'Terastallized target');
			}
			if (move.id === 'mysticalbonfire' && target?.status) {
				value.modify(1.5, 'Mystical Bonfire + status');
			}
			if (move.id === 'adaptivebeam' && target && Object.values(target.boosts).some(x => x > 0)) {
				value.set(0, "Target has more boosts");
			}
			if (value.value <= 60) {
				value.abilityModify(1.5, "Confirmed Town");
			}
			if (move.category !== 'Status' && allowTypeOverride && !move.isZ &&
				!move.isMax && !move.id.startsWith('hiddenpower')) {
				if (moveType === 'Normal') value.abilityModify(this.battle.gen > 6 ? 1.2 : 1.3, "I Can Hear The Heart Beating As One");
				value.abilityModify(this.battle.gen > 6 ? 1.2 : 1.3, "Acetosa");
			}
			if (move.flags['punch']) {
				value.abilityModify(1.5, "Harambe Hit");
			}
			if (move.flags['slicing']) {
				value.abilityModify(1.5, "I Can Hear The Heart Beating As One");
			}
			if (move.priority > 0) {
				value.abilityModify(2, "Full Bloom");
			}
			if (move.recoil || move.hasCrashDamage) {
				value.abilityModify(1.2, 'Hogwash');
				if (pokemon.name === "Billo") {
					value.modify(1.2);
				}
			}
			if (target?.gender === "M" && pokemon.getSpeciesForme().includes("Hearthflame")) {
				value.abilityModify(1.3, 'See No Evil, Hear No Evil, Speak No Evil');
			}
			for (let i = 1; i <= 5 && i <= pokemon.side.faintCounter; i++) {
				if (pokemon.volatiles[`fallen${i}`]) {
					value.abilityModify([1, 1.15, 1.3, 1.45, 1.6, 1.75][i], "Hardcore Hustle");
				}
			}
			let timeDilationBPMod = 1 + (0.1 * Math.floor(this.battle.turn / 10));
			if (timeDilationBPMod > 2) timeDilationBPMod = 2;
			value.abilityModify(timeDilationBPMod, "Time Dilation");
		}

		return value;
	}

	static incenseTypes: {[itemName: string]: TypeName} = {
		'Odd Incense': 'Psychic',
		'Rock Incense': 'Rock',
		'Rose Incense': 'Grass',
		'Sea Incense': 'Water',
		'Wave Incense': 'Water',
	};
	static itemTypes: {[itemName: string]: TypeName} = {
		'Black Belt': 'Fighting',
		'Black Glasses': 'Dark',
		'Charcoal': 'Fire',
		'Dragon Fang': 'Dragon',
		'Fairy Feather': 'Fairy',
		'Hard Stone': 'Rock',
		'Magnet': 'Electric',
		'Metal Coat': 'Steel',
		'Miracle Seed': 'Grass',
		'Mystic Water': 'Water',
		'Never-Melt Ice': 'Ice',
		'Poison Barb': 'Poison',
		'Sharp Beak': 'Flying',
		'Silk Scarf': 'Normal',
		'Silver Powder': 'Bug',
		'Soft Sand': 'Ground',
		'Spell Tag': 'Ghost',
		'Twisted Spoon': 'Psychic',
	};
	static orbUsers: {[speciesForme: string]: string[]} = {
		'Latias': ['Soul Dew'],
		'Latios': ['Soul Dew'],
		'Dialga': ['Adamant Crystal', 'Adamant Orb'],
		'Palkia': ['Lustrous Globe', 'Lustrous Orb'],
		'Giratina': ['Griseous Core', 'Griseous Orb'],
		'Venomicon': ['Vile Vial'],
	};
	static orbTypes: {[itemName: string]: TypeName[]} = {
		'Soul Dew': ['Psychic', 'Dragon'],
		'Adamant Crystal': ['Steel', 'Dragon'],
		'Adamant Orb': ['Steel', 'Dragon'],
		'Lustrous Globe': ['Water', 'Dragon'],
		'Lustrous Orb': ['Water', 'Dragon'],
		'Griseous Core': ['Ghost', 'Dragon'],
		'Griseous Orb': ['Ghost', 'Dragon'],
		'Vile Vial': ['Poison', 'Flying'],
	};
	static noGemMoves = [
		'Fire Pledge',
		'Fling',
		'Grass Pledge',
		'Struggle',
		'Water Pledge',
	];
	getItemBoost(move: Move, value: ModifiableValue, moveType: TypeName) {
		let item = this.battle.dex.items.get(value.serverPokemon.item);
		let itemName = item.name;
		let moveName = move.name;
		let species = this.battle.dex.species.get(value.serverPokemon.speciesForme);
		let isTransform = value.pokemon.volatiles.transform;
		let speciesName = isTransform && value.pokemon.volatiles.formechange?.[1] && this.battle.gen <= 4 ?
			this.battle.dex.species.get(value.pokemon.volatiles.formechange[1]).baseSpecies : species.baseSpecies;

		// Plates
		if (item.onPlate === moveType && !item.zMove) {
			value.itemModify(1.2);
			return value;
		}

		// Incenses
		if (BattleTooltips.incenseTypes[item.name] === moveType) {
			value.itemModify(1.2);
			return value;
		}

		// Type-enhancing items
		if (BattleTooltips.itemTypes[item.name] === moveType) {
			value.itemModify(this.battle.gen < 4 ? 1.1 : 1.2);
			return value;
		}

		// Light ball is a base power modifier in gen 4 only
		if (item.name === 'Light Ball' && this.battle.gen === 4 && speciesName === 'Pikachu') {
			value.itemModify(2);
			return value;
		}

		// Pokemon-specific items
		if (item.name === 'Soul Dew' && this.battle.gen < 7) return value;
		if (BattleTooltips.orbUsers[speciesName]?.includes(item.name) &&
			BattleTooltips.orbTypes[item.name]?.includes(moveType)) {
			value.itemModify(1.2);
			return value;
		}
		if (speciesName === 'Ogerpon') {
			const speciesForme = value.pokemon.getSpeciesForme();
			if ((speciesForme.startsWith('Ogerpon-Wellspring') && itemName === 'Wellspring Mask') ||
				(speciesForme.startsWith('Ogerpon-Hearthflame') && itemName === 'Hearthflame Mask') ||
				(speciesForme.startsWith('Ogerpon-Cornerstone') && itemName === 'Cornerstone Mask')) {
					value.itemModify(1.2);
					return value;
				}
		}

		// Gems
		if (BattleTooltips.noGemMoves.includes(moveName)) return value;
		if (itemName === moveType + ' Gem') {
			value.itemModify(this.battle.gen < 6 ? 1.5 : 1.3);
			return value;
		}

		if (itemName === 'Muscle Band' && move.category === 'Physical' ||
			itemName === 'Wise Glasses' && move.category === 'Special' ||
			itemName === 'Punching Glove' && move.flags['punch']) {
			value.itemModify(1.1);
		}

		return value;
	}
	getPokemonTypes(pokemon: Pokemon | ServerPokemon, preterastallized = false): ReadonlyArray<TypeName> {
		if (!(pokemon as Pokemon).getTypes) {
			return this.battle.dex.species.get(pokemon.speciesForme).types;
		}

		return (pokemon as Pokemon).getTypeList(undefined, preterastallized);
	}
	pokemonHasType(pokemon: Pokemon | ServerPokemon, type: TypeName, types?: ReadonlyArray<TypeName>) {
		if (!types) types = this.getPokemonTypes(pokemon);
		for (const curType of types) {
			if (curType === type) return true;
		}
		return false;
	}
	getAllyAbility(ally: Pokemon) {
		let serverPokemon;
		if (this.battle.myAllyPokemon) {
			serverPokemon = this.battle.myAllyPokemon[ally.slot];
		} else if (this.battle.myPokemon) {
			serverPokemon = this.battle.myPokemon[ally.slot];
		}
		return ally.effectiveAbility(serverPokemon);
	}
	getPokemonAbilityData(clientPokemon: Pokemon | null, serverPokemon: ServerPokemon | null | undefined) {
		const abilityData: {ability: string, baseAbility: string, possibilities: string[]} = {
			ability: '', baseAbility: '', possibilities: [],
		};
		if (clientPokemon) {
			if (clientPokemon.ability) {
				abilityData.ability = clientPokemon.ability || clientPokemon.baseAbility;
				if (clientPokemon.baseAbility) {
					abilityData.baseAbility = clientPokemon.baseAbility;
				}
			} else {
				const speciesForme = clientPokemon.getSpeciesForme() || serverPokemon?.speciesForme || '';
				const species = this.battle.dex.species.get(speciesForme);
				if (species.exists && species.abilities) {
					abilityData.possibilities = [species.abilities['0']];
					if (species.abilities['1']) abilityData.possibilities.push(species.abilities['1']);
					if (species.abilities['H']) abilityData.possibilities.push(species.abilities['H']);
					if (species.abilities['S']) abilityData.possibilities.push(species.abilities['S']);
					if (this.battle.rules['Frantic Fusions Mod']) {
						const fusionSpecies = this.battle.dex.species.get(clientPokemon.name);
						if (fusionSpecies.exists && fusionSpecies.name !== species.name) {
							abilityData.possibilities = Array.from(
								new Set(abilityData.possibilities.concat(Object.values(fusionSpecies.abilities)))
							);
						}
					}
				}
			}
		}
		if (serverPokemon) {
			if (!abilityData.ability) abilityData.ability = serverPokemon.ability || serverPokemon.baseAbility;
			if (!abilityData.baseAbility && serverPokemon.baseAbility) {
				abilityData.baseAbility = serverPokemon.baseAbility;
			}
		}
		return abilityData;
	}
	getPokemonAbilityText(
		clientPokemon: Pokemon | null,
		serverPokemon: ServerPokemon | null | undefined,
		isActive: boolean | undefined,
		hidePossible?: boolean
	) {
		let text = '';
		const abilityData = this.getPokemonAbilityData(clientPokemon, serverPokemon);
		if (!isActive) {
			// for switch tooltips, only show the original ability
			const ability = abilityData.baseAbility || abilityData.ability;
			if (ability) text = '<small>Ability:</small> ' + this.battle.dex.abilities.get(ability).name;
		} else {
			if (abilityData.ability) {
				const abilityName = this.battle.dex.abilities.get(abilityData.ability).name;
				text = '<small>Ability:</small> ' + abilityName;
				const baseAbilityName = this.battle.dex.abilities.get(abilityData.baseAbility).name;
				if (baseAbilityName && baseAbilityName !== abilityName) text += ' (base: ' + baseAbilityName + ')';
			}
		}
		const tier = this.battle.tier;
		if (!text && abilityData.possibilities.length && !hidePossible &&
			!(tier.includes('Almost Any Ability') || tier.includes('Hackmons') ||
				tier.includes('Inheritance') || tier.includes('Metronome'))) {
			text = '<small>Possible abilities:</small> ' + abilityData.possibilities.join(', ');
		}
		return text;
	}
}

type StatsTable = {hp: number, atk: number, def: number, spa: number, spd: number, spe: number};

/**
 * PokemonSet can be sparse, in which case that entry should be
 * inferred from the rest of the set, according to sensible
 * defaults.
 */
interface PokemonSet {
	/** Defaults to species name (not including forme), like in games */
	name?: string;
	species: string;
	/** Defaults to no item */
	item?: string;
	/** Defaults to no ability (error in Gen 3+) */
	ability?: string;
	moves: string[];
	/** Defaults to no nature (error in Gen 3+) */
	nature?: NatureName;
	/** Defaults to random legal gender, NOT subject to gender ratios */
	gender?: string;
	/** Defaults to flat 252's (200's/0's in Let's Go) (error in gen 3+) */
	evs?: Partial<StatsTable>;
	/** Defaults to whatever makes sense - flat 31's unless you have Gyro Ball etc */
	ivs?: StatsTable;
	/** Defaults as you'd expect (100 normally, 50 in VGC-likes, 5 in LC) */
	level?: number;
	/** Defaults to no (error if shiny event) */
	shiny?: boolean;
	/** Defaults to 255 unless you have Frustration, in which case 0 */
	happiness?: number;
	/** Defaults to event required ball, otherwise Poké Ball */
	pokeball?: string;
	/** Defaults to the type of your Hidden Power in Moves, otherwise Dark */
	hpType?: string;
	/** Defaults to 10 */
	dynamaxLevel?: number;
	/** Defaults to no (can only be yes for certain Pokemon) */
	gigantamax?: boolean;
	/** Defaults to the primary type */
	teraType?: string;
}

class BattleStatGuesser {
	formatid: ID;
	dex: ModdedDex;
	moveCount: any = null;
	hasMove: any = null;

	ignoreEVLimits: boolean;
	supportsEVs: boolean;
	supportsAVs: boolean;

	constructor(formatid: ID) {
		this.formatid = formatid;
		this.dex = formatid ? Dex.mod(formatid.slice(0, 4) as ID) : Dex;
		this.ignoreEVLimits = (
			this.dex.gen < 3 ||
			((this.formatid.endsWith('hackmons') || this.formatid.endsWith('bh')) && this.dex.gen !== 6) ||
			this.formatid.includes('metronomebattle') ||
			this.formatid.endsWith('norestrictions')
		);
		this.supportsEVs = !this.formatid.includes('letsgo');
		this.supportsAVs = !this.supportsEVs && this.formatid.endsWith('norestrictions');
	}
	guess(set: PokemonSet) {
		let role = this.guessRole(set);
		let comboEVs = this.guessEVs(set, role);
		let evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
		for (let stat in evs) {
			evs[stat as StatName] = comboEVs[stat as StatName] || 0;
		}
		let plusStat = comboEVs.plusStat || '';
		let minusStat = comboEVs.minusStat || '';
		return {role, evs, plusStat, minusStat, moveCount: this.moveCount, hasMove: this.hasMove};
	}
	guessRole(set: PokemonSet) {
		if (!set) return '?';
		if (!set.moves) return '?';

		let moveCount = {
			'Physical': 0,
			'Special': 0,
			'PhysicalAttack': 0,
			'SpecialAttack': 0,
			'PhysicalSetup': 0,
			'SpecialSetup': 0,
			'Support': 0,
			'Setup': 0,
			'Restoration': 0,
			'Offense': 0,
			'Stall': 0,
			'SpecialStall': 0,
			'PhysicalStall': 0,
			'Fast': 0,
			'Ultrafast': 0,
			'bulk': 0,
			'specialBulk': 0,
			'physicalBulk': 0,
		};
		let hasMove: {[moveid: string]: 1} = {};
		let itemid = toID(set.item);
		let item = this.dex.items.get(itemid);
		let abilityid = toID(set.ability);

		let species = this.dex.species.get(set.species || set.name!);
		if (item.megaEvolves === species.name) species = this.dex.species.get(item.megaStone);
		if (!species.exists) return '?';
		let stats = species.baseStats;

		if (set.moves.length < 1) return '?';
		let needsFourMoves = !['unown', 'ditto'].includes(species.id);
		let hasFourValidMoves = set.moves.length >= 4 && !set.moves.includes('');
		let moveids = set.moves.map(toID);
		if (moveids.includes('lastresort' as ID)) needsFourMoves = false;
		if (!hasFourValidMoves && needsFourMoves && !this.formatid.includes('metronomebattle')) {
			return '?';
		}

		for (let i = 0, len = set.moves.length; i < len; i++) {
			let move = this.dex.moves.get(set.moves[i]);
			hasMove[move.id] = 1;
			if (move.category === 'Status') {
				if (['batonpass', 'healingwish', 'lunardance'].includes(move.id)) {
					moveCount['Support']++;
				} else if (['metronome', 'assist', 'copycat', 'mefirst', 'photongeyser', 'shellsidearm'].includes(move.id)) {
					moveCount['Physical'] += 0.5;
					moveCount['Special'] += 0.5;
				} else if (move.id === 'naturepower') {
					moveCount['Special']++;
				} else if (['protect', 'detect', 'spikyshield', 'kingsshield'].includes(move.id)) {
					moveCount['Stall']++;
				} else if (move.id === 'wish') {
					moveCount['Restoration']++;
					moveCount['Stall']++;
					moveCount['Support']++;
				} else if (move.heal) {
					moveCount['Restoration']++;
					moveCount['Stall']++;
				} else if (move.target === 'self') {
					if (['agility', 'rockpolish', 'shellsmash', 'growth', 'workup'].includes(move.id)) {
						moveCount['PhysicalSetup']++;
						moveCount['SpecialSetup']++;
					} else if (['dragondance', 'swordsdance', 'coil', 'bulkup', 'curse', 'bellydrum'].includes(move.id)) {
						moveCount['PhysicalSetup']++;
					} else if (['nastyplot', 'tailglow', 'quiverdance', 'calmmind', 'geomancy'].includes(move.id)) {
						moveCount['SpecialSetup']++;
					}
					if (move.id === 'substitute') moveCount['Stall']++;
					moveCount['Setup']++;
				} else {
					if (['toxic', 'leechseed', 'willowisp'].includes(move.id)) {
						moveCount['Stall']++;
					}
					moveCount['Support']++;
				}
			} else if (['counter', 'endeavor', 'metalburst', 'mirrorcoat', 'rapidspin', 'comeuppance'].includes(move.id)) {
				moveCount['Support']++;
			} else if ([
				'nightshade', 'seismictoss', 'psywave', 'superfang', 'naturesmadness', 'foulplay', 'endeavor', 'finalgambit', 'bodypress', 'ruination',
			].includes(move.id)) {
				moveCount['Offense']++;
			} else if (move.id === 'fellstinger') {
				moveCount['PhysicalSetup']++;
				moveCount['Setup']++;
			} else {
				moveCount[move.category]++;
				moveCount['Offense']++;
				if (move.id === 'knockoff') {
					moveCount['Support']++;
				}
				if (['scald', 'voltswitch', 'uturn', 'flipturn', 'terablast'].includes(move.id)) {
					moveCount[move.category] -= 0.2;
				}
			}
		}
		if (hasMove['batonpass']) moveCount['Support'] += moveCount['Setup'];
		moveCount['PhysicalAttack'] = moveCount['Physical'];
		moveCount['Physical'] += moveCount['PhysicalSetup'];
		moveCount['SpecialAttack'] = moveCount['Special'];
		moveCount['Special'] += moveCount['SpecialSetup'];

		if (hasMove['dragondance'] || hasMove['quiverdance']) moveCount['Ultrafast'] = 1;

		let isFast = (stats.spe >= 80);
		let physicalBulk = (stats.hp + 75) * (stats.def + 87);
		let specialBulk = (stats.hp + 75) * (stats.spd + 87);

		if (hasMove['willowisp'] || hasMove['acidarmor'] || hasMove['irondefense'] || hasMove['cottonguard']) {
			physicalBulk *= 1.6;
			moveCount['PhysicalStall']++;
		} else if (hasMove['scald'] || hasMove['bulkup'] || hasMove['coil'] || hasMove['cosmicpower']) {
			physicalBulk *= 1.3;
			if (hasMove['scald']) { // partial stall goes in reverse
				moveCount['SpecialStall']++;
			} else {
				moveCount['PhysicalStall']++;
			}
		}
		if (abilityid === 'flamebody') physicalBulk *= 1.1;

		if (hasMove['calmmind'] || hasMove['quiverdance'] || hasMove['geomancy']) {
			specialBulk *= 1.3;
			moveCount['SpecialStall']++;
		}
		if (abilityid === 'sandstream' && species.types.includes('Rock')) {
			specialBulk *= 1.5;
		}

		if (hasMove['bellydrum']) {
			physicalBulk *= 0.6;
			specialBulk *= 0.6;
		}
		if (moveCount['Restoration']) {
			physicalBulk *= 1.5;
			specialBulk *= 1.5;
		} else if (hasMove['painsplit'] && hasMove['substitute']) {
			// SubSplit isn't generally a stall set
			moveCount['Stall']--;
		} else if (hasMove['painsplit'] || hasMove['rest']) {
			physicalBulk *= 1.4;
			specialBulk *= 1.4;
		}
		if ((hasMove['bodyslam'] || hasMove['thunder']) && abilityid === 'serenegrace' || hasMove['thunderwave']) {
			physicalBulk *= 1.1;
			specialBulk *= 1.1;
		}
		if ((hasMove['ironhead'] || hasMove['airslash']) && abilityid === 'serenegrace') {
			physicalBulk *= 1.1;
			specialBulk *= 1.1;
		}
		if (hasMove['gigadrain'] || hasMove['drainpunch'] || hasMove['hornleech']) {
			physicalBulk *= 1.15;
			specialBulk *= 1.15;
		}
		if (itemid === 'leftovers' || itemid === 'blacksludge') {
			physicalBulk *= 1 + 0.1 * (1 + moveCount['Stall'] / 1.5);
			specialBulk *= 1 + 0.1 * (1 + moveCount['Stall'] / 1.5);
		}
		if (hasMove['leechseed']) {
			physicalBulk *= 1 + 0.1 * (1 + moveCount['Stall'] / 1.5);
			specialBulk *= 1 + 0.1 * (1 + moveCount['Stall'] / 1.5);
		}
		if ((itemid === 'flameorb' || itemid === 'toxicorb') && abilityid !== 'magicguard') {
			if (itemid === 'toxicorb' && abilityid === 'poisonheal') {
				physicalBulk *= 1 + 0.1 * (2 + moveCount['Stall']);
				specialBulk *= 1 + 0.1 * (2 + moveCount['Stall']);
			} else {
				physicalBulk *= 0.8;
				specialBulk *= 0.8;
			}
		}
		if (itemid === 'lifeorb') {
			physicalBulk *= 0.7;
			specialBulk *= 0.7;
		}
		if (abilityid === 'multiscale' || abilityid === 'magicguard' || abilityid === 'regenerator') {
			physicalBulk *= 1.4;
			specialBulk *= 1.4;
		}
		if (itemid === 'eviolite') {
			physicalBulk *= 1.5;
			specialBulk *= 1.5;
		}
		if (itemid === 'assaultvest') {
			specialBulk *= 1.5;
		}

		let bulk = physicalBulk + specialBulk;
		if (bulk < 46000 && stats.spe >= 70) isFast = true;
		if (hasMove['trickroom']) isFast = false;
		moveCount['bulk'] = bulk;
		moveCount['physicalBulk'] = physicalBulk;
		moveCount['specialBulk'] = specialBulk;

		if (
			hasMove['agility'] || hasMove['dragondance'] || hasMove['quiverdance'] ||
			hasMove['rockpolish'] || hasMove['shellsmash'] || hasMove['flamecharge']
		) {
			isFast = true;
		} else if (abilityid === 'unburden' || abilityid === 'speedboost' || abilityid === 'motordrive') {
			isFast = true;
			moveCount['Ultrafast'] = 1;
		} else if (abilityid === 'chlorophyll' || abilityid === 'swiftswim' || abilityid === 'sandrush') {
			isFast = true;
			moveCount['Ultrafast'] = 2;
		} else if (itemid === 'salacberry') {
			isFast = true;
		}
		const ultrafast = hasMove['agility'] || hasMove['shellsmash'] ||
			hasMove['autotomize'] || hasMove['shiftgear'] || hasMove['rockpolish'];
		if (ultrafast) {
			moveCount['Ultrafast'] = 2;
		}
		moveCount['Fast'] = isFast ? 1 : 0;

		this.moveCount = moveCount;
		this.hasMove = hasMove;

		if (species.id === 'ditto') return abilityid === 'imposter' ? 'Physically Defensive' : 'Fast Bulky Support';
		if (species.id === 'shedinja') return 'Fast Physical Sweeper';

		if (itemid === 'choiceband' && moveCount['PhysicalAttack'] >= 2) {
			if (!isFast) return 'Bulky Band';
			return 'Fast Band';
		} else if (itemid === 'choicespecs' && moveCount['SpecialAttack'] >= 2) {
			if (!isFast) return 'Bulky Specs';
			return 'Fast Specs';
		} else if (itemid === 'choicescarf') {
			if (moveCount['PhysicalAttack'] === 0) return 'Special Scarf';
			if (moveCount['SpecialAttack'] === 0) return 'Physical Scarf';
			if (moveCount['PhysicalAttack'] > moveCount['SpecialAttack']) return 'Physical Biased Mixed Scarf';
			if (moveCount['PhysicalAttack'] < moveCount['SpecialAttack']) return 'Special Biased Mixed Scarf';
			if (stats.atk < stats.spa) return 'Special Biased Mixed Scarf';
			return 'Physical Biased Mixed Scarf';
		}

		if (species.id === 'unown') return 'Fast Special Sweeper';

		if (moveCount['PhysicalStall'] && moveCount['Restoration']) {
			if (stats.spe > 110 && abilityid !== 'prankster') return 'Fast Bulky Support';
			return 'Specially Defensive';
		}
		if (moveCount['SpecialStall'] && moveCount['Restoration'] && itemid !== 'lifeorb') {
			if (stats.spe > 110 && abilityid !== 'prankster') return 'Fast Bulky Support';
			return 'Physically Defensive';
		}

		let offenseBias: 'Physical' | 'Special' = 'Physical';
		if (stats.spa > stats.atk && moveCount['Special'] > 1) offenseBias = 'Special';
		else if (stats.atk > stats.spa && moveCount['Physical'] > 1) offenseBias = 'Physical';
		else if (moveCount['Special'] > moveCount['Physical']) offenseBias = 'Special';

		if (moveCount['Stall'] + moveCount['Support'] / 2 <= 2 && bulk < 135000 && moveCount[offenseBias] >= 1.5) {
			if (isFast) {
				if (bulk > 80000 && !moveCount['Ultrafast']) return 'Bulky ' + offenseBias + ' Sweeper';
				return 'Fast ' + offenseBias + ' Sweeper';
			} else {
				if (moveCount[offenseBias] >= 3 || moveCount['Stall'] <= 0) {
					return 'Bulky ' + offenseBias + ' Sweeper';
				}
			}
		}

		if (isFast && abilityid !== 'prankster') {
			if (stats.spe > 100 || bulk < 55000 || moveCount['Ultrafast']) {
				return 'Fast Bulky Support';
			}
		}
		if (moveCount['SpecialStall']) return 'Physically Defensive';
		if (moveCount['PhysicalStall']) return 'Specially Defensive';
		if (species.id === 'blissey' || species.id === 'chansey') return 'Physically Defensive';
		if (specialBulk >= physicalBulk) return 'Specially Defensive';
		return 'Physically Defensive';
	}
	ensureMinEVs(evs: StatsTable, stat: StatName, min: number, evTotal: number) {
		if (!evs[stat]) evs[stat] = 0;
		let diff = min - evs[stat];
		if (diff <= 0) return evTotal;
		if (evTotal <= 504) {
			let change = Math.min(508 - evTotal, diff);
			evTotal += change;
			evs[stat] += change;
			diff -= change;
		}
		if (diff <= 0) return evTotal;
		let evPriority = {def: 1, spd: 1, hp: 1, atk: 1, spa: 1, spe: 1};
		let prioStat: StatName;
		for (prioStat in evPriority) {
			if (prioStat === stat) continue;
			if (evs[prioStat] && evs[prioStat] > 128) {
				evs[prioStat] -= diff;
				evs[stat] += diff;
				return evTotal;
			}
		}
		return evTotal; // can't do it :(
	}
	ensureMaxEVs(evs: StatsTable, stat: StatName, min: number, evTotal: number) {
		if (!evs[stat]) evs[stat] = 0;
		let diff = evs[stat] - min;
		if (diff <= 0) return evTotal;
		evs[stat] -= diff;
		evTotal -= diff;
		return evTotal; // can't do it :(
	}
	guessEVs(set: PokemonSet, role: string): Partial<StatsTable> & {plusStat?: StatName | '', minusStat?: StatName | ''} {
		if (!set) return {};
		if (role === '?') return {};
		let species = this.dex.species.get(set.species || set.name!);
		let stats = species.baseStats;

		let hasMove = this.hasMove;
		let moveCount = this.moveCount;

		let evs: StatsTable & {plusStat?: StatName | '', minusStat?: StatName | ''} = {
			hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0,
		};
		let plusStat: StatName | '' = '';
		let minusStat: StatName | '' = '';

		let statChart: {[role: string]: [StatName, StatName]} = {
			'Bulky Band': ['atk', 'hp'],
			'Fast Band': ['spe', 'atk'],
			'Bulky Specs': ['spa', 'hp'],
			'Fast Specs': ['spe', 'spa'],
			'Physical Scarf': ['spe', 'atk'],
			'Special Scarf': ['spe', 'spa'],
			'Physical Biased Mixed Scarf': ['spe', 'atk'],
			'Special Biased Mixed Scarf': ['spe', 'spa'],
			'Fast Physical Sweeper': ['spe', 'atk'],
			'Fast Special Sweeper': ['spe', 'spa'],
			'Bulky Physical Sweeper': ['atk', 'hp'],
			'Bulky Special Sweeper': ['spa', 'hp'],
			'Fast Bulky Support': ['spe', 'hp'],
			'Physically Defensive': ['def', 'hp'],
			'Specially Defensive': ['spd', 'hp'],
		};

		plusStat = statChart[role][0];
		if (role === 'Fast Bulky Support') moveCount['Ultrafast'] = 0;
		if (plusStat === 'spe' && moveCount['Ultrafast']) {
			if (statChart[role][1] === 'atk' || statChart[role][1] === 'spa') {
				plusStat = statChart[role][1];
			} else if (moveCount['Physical'] >= 3) {
				plusStat = 'atk';
			} else if (stats.spd > stats.def) {
				plusStat = 'spd';
			} else {
				plusStat = 'def';
			}
		}

		if (this.supportsAVs) {
			// Let's Go, AVs enabled
			evs = {hp: 200, atk: 200, def: 200, spa: 200, spd: 200, spe: 200};
			if (!moveCount['PhysicalAttack']) evs.atk = 0;
			if (!moveCount['SpecialAttack']) evs.spa = 0;
			if (hasMove['gyroball'] || hasMove['trickroom']) evs.spe = 0;
		} else if (!this.supportsEVs) {
			// Let's Go, AVs disabled
			// no change
		} else if (this.ignoreEVLimits) {
			// Gen 1-2, hackable EVs (like Hackmons)
			evs = {hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252};
			if (!moveCount['PhysicalAttack']) evs.atk = 0;
			if (!moveCount['SpecialAttack'] && this.dex.gen > 1) evs.spa = 0;
			if (hasMove['gyroball'] || hasMove['trickroom']) evs.spe = 0;
			if (this.dex.gen === 1) evs.spd = 0;
			if (this.dex.gen < 3) return evs;
		} else {
			// Normal Gen 3-7
			if (!statChart[role]) return {};

			let evTotal = 0;

			let primaryStat = statChart[role][0];
			let stat = this.getStat(primaryStat, set, 252, plusStat === primaryStat ? 1.1 : 1.0);
			let ev = 252;
			while (ev > 0 && stat <= this.getStat(primaryStat, set, ev - 4, plusStat === primaryStat ? 1.1 : 1.0)) ev -= 4;
			evs[primaryStat] = ev;
			evTotal += ev;

			let secondaryStat: StatName | null = statChart[role][1];
			if (secondaryStat === 'hp' && set.level && set.level < 20) secondaryStat = 'spd';
			stat = this.getStat(secondaryStat, set, 252, plusStat === secondaryStat ? 1.1 : 1.0);
			ev = 252;
			while (ev > 0 && stat <= this.getStat(secondaryStat, set, ev - 4, plusStat === secondaryStat ? 1.1 : 1.0)) ev -= 4;
			evs[secondaryStat] = ev;
			evTotal += ev;

			let SRweaknesses = ['Fire', 'Flying', 'Bug', 'Ice'];
			let SRresistances = ['Ground', 'Steel', 'Fighting'];
			let SRweak = 0;
			if (set.ability !== 'Magic Guard' && set.ability !== 'Mountaineer') {
				if (SRweaknesses.indexOf(species.types[0]) >= 0) {
					SRweak++;
				} else if (SRresistances.indexOf(species.types[0]) >= 0) {
					SRweak--;
				}
				if (SRweaknesses.indexOf(species.types[1]) >= 0) {
					SRweak++;
				} else if (SRresistances.indexOf(species.types[1]) >= 0) {
					SRweak--;
				}
			}
			let hpDivisibility = 0;
			let hpShouldBeDivisible = false;
			let hp = evs['hp'] || 0;
			stat = this.getStat('hp', set, hp, 1);
			if ((set.item === 'Leftovers' || set.item === 'Black Sludge') && hasMove['substitute'] && stat !== 404) {
				hpDivisibility = 4;
			} else if (set.item === 'Leftovers' || set.item === 'Black Sludge') {
				hpDivisibility = 0;
			} else if (hasMove['bellydrum'] && (set.item || '').slice(-5) === 'Berry') {
				hpDivisibility = 2;
				hpShouldBeDivisible = true;
			} else if (hasMove['substitute'] && (set.item || '').slice(-5) === 'Berry') {
				hpDivisibility = 4;
				hpShouldBeDivisible = true;
			} else if (SRweak >= 2 || hasMove['bellydrum']) {
				hpDivisibility = 2;
			} else if (SRweak >= 1 || hasMove['substitute'] || hasMove['transform']) {
				hpDivisibility = 4;
			} else if (set.ability !== 'Magic Guard') {
				hpDivisibility = 8;
			}

			if (hpDivisibility) {
				while (hp < 252 && evTotal < 508 && !(stat % hpDivisibility) !== hpShouldBeDivisible) {
					hp += 4;
					stat = this.getStat('hp', set, hp, 1);
					evTotal += 4;
				}
				while (hp > 0 && !(stat % hpDivisibility) !== hpShouldBeDivisible) {
					hp -= 4;
					stat = this.getStat('hp', set, hp, 1);
					evTotal -= 4;
				}
				while (hp > 0 && stat === this.getStat('hp', set, hp - 4, 1)) {
					hp -= 4;
					evTotal -= 4;
				}
				if (hp || evs['hp']) evs['hp'] = hp;
			}

			if (species.id === 'tentacruel') {
				evTotal = this.ensureMinEVs(evs, 'spe', 16, evTotal);
			} else if (species.id === 'skarmory') {
				evTotal = this.ensureMinEVs(evs, 'spe', 24, evTotal);
			} else if (species.id === 'jirachi') {
				evTotal = this.ensureMinEVs(evs, 'spe', 32, evTotal);
			} else if (species.id === 'celebi') {
				evTotal = this.ensureMinEVs(evs, 'spe', 36, evTotal);
			} else if (species.id === 'volcarona') {
				evTotal = this.ensureMinEVs(evs, 'spe', 52, evTotal);
			} else if (species.id === 'gliscor') {
				evTotal = this.ensureMinEVs(evs, 'spe', 72, evTotal);
			} else if (species.id === 'dragonite' && evs['hp']) {
				evTotal = this.ensureMaxEVs(evs, 'spe', 220, evTotal);
			}

			if (evTotal < 508) {
				let remaining = 508 - evTotal;
				if (remaining > 252) remaining = 252;
				secondaryStat = null;
				if (!evs['atk'] && moveCount['PhysicalAttack'] >= 1) {
					secondaryStat = 'atk';
				} else if (!evs['spa'] && moveCount['SpecialAttack'] >= 1) {
					secondaryStat = 'spa';
				} else if (stats.hp === 1 && !evs['def']) {
					secondaryStat = 'def';
				} else if (stats.def === stats.spd && !evs['spd']) {
					secondaryStat = 'spd';
				} else if (!evs['spd']) {
					secondaryStat = 'spd';
				} else if (!evs['def']) {
					secondaryStat = 'def';
				}
				if (secondaryStat) {
					ev = remaining;
					stat = this.getStat(secondaryStat, set, ev);
					while (ev > 0 && stat === this.getStat(secondaryStat, set, ev - 4)) ev -= 4;
					if (ev) evs[secondaryStat] = ev;
					remaining -= ev;
				}
				if (remaining && !evs['spe']) {
					ev = remaining;
					stat = this.getStat('spe', set, ev);
					while (ev > 0 && stat === this.getStat('spe', set, ev - 4)) ev -= 4;
					if (ev) evs['spe'] = ev;
				}
			}

		}

		if (hasMove['gyroball'] || hasMove['trickroom']) {
			minusStat = 'spe';
		} else if (!moveCount['PhysicalAttack']) {
			minusStat = 'atk';
		} else if (moveCount['SpecialAttack'] < 1 && !evs['spa']) {
			if (moveCount['SpecialAttack'] < moveCount['PhysicalAttack']) {
				minusStat = 'spa';
			} else if (!evs['atk']) {
				minusStat = 'atk';
			}
		} else if (moveCount['PhysicalAttack'] < 1 && !evs['atk']) {
			minusStat = 'atk';
		} else if (stats.def > stats.spe && stats.spd > stats.spe && !evs['spe']) {
			minusStat = 'spe';
		} else if (stats.def > stats.spd) {
			minusStat = 'spd';
		} else {
			minusStat = 'def';
		}

		if (plusStat === minusStat) {
			minusStat = (plusStat === 'spe' ? 'spd' : 'spe');
		}

		evs.plusStat = plusStat;
		evs.minusStat = minusStat;

		return evs;
	}

	getStat(stat: StatName, set: PokemonSet, evOverride?: number, natureOverride?: number) {
		let species = this.dex.species.get(set.species);
		if (!species.exists) return 0;

		let level = set.level || 100;

		let baseStat = species.baseStats[stat];

		let iv = (set.ivs && set.ivs[stat]);
		if (typeof iv !== 'number') iv = 31;
		if (this.dex.gen <= 2) iv &= 30;

		let ev = (set.evs && set.evs[stat]);
		if (typeof ev !== 'number') ev = (this.dex.gen > 2 ? 0 : 252);
		if (evOverride !== undefined) ev = evOverride;

		if (stat === 'hp') {
			if (baseStat === 1) return 1;
			if (!this.supportsEVs) return ~~(~~(2 * baseStat + iv + 100) * level / 100 + 10) + (this.supportsAVs ? ev : 0);
			return ~~(~~(2 * baseStat + iv + ~~(ev / 4) + 100) * level / 100 + 10);
		}
		let val = ~~(~~(2 * baseStat + iv + ~~(ev / 4)) * level / 100 + 5);
		if (!this.supportsEVs) {
			val = ~~(~~(2 * baseStat + iv) * level / 100 + 5);
		}
		if (natureOverride) {
			val *= natureOverride;
		} else if (BattleNatures[set.nature!]?.plus === stat) {
			val *= 1.1;
		} else if (BattleNatures[set.nature!]?.minus === stat) {
			val *= 0.9;
		}
		if (!this.supportsEVs) {
			let friendshipValue = ~~((70 / 255 / 10 + 1) * 100);
			val = ~~(val) * friendshipValue / 100 + (this.supportsAVs ? ev : 0);
		}
		return ~~(val);
	}
}

function BattleStatOptimizer(set: PokemonSet, formatid: ID) {
	if (!set.evs) return null;

	const dex = Dex.mod(formatid.slice(0, 4) as ID);
	const ignoreEVLimits = (
		dex.gen < 3 ||
		((formatid.endsWith('hackmons') || formatid.endsWith('bh')) && dex.gen !== 6) ||
		formatid.includes('metronomebattle') || formatid.endsWith('norestrictions')
	);
	const supportsEVs = !formatid.includes('letsgo');
	if (!supportsEVs || ignoreEVLimits) return false;

	const species = dex.species.get(set.species);
	const level = set.level || 100;
	const getStat = (stat: StatNameExceptHP, ev: number, nature: Nature) => {
		const baseStat = species.baseStats[stat];
		const iv = set.ivs?.[stat] || 31;
		let val = ~~(~~(2 * baseStat + iv + ~~(ev / 4)) * level / 100 + 5);
		if (nature.plus === stat) {
			val *= 1.1;
		} else if (nature.minus === stat) {
			val *= 0.9;
		}
		return ~~(val);
	};

	const origNature = BattleNatures[set.nature || 'Serious'];
	const origStats = {
		// no need to calculate hp
		atk: getStat('atk', set.evs.atk || 0, origNature),
		def: getStat('def', set.evs.def || 0, origNature),
		spa: getStat('spa', set.evs.spa || 0, origNature),
		spd: getStat('spd', set.evs.spd || 0, origNature),
		spe: getStat('spe', set.evs.spe || 0, origNature),
	};
	const getMinEVs = (stat: StatNameExceptHP, nature: Nature) => {
		let ev = 0;
		while (getStat(stat, ev, nature) < origStats[stat]) {
			ev += 4;
		}
		return ev;
	};

	const origSpread = {evs: set.evs, ...origNature};
	let origLeftoverEVs = 508;
	for (const stat of Dex.statNames) {
		origLeftoverEVs -= origSpread.evs?.[stat] || 0;
	}
	// Only check for optimizations if EVs are completed
	if (origLeftoverEVs > 4) return null;

	// Can't move the plus if it boosts its stat past normal EV limit
	const plusTooHigh = origNature.plus && getStat(origNature.plus, 252, {}) < origStats[origNature.plus];
	// Can't move the minus if there's no investment in its stat to redistribute
	const minusTooLow = origNature.minus && !origSpread.evs?.[origNature.minus];
	// If we can't move either of them, do nothing
	if (plusTooHigh && minusTooLow) return null;

	let bestPlus = origNature.plus;
	let bestPlusMinEVs = bestPlus && origSpread.evs[bestPlus];
	let bestMinus = origNature.minus || 'atk';
	let bestMinusMinEVs = origSpread.evs[bestMinus];
	let savedEVs = 0;

	// Try and move the minus first, as figuring out where the plus should go is harder if the minus hasn't been placed
	if (!minusTooLow) {
		for (const stat of Dex.statNamesExceptHP) {
			if (origStats[stat] < origStats[bestMinus]) {
				const minEVs = getMinEVs(stat, {minus: stat});
				if (minEVs > 252) continue;
				// This number can go negative at this point, but we'll make up for it later (and check to make sure)
				savedEVs = (origSpread.evs[stat] || 0) - minEVs;
				if (origNature.minus) {
					savedEVs += (origSpread.evs[origNature.minus] || 0) - getMinEVs(origNature.minus, {minus: stat});
				}
				bestMinus = stat;
				bestMinusMinEVs = minEVs;
			}
		}
	}
	if (!plusTooHigh) {
		for (const stat of Dex.statNamesExceptHP) {
			// Don't move the plus to an uninvested stat
			if (stat !== origNature.plus && origSpread.evs[stat] && stat !== bestMinus) {
				const minEVs = getMinEVs(stat, {plus: stat});
				let plusEVsSaved = (origNature.minus === stat ? getMinEVs(stat, {}) : origSpread.evs[stat] || 0) - minEVs;
				if (bestPlus && bestPlus !== bestMinus) {
					plusEVsSaved += bestPlusMinEVs! - getMinEVs(bestPlus, {plus: stat, minus: bestMinus});
				}
				if (plusEVsSaved > 0 && savedEVs + plusEVsSaved > 0) {
					savedEVs += plusEVsSaved;
					bestPlus = stat;
					bestPlusMinEVs = minEVs;
				} else if (plusEVsSaved === 0 && (bestPlus || savedEVs > 0) || plusEVsSaved > 0 && savedEVs + plusEVsSaved === 0) {
					if (!bestPlus || getStat(stat, getMinEVs(stat, {plus: stat}), {plus: stat}) > origStats[stat]) {
						savedEVs += plusEVsSaved;
						bestPlus = stat;
						bestPlusMinEVs = minEVs;
					}
				}
			}
		}
	}

	if (bestPlus && savedEVs >= 0) {
		const newSpread: {
			evs: Partial<StatsTable>,
			plus?: StatNameExceptHP,
			minus?: StatNameExceptHP,
		} = {evs: {...origSpread.evs}, plus: bestPlus, minus: bestMinus};
		if (bestPlus !== origNature.plus || bestMinus !== origNature.minus) {
			newSpread.evs[bestPlus] = bestPlusMinEVs!;
			newSpread.evs[bestMinus] = bestMinusMinEVs!;
			if (origNature.plus && origNature.plus !== bestPlus && origNature.plus !== bestMinus) {
				newSpread.evs[origNature.plus] = getMinEVs(origNature.plus, newSpread);
			}
			if (origNature.minus && origNature.minus !== bestPlus && origNature.minus !== bestMinus) {
				newSpread.evs[origNature.minus] = getMinEVs(origNature.minus, newSpread);
			}
			for (const stat of Dex.statNames) {
				if (!newSpread.evs[stat]) delete newSpread.evs[stat];
			}
			return {...newSpread, savedEVs};
		} else if (!plusTooHigh && !minusTooLow) {
			if (Math.floor(getStat(bestPlus, bestMinusMinEVs!, newSpread) / 11) <= Math.ceil(origStats[bestMinus] / 9)) {
				// We're not gaining more points from our plus than we're losing to our minus
				// So a neutral nature would be better
				delete newSpread.plus;
				delete newSpread.minus;
				newSpread.evs[origNature.plus] = getMinEVs(origNature.plus, newSpread);
				newSpread.evs[origNature.minus] = getMinEVs(origNature.minus, newSpread);
				savedEVs += (origSpread.evs[origNature.plus] || 0) - newSpread.evs[origNature.plus]!;
				savedEVs += (origSpread.evs[origNature.minus] || 0) - newSpread.evs[origNature.minus]!;
				if (savedEVs < 0) return null;
				for (const stat of Dex.statNames) {
					if (!newSpread.evs[stat]) delete newSpread.evs[stat];
				}
				return {...newSpread, savedEVs};
			}
		}
	}

	return null;
}

if (typeof require === 'function') {
	// in Node
	(global as any).BattleStatGuesser = BattleStatGuesser;
	(global as any).BattleStatOptimizer = BattleStatOptimizer;
}
