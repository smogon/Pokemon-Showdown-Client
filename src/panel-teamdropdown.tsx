/**
 * Team Selector Panel
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */

class PSTeambuilder {
	static packTeam(team: PokemonSet[]) {
		let buf = '';
		if (!team) return '';

		for (const set of team) {
			let hasHP = '';
			if (buf) buf += ']';

			// name
			buf += set.name || set.species;

			// species
			let id = toID(set.species);
			buf += '|' + (toID(set.name || set.species) === id ? '' : id);

			// item
			buf += '|' + toID(set.item);

			// ability
			id = toID(set.ability);
			buf += '|' + (id || '-');

			// moves
			buf += '|';
			if (set.moves) {
				for (let j = 0; j < set.moves.length; j++) {
					let moveid = toID(set.moves[j]);
					if (j && !moveid) continue;
					buf += (j ? ',' : '') + moveid;
					if (moveid.substr(0, 11) === 'hiddenpower' && moveid.length > 11) {
						hasHP = moveid.slice(11);
					}
				}
			}

			// nature
			buf += '|' + (set.nature || '');

			// evs
			if (set.evs) {
				buf += '|' + (set.evs['hp'] || '') + ',' +
					(set.evs['atk'] || '') + ',' +
					(set.evs['def'] || '') + ',' +
					(set.evs['spa'] || '') + ',' +
					(set.evs['spd'] || '') + ',' +
					(set.evs['spe'] || '');
			} else {
				buf += '|';
			}

			// gender
			if (set.gender) {
				buf += '|' + set.gender;
			} else {
				buf += '|';
			}

			// ivs
			if (set.ivs) {
				buf += '|' + (set.ivs['hp'] === 31 ? '' : set.ivs['hp']) + ',' +
					(set.ivs['atk'] === 31 ? '' : set.ivs['atk']) + ',' +
					(set.ivs['def'] === 31 ? '' : set.ivs['def']) + ',' +
					(set.ivs['spa'] === 31 ? '' : set.ivs['spa']) + ',' +
					(set.ivs['spd'] === 31 ? '' : set.ivs['spd']) + ',' +
					(set.ivs['spe'] === 31 ? '' : set.ivs['spe']);
			} else {
				buf += '|';
			}

			// shiny
			if (set.shiny) {
				buf += '|S';
			} else {
				buf += '|';
			}

			// level
			if (set.level) {
				buf += '|' + set.level;
			} else {
				buf += '|';
			}

			// happiness
			if (set.happiness !== undefined) {
				buf += '|' + set.happiness;
			} else {
				buf += '|';
			}

			if (
				set.pokeball || (set.hpType && toID(set.hpType) !== hasHP) || set.gigantamax ||
				(set.dynamaxLevel !== undefined && set.dynamaxLevel !== 10)
			) {
				buf += ',' + (set.hpType || '');
				buf += ',' + toID(set.pokeball);
				buf += ',' + (set.gigantamax ? 'G' : '');
				buf += ',' + (set.dynamaxLevel !== undefined && set.dynamaxLevel !== 10 ? set.dynamaxLevel : '');
			}
		}

		return buf;
	}

	static unpackTeam(buf: string) {
		if (!buf) return [];

		let team: PokemonSet[] = [];

		for (const setBuf of buf.split(`]`)) {
			const parts = setBuf.split(`|`);
			if (parts.length < 11) continue;
			let set: PokemonSet = {species: '', moves: []};
			team.push(set);

			// name
			set.name = parts[0];

			// species
			set.species = Dex.species.get(parts[1]).name || set.name;

			// item
			set.item = Dex.items.get(parts[2]).name;

			// ability
			const species = Dex.species.get(set.species);
			set.ability = parts[3] === '-' ?
				'' :
				(species.baseSpecies === 'Zygarde' && parts[3] === 'H') ?
				'Power Construct' :
				['', '0', '1', 'H', 'S'].includes(parts[3]) ?
				species.abilities[parts[3] as '0' || '0'] || (parts[3] === '' ? '' : '!!!ERROR!!!') :
				Dex.abilities.get(parts[3]).name;

			// moves
			set.moves = parts[4].split(',').map(moveid =>
				Dex.moves.get(moveid).name
			);

			// nature
			set.nature = parts[5] as NatureName;
			if (set.nature as any === 'undefined') set.nature = undefined;

			// evs
			if (parts[6]) {
				if (parts[6].length > 5) {
					const evs = parts[6].split(',');
					set.evs = {
						hp: Number(evs[0]) || 0,
						atk: Number(evs[1]) || 0,
						def: Number(evs[2]) || 0,
						spa: Number(evs[3]) || 0,
						spd: Number(evs[4]) || 0,
						spe: Number(evs[5]) || 0,
					};
				} else if (parts[6] === '0') {
					set.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
				}
			}

			// gender
			if (parts[7]) set.gender = parts[7];

			// ivs
			if (parts[8]) {
				const ivs = parts[8].split(',');
				set.ivs = {
					hp: ivs[0] === '' ? 31 : Number(ivs[0]),
					atk: ivs[1] === '' ? 31 : Number(ivs[1]),
					def: ivs[2] === '' ? 31 : Number(ivs[2]),
					spa: ivs[3] === '' ? 31 : Number(ivs[3]),
					spd: ivs[4] === '' ? 31 : Number(ivs[4]),
					spe: ivs[5] === '' ? 31 : Number(ivs[5]),
				};
			}

			// shiny
			if (parts[9]) set.shiny = true;

			// level
			if (parts[10]) set.level = parseInt(parts[9], 10);

			// happiness
			if (parts[11]) {
				let misc = parts[11].split(',', 4);
				set.happiness = (misc[0] ? Number(misc[0]) : undefined);
				set.hpType = misc[1];
				set.pokeball = misc[2];
				set.gigantamax = !!misc[3];
				set.dynamaxLevel = (misc[4] ? Number(misc[4]) : 10);
			}
		}

		return team;
	}
	/**
	 * (Exports end with two spaces so linebreaks are preserved in Markdown;
	 * I assume mostly for Reddit.)
	 */
	static exportSet(set: PokemonSet) {
		let text = '';

		// core
		if (set.name && set.name !== set.species) {
			text += `${set.name} (${set.species})`;
		} else {
			text += `${set.species}`;
		}
		if (set.gender === 'M') text += ` (M)`;
		if (set.gender === 'F') text += ` (F)`;
		if (set.item) {
			text += ` @ ${set.item}`;
		}
		text += `  \n`;
		if (set.ability) {
			text += `Ability: ${set.ability}  \n`;
		}
		if (set.moves) {
			for (let move of set.moves) {
				if (move.substr(0, 13) === 'Hidden Power ') {
					const hpType = move.slice(13);
					move = move.slice(0, 13);
					move = `${move}[${hpType}]`;
				}
				if (move) {
					text += `- ${move}  \n`;
				}
			}
		}

		// stats
		let first = true;
		if (set.evs) {
			for (const stat of Dex.statNames) {
				if (!set.evs[stat]) continue;
				if (first) {
					text += `EVs: `;
					first = false;
				} else {
					text += ` / `;
				}
				text += `${set.evs[stat]} ${BattleStatNames[stat]}`;
			}
		}
		if (!first) {
			text += `  \n`;
		}
		if (set.nature) {
			text += `${set.nature} Nature  \n`;
		}
		first = true;
		if (set.ivs) {
			for (const stat of Dex.statNames) {
				if (set.ivs[stat] === undefined || isNaN(set.ivs[stat]) || set.ivs[stat] === 31) continue;
				if (first) {
					text += `IVs: `;
					first = false;
				} else {
					text += ` / `;
				}
				text += `${set.ivs[stat]} ${BattleStatNames[stat]}`;
			}
		}
		if (!first) {
			text += `  \n`;
		}

		// details
		if (set.level && set.level !== 100) {
			text += `Level: ${set.level}  \n`;
		}
		if (set.shiny) {
			text += `Shiny: Yes  \n`;
		}
		if (typeof set.happiness === 'number' && set.happiness !== 255 && !isNaN(set.happiness)) {
			text += `Happiness: ${set.happiness}  \n`;
		}
		if (typeof set.dynamaxLevel === 'number' && set.dynamaxLevel !== 255 && !isNaN(set.dynamaxLevel)) {
			text += `Dynamax Level: ${set.dynamaxLevel}  \n`;
		}
		if (set.gigantamax) {
			text += `Gigantamax: Yes  \n`;
		}

		text += `\n`;
		return text;
	}
	static exportTeam(sets: PokemonSet[]) {
		let text = '';
		for (const set of sets) {
			// core
			text += PSTeambuilder.exportSet(set);
		}
		return text;
	}
	static splitPrefix(buffer: string, delimiter: string, prefixOffset = 0): [string, string] {
		const delimIndex = buffer.indexOf(delimiter);
		if (delimIndex < 0) return ['', buffer];
		return [buffer.slice(prefixOffset, delimIndex), buffer.slice(delimIndex + delimiter.length)];
	}
	static splitLast(buffer: string, delimiter: string): [string, string] {
		const delimIndex = buffer.lastIndexOf(delimiter);
		if (delimIndex < 0) return [buffer, ''];
		return [buffer.slice(0, delimIndex), buffer.slice(delimIndex + delimiter.length)];
	}
	static parseExportedTeamLine(
		line: string, isFirstLine: boolean, set: PokemonSet, format: string | undefined = undefined
	) {
		if (isFirstLine) {
			let item;
			[line, item] = line.split(' @ ');
			if (item) {
				set.item = item;
				if (toID(set.item) === 'noitem') set.item = '';
			}
			if (line.endsWith(' (M)')) {
				set.gender = 'M';
				line = line.slice(0, -4);
			}
			if (line.endsWith(' (F)')) {
				set.gender = 'F';
				line = line.slice(0, -4);
			}
			let parenIndex = line.lastIndexOf(' (');
			if (line.charAt(line.length - 1) === ')' && parenIndex !== -1) {
				set.species = Dex.species.get(line.slice(parenIndex + 2, -1)).name;
				set.name = line.slice(0, parenIndex);
			} else {
				set.species = Dex.species.get(line).name;
				set.name = '';
			}
		} else if (line.startsWith('Trait: ')) {
			line = line.slice(7);
			set.ability = line;
		} else if (line.startsWith('Ability: ')) {
			line = line.slice(9);
			set.ability = line;
		} else if (line === 'Shiny: Yes') {
			set.shiny = true;
		} else if (line.startsWith('Level: ')) {
			line = line.slice(7);
			set.level = +line;
		} else if (line.startsWith('Happiness: ')) {
			line = line.slice(11);
			set.happiness = +line;
		} else if (line.startsWith('Pokeball: ')) {
			line = line.slice(10);
			set.pokeball = line;
		} else if (line.startsWith('Hidden Power: ')) {
			line = line.slice(14);
			set.hpType = line;
		} else if (line.startsWith('Dynamax Level: ')) {
			line = line.substr(15);
			set.dynamaxLevel = +line;
		} else if (line === 'Gigantamax: Yes') {
			set.gigantamax = true;
		} else if (line.startsWith('EVs: ')) {
			line = line.slice(5);
			let evLines = line.split('/');
			set.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
			for (let evLine of evLines) {
				evLine = evLine.trim();
				let spaceIndex = evLine.indexOf(' ');
				if (spaceIndex === -1) continue;
				let statid = BattleStatIDs[evLine.slice(spaceIndex + 1)];
				if (!statid) continue;
				let statval = parseInt(evLine.slice(0, spaceIndex), 10);
				set.evs[statid] = statval;
			}
		} else if (line.startsWith('IVs: ')) {
			line = line.slice(5);
			let ivLines = line.split(' / ');
			set.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
			for (let ivLine of ivLines) {
				ivLine = ivLine.trim();
				let spaceIndex = ivLine.indexOf(' ');
				if (spaceIndex === -1) continue;
				let statid = BattleStatIDs[ivLine.slice(spaceIndex + 1)];
				if (!statid) continue;
				let statval = parseInt(ivLine.slice(0, spaceIndex), 10);
				if (isNaN(statval)) statval = 31;
				set.ivs[statid] = statval;
			}
		} else if (line.match(/^[A-Za-z]+ (N|n)ature/)) {
			let natureIndex = line.indexOf(' Nature');
			if (natureIndex === -1) natureIndex = line.indexOf(' nature');
			if (natureIndex === -1) return;
			line = line.substr(0, natureIndex);
			if (line !== 'undefined') set.nature = line as NatureName;
		} else if (line.charAt(0) === '-' || line.charAt(0) === '~') {
			line = line.slice(line.charAt(1) === ' ' ? 2 : 1);
			if (line.startsWith('Hidden Power [')) {
				const hpType = line.slice(14, -1) as TypeName;
				line = 'Hidden Power ' + hpType;
				if (format && (parseInt(format[3], 10) || 6) < 7) {
					if (!set.ivs && Dex.types.isName(hpType)) {
						set.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
						const hpIVs = Dex.types.get(hpType).HPivs || {};
						for (let stat in hpIVs) {
							set.ivs[stat as StatName] = hpIVs[stat as StatName]!;
						}
					}
				}
			}
			if (line === 'Frustration' && set.happiness === undefined) {
				set.happiness = 0;
			}
			set.moves.push(line);
		}
	}
	static importTeam(buffer: string): PokemonSet[] {
		const lines = buffer.split("\n");

		const sets: PokemonSet[] = [];
		let curSet: PokemonSet | null = null;

		while (lines.length && !lines[0]) lines.shift();
		while (lines.length && !lines[lines.length - 1]) lines.pop();

		if (lines.length === 1 && lines[0].includes('|')) {
			return this.unpackTeam(lines[0]);
		}
		for (let line of lines) {
			line = line.trim();
			if (line === '' || line === '---') {
				curSet = null;
			} else if (line.startsWith('===')) {
				// team backup format; ignore
			} else if (line.includes('|')) {
				// packed format
				const team = PS.teams.unpackLine(line);
				if (!team) continue;
				return this.unpackTeam(team.packedTeam);
			} else if (!curSet) {
				curSet = {
					name: '', species: '', gender: '',
					moves: [],
				};
				sets.push(curSet);
				this.parseExportedTeamLine(line, true, curSet);
			} else {
				this.parseExportedTeamLine(line, false, curSet);
			}
		}
		return sets;
	}
	static importTeamBackup(buffer: string): Team[] {
		const teams: Team[] = [];
		const lines = buffer.split("\n");

		let curTeam: Team | null = null;
		let sets: PokemonSet[] | null = null;

		let curSet: PokemonSet | null = null;

		while (lines.length && !lines[0]) lines.shift();
		while (lines.length && !lines[lines.length - 1]) lines.pop();

		for (let line of lines) {
			line = line.trim();
			if (line === '' || line === '---') {
				curSet = null;
			} else if (line.startsWith('===')) {
				if (curTeam) {
					// not the first team, store the previous team
					curTeam.packedTeam = this.packTeam(sets!);
					teams.push(curTeam);
				}

				curTeam = {
					name: '',
					format: '' as ID,
					packedTeam: '',
					folder: '',
					key: '',
					iconCache: '',
				};
				sets = [];

				line = line.slice(3, -3).trim();
				[curTeam.format, line] = this.splitPrefix(line, ']', 1) as [ID, string];
				if (!curTeam.format) curTeam.format = 'gen8' as ID;
				else if (!curTeam.format.startsWith('gen')) curTeam.format = `gen6${curTeam.format}` as ID;

				[curTeam.folder, curTeam.name] = this.splitPrefix(line, '/');
			} else if (line.includes('|')) {
				if (curTeam) {
					// not the first team, store the previous team
					curTeam.packedTeam = this.packTeam(sets!);
					teams.push(curTeam);
				}
				curTeam = null;
				curSet = null;
				const team = PS.teams.unpackLine(line);
				if (team) teams.push(team);
			} else if (!curSet) {
				if (!sets) continue; // corruption
				curSet = {
					name: '', species: '', gender: '',
					moves: [],
				};
				sets.push(curSet);
				this.parseExportedTeamLine(line, true, curSet, curTeam?.format);
			} else {
				this.parseExportedTeamLine(line, false, curSet, curTeam?.format);
			}
		}
		if (curTeam) {
			curTeam.packedTeam = this.packTeam(sets!);
			teams.push(curTeam);
		}
		return teams;
	}

	static packedTeamNames(buf: string) {
		if (!buf) return [];

		const team = [];
		let i = 0;

		while (true) {
			const name = buf.slice(i, buf.indexOf('|', i));
			i = buf.indexOf('|', i) + 1;

			team.push(buf.slice(i, buf.indexOf('|', i)) || name);

			for (let k = 0; k < 9; k++) {
				i = buf.indexOf('|', i) + 1;
			}

			i = buf.indexOf(']', i) + 1;

			if (i < 1) break;
		}

		return team;
	}
}

function TeamFolder(props: {cur?: boolean, value: string, children: preact.ComponentChildren}) {
	// folders are <div>s rather than <button>s because in theory it has
	// less weird interactions with HTML5 drag-and-drop
	if (props.cur) {
		return <div class="folder cur"><div class="folderhack3">
			<div class="folderhack1"></div><div class="folderhack2"></div>
			<div class="selectFolder" data-value={props.value}>{props.children}</div>
		</div></div>;
	}
	return <div class="folder">
		<div class="selectFolder" data-value={props.value}>{props.children}</div>
	</div>;
}

function TeamBox(props: {team: Team | null, noLink?: boolean, button?: boolean}) {
	const team = props.team;
	let contents;
	if (team) {
		let icons = team.iconCache;
		if (!icons) {
			if (!team.packedTeam) {
				icons = <em>(empty team)</em>;
			} else {
				icons = PSTeambuilder.packedTeamNames(team.packedTeam).map(species =>
					<span class="picon" style={Dex.getPokemonIcon(species)}></span>
				);
			}
			team.iconCache = icons;
		}
		let format = team.format as string;
		if (format.startsWith('gen8')) format = format.slice(4);
		format = (format ? `[${format}] ` : ``) + (team.folder ? `${team.folder}/` : ``);
		contents = [
			<strong>{format && <span>{format}</span>}{team.name}</strong>,
			<small>{icons}</small>,
		];
	} else {
		contents = [
			<em>Select a team</em>,
		];
	}
	if (props.button) {
		return <button class="team" value={team ? team.key : ''}>
			{contents}
		</button>;
	}
	return <div data-href={props.noLink ? '' : `/team-${team ? team.key : ''}`} class="team" draggable>
		{contents}
	</div>;
}

/**
 * Team selector popup
 */

class TeamDropdownPanel extends PSRoomPanel {
	gen = '';
	format: string | null = null;
	getTeams() {
		if (!this.format && !this.gen) return PS.teams.list;
		return PS.teams.list.filter(team => {
			if (this.gen && !team.format.startsWith(this.gen)) return false;
			if (this.format && team.format !== this.format) return false;
			return true;
		});
	}
	setFormat = (e: MouseEvent) => {
		const target = e.currentTarget as HTMLButtonElement;
		this.format = (target.name === 'format' && target.value) || '';
		this.gen = (target.name === 'gen' && target.value) || '';
		this.forceUpdate();
	};
	click = (e: MouseEvent) => {
		let curTarget = e.target as HTMLElement | null;
		let target;
		while (curTarget && curTarget !== e.currentTarget) {
			if (curTarget.tagName === 'BUTTON') {
				target = curTarget as HTMLButtonElement;
			}
			curTarget = curTarget.parentElement;
		}
		if (!target) return;

		this.chooseParentValue(target.value);
	};
	render() {
		const room = this.props.room;
		if (!room.parentElem) {
			return <PSPanelWrapper room={room}>
				<p>Error: You tried to open a team selector, but you have nothing to select a team for.</p>
			</PSPanelWrapper>;
		}
		const baseFormat = room.parentElem.getAttribute('data-format') || Dex.modid;
		let isFirstLoad = this.format === null;
		if (isFirstLoad) {
			this.format = baseFormat;
		}
		let teams = this.getTeams();
		if (!teams.length && this.format && isFirstLoad) {
			this.gen = this.format.slice(0, 4);
			this.format = '';
			teams = this.getTeams();
		}
		if (!teams.length && this.gen && isFirstLoad) {
			this.gen = '';
			teams = this.getTeams();
		}

		let availableWidth = document.body.offsetWidth;
		let width = 307;
		if (availableWidth > 636) width = 613;
		if (availableWidth > 945) width = 919;

		let teamBuckets: {[folder: string]: Team[]} = {};
		for (const team of teams) {
			const list = teamBuckets[team.folder] || (teamBuckets[team.folder] = []);
			list.push(team);
		}

		let teamList = [];

		const baseGen = baseFormat.slice(0, 4);
		let genList: string[] = [];
		for (const team of PS.teams.list) {
			const gen = team.format.slice(0, 4);
			if (gen && !genList.includes(gen)) genList.push(gen);
		}
		const hasOtherGens = genList.length > 1 || genList[0] !== baseGen;

		teamList.push(<p>
			{baseFormat.length > 4 && <button class={'button' + (baseFormat === this.format ? ' disabled' : '')} onClick={this.setFormat} name="format" value={baseFormat}>
				<i class="fa fa-folder-o"></i> [{baseFormat.slice(0, 4)}] {baseFormat.slice(4)}
			</button>} <button class={'button' + (baseGen === this.format ? ' disabled' : '')} onClick={this.setFormat} name="format" value={baseGen}>
				<i class="fa fa-folder-o"></i> [{baseGen}] <em>(uncategorized)</em>
			</button> <button class={'button' + (baseGen === this.gen ? ' disabled' : '')} onClick={this.setFormat} name="gen" value={baseGen}>
				<i class="fa fa-folder-o"></i> [{baseGen}] <em>(all)</em>
			</button> {hasOtherGens && !this.gen && <button class="button" onClick={this.setFormat} name="gen" value={baseGen}>Other gens</button>}
		</p>);

		if (hasOtherGens && this.gen) {
			teamList.push(<h2>Other gens</h2>);
			teamList.push(<p>{genList.sort().map(gen => [
				<button class={'button' + (gen === this.gen ? ' disabled' : '')} onClick={this.setFormat} name="gen" value={gen}>
					<i class="fa fa-folder-o"></i> [{gen}] <em>(all)</em>
				</button>,
				" ",
			])}</p>);
		}

		let isEmpty = true;
		for (let folder in teamBuckets) {
			if (folder && (this.gen || this.format)) {
				teamList.push(<h2>
					<i class="fa fa-folder-open"></i> {folder} + {}
					<i class="fa fa-folder-open-o"></i> {this.format || this.gen}
				</h2>);
			} else if (folder) {
				teamList.push(<h2>
					<i class="fa fa-folder-open"></i> {folder}
				</h2>);
			} else if (this.gen || this.format) {
				teamList.push(<h2>
					<i class="fa fa-folder-open-o"></i> {this.format || this.gen}
				</h2>);
			} else {
				teamList.push(<h2>
					<i class="fa fa-folder-open-o"></i> Teams not in any folders
				</h2>);
			}
			teamList.push(<ul class="teamdropdown" onClick={this.click}>
				{teamBuckets[folder].map(team => <li key={team.key} style={"display:inline-block"}>
					<TeamBox team={team} button />
				</li>)}
			</ul>);
			isEmpty = false;
		}

		return <PSPanelWrapper room={room} width={width}>
			{teamList}
			{isEmpty && <p><em>No teams found</em></p>}
		</PSPanelWrapper>;
	}
}

interface FormatData {
	id: ID;
	name: string;
	team?: 'preset' | null;
	section: string;
	column: number;
	searchShow?: boolean;
	challengeShow?: boolean;
	tournamentShow?: boolean;
	rated: boolean;
	teambuilderLevel?: number | null;
	teambuilderFormat?: ID;
	battleFormat?: string;
	isTeambuilderFormat: boolean;
	effectType: 'Format';
}

declare var BattleFormats: {[id: string]: FormatData};
/** id:name */
declare var NonBattleGames: {[id: string]: string};

class FormatDropdownPanel extends PSRoomPanel {
	gen = '';
	format: string | null = null;
	click = (e: MouseEvent) => {
		let curTarget = e.target as HTMLElement | null;
		let target;
		while (curTarget && curTarget !== e.currentTarget) {
			if (curTarget.tagName === 'BUTTON') {
				target = curTarget as HTMLButtonElement;
			}
			curTarget = curTarget.parentElement;
		}
		if (!target) return;

		this.chooseParentValue(target.value);
	};
	render() {
		const room = this.props.room;
		if (!room.parentElem) {
			return <PSPanelWrapper room={room}>
				<p>Error: You tried to open a format selector, but you have nothing to select a format for.</p>
			</PSPanelWrapper>;
		}

		let formatsLoaded = !!window.BattleFormats;
		if (formatsLoaded) {
			formatsLoaded = false;
			for (let i in window.BattleFormats) {
				formatsLoaded = true;
				break;
			}
		}
		if (!formatsLoaded) {
			return <PSPanelWrapper room={room}>
				<p>Loading...</p>
			</PSPanelWrapper>;
		}

		/**
		 * 'challenge' hides search-only formats, and 'search' hides challenge-only
		 * formats. 'teambuilder' shows teambuilder formats (removing parentheses
		 * from format names).
		 */
		const selectType: 'teambuilder' | 'challenge' | 'search' = (
			room.parentElem.getAttribute('data-selecttype') as any || 'challenge'
		);

		const formats = Object.values(BattleFormats).filter(format => {
			if (selectType === 'challenge' && format.challengeShow === false) return false;
			if (selectType === 'search' && format.searchShow === false) return false;
			return true;
		});

		let curSection = '';
		let curColumnNum = 0;
		let curColumn: (FormatData | {id: null, section: string})[] = [];
		const columns = [curColumn];
		for (const format of formats) {
			if (format.column !== curColumnNum) {
				if (curColumn.length) {
					curColumn = [];
					columns.push(curColumn);
				}
				curColumnNum = format.column;
			}
			if (format.section !== curSection) {
				curSection = format.section;
				if (curSection) {
					curColumn.push({id: null, section: curSection});
				}
			}
			curColumn.push(format);
		}

		const width = columns.length * 225 + 10;

		return <PSPanelWrapper room={room} width={width}>
			{columns.map(column => <ul class="options" onClick={this.click}>
				{column.map(format => format.id ? (
					<li><button value={format.name} class="option">
						{format.name.replace('[Gen 8 ', '[').replace('[Gen 9] ', '').replace('[Gen 7 ', '[')}
					</button></li>
				) : (
					<li><h3>
						{format.section}
					</h3></li>
				))}
			</ul>)}
			<div style="float: left"></div>
		</PSPanelWrapper>;
	}
}

PS.roomTypes['teamdropdown'] = {
	Component: TeamDropdownPanel,
};

PS.roomTypes['formatdropdown'] = {
	Component: FormatDropdownPanel,
};
