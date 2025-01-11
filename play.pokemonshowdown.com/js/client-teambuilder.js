(function (exports, $) {

	// this is a useful global
	var teams;

	exports.TeambuilderRoom = exports.Room.extend({
		type: 'teambuilder',
		title: 'Teambuilder',
		initialize: function () {
			teams = Storage.teams;

			// left menu
			this.$el.addClass('ps-room-light').addClass('scrollable');
			if (!Storage.whenTeamsLoaded.isLoaded) {
				Storage.whenTeamsLoaded(this.update, this);
			}
			this.update();
			if (typeof Storage.prefs('uploadprivacy') !== 'undefined') {
				this.$('input[name=teamprivacy]').is('checked', Storage.prefs('uploadprivacy'));
			}
		},
		focus: function () {
			if (this.curTeam) {
				this.curTeam.iconCache = '!';
				this.curTeam.gen = this.getGen(this.curTeam.format);
				this.curTeam.dex = Dex.forGen(this.curTeam.gen);
				if (this.curTeam.format.includes('letsgo')) {
					this.curTeam.dex = Dex.mod('gen7letsgo');
				}
				if (this.curTeam.format.includes('bdsp')) {
					this.curTeam.dex = Dex.mod('gen8bdsp');
				}
				Storage.activeSetList = this.curSetList;
			}
		},
		blur: function () {
			if (this.saveFlag) {
				this.saveFlag = false;
				app.user.trigger('saveteams');
			}
		},
		events: {
			// team changes
			'change input.teamnameedit': 'teamNameChange',
			'click button.formatselect': 'selectFormat',
			'change input[name=nickname]': 'nicknameChange',

			// misc
			'click input[name=teamprivacy]': 'privacyChange',

			// details
			'change .detailsform input': 'detailsChange',
			'change .detailsform select': 'detailsChange',
			'submit .detailsform': 'detailsChange',
			'click .changeform' : 'altForm',
			'click .altform' : 'altForm',

			// stats
			'keyup .statform input.numform': 'statChange',
			'input .statform input[type=number].numform': 'statChange',
			'change select[name=nature]': 'natureChange',
			'change select[name=ivspread]': 'ivSpreadChange',
			'change .evslider': 'statSlided',
			'input .evslider': 'statSlide',

			// teambuilder events
			'click .utilichart a': 'chartClick',
			'keydown .chartinput': 'chartKeydown',
			'keyup .chartinput': 'chartKeyup',
			'focus .chartinput': 'chartFocus',
			'blur .chartinput': 'chartChange',
			'keyup .searchinput': 'searchChange',

			// drag/drop
			'click .team': 'edit',
			'click .selectFolder': 'selectFolder',
			'mouseover .team': 'mouseOverTeam',
			'mouseout .team': 'mouseOutTeam',
			'dragstart .team': 'dragStartTeam',
			'dragend .team': 'dragEndTeam',
			'dragenter .team': 'dragEnterTeam',
			'dragenter .folder .selectFolder': 'dragEnterFolder',
			'dragleave .folder .selectFolder': 'dragLeaveFolder',
			'dragexit .folder .selectFolder': 'dragExitFolder',

			// clipboard
			'click .teambuilder-clipboard-data .result': 'clipboardResultSelect',
			'click .teambuilder-clipboard-data': 'clipboardExpand',
			'blur .teambuilder-clipboard-data': 'clipboardShrink'
		},
		dispatchClick: function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (this[e.currentTarget.value]) this[e.currentTarget.value](e);
		},
		back: function () {
			if (this.exportMode) {
				if (this.curTeam) {
					this.curTeam.team = Storage.packTeam(this.curSetList);
					Storage.saveTeam(this.curTeam);
				}
				this.exportMode = false;
			} else if (this.curSet) {
				this.curSet = null;
				Storage.saveTeam(this.curTeam);
			} else if (this.curTeam) {
				this.clearCachedUserSetsIfNecessary(this.curTeam.format);
				this.curTeam.team = Storage.packTeam(this.curSetList);
				this.curTeam.iconCache = '';
				var team = this.curTeam;
				this.curTeam = null;
				Storage.activeSetList = this.curSetList = null;
				Storage.saveTeam(team);
			} else {
				return;
			}
			app.user.trigger('saveteams');
			this.update();
		},

		// the teambuilder has three views:
		// - team list (curTeam falsy)
		// - team view (curTeam exists, curSet falsy)
		// - set view (curTeam exists, curSet exists)

		curTeam: null,
		curTeamLoc: 0,
		curSet: null,
		curSetLoc: 0,

		// curFolder will have '/' at the end if it's a folder, but
		// it will be alphanumeric (so guaranteed no '/') if it's a
		// format
		// Special values:
		// '' -     show all
		// 'gen9' - show teams with no format
		// '/' -    show teams with no folder
		curFolder: '',
		curFolderKeep: '',
		curSearchVal: '',
		// Debounce value for searching in the teambuilder
		searchTimeout: null,

		exportMode: false,
		formatResources: {},
		update: function () {
			teams = Storage.teams;
			if (this.curTeam) {
				if (this.curTeam.format && !this.formatResources[this.curTeam.format]) {
					this.tryLoadFormatResource(this.curTeam.format);
				}
				if (this.curTeam.loaded === false || (this.curTeam.teamid && !this.curTeam.loaded)) {
					this.loadTeam();
					return this.updateTeamView();
				}
				this.ignoreEVLimits = (this.curTeam.gen < 3 ||
					((this.curTeam.format.includes('hackmons') || this.curTeam.format.endsWith('bh')) && this.curTeam.gen !== 6) ||
					this.curTeam.format.includes('metronomebattle'));
				if (this.curSet) {
					return this.updateSetView();
				}
				return this.updateTeamView();
			}
			return this.updateTeamInterface();
		},

		privacyChange: function (ev) {
			Storage.prefs('uploadprivacy', ev.currentTarget.checked);
		},

		loadTeam: function () {
			if (this.loadingTeam) return false;
			this.loadingTeam = true;
			var teambuilder = this;
			app.loadTeam(this.curTeam, function (team) {
				window.builderTeam = team;
				teambuilder.loadingTeam = false;
				teambuilder.curSetList = Storage.unpackTeam(team.team);
				Storage.activeSetList = teambuilder.curSetList;
				teambuilder.curTeam.team = Storage.packTeam(teambuilder.curSetList);
				teambuilder.updateTeamView();
			});
		},

		tryLoadFormatResource: function (format) {
			var teambuilder = this;
			if (format in teambuilder.formatResources) { // already loading, bypass
				return;
			}
			teambuilder.formatResources[format] = true; // true - loading, array - loaded
			$.get('https://www.smogon.com/dex/api/formats/by-ps-name/' + format, {}, function (data) {
				// if the data doesn't exist, set it to true so it stops trying to load it
				teambuilder.formatResources[format] = data || true;
				teambuilder.update();
			});
		},

		/*********************************************************
		 * Team list view
		 *********************************************************/

		deletedTeam: null,
		deletedTeamLoc: -1,
		updateTeamInterface: function () {
			this.deletedSet = null;
			this.deletedSetLoc = -1;

			var buf = '';

			if (this.exportMode) {
				if (this.curFolder) {
					buf = '<div class="pad"><button name="back" class="button"><i class="fa fa-chevron-left"></i> List</button></div>';
					buf += '<div class="teamedit"><textarea readonly class="textbox" rows="17">' + BattleLog.escapeHTML(Storage.exportFolder(this.curFolder)) + '</textarea></div>';
				} else {
					buf = '<div class="pad"><button name="back" class="button"><i class="fa fa-chevron-left"></i> List</button> <button name="saveBackup" class="savebutton button"><i class="fa fa-floppy-o"></i> Save</button></div>';
					buf += '<div class="teamedit"><textarea class="textbox" rows="17">';
					if (Storage.teams.length > 350) {
						buf += BattleLog.escapeHTML(Storage.getPackedTeams());
					} else {
						buf += BattleLog.escapeHTML(Storage.exportAllTeams());
					}
					buf += '</textarea></div>';
				}
				this.$el.html(buf);
				this.$('.teamedit textarea').focus().select();
				return;
			}

			if (!Storage.whenTeamsLoaded.isLoaded) {
				if (Storage.whenTeamsLoaded.error === 'stalled') {
					buf = '<div class="pad"><p class="message-error">We\'re having some trouble loading teams securely.</p>';
					buf += '<p>This is sometimes caused by antiviruses like Avast and BitDefender.</p>';
					buf += '<p><strong>If you\'re using Firefox and an antivirus:</strong> Your antivirus is trying to scan your teams, and a recent Firefox update doesn\'t let it. Turn off HTTPS scanning in your antivirus or uninstall your antivirus, and your teams will come back.</p>';
					buf += '<p>You can use the teambuilder insecurely, but any teams you\'ve saved securely won\'t be there.</p>';
					buf += '<p><button class="button" name="insecureUse">Use teambuilder insecurely</button></p></div>';
				} else if (Storage.whenTeamsLoaded.error) {
					buf = '<div class="pad"><p class="message-error">We got an error trying to load teams: ' + Storage.whenTeamsLoaded.error.message + '.</p>';
					buf += '<p>This might be because you didn\'t give us permission to load teams: on macOS, this is in System Preferences → Security &amp; Privacy → Privacy → Files and Folders → Pokemon Showdown</p></div>';
				} else {
					buf = '<div class="pad"><p>lol zarel this is a horrible teambuilder</p>';
					buf += '<p>that\'s because we\'re not done loading it...</p></div>';
				}
				this.$el.html(buf);
				return;
			}

			// folderpane
			buf = '<div class="folderpane">';
			buf += '</div>';

			// teampane
			buf += '<div class="teampane">';
			buf += '</div>';

			this.$el.html(buf);

			this.updateFolderList();
			this.updateTeamList();
		},
		insecureUse: function () {
			Storage.whenTeamsLoaded.load();
			this.updateTeamInterface();
		},
		updateFolderList: function () {
			var buf = '<div class="folderlist"><div class="folderlistbefore"></div>';

			buf += '<div class="folder' + (!this.curFolder ? ' cur"><div class="folderhack3"><div class="folderhack1"></div><div class="folderhack2"></div>' : '">') + '<div class="selectFolder" data-value="all"><em>(all)</em></div></div>' + (!this.curFolder ? '</div>' : '');
			var folderTable = {};
			var folders = [];
			if (Storage.teams) for (var i = -2; i < Storage.teams.length; i++) {
				if (i >= 0) {
					var folder = Storage.teams[i].folder;
					if (folder && !((folder + '/') in folderTable)) {
						folders.push('Z' + folder);
						folderTable[folder + '/'] = 1;
						if (!('/' in folderTable)) {
							folders.push('Z~');
							folderTable['/'] = 1;
						}
					}
				}

				var format;
				if (i === -2) {
					format = this.curFolderKeep;
				} else if (i === -1) {
					format = this.curFolder;
				} else {
					format = Storage.teams[i].format;
					if (!format) format = 'gen9';
				}
				if (!format) continue;
				if (format in folderTable) continue;
				folderTable[format] = 1;
				if (format.slice(-1) === '/') {
					folders.push('Z' + (format.slice(0, -1) || '~'));
					if (!('/' in folderTable)) {
						folders.push('Z~');
						folderTable['/'] = 1;
					}
					continue;
				}
				if (format === 'gen9') {
					folders.push('A~');
					continue;
				}
				switch (format.slice(0, 4)) {
				case 'gen1': format = 'I' + format.slice(4); break;
				case 'gen2': format = 'H' + format.slice(4); break;
				case 'gen3': format = 'G' + format.slice(4); break;
				case 'gen4': format = 'F' + format.slice(4); break;
				case 'gen5': format = 'E' + format.slice(4); break;
				case 'gen6': format = 'D' + format.slice(4); break;
				case 'gen7': format = 'C' + format.slice(4); break;
				case 'gen8': format = 'B' + format.slice(4); break;
				case 'gen9': format = 'A' + format.slice(4); break;
				default: format = 'X' + format; break;
				}
				folders.push(format);
			}
			folders.sort();
			var gen = '';
			var formatFolderBuf = '<div class="foldersep"></div>';
			formatFolderBuf += '<div class="folder"><div class="selectFolder" data-value="+"><i class="fa fa-plus"></i><em>(add format folder)</em></div></div>';
			for (var i = 0; i < folders.length; i++) {
				var format = folders[i];
				var newGen;
				switch (format.charAt(0)) {
				case 'I': newGen = '1'; break;
				case 'H': newGen = '2'; break;
				case 'G': newGen = '3'; break;
				case 'F': newGen = '4'; break;
				case 'E': newGen = '5'; break;
				case 'D': newGen = '6'; break;
				case 'C': newGen = '7'; break;
				case 'B': newGen = '8'; break;
				case 'A': newGen = '9'; break;
				case 'X': newGen = 'X'; break;
				case 'Z': newGen = '/'; break;
				}
				if (gen !== newGen) {
					gen = newGen;
					if (gen === '/') {
						buf += formatFolderBuf;
						formatFolderBuf = '';
						buf += '<div class="foldersep"></div>';
						buf += '<div class="folder"><h3>Folders</h3></div>';
					} else if (gen === 'X') {
						buf += '<div class="folder"><h3>???</h3></div>';
					} else {
						buf += '<div class="folder"><h3>Gen ' + gen + '</h3></div>';
					}
				}
				var formatName;
				if (gen === '/') {
					formatName = format.slice(1);
					format = formatName + '/';
					if (formatName === '~') {
						formatName = '(uncategorized)';
						format = '/';
					} else {
						formatName = BattleLog.escapeHTML(formatName);
					}
					buf += '<div class="folder' + (this.curFolder === format ? ' cur"><div class="folderhack3"><div class="folderhack1"></div><div class="folderhack2"></div>' : '">') + '<div class="selectFolder" data-value="' + format + '"><i class="fa ' + (this.curFolder === format ? 'fa-folder-open' : 'fa-folder') + (format === '/' ? '-o' : '') + '"></i>' + formatName + '</div></div>' + (this.curFolder === format ? '</div>' : '');
					continue;
				}
				formatName = format.slice(1);
				if (formatName === '~') formatName = '';
				format = 'gen' + newGen + formatName;
				if (format.length === 4) formatName = '(uncategorized)';
				// folders are <div>s rather than <button>s because in theory it has
				// less weird interactions with HTML5 drag-and-drop
				buf += '<div class="folder' + (this.curFolder === format ? ' cur"><div class="folderhack3"><div class="folderhack1"></div><div class="folderhack2"></div>' : '">') + '<div class="selectFolder" data-value="' + format + '"><i class="fa ' + (this.curFolder === format ? 'fa-folder-open-o' : 'fa-folder-o') + '"></i>' + formatName + '</div></div>' + (this.curFolder === format ? '</div>' : '');
			}
			buf += formatFolderBuf;
			buf += '<div class="foldersep"></div>';
			buf += '<div class="folder"><div class="selectFolder" data-value="++"><i class="fa fa-plus"></i><em>(add folder)</em></div></div>';

			buf += '<div class="folderlistafter"></div></div>';

			this.$('.folderpane').html(buf);
		},
		updateTeamList: function (resetScroll) {
			var teams = Storage.teams;
			var buf = '';

			// teampane
			buf += this.clipboardHTML();

			var filterFormat = '';

			// filterFolder === undefined: show teams in any folder
			// filterFolder === '': show only teams that don't have a folder
			var filterFolder;

			if (!this.curFolder) {
				buf += '<h2>Hi</h2>';
				buf += '<p>Did you have a good day?</p>';
				buf += '<p><button class="button" name="greeting" value="Y"><i class="fa fa-smile-o"></i> Yes, my day was pretty good</button> <button class="button" name="greeting" value="N"><i class="fa fa-frown-o"></i> No, it wasn\'t great</button></p>';
				buf += '<h2>All teams <small style="font-weight: normal">(' + teams.length + ')</small></h2>';
			} else {
				if (this.curFolder.slice(-1) === '/') {
					filterFolder = this.curFolder.slice(0, -1);
					if (filterFolder) {
						buf += '<h2><i class="fa fa-folder-open"></i> ' + filterFolder + ' <button class="button small" style="margin-left:5px" name="renameFolder"><i class="fa fa-pencil"></i> Rename</button> <button class="button small" style="margin-left:5px" name="promptDeleteFolder"><i class="fa fa-times"></i> Remove</button></h2>';
					} else {
						buf += '<h2><i class="fa fa-folder-open-o"></i> Teams not in any folders</h2>';
					}
				} else {
					filterFormat = this.curFolder;
					var func = function (team) {
						return team.format === filterFormat;
					};
					buf += '<h2><i class="fa fa-folder-open-o"></i> ' + filterFormat + ' <small style="font-weight: normal">(' + teams.filter(func).length + ')</small></h2>';
				}
			}

			var newTeamButtonText = "New Team";
			if (filterFolder) newTeamButtonText = "New Team in folder";
			if (filterFormat && filterFormat !== 'gen9') {
				newTeamButtonText = "New " + BattleLog.escapeFormat(filterFormat) + " Team";
			}
			buf += '<p><button name="newTop" value="team" class="button big"><i class="fa fa-plus-circle"></i> ' + newTeamButtonText + '</button> ' +
				'<button name="newTop" value="box" class="button big"><i class="fa fa-archive"></i> New Box</button> ' +
				'<input type="text" id="teamSearchBar" name="search" class="textbox searchinput" value="' + this.curSearchVal + '" placeholder="search teams"/></p>';

			buf += '<ul class="teamlist">';
			var atLeastOne = false;

			try {
				if (!window.localStorage && !window.nodewebkit) buf += '<li>== CAN\'T SAVE ==<br /><small>Your browser doesn\'t support <code>localStorage</code> and can\'t save teams! Update to a newer browser.</small></li>';
			} catch (e) {
				buf += '<li>== CAN\'T SAVE ==<br /><small><code>Cookies</code> are disabled so you can\'t save teams! Enable them in your browser settings.</small></li>';
			}
			if (Storage.cantSave) buf += '<li>== CAN\'T SAVE ==<br /><small>You hit your browser\'s limit for team storage! Please backup them and delete some of them. Your teams won\'t be saved until you\'re under the limit again.</small></li>';
			if (!teams.length) {
				if (this.deletedTeamLoc >= 0) {
					buf += '<li><button name="undoDelete"><i class="fa fa-undo"></i> Undo Delete</button></li>';
				}
				buf += '<li><p><em>you don\'t have any teams lol</em></p></li>';
			} else {

				for (var i = 0; i < teams.length + 1; i++) {
					if (i === this.deletedTeamLoc) {
						if (!atLeastOne) atLeastOne = true;
						buf += '<li><button name="undoDelete"><i class="fa fa-undo"></i> Undo Delete</button></li>';
					}
					if (i >= teams.length) break;

					var team = teams[i];

					if (team && !team.team && team.team !== '') {
						team = null;
					}
					if (!team) {
						buf += '<li>Error: A corrupted team was dropped</li>';
						teams.splice(i, 1);
						i--;
						if (this.deletedTeamLoc && this.deletedTeamLoc > i) this.deletedTeamLoc--;
						continue;
					}

					if (filterFormat && filterFormat !== (team.format || 'gen9')) continue;
					if (filterFolder !== undefined && filterFolder !== team.folder) continue;

					if (this.curSearchVal) {
						// If a Pokemon hasn't been given a nickname, species is omitted
						// from the packed team.team in favor of the name field
						// since the name defaults to the species' display name.
						// While eliminating this redundancy between name and species
						// helps with packed team size, the display name unfortunately
						// won't match the ID search term and so we need to special case
						// searching for Pokemon here
						var pokemon = team.team.split(']').map(function (el) {
							return toID(PSUtils.splitFirst(el, '|')[0]);
						});
						var searchVal = this.curSearchVal.split(',').map(function (el) {
							return toID(el);
						});
						var meetsCriteria = searchVal.every(function (el) {
							return team.team.indexOf(el) > -1 || pokemon.includes(el);
						});
						if (!meetsCriteria) continue;
					}

					if (!atLeastOne) atLeastOne = true;
					var formatText = '';
					if (team.format) {
						formatText = '[' + team.format + '] ';
					}
					if (team.folder) formatText += team.folder + '/';

					// teams and boxes are <div>s rather than <button>s because Firefox doesn't
					// support dragging and dropping buttons.
					buf += '<li><div name="edit" data-value="' + i + '" class="team';
					if (team.capacity === 24) buf += ' pc-box';
					buf += '" draggable="true">' + BattleLog.escapeHTML(formatText) + '<strong>' + BattleLog.escapeHTML(team.name) + '</strong><br /><small>';
					buf += Storage.getTeamIcons(team);
					buf += '</small></div><button name="edit" value="' + i + '"><i class="fa fa-pencil" aria-label="Edit" title="Edit (you can also just click on the team)"></i></button><button name="duplicate" value="' + i + '" title="Duplicate" aria-label="Duplicate"><i class="fa fa-clone"></i></button><button name="delete" value="' + i + '"><i class="fa fa-trash"></i> Delete</button></li>';

				}
				if (!atLeastOne) {
					if (filterFolder) {
						buf += '<li><p><em>you don\'t have any teams in this folder lol</em></p></li>';
					} else {
						buf += '<li><p><em>you don\'t have any ' + this.curFolder + ' teams lol</em></p></li>';
					}
				}
			}

			buf += '</ul><p>';
			if (atLeastOne) {
				buf += '<button name="new" value="team" class="button"><i class="fa fa-plus-circle"></i> ' + newTeamButtonText + '</button> <button name="new" value="box" class="button"><i class="fa fa-archive"></i> New Box</button> ';
			}
			buf += '<button class="button" name="send" value="/teams">View teams uploaded to server</button>';
			buf += '</p>';

			if (window.nodewebkit) {
				buf += '<button name="revealFolder" class="button"><i class="fa fa-folder-open"></i> Reveal teams folder</button> <button name="reloadTeamsFolder" class="button"><i class="fa fa-refresh"></i> Reload teams files</button> <button name="backup" class="button"><i class="fa fa-upload"></i> Backup/Restore all teams</button>';
			} else if (this.curFolder) {
				buf += '<button name="backup" class="button"><i class="fa fa-upload"></i> Backup all teams from this folder</button>';
			} else if (atLeastOne) {
				buf += '<p><strong>Clearing your cookies (specifically, <code>localStorage</code>) will delete your teams.</strong> ';
				buf += '<span class="storage-warning">Browsers sometimes randomly clear cookies - you should upload your teams to the Showdown database ';
				buf += 'or make a backup yourself if you want to make sure you don\'t lose them.</span></p>';
				buf += '<button name="backup" class="button"><i class="fa fa-upload"></i> Backup/Restore all teams</button>';
				buf += '<p>If you want to clear your cookies or <code>localStorage</code>, you can use the Backup/Restore feature to save your teams as text first.</p>';
				var self = this;
				if (navigator.storage && navigator.storage.persisted) {
					navigator.storage.persisted().then(function (state) {
						self.updatePersistence(state);
					});
				}
			} else {
				buf += '<button name="backup" class="button"><i class="fa fa-upload"></i> Restore teams from backup</button>';
			}

			var $pane = this.$('.teampane');
			$pane.html(buf);
			if (resetScroll) {
				$pane.scrollTop(0);
			} else if (this.teamScrollPos) {
				$pane.scrollTop(this.teamScrollPos);
				this.teamScrollPos = 0;
			}

			//reset focus to searchbar
			var teamSearchBar = this.$("#teamSearchBar");
			var strLength = teamSearchBar.val().length;
			if (strLength) {
				teamSearchBar.focus();
				teamSearchBar[0].setSelectionRange(strLength, strLength);
			}
		},
		updatePersistence: function (state) {
			if (state) {
				this.$('.storage-warning').html('');
				return;
			}
		},
		greeting: function (answer, button) {
			var buf = '<p><strong>' + $(button).html() + '</p></strong>';
			if (answer === 'N') {
				buf += '<p>Aww, that\'s too bad. :( I hope playing on Pok&eacute;mon Showdown today can help cheer you up!</p>';
			} else if (answer === 'Y') {
				buf += '<p>Cool! I just added some pretty cool teambuilder features, so I\'m pretty happy, too. Did you know you can drag and drop teams to different format-folders? You can also drag and drop them to and from your computer (works best in Chrome).</p>';
				buf += '<p><button class="button" name="greeting" value="W"><i class="fa fa-question-circle"></i> Wait, who are you? Talking to a teambuilder is weird.</button></p>';
			} else if (answer === 'W') {
				buf += '<p>Oh, I\'m Zarel! I made a Credits button for this...</p>';
				buf += '<div class="menugroup"><p><a href="//pokemonshowdown.com/credits" target="_blank"><button class="button mainmenu4"><i class="fa fa-info-circle"></i> Credits</button></a></p></div>';
				buf += '<p>Isn\'t it pretty? Matches your background and everything. It used to be in the Main Menu but we had to get rid of it to save space.</p>';
				buf += '<p>Speaking of, you should try <button class="button" name="background"><i class="fa fa-picture-o"></i> changing your background</button>.';
				buf += '<p><button class="button" name="greeting" value="B"><i class="fa fa-hand-pointer-o"></i> You might be having too much fun with these buttons and icons</button></p>';
			} else if (answer === 'B') {
				buf += '<p>I paid good money for those icons! I need to get my money\'s worth!</p>';
				buf += '<p><button class="button" name="greeting" value="WR"><i class="fa fa-exclamation-triangle"></i> Wait, really?</button></p>';
			} else if (answer === 'WR') {
				buf += '<p>No, they were free. That just makes it easier to get my money\'s worth. Let\'s play rock paper scissors!</p>';
				buf += '<p><button class="button" name="greeting" value="RR"><i class="fa fa-hand-rock-o"></i> Rock</button> <button class="button" name="greeting" value="RP"><i class="fa fa-hand-paper-o"></i> Paper</button> <button class="button" name="greeting" value="RS"><i class="fa fa-hand-scissors-o"></i> Scissors</button> <button class="button" name="greeting" value="RL"><i class="fa fa-hand-lizard-o"></i> Lizard</button> <button class="button" name="greeting" value="RK"><i class="fa fa-hand-spock-o"></i> Spock</button></p>';
			} else if (answer[0] === 'R') {
				buf += '<p>I play laser, I win. <i class="fa fa-hand-o-left"></i></p>';
				buf += '<p><button class="button" name="greeting" value="YC"><i class="fa fa-thumbs-o-down"></i> You can\'t do that!</button></p>';
			} else if (answer === 'SP') {
				buf += '<p>Okay, sure. I warn you, I\'m using the same RNG that makes Stone Edge miss for you.</p>';
				buf += '<p><button class="button" name="greeting" value="SP3"><i class="fa fa-caret-square-o-right"></i> I want to play Rock Paper Scissors</button> <button class="button" name="greeting" value="SP5"><i class="fa fa-caret-square-o-right"></i> I want to play Rock Paper Scissors Lizard Spock</button></p>';
			} else if (answer === 'SP3') {
				buf += '<p><button class="button" name="greeting" value="PR3"><i class="fa fa-hand-rock-o"></i> Rock</button> <button class="button" name="greeting" value="PP3"><i class="fa fa-hand-paper-o"></i> Paper</button> <button class="button" name="greeting" value="PS3"><i class="fa fa-hand-scissors-o"></i> Scissors</button></p>';
			} else if (answer === 'SP5') {
				buf += '<p><button class="button" name="greeting" value="PR5"><i class="fa fa-hand-rock-o"></i> Rock</button> <button class="button" name="greeting" value="PP5"><i class="fa fa-hand-paper-o"></i> Paper</button> <button class="button" name="greeting" value="PS5"><i class="fa fa-hand-scissors-o"></i> Scissors</button> <button class="button" name="greeting" value="PL5"><i class="fa fa-hand-lizard-o"></i> Lizard</button> <button class="button" name="greeting" value="PK5"><i class="fa fa-hand-spock-o"></i> Spock</button></p>';
			} else if (answer[0] === 'P') {
				var rpsChart = {
					R: 'rock',
					P: 'paper',
					S: 'scissors',
					L: 'lizard',
					K: 'spock'
				};
				var rpsWinChart = {
					SP: 'cuts',
					SL: 'decapitates',
					PR: 'covers',
					PK: 'disproves',
					RL: 'crushes',
					RS: 'crushes',
					LK: 'poisons',
					LP: 'eats',
					KS: 'smashes',
					KR: 'vaporizes'
				};
				var my = ['R', 'P', 'S', 'L', 'K'][Math.floor(Math.random() * Number(answer[2]))];
				var your = answer[1];
				buf += '<p>I play <i class="fa fa-hand-' + rpsChart[my] + '-o"></i> ' + rpsChart[my] + '!</p>';
				if ((my + your) in rpsWinChart) {
					buf += '<p>And ' + rpsChart[my] + ' ' + rpsWinChart[my + your] + ' ' + rpsChart[your] + ', so I win!</p>';
				} else if ((your + my) in rpsWinChart) {
					buf += '<p>But ' + rpsChart[your] + ' ' + rpsWinChart[your + my] + ' ' + rpsChart[my] + ', so you win...</p>';
				} else {
					buf += '<p>We played the same thing, so it\'s a tie.</p>';
				}
				if (!this.rpsScores || !this.rpsScores.length) {
					this.rpsScores = ['pi', '$3.50', '9.80665 m/s<sup>2</sup>', '28°C', '百万点', '<i class="fa fa-bitcoin"></i>0.0000174', '<s>priceless</s> <i class="fa fa-cc-mastercard"></i> MasterCard', '127.0.0.1', 'C&minus;, see me after class'];
				}
				var score = this.rpsScores.splice(Math.floor(Math.random() * this.rpsScores.length), 1)[0];
				buf += '<p>Score: ' + score + '</p>';
				buf += '<p><button class="button" name="greeting" value="SP' + answer[2] + '"><i class="fa fa-caret-square-o-right"></i> I demand a rematch!</button></p>';
			} else if (answer === 'YC') {
				buf += '<p>Okay, then I play peace sign <i class="fa fa-hand-peace-o"></i>, everyone signs a peace treaty, ending the war and ushering in a new era of prosperity.</p>';
				buf += '<p><button class="button" name="greeting" value="SP"><i class="fa fa-caret-square-o-right"></i> I wanted to play for real...</button></p>';
			}
			$(button).parent().replaceWith(buf);
		},
		background: function () {
			app.addPopup(CustomBackgroundPopup);
		},
		selectFolder: function (format) {
			if (format && format.currentTarget) {
				var e = format;
				format = $(e.currentTarget).data('value');
				e.preventDefault();
				if (format === '+') {
					e.stopImmediatePropagation();
					var self = this;
					app.addPopup(FormatPopup, {format: '', sourceEl: e.currentTarget, selectType: 'teambuilder', onselect: function (newFormat) {
						self.selectFolder(newFormat);
					}});
					return;
				}
				if (format === '++') {
					e.stopImmediatePropagation();
					var self = this;
					// app.addPopupPrompt("Folder name:", "Create folder", function (newFormat) {
					// 	self.selectFolder(newFormat + '/');
					// });
					app.addPopup(PromptPopup, {message: "Folder name:", button: "Create folder", sourceEl: e.currentTarget, callback: function (name) {
						name = $.trim(name);
						if (name.indexOf('/') >= 0 || name.indexOf('\\') >= 0) {
							app.addPopupMessage("Names can't contain slashes, since they're used as a folder separator.");
							name = name.replace(/[\\\/]/g, '');
						}
						if (name.indexOf('|') >= 0) {
							app.addPopupMessage("Names can't contain the character |, since they're used for storing teams.");
							name = name.replace(/\|/g, '');
						}
						if (!name) return;
						self.selectFolder(name + '/');
					}});
					return;
				}
			} else {
				this.curFolderKeep = format;
			}
			this.curFolder = (format === 'all' ? '' : format);
			this.updateFolderList();
			this.updateTeamList(true);
		},
		renameFolder: function () {
			if (!this.curFolder) return;
			if (this.curFolder.slice(-1) !== '/') return;
			var oldFolder = this.curFolder.slice(0, -1);
			var self = this;
			app.addPopup(PromptPopup, {message: "Folder name:", button: "Rename folder", value: oldFolder, callback: function (name) {
				name = $.trim(name);
				if (name.indexOf('/') >= 0 || name.indexOf('\\') >= 0) {
					app.addPopupMessage("Names can't contain slashes, since they're used as a folder separator.");
					name = name.replace(/[\\\/]/g, '');
				}
				if (name.indexOf('|') >= 0) {
					app.addPopupMessage("Names can't contain the character |, since they're used for storing teams.");
					name = name.replace(/\|/g, '');
				}
				if (!name) return;
				if (name === oldFolder) return;
				for (var i = 0; i < Storage.teams.length; i++) {
					var team = Storage.teams[i];
					if (team.folder !== oldFolder) continue;
					team.folder = name;
					if (window.nodewebkit) Storage.saveTeam(team);
				}
				if (!window.nodewebkit) Storage.saveTeams();
				self.selectFolder(name + '/');
			}});
		},
		promptDeleteFolder: function () {
			app.addPopup(DeleteFolderPopup, {folder: this.curFolder, room: this});
		},
		deleteFolder: function (format, addName) {
			if (format.slice(-1) !== '/') return;
			var oldFolder = format.slice(0, -1);
			if (this.curFolderKeep === oldFolder) {
				this.curFolderKeep = '';
			}
			for (var i = 0; i < Storage.teams.length; i++) {
				var team = Storage.teams[i];
				if (team.folder !== oldFolder) continue;
				team.folder = '';
				if (addName) team.name = oldFolder + ' ' + team.name;
				if (window.nodewebkit) Storage.saveTeam(team);
			}
			if (!window.nodewebkit) Storage.saveTeams();
			this.selectFolder('/');
		},
		show: function () {
			Room.prototype.show.apply(this, arguments);
			var $teamwrapper = this.$('.teamwrapper');
			var width = $(window).width();
			if (!$teamwrapper.length) return;
			if (width < 640) {
				var scale = (width / 640);
				$teamwrapper.css('transform', 'scale(' + scale + ')');
				$teamwrapper.addClass('scaled');
			} else {
				$teamwrapper.css('transform', 'none');
				$teamwrapper.removeClass('scaled');
			}
		},
		// button actions
		revealFolder: function () {
			Storage.revealFolder();
		},
		reloadTeamsFolder: function () {
			Storage.nwLoadTeams();
		},
		edit: function (i) {
			this.teamScrollPos = this.$('.teampane').scrollTop();
			if (i && i.currentTarget) {
				i = $(i.currentTarget).data('value');
			}
			i = +i;
			this.curTeam = teams[i];
			this.curTeam.iconCache = '!';
			this.curTeam.gen = this.getGen(this.curTeam.format);
			this.curTeam.dex = Dex.forGen(this.curTeam.gen);
			if (this.curTeam.format.includes('letsgo')) {
				this.curTeam.dex = Dex.mod('gen7letsgo');
			}
			if (this.curTeam.format.includes('bdsp')) {
				this.curTeam.dex = Dex.mod('gen8bdsp');
			}
			Storage.activeSetList = this.curSetList = Storage.unpackTeam(this.curTeam.team);
			this.curTeamIndex = i;
			this.update();
		},
		"delete": function (i) {
			i = +i;
			this.deletedTeamLoc = i;
			this.deletedTeam = teams.splice(i, 1)[0];
			for (var room in app.rooms) {
				var selection = app.rooms[room].$('button.teamselect').val();
				if (!selection || selection === 'random') continue;
				var obj = app.rooms[room].id === "" ? app.rooms[room] : app.rooms[room].tournamentBox;
				if (i < obj.curTeamIndex) {
					obj.curTeamIndex--;
				} else if (i === obj.curTeamIndex) {
					obj.curTeamIndex = -1;
				}
			}
			Storage.deleteTeam(this.deletedTeam);
			app.user.trigger('saveteams');
			this.updateTeamList();
		},
		undoDelete: function () {
			if (this.deletedTeamLoc >= 0) {
				teams.splice(this.deletedTeamLoc, 0, this.deletedTeam);
				for (var room in app.rooms) {
					var selection = app.rooms[room].$('button.teamselect').val();
					if (!selection || selection === 'random') continue;
					var obj = app.rooms[room].id === "" ? app.rooms[room] : app.rooms[room].tournamentBox;
					if (this.deletedTeamLoc < obj.curTeamIndex + 1) {
						obj.curTeamIndex++;
					} else if (obj.curTeamIndex === -1) {
						obj.curTeamIndex = this.deletedTeamLoc;
					}
				}
				var undeletedTeam = this.deletedTeam;
				this.deletedTeam = null;
				this.deletedTeamLoc = -1;
				Storage.saveTeam(undeletedTeam);
				app.user.trigger('saveteams');
				this.update();
			}
		},
		saveBackup: function () {
			Storage.deleteAllTeams();
			Storage.importTeam(this.$('.teamedit textarea').val(), true);
			teams = Storage.teams;
			Storage.saveAllTeams();
			for (var room in app.rooms) {
				var selection = app.rooms[room].$('button.teamselect').val();
				if (!selection || selection === 'random') continue;
				var obj = app.rooms[room].id === "" ? app.rooms[room] : app.rooms[room].tournamentBox;
				obj.curTeamIndex = 0;
			}
			this.back();
		},
		"new": function (type) {
			var newTeam = this.createTeam(null, type === "box");

			teams.push(newTeam);
			this.edit(teams.length - 1);
		},
		newTop: function (type) {
			var newTeam = this.createTeam(null, type === "box");
			teams.unshift(newTeam);
			for (var room in app.rooms) {
				var selection = app.rooms[room].$('button.teamselect').val();
				if (!selection || selection === 'random') continue;
				var obj = app.rooms[room].id === "" ? app.rooms[room] : app.rooms[room].tournamentBox;
				obj.curTeamIndex++;
				obj.updateTeams();
			}
			this.edit(0);
		},
		duplicate: function (i) {
			var newTeam = this.createTeam(i ? teams[i] : null);
			teams.unshift(newTeam);
			for (var room in app.rooms) {
				var selection = app.rooms[room].$('button.teamselect').val();
				if (!selection || selection === 'random') continue;
				var obj = app.rooms[room].id === "" ? app.rooms[room] : app.rooms[room].tournamentBox;
				obj.curTeamIndex++;
			}
			this.edit(0);
		},
		createTeam: function (orig, isBox) {
			var newTeam;
			if (orig) {
				newTeam = {
					name: 'Copy of ' + orig.name,
					format: orig.format,
					team: orig.team,
					capacity: orig.capacity,
					folder: orig.folder,
					iconCache: ''
				};
			} else {
				var format = this.curFolder || 'gen9';
				var folder = '';
				if (format && format.charAt(format.length - 1) === '/') {
					folder = format.slice(0, -1);
					format = 'gen9';
				}
				newTeam = {
					name: (isBox ? 'Box ' : 'Untitled ') + (teams.length + 1),
					format: format,
					team: '',
					capacity: isBox ? 24 : 6,
					folder: folder,
					iconCache: ''
				};
			}
			// work around Opera 42-45 crashing when persist() is called
			if (navigator.storage && navigator.storage.persist && !/ OPR\/4[0-5]/.test(navigator.userAgent)) {
				var self = this;
				navigator.storage.persist().then(function (state) {
					self.updatePersistence(state);
				});
			}

			return newTeam;
		},
		"import": function () {
			if (this.exportMode) return this.back();
			this.exportMode = true;
			if (!this.curTeam) {
				this['new']();
			} else {
				this.update();
			}
		},
		backup: function () {
			this.curTeam = null;
			this.curSetList = null;
			this.exportMode = true;
			this.update();
		},
		psExport: function () {
			var cmd = '/teams ';
			cmd += this.curTeam.teamid ? 'update' : 'save';
			// teamName, formatid, rawPrivacy, rawTeam
			var buf = [];
			if (this.curTeam.teamid) buf.push(this.curTeam.teamid);
			buf.push(this.curTeam.name);
			buf.push(this.curTeam.format);
			buf.push(this.$('input[name=teamprivacy]').get(0).checked ? 1 : 0);
			var team = Storage.exportTeam(this.curSetList, this.curTeam.gen, false);
			if (!team) return app.addPopupMessage("Add a Pokémon to your team before uploading it!");
			buf.push(team);
			app.send(cmd + " " + buf.join(', '));
			this.exported = true;
			$('button[name=psExport]').addClass('disabled');
			$('button[name=psExport]')[0].disabled = true;
			$('label[name=editMessage]').hide();
		},
		pokepasteExport: function (type) {
			var team = Storage.exportTeam(this.curSetList, this.curTeam.gen, type === 'openteamsheet');
			if (!team) return app.addPopupMessage("Add a Pokémon to your team before uploading it!");
			document.getElementById("pasteData").value = team;
			document.getElementById("pasteTitle").value = this.curTeam.name;
			if (type === 'openteamsheet') {
				document.getElementById("pasteTitle").value += " (OTS)";
			}
			document.getElementById("pasteAuthor").value = app.user.get('name');
			if (this.curTeam.format !== 'gen9') {
				document.getElementById("pasteNotes").value = "Format: " + this.curTeam.format;
			}
			document.getElementById("pokepasteForm").submit();
		},

		// drag and drop

		// because of a bug in Chrome and Webkit:
		//   https://code.google.com/p/chromium/issues/detail?id=410328
		// we can't use CSS :hover
		mouseOverTeam: function (e) {
			if (!e.currentTarget.className.endsWith('team-hover')) e.currentTarget.className += ' team-hover';
		},
		mouseOutTeam: function (e) {
			if (e.currentTarget.className.endsWith('team-hover')) e.currentTarget.className = e.currentTarget.className.slice(0, -11);
		},
		dragStartTeam: function (e) {
			var dataTransfer = e.originalEvent.dataTransfer;

			dataTransfer.effectAllowed = 'copyMove';

			dataTransfer.setData("text/plain", "Team " + e.currentTarget.dataset.value);

			var team = Storage.teams[e.currentTarget.dataset.value];
			var filename = team.name;
			if (team.format) filename = '[' + team.format + '] ' + filename;
			filename = $.trim(filename).replace(/[\\\/]+/g, '') + '.txt';
			var urlprefix = "data:text/plain;base64,";
			if (document.location.protocol === 'https:') {
				// Chrome is dumb and doesn't support data URLs in HTTPS
				urlprefix = "https://" + Config.routes.client + "/action.php?act=dlteam&team=";
			}
			var contents = Storage.exportTeam(team.team, team.gen).replace(/\n/g, '\r\n');
			var downloadurl = "text/plain:" + filename + ":" + urlprefix + encodeURIComponent(window.btoa(unescape(encodeURIComponent(contents))));
			console.log(downloadurl);
			dataTransfer.setData("DownloadURL", downloadurl);

			app.dragging = e.currentTarget;
			app.draggingRoom = this.id;
			app.draggingLoc = parseInt(e.currentTarget.dataset.value, 10);
			var elOffset = $(e.currentTarget).offset();
			app.draggingOffsetX = e.originalEvent.pageX - elOffset.left;
			app.draggingOffsetY = e.originalEvent.pageY - elOffset.top;
			this.finalOffset = null;
			setTimeout(function () {
				$(e.currentTarget).parent().addClass('dragging');
			}, 0);
		},
		dragEndTeam: function (e) {
			this.finishDrop();
		},
		finishDrop: function () {
			var teamEl = app.dragging;
			app.dragging = null;
			var originalLoc = parseInt(teamEl.dataset.value, 10);
			if (isNaN(originalLoc)) {
				throw new Error("drag failed");
			}
			var newLoc = Math.floor(app.draggingLoc);
			if (app.draggingLoc < originalLoc) newLoc += 1;
			var team = Storage.teams[originalLoc];
			var edited = false;
			if (newLoc !== originalLoc) {
				Storage.teams.splice(originalLoc, 1);
				Storage.teams.splice(newLoc, 0, team);
				for (var room in app.rooms) {
					var selection = app.rooms[room].$('button.teamselect').val();
					if (!selection || selection === 'random') continue;
					var obj = app.rooms[room].id === "" ? app.rooms[room] : app.rooms[room].tournamentBox;
					if (originalLoc === obj.curTeamIndex) {
						obj.curTeamIndex = newLoc;
					} else if (originalLoc > obj.curTeamIndex && newLoc <= obj.curTeamIndex) {
						obj.curTeamIndex++;
					} else if (originalLoc < obj.curTeamIndex && newLoc >= obj.curTeamIndex) {
						obj.curTeamIndex--;
					}
				}
				edited = true;
			}

			// possibly half-works-around a hover issue in
			this.$('.teamlist').css('pointer-events', 'none');
			$(teamEl).parent().removeClass('dragging');

			if (app.draggingFolder) {
				var $folder = $(app.draggingFolder);
				app.draggingFolder = null;
				var $plusOneFolder = $folder.find('.plusonefolder');
				$folder.removeClass('active');
				if (!$plusOneFolder.length) {
					$folder.prepend('<strong style="float:right;margin-right:3px;padding:0 2px;border-radius:3px;background:#CC8500;color:white" class="plusonefolder">+1</strong>');
				} else {
					var count = Number($plusOneFolder.text().substr(1)) + 1;
					$plusOneFolder.text('+' + count);
				}
				var format = $folder.data('value');
				if (format.slice(-1) === '/') {
					team.folder = format.slice(0, -1);
				} else {
					team.format = format;
				}
				edited = true;
			}
			this.updateTeamList();

			if (edited) {
				Storage.saveTeam(team);
				app.user.trigger('saveteams');
				this.exported = false;
				$('button[name=psExport]').removeClass('disabled');
				$('button[name=psExport]')[0].disabled = false;
				$('label[name=editMessage]').show();
			}

			// We're going to try to animate the team settling into its new position

			if (this.finalOffset) {
				// event.pageY and event.pageX are buggy on literally every browser:

				//   in Chrome:
				// event.pageX|pageY is the position of the bottom left corner of the draggable, instead
				// of the mouse position

				//   in Safari:
				// window.innerHeight * 2 - window.outerHeight - event.pageY is the mouse position
				// No, I don't understand what's going on, either, but unsurprisingly this fails utterly
				// if the page is zoomed.

				//   in Firefox:
				// event.pageX|pageY are straight-up unsupported

				// if you don't believe me, uncomment and see for yourself:
				// console.log('x,y = ' + [e.originalEvent.x, e.originalEvent.y]);
				// console.log('screenX,screenY = ' + [e.originalEvent.screenX, e.originalEvent.screenY]);
				// console.log('clientX,clientY = ' + [e.originalEvent.clientX, e.originalEvent.clientY]);
				// console.log('pageX,pageY = ' + [e.originalEvent.pageX, e.originalEvent.pageY]);

				// Because of this, we're just going to steal the values from the drop event, where
				// everything is sane.

				var $newTeamEl = this.$('.team[data-value=' + newLoc + ']');
				if (!$newTeamEl.length) return;
				var finalPos = $newTeamEl.offset();
				$newTeamEl.css('transform', 'translate(' + (this.finalOffset[0] - finalPos.left) + 'px, ' + (this.finalOffset[1] - finalPos.top) + 'px)');
				setTimeout(function () {
					$newTeamEl.css('transition', 'transform 0.15s');
					// it's 2015 and Safari doesn't support unprefixed transition!!!
					$newTeamEl.css('-webkit-transition', '-webkit-transform 0.15s');
					$newTeamEl.css('transform', 'translate(0px, 0px)');
				});
			}
		},
		dragEnterTeam: function (e) {
			if (!app.dragging) return;
			var $draggingLi = $(app.dragging).parent();
			this.dragLeaveFolder();
			if (e.currentTarget === app.dragging) {
				e.preventDefault();
				return;
			}
			var hoverLoc = parseInt(e.currentTarget.dataset.value, 10);
			if (app.draggingLoc > hoverLoc) {
				// dragging up
				$(e.currentTarget).parent().before($draggingLi);
				app.draggingLoc = parseInt(e.currentTarget.dataset.value, 10) - 0.5;
			} else {
				// dragging down
				$(e.currentTarget).parent().after($draggingLi);
				app.draggingLoc = parseInt(e.currentTarget.dataset.value, 10) + 0.5;
			}
		},
		dragEnterFolder: function (e) {
			if (!app.dragging) return;
			this.dragLeaveFolder();
			if (e.currentTarget === app.draggingFolder) {
				return;
			}
			var format = e.currentTarget.dataset.value;
			if (format === '+' || format === '++' || format === 'all' || format === this.curFolder) {
				return;
			}
			if (parseInt(app.dragging.dataset.value, 10) >= Storage.teams.length && format.slice(-1) !== '/') {
				// dragging a team file, already has a known format
				return;
			}
			app.draggingFolder = e.currentTarget;
			$(app.draggingFolder).addClass('active');
			// amusing note: using .detach() instead of .hide() will make `dragend` not fire
			$(app.dragging).parent().hide();
		},
		dragLeaveFolder: function (e) {
			// sometimes there's a race condition and dragEnter happens before dragLeave
			if (e && e.currentTarget !== app.draggingFolder) return;
			if (!app.dragging || !app.draggingFolder) return;
			$(app.draggingFolder).removeClass('active');
			app.draggingFolder = null;
			$(app.dragging).parent().show();
		},
		defaultDragEnterTeam: function (e) {
			var dataTransfer = e.originalEvent.dataTransfer;
			if (!dataTransfer) return;
			if (dataTransfer.types.indexOf && dataTransfer.types.indexOf('Files') === -1) return;
			if (dataTransfer.types.contains && !dataTransfer.types.contains('Files')) return;
			if (dataTransfer.files[0] && dataTransfer.files[0].name.slice(-4) !== '.txt') return;
			// We're dragging a file! It might be a team!
			if (app.curFolder && app.curFolder.slice(-1) !== '/') {
				this.selectFolder('all');
			}
			this.$('.teamlist').append('<li class="dragging"><div class="team" data-value="' + Storage.teams.length + '"></div></li>');
			app.dragging = this.$('.dragging .team')[0];
			app.draggingRoom = this.id;
			app.draggingLoc = Storage.teams.length;
			app.draggingOffsetX = 180;
			app.draggingOffsetY = 25;
		},
		defaultDropTeam: function (e) {
			if (e.originalEvent.dataTransfer.files && e.originalEvent.dataTransfer.files[0]) {
				var file = e.originalEvent.dataTransfer.files[0];
				var name = file.name;
				if (name.slice(-4) !== '.txt') {
					app.dragging = null;
					this.updateTeamList();
					app.addPopupMessage("Your file is not a valid team. Team files are .txt files.");
					return;
				}
				var reader = new FileReader();
				var self = this;
				reader.onload = function (e) {
					var team;
					try {
						team = Storage.packTeam(Storage.importTeam(e.target.result));
					} catch (err) {
						app.addPopupMessage("Your file is not a valid team.");
						self.updateTeamList();
						return;
					}
					var name = file.name;
					if (name.slice(name.length - 4).toLowerCase() === '.txt') {
						name = name.substr(0, name.length - 4);
					}
					var format = '';
					var bracketIndex = name.indexOf(']');
					var capacity = 6;
					if (bracketIndex >= 0) {
						format = name.substr(1, bracketIndex - 1);
						if (format && format.slice(0, 3) !== 'gen') format = 'gen6' + format;
						if (format && format.endsWith('-box')) {
							format = format.slice(0, -4);
							capacity = 24;
						}
						name = $.trim(name.substr(bracketIndex + 1));
					}
					Storage.teams.push({
						name: name,
						format: format,
						team: team,
						capacity: capacity,
						folder: '',
						iconCache: ''
					});
					self.finishDrop();
				};
				reader.readAsText(file);
			}
			this.finalOffset = [e.originalEvent.pageX - app.draggingOffsetX, e.originalEvent.pageY - app.draggingOffsetY];
		},

		/*********************************************************
		 * Team view
		 *********************************************************/

		updateTeamView: function () {
			this.curChartName = '';
			this.curChartType = '';

			var buf = '';
			if (this.exportMode) {
				buf = '<div class="pad"><button name="back" class="button"><i class="fa fa-chevron-left"></i> List</button> <input class="textbox teamnameedit" type="text" class="teamnameedit" size="30" value="' + BattleLog.escapeHTML(this.curTeam.name) + '" /> <button name="saveImport" class="button"><i class="fa fa-upload"></i> Import/Export</button> <button name="saveImport" class="savebutton button"><i class="fa fa-floppy-o"></i> Save</button></div>';
				buf += '<div class="teamedit"><textarea class="textbox" rows="17">' + BattleLog.escapeHTML(Storage.exportTeam(this.curSetList, this.curTeam.gen)) + '</textarea></div>';
			} else {
				buf = '<div class="pad"><button name="back" class="button"><i class="fa fa-chevron-left"></i> List</button> ';
				buf += '<input class="textbox teamnameedit" type="text" class="teamnameedit" size="30" value="' + BattleLog.escapeHTML(this.curTeam.name) + '" /> ';
				buf += '<button name="import" class="button"><i class="fa fa-upload"></i> Import/Export</button> ';
				buf += '<div class="teamchartbox">';
				buf += '<ol class="teamchart">';
				buf += '<li>' + this.clipboardHTML() + '</li>';
				var i = 0;
				if (this.curSetList.length && !this.curSetList[this.curSetList.length - 1].species) {
					this.curSetList.splice(this.curSetList.length - 1, 1);
				}

				var isGenericFormat = function (formatName) {
					if (!formatName) return true;
					if (/^gen\d+$/.test(formatName)) return true;
					return false;
				};
				if (this.loadingTeam) buf += '<div style="message-error">Downloading team from server...</strong><br />';
				buf += '<label name="editMessage" style="display: none">';
				buf += 'Remember to click the upload button below to sync your changes to the server!</label><br />';
				if (exports.BattleFormats) {
					buf += '<li class="format-select">';
					buf += '<label class="label">Format:</label><button class="select formatselect teambuilderformatselect" name="format" value="' + this.curTeam.format + '">' + (isGenericFormat(this.curTeam.format) ? '<em>Select a format</em>' : BattleLog.escapeFormat(this.curTeam.format)) + '</button>';
					var btnClass = 'button' + (!this.curSetList.length || app.isDisconnected ? ' disabled' : '');
					buf += ' <button name="validate" class="' + btnClass + '"><i class="fa fa-check"></i> Validate</button></li>';
				}
				if (!this.curSetList.length) {
					buf += '<li><em>you have no pokemon lol</em></li>';
				}
				for (i = 0; i < this.curSetList.length; i++) {
					if (this.curSetList.length < this.curTeam.capacity && this.deletedSet && i === this.deletedSetLoc) {
						buf += '<li><button name="undeleteSet" class="button"><i class="fa fa-undo"></i> Undo Delete</button></li>';
					}
					buf += this.renderSet(this.curSetList[i], i);
				}
				if (this.deletedSet && i === this.deletedSetLoc) {
					buf += '<li><button name="undeleteSet" class="button"><i class="fa fa-undo"></i> Undo Delete</button></li>';
				}
				if (i === 0) {
					buf += '<li><button name="import" class="button big"><i class="fa fa-upload"></i> Import from text or URL</button></li>';
				}
				if (i < this.curTeam.capacity) {
					buf += '<li><button name="addPokemon" class="button big"><i class="fa fa-plus"></i> Add Pok&eacute;mon</button></li>';
				}
				buf += '</ol>';
				var formatInfo = this.formatResources[this.curTeam.format];
				// data's there and loaded
				if (formatInfo && formatInfo !== true) {
					if (formatInfo.resources.length || formatInfo.url) {
						buf += '<div style="padding-left: 5px"><h3 style="font-size: 12px">Teambuilding resources for this tier:</h3></div><ul>';
						for (var i = 0; i < formatInfo.resources.length; i++) {
							var resource = formatInfo.resources[i];
							buf += '<li><p><a href="' + resource.url + '" target="_blank">' + resource.resource_name + '</a></p></li>';
						}
					}
					buf += '</ul>';
					var desc = formatInfo.resources.length ? 'more ' : '';
					buf += '<div style="padding-left: 5px">Find ' + desc + 'helpful resources for this tier on <a href="' + formatInfo.url + '" target="_blank">the Smogon Dex</a>.</div>';
				}
				buf += '<form id="pokepasteForm" style="display:inline" method="post" action="https://pokepast.es/create" target="_blank">';
				buf += '<input type="hidden" name="title" id="pasteTitle">';
				buf += '<input type="hidden" name="paste" id="pasteData">';
				buf += '<input type="hidden" name="author" id="pasteAuthor">';
				buf += '<input type="hidden" name="notes" id="pasteNotes">';
				buf += '<p><button name="psExport" type="submit" class="button exportbutton"> <i class="fa fa-upload"></i> Upload to Showdown database (saves across devices)</button>';
				var privacy = (Storage.prefs('uploadprivacy') || typeof Storage.prefs('uploadprivacy') !== 'boolean') ? 'checked' : '';
				buf += ' <label><small>(Private:</small> <input type="checkbox" name="teamprivacy" ' + privacy + ' /><small>)</small></label>';
				buf += '</p>';
				buf += '<p><button name="pokepasteExport" type="submit" class="button exportbutton"><i class="fa fa-upload"></i> Upload to PokePaste</button></p>';
				if (this.curTeam.format.includes('vgc')) {
					buf += '<p><button name="pokepasteExport" value="openteamsheet" type="submit" class="button exportbutton"><i class="fa fa-upload"></i> Upload to PokePaste (Open Team Sheet)</button></p>';
				}
				buf += '</form></div>';
			}
			this.$el.html('<div class="teamwrapper">' + buf + '</div>');
			this.$(".teamedit textarea").focus().select();
			if ($(window).width() < 640) this.show();
		},
		renderSet: function (set, i) {
			var species = this.curTeam.dex.species.get(set.species);
			var isLetsGo = this.curTeam.format.includes('letsgo');
			var isBDSP = this.curTeam.format.includes('bdsp');
			var isNatDex = this.curTeam.format.includes('nationaldex') || this.curTeam.format.includes('natdex');
			var buf = '<li value="' + i + '">';
			if (!set.species) {
				if (this.deletedSet) {
					buf += '<div class="setmenu setmenu-left"><button name="undeleteSet" class="button"><i class="fa fa-undo"></i> Undo Delete</button></div>';
				}
				buf += '<div class="setmenu"><button name="importSet"><i class="fa fa-upload"></i>Import</button></div>';
				buf += '<div class="setchart" style="background-image:url(' + Dex.resourcePrefix + 'sprites/gen5/0.png);"><div class="setcol setcol-icon"><div class="setcell-sprite"></div><div class="setcell setcell-pokemon"><label>Pok&eacute;mon</label><input type="text" name="pokemon" class="textbox chartinput" value="" autocomplete="off" /></div></div></div>';
				buf += '</li>';
				return buf;
			}
			buf += '<div class="setmenu"><button name="copySet"><i class="fa fa-files-o"></i>Copy</button> <button name="importSet"><i class="fa fa-upload"></i>Import/Export</button> <button name="moveSet"><i class="fa fa-arrows"></i>Move</button> <button name="deleteSet"><i class="fa fa-trash"></i>Delete</button></div>';
			buf += '<div class="setchart-nickname">';
			buf += '<label>Nickname</label><input type="text" name="nickname" class="textbox" value="' + BattleLog.escapeHTML(set.name || '') + '" placeholder="' + BattleLog.escapeHTML(species.baseSpecies) + '" />';
			buf += '</div>';
			buf += '<div class="setchart" style="' + Dex.getTeambuilderSprite(set, this.curTeam.gen) + ';">';

			// icon
			buf += '<div class="setcol setcol-icon">';
			if (species.cosmeticFormes) {
				buf += '<div class="setcell-sprite changeform"><i class="fa fa-caret-down"></i></div>';
			} else {
				buf += '<div class="setcell-sprite"></div>';
			}
			buf += '<div class="setcell setcell-pokemon"><label>Pok&eacute;mon</label><input type="text" name="pokemon" class="textbox chartinput" value="' + BattleLog.escapeHTML(set.species) + '" autocomplete="off" /></div></div>';

			// details
			buf += '<div class="setcol setcol-details"><div class="setrow">';
			buf += '<div class="setcell setcell-details"><label>Details</label><button class="textbox setdetails" tabindex="-1" name="details">';

			var GenderChart = {
				'M': 'Male',
				'F': 'Female',
				'N': '&mdash;'
			};
			buf += '<span class="detailcell detailcell-first"><label>Level</label>' + (set.level || 100) + '</span>';
			if (this.curTeam.gen > 1) {
				buf += '<span class="detailcell"><label>Gender</label>' + GenderChart[set.gender || species.gender || 'N'] + '</span>';
				if (isLetsGo) {
					buf += '<span class="detailcell"><label>Happiness</label>' + (typeof set.happiness === 'number' ? set.happiness : 70) + '</span>';
				} else if (this.curTeam.gen < 8 || isNatDex) {
					buf += '<span class="detailcell"><label>Happiness</label>' + (typeof set.happiness === 'number' ? set.happiness : 255) + '</span>';
				}
				buf += '<span class="detailcell"><label>Shiny</label>' + (set.shiny ? 'Yes' : 'No') + '</span>';
				if (!isLetsGo && this.curTeam.gen < 9) {
					if (this.curTeam.gen === 8 && !isNatDex) {
						if (isBDSP && species.baseSpecies === "Unown") {
							buf += '<span class="detailcell"><label>HP Type</label>' + (set.hpType || 'Dark') + '</span>';
						}
						// Hidden Power isn't in normal Gen 8
					} else {
						buf += '<span class="detailcell"><label>HP Type</label>' + (set.hpType || 'Dark') + '</span>';
					}
				}
				if (this.curTeam.gen === 8 && !isBDSP) {
					if (!species.cannotDynamax && set.dynamaxLevel !== 10 && set.dynamaxLevel !== undefined) {
						buf += '<span class="detailcell"><label>Dmax Level</label>' + (typeof set.dynamaxLevel === 'number' ? set.dynamaxLevel : 10) + '</span>';
					}
					if (species.canGigantamax || species.forme === 'Gmax') {
						buf += '<span class="detailcell"><label>Gmax</label>' + (set.gigantamax || species.forme === 'Gmax' ? 'Yes' : 'No') + '</span>';
					}
				}
				if (this.curTeam.gen === 9) {
					buf += '<span class="detailcell"><label>Tera Type</label>' + (species.forceTeraType || set.teraType || species.types[0]) + '</span>';
				}
			}
			buf += '</button></div></div>';

			// item/type icons
			buf += '<div class="setrow setrow-icons">';
			buf += '<div class="setcell">';
			var itemicon = '<span class="itemicon"></span>';
			if (set.item) {
				var item = this.curTeam.dex.items.get(set.item);
				itemicon = '<span class="itemicon" style="' + Dex.getItemIcon(item) + '"></span>';
			}
			buf += itemicon;
			buf += '</div>';
			buf += '<div class="setcell setcell-typeicons">';
			var types = species.types;
			if (types) {
				for (var i = 0; i < types.length; i++) buf += Dex.getTypeIcon(types[i]);
			}
			buf += '</div></div>';

			buf += '<div class="setrow">';
			if (this.curTeam.gen > 1 && !isLetsGo) buf += '<div class="setcell setcell-item"><label>Item</label><input type="text" name="item" class="textbox chartinput" value="' + BattleLog.escapeHTML(set.item) + '" autocomplete="off" /></div>';
			if (this.curTeam.gen > 2 && !isLetsGo) buf += '<div class="setcell setcell-ability"><label>Ability</label><input type="text" name="ability" class="textbox chartinput" value="' + BattleLog.escapeHTML(set.ability) + '" autocomplete="off" /></div>';
			buf += '</div></div>';

			// moves
			if (!set.moves) set.moves = [];
			buf += '<div class="setcol setcol-moves"><div class="setcell"><label>Moves</label>';
			for (var i = 0; i <= 3; i++) {
				if (i > 0) buf += '<div class="setcell">';
				buf += '<input type="text" name="move' + (i + 1) + '" class="textbox chartinput" value="' + BattleLog.escapeHTML(set.moves[i]) + '" autocomplete="off" /></div>';
			}
			buf += '</div>';

			// stats
			buf += '<div class="setcol setcol-stats"><div class="setrow"><label>Stats</label><button class="textbox setstats" name="stats">';
			buf += '<span class="statrow statrow-head"><label></label> <span class="statgraph"></span> <em>' + (!isLetsGo ? 'EV' : 'AV') + '</em></span>';
			var stats = {};
			var defaultEV = (this.curTeam.gen > 2 ? 0 : 252);
			for (var j in BattleStatNames) {
				if (j === 'spd' && this.curTeam.gen === 1) continue;
				stats[j] = this.getStat(j, set);
				var ev = (set.evs[j] === undefined ? defaultEV : set.evs[j]);
				var evBuf = '<em>' + (ev === defaultEV ? '' : ev) + '</em>';
				if (BattleNatures[set.nature] && BattleNatures[set.nature].plus === j) {
					evBuf += '<small>+</small>';
				} else if (BattleNatures[set.nature] && BattleNatures[set.nature].minus === j) {
					evBuf += '<small>&minus;</small>';
				}
				var width = stats[j] * 75 / 504;
				if (j == 'hp') width = stats[j] * 75 / 704;
				if (width > 75) width = 75;
				var color = Math.floor(stats[j] * 180 / 714);
				if (color > 360) color = 360;
				var statName = this.curTeam.gen === 1 && j === 'spa' ? 'Spc' : BattleStatNames[j];
				buf += '<span class="statrow"><label>' + statName + '</label> <span class="statgraph"><span style="width:' + width + 'px;background:hsl(' + color + ',40%,75%);"></span></span> ' + evBuf + '</span>';
			}
			buf += '</button></div></div>';

			buf += '</div></li>';
			return buf;
		},

		saveImport: function () {
			var text = this.$('.teamedit textarea').val();
			var url = this.importableUrl(text);

			if (url) {
				this.$('.teamedit textarea, .teamedit .savebutton').attr('disabled', true);
				var self = this;
				$.ajax({
					type: 'GET',
					url: url,
					success: function (data) {
						if (/^https?:\/\/pokepast\.es\/.*\/json\s*$/.test(url)) {

							var notes = data.notes.split('\n');
							if (notes[0].startsWith('Format: ')) {
								var formatid = toID(notes[0].slice(8));
								var format = window.BattleFormats && window.BattleFormats[formatid];
								if (format) self.changeFormat(format.id);
								notes.shift();
							}
							var teamNotes = notes.join('\n'); // Not implemented yet

							var title = data.title;
							if (title && !title.startsWith('Untitled')) {
								title = title.replace(/[\|\\\/]/g, '');
								self.$('.teamnameedit').val(title).change();
							}

							Storage.activeSetList = self.curSetList = Storage.importTeam(data.paste);
						} else {
							Storage.activeSetList = self.curSetList = Storage.importTeam(data);
						}
						self.$('.teamedit textarea, .teamedit .savebutton').attr('disabled', null);
						self.back();
					},
					error: function () {
						app.addPopupMessage("Could not fetch a team from this URL. Make sure you copied the full link, or paste the team in by hand.");
						self.$('.teamedit textarea, .teamedit .savebutton').attr('disabled', null);
					}
				});
			} else {
				Storage.activeSetList = this.curSetList = Storage.importTeam(text);
				this.back();
			}
		},
		importableUrl: function (value) {
			var match = value.match(/^https?:\/\/(pokepast\.es|gist\.github(?:usercontent)?\.com)\/(.*)\s*$/);
			if (!match) return;

			var host = match[1];
			var path = match[2];

			switch (host) {
			case 'pokepast.es':
				return 'https://pokepast.es/' + path.replace(/\/.*/, '') + '/json';
			default: // gist
				var split = path.split('/');
				return split.length < 2 ? undefined : 'https://gist.githubusercontent.com/' + split[0] + '/' + split[1] + '/raw';
			}
		},
		addPokemon: function () {
			if (!this.curTeam) return;
			var team = this.curSetList;
			if (!team.length || team[team.length - 1].species) {
				var newPokemon = {
					name: '',
					species: '',
					item: '',
					nature: '',
					evs: {},
					ivs: {},
					moves: []
				};
				team.push(newPokemon);
			}
			this.curSet = team[team.length - 1];
			this.curSetLoc = team.length - 1;
			this.curChartName = '';
			this.update();
			this.$('input[name=pokemon]').select();
			var formatid = this.curTeam.format;
			if (formatid.includes('monotype') || formatid.includes('monothreat')) {
				var typeTable = [];
				var dex = this.curTeam.dex;
				if (formatid.includes('monothreat')) {
					typeTable = [dex.types.get(formatid.slice(14)).name || 'Normal'];
				}
				for (var i = 0; i < this.curSetList.length; i++) {
					var set = this.curSetList[i];
					var species = dex.species.get(set.species);
					if (species.isMega) {
						species = dex.species.get(species.baseSpecies);
					}
					if (!species.exists) continue;
					if (!formatid.includes('monothreat')) {
						if (i === 0) {
							typeTable = species.types;
						} else {
							typeTable = typeTable.filter(function (type) {
								return species.types.includes(type);
							});
							if (!typeTable.length) break;
						}
					}
					if (this.curTeam.gen >= 6) {
						var item = dex.items.get(set.item);
						if (item.megaStone && species.baseSpecies === item.megaEvolves) {
							species = dex.species.get(item.megaStone);
							typeTable = typeTable.filter(function (type) {
								return species.types.includes(type);
							});
							if (!typeTable.length) break;
						}
					}
				}
				if (typeTable.length === 1) {
					this.search.engine.addFilter(['type', typeTable[0]]);
					this.search.filters = this.search.engine.filters;
					this.search.find('');
				}
			}
		},
		pastePokemon: function (i, btn) {
			if (!this.curTeam) return;
			var team = this.curSetList;
			if (team.length >= this.curTeam.capacity) return;
			if (!this.clipboardCount()) return;

			if (team.push($.extend(true, {}, this.clipboard[0])) >= 6) {
				$(btn).css('display', 'none');
			}
			this.update();
			this.save();
		},
		saveFlag: false,
		save: function () {
			this.saveFlag = true;
			if (this.curTeam) {
				Storage.saveTeam(this.curTeam);
			} else {
				Storage.saveTeams();
			}
		},
		validate: function () {
			if (this.curTeam.teamid && !this.curTeam.loaded) {
				return app.loadTeam(this.curTeam, this.validate.bind(this));
			}
			var format = this.curTeam.format || 'gen7anythinggoes';

			if (!this.curSetList.length) {
				app.addPopupMessage("You need at least one Pokémon to validate.");
				return;
			}

			if (window.BattleFormats && BattleFormats[format] && BattleFormats[format].battleFormat) {
				format = BattleFormats[format].battleFormat;
			}
			app.sendTeam(this.curTeam, function () {
				app.send('/vtm ' + format);
			});
		},
		teamNameChange: function (e) {
			var name = ($.trim(e.currentTarget.value) || 'Untitled ' + (this.curTeamLoc + 1));
			if (name.indexOf('/') >= 0 || name.indexOf('\\') >= 0) {
				app.addPopupMessage("Names can't contain slashes, since they're used as a folder separator.");
				name = name.replace(/[\\\/]/g, '');
			}
			if (name.indexOf('|') >= 0) {
				app.addPopupMessage("Names can't contain the character |, since they're used for storing teams.");
				name = name.replace(/\|/g, '');
			}
			if (name.indexOf('[') >= 0 || name.indexOf(']') >= 0) {
				app.addPopupMessage("Names can't contain the characters [ or ], since they're used for storing team IDs.");
				name = name.replace(/\[/g, '');
				name = name.replace(/\]/g, '');
			}
			this.curTeam.name = name;
			e.currentTarget.value = name;
			this.save();
		},
		format: function (format, button) {
			if (!window.BattleFormats) {
				return;
			}
			var self = this;
			app.addPopup(FormatPopup, {format: format, sourceEl: button, selectType: 'teambuilder', onselect: function (newFormat) {
				self.changeFormat(newFormat);
			}});
		},
		changeFormat: function (format) {
			this.curTeam.format = format;
			this.curTeam.gen = this.getGen(this.curTeam.format);
			this.curTeam.dex = Dex.forGen(this.curTeam.gen);
			if (this.curTeam.format.includes('letsgo')) {
				this.curTeam.dex = Dex.mod('gen7letsgo');
			}
			if (this.curTeam.format.includes('bdsp')) {
				this.curTeam.dex = Dex.mod('gen8bdsp');
			}
			this.save();
			if (this.curTeam.gen === 5 && !Dex.loadedSpriteData['bw']) Dex.loadSpriteData('bw');
			this.update();
		},
		nicknameChange: function (e) {
			var i = +$(e.currentTarget).closest('li').attr('value');
			var set = this.curSetList[i];
			var name = $.trim(e.currentTarget.value).replace(/\|/g, '');
			e.currentTarget.value = set.name = name;
			this.save();
		},

		// clipboard
		clipboard: [],
		clipboardCount: function () {
			return this.clipboard.length;
		},
		clipboardVisible: function () {
			return !!this.clipboardCount();
		},
		clipboardHTML: function () {
			var buf = '';
			buf += '<div class="teambuilder-clipboard-container" style="display: ' + (this.clipboardVisible() ? 'block' : 'none') + ';">';
			buf += '<div class="teambuilder-clipboard-title">Clipboard:</div>';
			buf += '<div class="teambuilder-clipboard-data" tabindex="-1">' + this.clipboardInnerHTML() + '</div>';
			buf += '<div class="teambuilder-clipboard-buttons">';
			if (this.curTeam && this.curSetList.length < this.curTeam.capacity) {
				buf += '<button name="pastePokemon" class="teambuilder-clipboard-button-left button"><i class="fa fa-clipboard"></i> Paste!</button>';
			}
			buf += '<button name="clipboardRemoveAll" class="teambuilder-clipboard-button-right button"><i class="fa fa-trash"></i> Clear clipboard</button>';
			buf += '</div>';
			buf += '</div>';

			return buf;
		},
		clipboardInnerHTMLCache: '',
		clipboardInnerHTML: function () {
			if (this.clipboardInnerHTMLCache) {
				return this.clipboardInnerHTMLCache;
			}

			var buf = '';
			for (var i = 0; i < this.clipboardCount(); i++) {
				var res = this.clipboard[i];
				var species = Dex.species.get(res.species);

				buf += '<div class="result" data-id="' + i + '">';
				buf += '<div class="section"><span class="icon" style="' + Dex.getPokemonIcon(species.name) + '"></span>';
				buf += '<span class="species">' + (species.name === species.baseSpecies ? BattleLog.escapeHTML(species.name) : (BattleLog.escapeHTML(species.baseSpecies) + '-<small>' + BattleLog.escapeHTML(species.name.substr(species.baseSpecies.length + 1)) + '</small>')) + '</span></div>';
				buf += '<div class="section"><span class="ability-item">' + (BattleLog.escapeHTML(res.ability) || '<i>No ability</i>') + '<br />' + (BattleLog.escapeHTML(res.item) || '<i>No item</i>') + '</span></div>';
				buf += '<div class="section no-border">';
				for (var j = 0; j < 4; j++) {
					if (!(j & 1)) {
						buf += '<span class="moves">';
					}
					buf += (BattleLog.escapeHTML(res.moves[j]) || '<i>No move</i>') + (!(j & 1) ? '<br />' : '');
					if (j & 1) {
						buf += '</span>';
					}
				}
				buf += '</div>';
				buf += '</div>';
			}

			this.clipboardInnerHTMLCache = buf;
			return buf;
		},
		clipboardUpdate: function () {
			this.clipboardInnerHTMLCache = '';
			$('.teambuilder-clipboard-data').html(this.clipboardInnerHTML());
		},
		clipboardExpanded: false,
		clipboardExpand: function () {
			var $clipboard = $('.teambuilder-clipboard-data');
			$clipboard.animate({height: this.clipboardCount() * 34}, 500, function () {
				setTimeout(function () { $clipboard.focus(); }, 100);
			});

			setTimeout(function () {
				this.clipboardExpanded = true;
			}.bind(this), 10);
		},
		clipboardShrink: function () {
			var $clipboard = $('.teambuilder-clipboard-data');
			$clipboard.animate({height: 32}, 500);

			setTimeout(function () {
				this.clipboardExpanded = false;
			}.bind(this), 10);
		},
		clipboardResultSelect: function (e) {
			if (!this.clipboardExpanded) return;

			e.preventDefault();
			e.stopPropagation();
			var target = +($(e.target).closest('.result').data('id'));
			if (target === -1) {
				this.clipboardShrink();
				this.clipboardRemoveAll();
				return;
			}

			this.clipboard.unshift(this.clipboard.splice(target, 1)[0]);
			this.clipboardUpdate();
			this.clipboardShrink();
		},
		clipboardAdd: function (set) {
			if (this.clipboard.unshift(set) > 6) {
				// we don't want the clipboard so big that it lags the teambuilder
				this.clipboard.pop();
			}
			this.clipboardUpdate();

			if (this.clipboardCount() === 1) {
				var $clipboard = $('.teambuilder-clipboard-container').css('opacity', 0);
				$clipboard.slideDown(250, function () {
					$clipboard.animate({opacity: 1}, 250);
				});
			}
		},
		clipboardRemoveAll: function () {
			this.clipboard = [];

			var self = this;
			var $clipboard = $('.teambuilder-clipboard-container');
			$clipboard.animate({opacity: 0}, 250, function () {
				$clipboard.slideUp(250, function () {
					self.clipboardUpdate();
				});
			});
		},

		// copy/import/export/move/delete
		copySet: function (i, button) {
			i = +($(button).closest('li').attr('value'));
			this.clipboardAdd($.extend(true, {}, this.curSetList[i]));
			button.blur();
		},
		wasViewingPokemon: false,
		importSet: function (i, button) {
			i = +($(button).closest('li').attr('value'));

			this.wasViewingPokemon = true;
			if (!this.curSet) {
				this.wasViewingPokemon = false;
				this.selectPokemon(i);
			}

			this.$('li').find('input, button').prop('disabled', true);
			this.$chart.hide();
			this.$('.teambuilder-pokemon-import')
				.show()
				.find('textarea')
				.val(Storage.exportTeam([this.curSet], this.curTeam.gen).trim())
				.focus()
				.select();

			this.getSmogonSets();
		},
		getSmogonSets: function () {
			this.$('.teambuilder-pokemon-import .teambuilder-import-smogon-sets').empty();
			this.$('.teambuilder-pokemon-import .teambuilder-import-user-sets').empty();

			var format = this.curTeam.format;
			// If we don't have a specific format, don't try and guess which sets to use.
			if (format.match(/gen\d$/)) return;

			var self = this;
			this.smogonSets = this.smogonSets || {};
			this.updateCachedUserSets(format);
			this.importSetButtons();

			if (this.smogonSets[format] !== undefined) {
				return;
			}

			// We fetch this as 'text' and JSON.parse it ourserves in order to have consistent behavior
			// between the localdev CORS helper and the real jQuery.get function, which would already parse
			// this into an object based on the content-type header.
			$.get('https://' + Config.routes.client + '/data/sets/' + format + '.json', {}, function (data) {
				try {
					self.smogonSets[format] = JSON.parse(data);
				} catch (e) {
					// An error occured. Mark this as false, so that we don't try to reimport sets for this format
					// in the future.
					self.smogonSets[format] = false;
				}
				self.importSetButtons();
			}, 'text');
		},
		updateCachedUserSets: function (format) {
			if (this.userSets && this.userSets[format]) return;

			this.userSets = this.userSets || {};
			this.userSets[format] = {};

			var duplicateNameIndices = {};
			for (var i = 0; i < teams.length; i++) {
				var team = teams[i];
				if (team.format !== format || team.capacity !== 24) continue;

				var setList = Storage.unpackTeam(team.team);
				for (var j = 0; j < setList.length; j++) {
					var set = setList[j];
					var name = set.name + " " + (duplicateNameIndices[set.name] || "");
					var sets = this.userSets[format][set.species] || {};
					sets[name] = set;
					this.userSets[format][set.species] = sets;
					duplicateNameIndices[set.name] = 1 + (duplicateNameIndices[set.name] || 0);
				}
			}
		},
		clearCachedUserSetsIfNecessary: function (format) {
			if (!this.curTeam || !this.userSets) return;

			// clear cached user sets if we have just been in a box for given format
			if (this.curTeam.capacity === 24 && this.userSets[format]) {
				this.userSets[format] = undefined;
			}
		},
		importSetButtons: function () {
			var format = this.curTeam.format;
			var smogonFormatSets = this.smogonSets[format];
			var userFormatSets = this.userSets[format];
			var species = this.curSet.species;

			var $smogonSetDiv = this.$('.teambuilder-pokemon-import .teambuilder-import-smogon-sets');
			$smogonSetDiv.empty();

			var $userSetDiv = this.$('.teambuilder-pokemon-import .teambuilder-import-user-sets');
			$userSetDiv.empty();

			if (smogonFormatSets) {
				var smogonSets = $.extend({}, smogonFormatSets['dex'][species], (smogonFormatSets['stats'] || {})[species]);
				$smogonSetDiv.text('Sample sets: ');
				for (var set in smogonSets) {
					$smogonSetDiv.append('<button name="importSmogonSet" class="button smogon">' + BattleLog.escapeHTML(set) + '</button>');
				}
				$smogonSetDiv.append(' <small>(<a target="_blank" href="' + this.smogdexLink(species) + '">Smogon&nbsp;analysis</a>)</small>');
			}

			$userSetDiv.text('Box sets: ');
			if (userFormatSets && userFormatSets[species]) {
				for (var set in userFormatSets[species]) {
					$userSetDiv.append('<button name="importSmogonSet" class="button box">' + BattleLog.escapeHTML(set) + '</button>');
				}
			} else {
				$userSetDiv.append('<small>(Sets from your boxes in this format will be available here)</small>');
			}
		},
		importSmogonSet: function (i, button) {
			var species = this.curSet.species;
			var setName = this.$(button).text();
			var sampleSet;
			if (this.$(button).hasClass('smogon')) {
				var smogonFormatSets = this.smogonSets[this.curTeam.format];
				sampleSet = smogonFormatSets['dex'][species][setName] || smogonFormatSets['stats'][species][setName];
			}

			if (this.$(button).hasClass('box')) {
				var userFormatSets = this.userSets[this.curTeam.format];
				sampleSet = userFormatSets[species][setName];
			}

			if (!sampleSet) return;

			var curSet = $.extend({}, this.curSet, sampleSet);

			// smogon samples don't usually have sample names, box samples usually do; either way, don't use them
			curSet.name = this.curSet.name || undefined;

			// never preserve current set tera, even if smogon set used default
			if (this.curSet.gen === 9) {
				curSet.teraType = species.forceTeraType || sampleSet.teraType || species.types[0];
			}

			var text = Storage.exportTeam([curSet], this.curTeam.gen);
			this.$('.teambuilder-pokemon-import .pokemonedit').val(text);
		},
		closePokemonImport: function (force) {
			if (!this.wasViewingPokemon) return this.back();

			var $li = this.$('li');
			var i = +($li.attr('value'));
			this.$('.teambuilder-pokemon-import').hide();
			this.$chart.show();

			if (force === true) return this.selectPokemon(i);
			$li.find('input, button').prop('disabled', false);
		},
		savePokemonImport: function (i) {
			i = +(this.$('li').attr('value'));
			var curSet = Storage.importTeam(this.$('.pokemonedit').val())[0];
			if (curSet) {
				this.curSet = curSet;
				this.curSetList[i] = curSet;
			}
			this.closePokemonImport(true);
		},
		moveSet: function (i, button) {
			i = +($(button).closest('li').attr('value'));
			app.addPopup(MoveSetPopup, {
				i: i,
				team: this.curSetList
			});
		},
		deleteSet: function (i, button) {
			i = +($(button).closest('li').attr('value'));
			this.deletedSetLoc = i;
			this.deletedSet = this.curSetList.splice(i, 1)[0];
			if (this.curSet) {
				this.addPokemon();
			} else {
				this.update();
			}
			this.save();
		},
		undeleteSet: function () {
			if (this.deletedSet) {
				var loc = this.deletedSetLoc;
				this.curSetList.splice(loc, 0, this.deletedSet);
				this.deletedSet = null;
				this.deletedSetLoc = -1;
				this.save();

				if (this.curSet) {
					this.curSetLoc = loc;
					this.curSet = this.curSetList[loc];
					this.curChartName = '';
					this.update();
					this.updateChart();
				} else {
					this.update();
				}
			}
		},

		/*********************************************************
		 * Set view
		 *********************************************************/

		updateSetView: function () {
			// pokemon
			var buf = '<div class="pad">';
			buf += '<button name="back" class="button"><i class="fa fa-chevron-left"></i> Team</button></div>';
			buf += '<div class="teambar">';
			buf += this.renderTeambar();
			buf += '</div>';

			// pokemon
			buf += '<div class="teamchartbox individual">';
			buf += '<ol class="teamchart">';
			buf += this.renderSet(this.curSet, this.curSetLoc);
			buf += '</ol>';
			buf += '</div>';

			// results
			this.chartPrevSearch = '[init]';
			buf += '<div class="teambuilder-results"></div>';

			// import/export
			buf += '<div class="teambuilder-pokemon-import">';
			buf += '<div class="pokemonedit-buttons"><button name="closePokemonImport" class="button"><i class="fa fa-chevron-left"></i> Back</button> <button name="savePokemonImport" class="button"><i class="fa fa-floppy-o"></i> Save</button></div>';
			buf += '<textarea class="pokemonedit textbox" rows="14"></textarea>';
			buf += '<div class="teambuilder-import-smogon-sets"></div>';
			buf += '<div class="teambuilder-import-user-sets"></div>';
			buf += '</div>';

			this.$el.html('<div class="teamwrapper">' + buf + '</div>');
			if ($(window).width() < 640) this.show();
			this.$chart = this.$('.teambuilder-results');
			this.search = new BattleSearch(this.$chart, this.$chart);
			var self = this;
			// fun fact: Backbone DOM events don't support scroll...
			// I guess scroll doesn't bubble like other events
			this.$chart.on('scroll', function () {
				if (self.curChartType in self.searchChartTypes) {
					self.search.updateScroll();
				}
			});
		},
		updateSetTop: function () {
			this.$('.teambar').html(this.renderTeambar());
			this.$('.teamchart').first().html(this.renderSet(this.curSet, this.curSetLoc));
		},
		renderTeambar: function () {
			var buf = '';
			var isAdd = false;
			if (this.curSetList.length && !this.curSetList[this.curSetList.length - 1].species && this.curSetLoc !== this.curSetList.length - 1) {
				this.curSetList.splice(this.curSetList.length - 1, 1);
			}
			// if in a box, try to show at least 2 and up to 4 other pokemon in each direction
			// but don't step outside the array bounds (obviously)
			var start = 0;
			var end = this.curSetList.length;
			if (end > 6 || (end === 6 && this.curTeam.capacity > 6)) {
				start = this.curSetLoc - 2;
				if (start < 0) start = 0;
				if (start + 5 > end) start = end - 5;
				end = start + 5;
			}
			for (var i = start; i < end; i++) {
				var set = this.curSetList[i];
				var pokemonicon = '<span class="picon pokemonicon-' + i + '" style="' + Dex.getPokemonIcon(set) + '"></span>';
				if (!set.species) {
					buf += '<button disabled class="addpokemon" aria-label="Add Pok&eacute;mon"><i class="fa fa-plus"></i></button> ';
					isAdd = true;
				} else if (i == this.curSetLoc) {
					buf += '<button disabled class="pokemon">' + pokemonicon + BattleLog.escapeHTML(set.name || this.curTeam.dex.species.get(set.species).baseSpecies || '<i class="fa fa-plus"></i>') + '</button> ';
				} else {
					buf += '<button name="selectPokemon" value="' + i + '" class="pokemon">' + pokemonicon + BattleLog.escapeHTML(set.name || this.curTeam.dex.species.get(set.species).baseSpecies) + '</button> ';
				}
			}
			if (this.curSetList.length < this.curTeam.capacity && !isAdd) {
				buf += '<button name="addPokemon"><i class="fa fa-plus"></i></button> ';
			}
			return buf;
		},
		updatePokemonSprite: function () {
			var set = this.curSet;
			if (!set) return;

			this.$('.setchart').attr('style', Dex.getTeambuilderSprite(set, this.curTeam.gen));

			this.$('.pokemonicon-' + this.curSetLoc).css('background', Dex.getPokemonIcon(set).substr(11));

			var item = this.curTeam.dex.items.get(set.item);
			if (item.id) {
				this.$('.setcol-details .itemicon').css('background', Dex.getItemIcon(item).substr(11));
			} else {
				this.$('.setcol-details .itemicon').css('background', 'none');
			}

			this.updateStatGraph();
		},
		updateStatGraph: function () {
			var set = this.curSet;
			if (!set) return;

			var stats = {hp:'', atk:'', def:'', spa:'', spd:'', spe:''};

			var supportsEVs = !this.curTeam.format.includes('letsgo');

			// stat cell
			var buf = '<span class="statrow statrow-head"><label></label> <span class="statgraph"></span> <em>' + (supportsEVs ? 'EV' : 'AV') + '</em></span>';
			var defaultEV = (this.curTeam.gen > 2 ? 0 : 252);
			for (var stat in stats) {
				if (stat === 'spd' && this.curTeam.gen === 1) continue;
				stats[stat] = this.getStat(stat, set);
				var ev = (set.evs[stat] === undefined ? defaultEV : set.evs[stat]);
				var evBuf = '<em>' + (ev === defaultEV ? '' : ev) + '</em>';
				if (BattleNatures[set.nature] && BattleNatures[set.nature].plus === stat) {
					evBuf += '<small>+</small>';
				} else if (BattleNatures[set.nature] && BattleNatures[set.nature].minus === stat) {
					evBuf += '<small>&minus;</small>';
				}
				var width = stats[stat] * 75 / 504;
				if (stat == 'hp') width = stats[stat] * 75 / 704;
				if (width > 75) width = 75;
				var color = Math.floor(stats[stat] * 180 / 714);
				if (color > 360) color = 360;
				var statName = this.curTeam.gen === 1 && stat === 'spa' ? 'Spc' : BattleStatNames[stat];
				buf += '<span class="statrow"><label>' + statName + '</label> <span class="statgraph"><span style="width:' + width + 'px;background:hsl(' + color + ',40%,75%);"></span></span> ' + evBuf + '</span>';
			}
			this.$('button[name=stats]').html(buf);

			if (this.curChartType !== 'stats') return;

			buf = '<div></div>';
			for (var stat in stats) {
				if (stat === 'spd' && this.curTeam.gen === 1) continue;
				buf += '<div><b>' + stats[stat] + '</b></div>';
			}
			this.$chart.find('.statscol').html(buf);

			buf = '<div></div>';
			var totalev = 0;
			for (var stat in stats) {
				if (stat === 'spd' && this.curTeam.gen === 1) continue;
				var width = stats[stat] * 180 / 504;
				if (stat == 'hp') width = stats[stat] * 180 / 704;
				if (width > 179) width = 179;
				var color = Math.floor(stats[stat] * 180 / 714);
				if (color > 360) color = 360;
				buf += '<div><em><span style="width:' + Math.floor(width) + 'px;background:hsl(' + color + ',85%,45%);border-color:hsl(' + color + ',85%,35%)"></span></em></div>';
				totalev += (set.evs[stat] || 0);
			}

			if (this.curTeam.gen > 2 && supportsEVs) buf += '<div><em>Remaining:</em></div>';
			this.$chart.find('.graphcol').html(buf);

			if (this.curTeam.gen <= 2) return;
			if (supportsEVs) {
				var maxEv = 510;
				if (totalev <= maxEv) {
					this.$chart.find('.totalev').html('<em>' + (totalev > (maxEv - 2) ? 0 : (maxEv - 2) - totalev) + '</em>');
				} else {
					this.$chart.find('.totalev').html('<b>' + (maxEv - totalev) + '</b>');
				}
			}
			this.$chart.find('select[name=nature]').val(set.nature || 'Serious');
			this.checkStatOptimizations();
		},
		curChartType: '',
		curChartName: '',
		searchChartTypes: {
			pokemon: 'pokemon',
			ability: 'abilities',
			move: 'moves',
			item: 'items'
		},
		updateChart: function (pokemonChanged, wasIncomplete) {
			var type = this.curChartType;
			if (type === 'stats') {
				this.search.qType = null;
				this.search.qName = null;
				this.updateStatForm();
				return;
			}
			if (type === 'details') {
				this.search.qType = null;
				this.search.qName = null;
				this.updateDetailsForm();
				return;
			}

			var $inputEl = this.$('input[name=' + this.curChartName + ']');
			var q = $inputEl.val();

			if (pokemonChanged || this.search.qName !== this.curChartName) {
				var cur = {};
				cur[toID(q)] = 1; // make sure selected one is first
				if (type === 'move') {
					cur[toID(this.$('input[name=move1]').val())] = 1;
					cur[toID(this.$('input[name=move2]').val())] = 1;
					cur[toID(this.$('input[name=move3]').val())] = 1;
					cur[toID(this.$('input[name=move4]').val())] = 1;
				}
				if (type !== this.search.qType) {
					this.$chart.scrollTop(0);
				}
				this.search.$inputEl = $inputEl;
				this.search.setType(type, this.curTeam.format || 'gen9', this.curSet, cur);
				this.qInitial = q;
				this.search.qName = this.curChartName;
				if (wasIncomplete) {
					if (this.search.find(q)) {
						if (this.search.q) this.$chart.find('a').first().addClass('hover');
					}
				}
			} else if (q !== this.qInitial) {
				this.qInitial = undefined;
				if (this.search.find(q)) {
					if (this.search.q) this.$chart.find('a').first().addClass('hover');
				}
			}
		},
		selectPokemon: function (i) {
			i = +i;
			var set = this.curSetList[i];
			if (set) {
				this.curSet = set;
				this.curSetLoc = i;
				if (!this.curChartName) {
					this.curChartName = 'details';
					this.curChartType = 'details';
				}
				if (this.curChartType in this.searchChartTypes) {
					this.update();
					this.updateChart(true);
					this.$('input[name=' + this.curChartName + ']').select();
				} else {
					this.update();
					this.updateChart(true);
				}
			}
		},
		stats: function (i, button) {
			if (!this.curSet) this.selectPokemon($(button).closest('li').val());
			this.curChartName = 'stats';
			this.curChartType = 'stats';
			this.updateChart();
		},
		details: function (i, button) {
			if (!this.curSet) this.selectPokemon($(button).closest('li').val());
			this.curChartName = 'details';
			this.curChartType = 'details';
			this.updateChart();
		},

		/*********************************************************
		 * Set stat form
		 *********************************************************/

		plus: '',
		minus: '',
		smogdexLink: function (s) {
			var species = this.curTeam.dex.species.get(s);
			var format = this.curTeam && this.curTeam.format;
			var smogdexid = toID(species.baseSpecies);

			if (species.id === 'meowstic') {
				smogdexid = 'meowstic-m';
			} else if (species.forme) {
				switch (species.baseSpecies) {
				case 'Alcremie':
				case 'Basculin':
				case 'Burmy':
				case 'Castform':
				case 'Cherrim':
				case 'Deerling':
				case 'Flabebe':
				case 'Floette':
				case 'Florges':
				case 'Furfrou':
				case 'Gastrodon':
				case 'Genesect':
				case 'Keldeo':
				case 'Mimikyu':
				case 'Minior':
				case 'Pikachu':
				case 'Polteageist':
				case 'Sawsbuck':
				case 'Shellos':
				case 'Sinistea':
				case 'Tatsugiri':
				case 'Vivillon':
					break;
				default:
					smogdexid += '-' + toID(species.forme);
					break;
				}
			}

			var generationNumber = 9;
			if (format.substr(0, 3) === 'gen') {
				var number = parseInt(format.charAt(3), 10);
				if (1 <= number && number <= 8) {
					generationNumber = number;
				}
				format = format.substr(4);
			}
			var generation = ['rb', 'gs', 'rs', 'dp', 'bw', 'xy', 'sm', 'ss', 'sv'][generationNumber - 1];
			if (format === 'battlespotdoubles') {
				smogdexid += '/vgc15';
			} else if (format === 'doublesou' || format === 'doublesuu') {
				smogdexid += '/doubles';
			} else if (format === 'ou' || format === 'uu' || format === 'ru' || format === 'nu' || format === 'pu' || format === 'lc' || format === 'monotype' || format === 'mixandmega' || format === 'nfe' || format === 'nationaldex' || format === 'stabmons' || format === '1v1' || format === 'almostanyability') {
				smogdexid += '/' + format;
			} else if (format === 'balancedhackmons') {
				smogdexid += '/bh';
			} else if (format === 'anythinggoes') {
				smogdexid += '/ag';
			} else if (format === 'nationaldexag') {
				smogdexid += '/national-dex-ag';
			}
			return 'http://smogon.com/dex/' + generation + '/pokemon/' + smogdexid + '/';
		},
		updateStatForm: function (setGuessed) {
			var buf = '';
			var set = this.curSet;
			var species = this.curTeam.dex.species.get(this.curSet.species);

			var baseStats = species.baseStats;

			buf += '<div class="resultheader"><h3>EVs</h3></div>';
			buf += '<div class="statform">';
			var guess = new BattleStatGuesser(this.curTeam.format).guess(set);
			var role = guess.role;

			var guessedEVs = guess.evs;
			var guessedPlus = guess.plusStat;
			var guessedMinus = guess.minusStat;
			buf += '<p class="suggested"><small>Guessed spread:';
			if (role === '?') {
				buf += ' (Please choose 4 moves to get a guessed spread) (<a target="_blank" href="' + this.smogdexLink(species) + '">Smogon&nbsp;analysis</a>)</small></p>';
			} else {
				buf += ' </small><button name="setStatFormGuesses" class="button">' + role + ': ';
				for (var i in BattleStatNames) {
					if (guessedEVs[i]) {
						var statName = this.curTeam.gen === 1 && i === 'spa' ? 'Spc' : BattleStatNames[i];
						buf += '' + guessedEVs[i] + ' ' + statName + ' / ';
					}
				}
				if (guessedPlus && guessedMinus) buf += ' (+' + BattleStatNames[guessedPlus] + ', -' + BattleStatNames[guessedMinus] + ')';
				else buf = buf.slice(0, -3);
				buf += '</button><small> (<a target="_blank" href="' + this.smogdexLink(species) + '">Smogon&nbsp;analysis</a>)</small></p>';
				// buf += ' <small>(' + role + ' | bulk: phys ' + Math.round(guess.moveCount.physicalBulk/1000) + ' + spec ' + Math.round(guess.moveCount.specialBulk/1000) + ' = ' + Math.round(guess.moveCount.bulk/1000) + ')</small>';
			}

			if (setGuessed) {
				set.evs = guessedEVs;
				this.plus = guessedPlus;
				this.minus = guessedMinus;
				this.updateNature();

				this.save();
				this.updateStatGraph();
				this.natureChange();
				return;
			}

			var stats = {hp:'', atk:'', def:'', spa:'', spd:'', spe:''};
			if (this.curTeam.gen === 1) delete stats.spd;
			if (!set) return;
			var nature = BattleNatures[set.nature || 'Serious'];
			if (!nature) nature = {};

			var supportsEVs = !this.curTeam.format.includes('letsgo');
			// var supportsAVs = !supportsEVs && this.curTeam.format.endsWith('norestrictions');
			var defaultEV = this.curTeam.gen <= 2 ? 252 : 0;
			var maxEV = supportsEVs ? 252 : 200;
			var stepEV = supportsEVs ? 4 : 1;

			// label column
			buf += '<div class="col labelcol"><div></div>';
			buf += '<div><label>HP</label></div><div><label>Attack</label></div><div><label>Defense</label></div><div>';
			if (this.curTeam.gen === 1) {
				buf += '<label>Special</label></div>';
			} else {
				buf += '<label>Sp. Atk.</label></div><div><label>Sp. Def.</label></div>';
			}

			buf += '<div><label>Speed</label></div></div>';

			buf += '<div class="col basestatscol"><div><em>Base</em></div>';
			for (var i in stats) {
				buf += '<div><b>' + baseStats[i] + '</b></div>';
			}
			buf += '</div>';

			buf += '<div class="col graphcol"><div></div>';
			for (var i in stats) {
				stats[i] = this.getStat(i);
				var width = stats[i] * 180 / 504;
				if (i == 'hp') width = Math.floor(stats[i] * 180 / 704);
				if (width > 179) width = 179;
				var color = Math.floor(stats[i] * 180 / 714);
				if (color > 360) color = 360;
				buf += '<div><em><span style="width:' + Math.floor(width) + 'px;background:hsl(' + color + ',85%,45%);border-color:hsl(' + color + ',85%,35%)"></span></em></div>';
			}
			if (this.curTeam.gen > 2 && supportsEVs) buf += '<div><em>Remaining:</em></div>';
			buf += '</div>';

			buf += '<div class="col evcol"><div><strong>' + (supportsEVs ? 'EVs' : 'AVs') + '</strong></div>';
			var totalev = 0;
			this.plus = '';
			this.minus = '';
			for (var i in stats) {
				var val;
				val = '' + ((set.evs[i] === undefined ? defaultEV : set.evs[i]) || '');
				if (nature.plus === i) {
					val += '+';
					this.plus = i;
				}
				if (nature.minus === i) {
					val += '-';
					this.minus = i;
				}
				buf += '<div><input type="text" name="stat-' + i + '" value="' + val + '" class="textbox inputform numform" /></div>';
				totalev += (set.evs[i] || 0);
			}
			if (this.curTeam.gen > 2 && supportsEVs) {
				var maxTotalEVs = 510;
				if (totalev <= maxTotalEVs) {
					buf += '<div class="totalev"><em>' + (totalev > (maxTotalEVs - 2) ? 0 : (maxTotalEVs - 2) - totalev) + '</em></div>';
				} else {
					buf += '<div class="totalev"><b>' + (maxTotalEVs - totalev) + '</b></div>';
				}
			}
			buf += '</div>';

			buf += '<div class="col evslidercol"><div></div>';
			for (var i in stats) {
				if (i === 'spd' && this.curTeam.gen === 1) continue;
				buf += '<div><input type="range" name="evslider-' + i + '" value="' + BattleLog.escapeHTML(set.evs[i] === undefined ? '' + defaultEV : '' + set.evs[i]) + '" min="0" max="' + maxEV + '" step="' + stepEV + '" class="evslider" tabindex="-1" aria-hidden="true" /></div>';
			}
			buf += '</div>';

			if (this.curTeam.gen > 2) {
				buf += '<div class="col ivcol"><div><strong>IVs</strong></div>';
				if (!set.ivs) set.ivs = {};
				for (var i in stats) {
					if (set.ivs[i] === undefined || isNaN(set.ivs[i])) set.ivs[i] = 31;
					var val = '' + (set.ivs[i]);
					buf += '<div><input type="number" name="iv-' + i + '" value="' + BattleLog.escapeHTML(val) + '" class="textbox inputform numform" min="0" max="31" step="1" /></div>';
				}
				var hpType = '';
				if (set.moves) {
					for (var i = 0; i < set.moves.length; i++) {
						var moveid = toID(set.moves[i]);
						if (moveid.slice(0, 11) === 'hiddenpower') {
							hpType = moveid.slice(11);
						}
					}
				}
				if (hpType && !this.canHyperTrain(set)) {
					var hpIVs;
					switch (hpType) {
					case 'dark':
						hpIVs = ['111111']; break;
					case 'dragon':
						hpIVs = ['011111', '101111', '110111']; break;
					case 'ice':
						hpIVs = ['010111', '100111', '111110']; break;
					case 'psychic':
						hpIVs = ['011110', '101110', '110110']; break;
					case 'electric':
						hpIVs = ['010110', '100110', '111011']; break;
					case 'grass':
						hpIVs = ['011011', '101011', '110011']; break;
					case 'water':
						hpIVs = ['100011', '111010']; break;
					case 'fire':
						hpIVs = ['101010', '110010']; break;
					case 'steel':
						hpIVs = ['100010', '111101']; break;
					case 'ghost':
						hpIVs = ['101101', '110101']; break;
					case 'bug':
						hpIVs = ['100101', '111100', '101100']; break;
					case 'rock':
						hpIVs = ['001100', '110100', '100100']; break;
					case 'ground':
						hpIVs = ['000100', '111001', '101001']; break;
					case 'poison':
						hpIVs = ['001001', '110001', '100001']; break;
					case 'flying':
						hpIVs = ['000001', '111000', '101000']; break;
					case 'fighting':
						hpIVs = ['001000', '110000', '100000']; break;
					}
					buf += '<div style="margin-left:-80px;text-align:right"><select name="ivspread" class="button">';
					buf += '<option value="" selected>HP ' + hpType.charAt(0).toUpperCase() + hpType.slice(1) + ' IVs</option>';

					var minStat = this.curTeam.gen >= 6 ? 0 : 2;

					buf += '<optgroup label="min Atk">';
					for (var i = 0; i < hpIVs.length; i++) {
						var spread = '';
						for (var j = 0; j < 6; j++) {
							if (j) spread += '/';
							spread += (j === 1 ? minStat : 30) + parseInt(hpIVs[i].charAt(j), 10);
						}
						buf += '<option value="' + spread + '">' + spread + '</option>';
					}
					buf += '</optgroup>';
					buf += '<optgroup label="min Atk, min Spe">';
					for (var i = 0; i < hpIVs.length; i++) {
						var spread = '';
						for (var j = 0; j < 6; j++) {
							if (j) spread += '/';
							spread += (j === 5 || j === 1 ? minStat : 30) + parseInt(hpIVs[i].charAt(j), 10);
						}
						buf += '<option value="' + spread + '">' + spread + '</option>';
					}
					buf += '</optgroup>';
					buf += '<optgroup label="max all">';
					for (var i = 0; i < hpIVs.length; i++) {
						var spread = '';
						for (var j = 0; j < 6; j++) {
							if (j) spread += '/';
							spread += 30 + parseInt(hpIVs[i].charAt(j), 10);
						}
						buf += '<option value="' + spread + '">' + spread + '</option>';
					}
					buf += '</optgroup>';
					buf += '<optgroup label="min Spe">';
					for (var i = 0; i < hpIVs.length; i++) {
						var spread = '';
						for (var j = 0; j < 6; j++) {
							if (j) spread += '/';
							spread += (j === 5 ? minStat : 30) + parseInt(hpIVs[i].charAt(j), 10);
						}
						buf += '<option value="' + spread + '">' + spread + '</option>';
					}
					buf += '</optgroup>';

					buf += '</select></div>';
				} else {
					buf += '<div style="margin-left:-80px;text-align:right"><select name="ivspread" class="button">';
					buf += '<option value="" selected>IV spreads</option>';

					buf += '<optgroup label="min Atk">';
					buf += '<option value="31/0/31/31/31/31">31/0/31/31/31/31</option>';
					buf += '</optgroup>';
					buf += '<optgroup label="min Atk, min Spe">';
					buf += '<option value="31/0/31/31/31/0">31/0/31/31/31/0</option>';
					buf += '</optgroup>';
					buf += '<optgroup label="max all">';
					buf += '<option value="31/31/31/31/31/31">31/31/31/31/31/31</option>';
					buf += '</optgroup>';
					buf += '<optgroup label="min Spe">';
					buf += '<option value="31/31/31/31/31/0">31/31/31/31/31/0</option>';
					buf += '</optgroup>';

					buf += '</select></div>';
				}
				buf += '</div>';
			} else {
				buf += '<div class="col ivcol"><div><strong>DVs</strong></div>';
				if (!set.ivs) set.ivs = {};
				for (var i in stats) {
					if (set.ivs[i] === undefined || isNaN(set.ivs[i])) set.ivs[i] = 31;
					var val = '' + Math.floor(set.ivs[i] / 2);
					buf += '<div><input type="number" name="iv-' + i + '" value="' + BattleLog.escapeHTML(val) + '" class="textbox inputform numform" min="0" max="15" step="1" /></div>';
				}
				buf += '</div>';
			}

			buf += '<div class="col statscol"><div></div>';
			for (var i in stats) {
				buf += '<div><b>' + stats[i] + '</b></div>';
			}
			buf += '</div>';

			if (this.curTeam.gen > 2) {
				buf += '<p style="clear:both">Nature: <select name="nature" class="button">';
				for (var i in BattleNatures) {
					var curNature = BattleNatures[i];
					buf += '<option value="' + i + '"' + (curNature === nature ? 'selected="selected"' : '') + '>' + i;
					if (curNature.plus) {
						buf += ' (+' + BattleStatNames[curNature.plus] + ', -' + BattleStatNames[curNature.minus] + ')';
					}
					buf += '</option>';
				}
				buf += '</select></p>';

				buf += '<p><small><em>Protip:</em> You can also set natures by typing <kbd>+</kbd> and <kbd>-</kbd> next to a stat.</small></p>';

				buf += '<p id="statoptimizer"></p>';
			}

			buf += '</div>';
			this.$chart.html(buf);
			this.checkStatOptimizations();
		},
		setStatFormGuesses: function () {
			this.updateStatForm(true);
		},
		checkStatOptimizations: function () {
			var optimized = BattleStatOptimizer(this.curSet, this.curTeam.format);

			if (optimized) {
				var buf = '';
				var msg = '';
				if (optimized.savedEVs) {
					msg = 'save ' + optimized.savedEVs + ' EVs';
				} else {
					msg = 'get higher stats';
				}
				buf += '<small><em>Protip:</em> Use a different nature to ' + msg + ': </small>';
				buf += ' <button name="setStatFormOptimization" class="button">';
				for (var i in BattleStatNames) {
					if (optimized.evs[i]) {
						buf += '' + optimized.evs[i] + ' ' + BattleStatNames[i] + ' / ';
					}
				}
				if (!optimized.plus && !optimized.minus) {
					buf += ' (Neutral nature)';
				} else {
					buf += ' (+' + BattleStatNames[optimized.plus] + ', -' + BattleStatNames[optimized.minus] + ')';
				}
				buf += '</button>';
				this.$chart.find('#statoptimizer').html(buf).show();
			} else {
				this.$chart.find('#statoptimizer').hide();
			}
		},
		setStatFormOptimization: function () {
			var optimized = BattleStatOptimizer(this.curSet, this.curTeam.format);
			this.curSet.evs = optimized.evs;
			this.plus = optimized.plus;
			this.minus = optimized.minus;
			this.updateNature();
			this.save();
			this.updateStatGraph();
			this.natureChange();
			this.$chart.find('#statoptimizer').hide();
		},
		setSlider: function (stat, val) {
			this.$chart.find('input[name=evslider-' + stat + ']').val(val || 0);
		},
		updateNature: function () {
			var set = this.curSet;
			if (!set) return;

			if (this.plus === '' || this.minus === '') {
				set.nature = 'Serious';
			} else {
				for (var i in BattleNatures) {
					if (BattleNatures[i].plus === this.plus && BattleNatures[i].minus === this.minus) {
						set.nature = i;
						break;
					}
				}
			}
		},
		statChange: function (e) {
			var inputName = '';
			inputName = e.currentTarget.name;
			var val = Math.abs(parseInt(e.currentTarget.value, 10));
			var supportsEVs = !this.curTeam.format.includes('letsgo');
			var supportsAVs = !supportsEVs && this.curTeam.format.endsWith('norestrictions');
			var set = this.curSet;
			if (!set) return;

			if (inputName.substr(0, 5) === 'stat-') {
				// EV
				// Handle + and -
				var stat = inputName.substr(5);

				var lastchar = e.currentTarget.value.charAt(e.target.value.length - 1);
				var firstchar = e.currentTarget.value.charAt(0);
				var natureChange = true;
				if ((lastchar === '+' || firstchar === '+') && stat !== 'hp') {
					if (this.plus && this.plus !== stat) this.$chart.find('input[name=stat-' + this.plus + ']').val(set.evs[this.plus] || '');
					this.plus = stat;
				} else if ((lastchar === '-' || lastchar === "\u2212" || firstchar === '-' || firstchar === "\u2212") && stat !== 'hp') {
					if (this.minus && this.minus !== stat) this.$chart.find('input[name=stat-' + this.minus + ']').val(set.evs[this.minus] || '');
					this.minus = stat;
				} else if (this.plus === stat) {
					this.plus = '';
				} else if (this.minus === stat) {
					this.minus = '';
				} else {
					natureChange = false;
				}
				if (natureChange) {
					this.updateNature();
				}

				// cap
				if (val > 252) val = 252;
				if (val < 0 || isNaN(val)) val = 0;

				if (set.evs[stat] !== val || natureChange) {
					set.evs[stat] = val;
					if (this.ignoreEVLimits) {
						var evNum = supportsEVs ? 252 : supportsAVs ? 200 : 0;
						if (set.evs['hp'] === undefined) set.evs['hp'] = evNum;
						if (set.evs['atk'] === undefined) set.evs['atk'] = evNum;
						if (set.evs['def'] === undefined) set.evs['def'] = evNum;
						if (set.evs['spa'] === undefined) set.evs['spa'] = evNum;
						if (set.evs['spd'] === undefined) set.evs['spd'] = evNum;
						if (set.evs['spe'] === undefined) set.evs['spe'] = evNum;
					}
					this.setSlider(stat, val);
					this.updateStatGraph();
				}
			} else {
				// IV
				var stat = inputName.substr(3);

				if (this.curTeam.gen <= 2) {
					val *= 2;
					if (val === 30) val = 31;
				}

				if (val > 31 || isNaN(val)) val = 31;
				if (val < 0) val = 0;

				if (!set.ivs) set.ivs = {};
				if (set.ivs[stat] !== val) {
					set.ivs[stat] = val;
					this.updateIVs();
					this.updateStatGraph();
				}
			}
			this.save();
		},
		updateIVs: function () {
			var set = this.curSet;
			if (!set.moves || this.canHyperTrain(set)) return;
			var hasHiddenPower = false;
			for (var i = 0; i < set.moves.length; i++) {
				if (toID(set.moves[i]).slice(0, 11) === 'hiddenpower') {
					hasHiddenPower = true;
					break;
				}
			}
			if (!hasHiddenPower) return;
			var hpTypes = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark'];
			var hpType;
			if (this.curTeam.gen <= 2) {
				var hpDV = Math.floor(set.ivs.hp / 2);
				var atkDV = Math.floor(set.ivs.atk / 2);
				var defDV = Math.floor(set.ivs.def / 2);
				var speDV = Math.floor(set.ivs.spe / 2);
				var spcDV = Math.floor(set.ivs.spa / 2);
				hpType = hpTypes[4 * (atkDV % 4) + (defDV % 4)];
				var expectedHpDV = (atkDV % 2) * 8 + (defDV % 2) * 4 + (speDV % 2) * 2 + (spcDV % 2);
				if (expectedHpDV !== hpDV) {
					set.ivs.hp = expectedHpDV * 2;
					if (set.ivs.hp === 30) set.ivs.hp = 31;
					this.$chart.find('input[name=iv-hp]').val(expectedHpDV);
				}
			} else {
				var hpTypeX = 0;
				var i = 1;
				var stats = {hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31};
				for (var s in stats) {
					if (set.ivs[s] === undefined) set.ivs[s] = 31;
					hpTypeX += i * (set.ivs[s] % 2);
					i *= 2;
				}
				hpType = hpTypes[Math.floor(hpTypeX * 15 / 63)];
			}
			for (var i = 0; i < set.moves.length; i++) {
				if (toID(set.moves[i]).slice(0, 11) === 'hiddenpower') {
					set.moves[i] = "Hidden Power " + hpType;
					if (i < 4) this.$('input[name=move' + (i + 1) + ']').val("Hidden Power " + hpType);
				}
			}
		},
		statSlide: function (e) {
			var slider = e.currentTarget;
			var stat = slider.name.substr(9);
			var set = this.curSet;
			if (!set) return;
			var val = +slider.value;
			var originalVal = val;
			var result = this.getStat(stat, set, val);
			var supportsEVs = !this.curTeam.format.includes('letsgo');
			var supportsAVs = !supportsEVs && this.curTeam.format.endsWith('norestrictions');
			if (supportsEVs) {
				while (val > 0 && this.getStat(stat, set, val - 4) == result) val -= 4;
			}

			if (supportsEVs && !this.ignoreEVLimits && set.evs) {
				var total = 0;
				for (var i in set.evs) {
					total += (i === stat ? val : set.evs[i]);
				}
				var totalLimit = 508;
				var limit = 252;
				if (total > totalLimit && val - total + totalLimit >= 0) {
					// don't allow dragging beyond 508 EVs
					val = val - total + totalLimit;

					// make sure val is a legal value
					val = +val;
					if (!val || val <= 0) val = 0;
					if (val > limit) val = limit;
				}
			}

			// Don't try this at home.
			// I am a trained professional.
			if (val !== originalVal) slider.value = val;

			if (!set.evs) set.evs = {};
			if (this.ignoreEVLimits) {
				var evNum = supportsEVs ? 252 : supportsAVs ? 200 : 0;
				if (set.evs['hp'] === undefined) set.evs['hp'] = evNum;
				if (set.evs['atk'] === undefined) set.evs['atk'] = evNum;
				if (set.evs['def'] === undefined) set.evs['def'] = evNum;
				if (set.evs['spa'] === undefined) set.evs['spa'] = evNum;
				if (set.evs['spd'] === undefined) set.evs['spd'] = evNum;
				if (set.evs['spe'] === undefined) set.evs['spe'] = evNum;
			}
			set.evs[stat] = val;

			val = '' + (val || '') + (this.plus === stat ? '+' : '') + (this.minus === stat ? '-' : '');
			this.$('input[name=stat-' + stat + ']').val(val);

			this.updateStatGraph();
		},
		statSlided: function (e) {
			this.statSlide(e);
			this.save();
		},
		natureChange: function (e) {
			var set = this.curSet;
			if (!set) return;

			if (e) {
				set.nature = e.currentTarget.value;
			}
			this.plus = '';
			this.minus = '';
			var nature = BattleNatures[set.nature || 'Serious'];
			for (var i in BattleStatNames) {
				var val = '' + (set.evs[i] || '');
				if (nature.plus === i) {
					this.plus = i;
					val += '+';
				}
				if (nature.minus === i) {
					this.minus = i;
					val += '-';
				}
				this.$chart.find('input[name=stat-' + i + ']').val(val);
				if (!e) this.setSlider(i, set.evs[i]);
			}

			this.save();
			this.updateStatGraph();
		},
		ivSpreadChange: function (e) {
			var set = this.curSet;
			if (!set) return;

			var spread = e.currentTarget.value.split('/');
			if (!set.ivs) set.ivs = {};
			if (spread.length !== 6) return;

			var stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
			for (var i = 0; i < 6; i++) {
				this.$chart.find('input[name=iv-' + stats[i] + ']').val(spread[i]);
				set.ivs[stats[i]] = parseInt(spread[i], 10);
			}
			$(e.currentTarget).val('');

			this.save();
			this.updateStatGraph();
		},

		/*********************************************************
		 * Set details form
		 *********************************************************/

		updateDetailsForm: function () {
			var buf = '';
			var set = this.curSet;
			var isLetsGo = this.curTeam.format.includes('letsgo');
			var isBDSP = this.curTeam.format.includes('bdsp');
			var isNatDex = this.curTeam.format.includes('nationaldex') || this.curTeam.format.includes('natdex');
			var isHackmons = this.curTeam.format.includes('hackmons') || this.curTeam.format.endsWith('bh');
			var species = this.curTeam.dex.species.get(set.species);
			if (!set) return;
			buf += '<div class="resultheader"><h3>Details</h3></div>';
			buf += '<form class="detailsform">';

			buf += '<div class="formrow"><label class="formlabel">Level:</label><div><input type="number" min="1" max="100" step="1" name="level" value="' + (typeof set.level === 'number' ? set.level : 100) + '" class="textbox inputform numform" /></div></div>';

			if (this.curTeam.gen > 1) {
				buf += '<div class="formrow"><label class="formlabel">Gender:</label><div>';
				if (species.gender && !isHackmons) {
					var genderTable = {'M': "Male", 'F': "Female", 'N': "Genderless"};
					buf += genderTable[species.gender];
				} else {
					buf += '<label class="checkbox inline"><input type="radio" name="gender" value="M"' + (set.gender === 'M' ? ' checked' : '') + ' /> Male</label> ';
					buf += '<label class="checkbox inline"><input type="radio" name="gender" value="F"' + (set.gender === 'F' ? ' checked' : '') + ' /> Female</label> ';
					if (!isHackmons) {
						buf += '<label class="checkbox inline"><input type="radio" name="gender" value="N"' + (!set.gender ? ' checked' : '') + ' /> Random</label>';
					} else {
						buf += '<label class="checkbox inline"><input type="radio" name="gender" value="N"' + (set.gender === 'N' ? ' checked' : '') + ' /> Genderless</label>';
					}
				}
				buf += '</div></div>';

				if (isLetsGo) {
					buf += '<div class="formrow"><label class="formlabel">Happiness:</label><div><input type="number" name="happiness" value="70" class="textbox inputform numform" /></div></div>';
				} else {
					if (this.curTeam.gen < 8 || isNatDex) buf += '<div class="formrow"><label class="formlabel">Happiness:</label><div><input type="number" min="0" max="255" step="1" name="happiness" value="' + (typeof set.happiness === 'number' ? set.happiness : 255) + '" class="textbox inputform numform" /></div></div>';
				}

				buf += '<div class="formrow"><label class="formlabel">Shiny:</label><div>';
				buf += '<label class="checkbox inline"><input type="radio" name="shiny" value="yes"' + (set.shiny ? ' checked' : '') + ' /> Yes</label> ';
				buf += '<label class="checkbox inline"><input type="radio" name="shiny" value="no"' + (!set.shiny ? ' checked' : '') + ' /> No</label>';
				buf += '</div></div>';

				if (this.curTeam.gen === 8 && !isBDSP) {
					if (!species.cannotDynamax) {
						buf += '<div class="formrow"><label class="formlabel">Dmax Level:</label><div><input type="number" min="0" max="10" step="1" name="dynamaxlevel" value="' + (typeof set.dynamaxLevel === 'number' ? set.dynamaxLevel : 10) + '" class="textbox inputform numform" /></div></div>';
					}
					if (species.canGigantamax || species.forme === 'Gmax') {
						buf += '<div class="formrow"><label class="formlabel">Gigantamax:</label><div>';
						if (species.forme === 'Gmax') {
							buf += 'Yes';
						} else {
							buf += '<label class="checkbox inline"><input type="radio" name="gigantamax" value="yes"' + (set.gigantamax ? ' checked' : '') + ' /> Yes</label> ';
							buf += '<label class="checkbox inline"><input type="radio" name="gigantamax" value="no"' + (!set.gigantamax ? ' checked' : '') + ' /> No</label>';
						}
						buf += '</div></div>';
					}
				}
			}

			if (this.curTeam.gen > 2) {
				buf += '<div class="formrow" style="display:none"><label class="formlabel">Pokeball:</label><div><select name="pokeball" class="button">';
				buf += '<option value=""' + (!set.pokeball ? ' selected="selected"' : '') + '></option>'; // unset
				var balls = this.curTeam.dex.getPokeballs();
				for (var i = 0; i < balls.length; i++) {
					buf += '<option value="' + balls[i] + '"' + (set.pokeball === balls[i] ? ' selected="selected"' : '') + '>' + balls[i] + '</option>';
				}
				buf += '</select></div></div>';
			}

			if (!isLetsGo && (this.curTeam.gen === 7 || isNatDex || (isBDSP && species.baseSpecies === 'Unown'))) {
				buf += '<div class="formrow"><label class="formlabel" title="Hidden Power Type">Hidden Power:</label><div><select name="hptype" class="button">';
				buf += '<option value=""' + (!set.hpType ? ' selected="selected"' : '') + '>(automatic type)</option>'; // unset
				var types = Dex.types.all();
				for (var i = 0; i < types.length; i++) {
					if (types[i].HPivs) {
						buf += '<option value="' + types[i].name + '"' + (set.hpType === types[i].name ? ' selected="selected"' : '') + '>' + types[i].name + '</option>';
					}
				}
				buf += '</select></div></div>';
			}

			if (this.curTeam.gen === 9) {
				buf += '<div class="formrow"><label class="formlabel" title="Tera Type">Tera Type:</label><div>';
				if (species.forceTeraType) {
					buf += species.forceTeraType;
				} else {
					buf += '<select name="teratype" class="button">';
					var types = Dex.types.all();
					var teraType = set.teraType || species.types[0];
					for (var i = 0; i < types.length; i++) {
						buf += '<option value="' + types[i].name + '"' + (teraType === types[i].name ? ' selected="selected"' : '') + '>' + types[i].name + '</option>';
					}
					buf += '</select>';
				}
				buf += '</div></div>';
			}

			buf += '</form>';
			if (species.cosmeticFormes) {
				buf += '<button class="altform button">Change sprite</button>';
			}

			this.$chart.html(buf);
		},
		detailsChange: function (e) {
			e.preventDefault();
			e.stopPropagation();
			var set = this.curSet;
			if (!set) return;
			var species = this.curTeam.dex.species.get(set.species);
			var isLetsGo = this.curTeam.format.includes('letsgo');
			var isBDSP = this.curTeam.format.includes('bdsp');
			var isNatDex = this.curTeam.format.includes('nationaldex') || this.curTeam.format.includes('natdex');

			// level
			var level = parseInt(this.$chart.find('input[name=level]').val(), 10);
			if (!level || level > 100 || level < 1) level = 100;
			if (level !== 100 || set.level) set.level = level;

			// happiness
			var happiness = parseInt(this.$chart.find('input[name=happiness]').val(), 10);
			if (isNaN(happiness) || happiness > 255 || happiness < 0) happiness = 255;
			set.happiness = happiness;
			if (set.happiness === 255) delete set.happiness;

			// shiny
			var shiny = (this.$chart.find('input[name=shiny]:checked').val() === 'yes');
			if (shiny) {
				set.shiny = true;
			} else {
				delete set.shiny;
			}

			// dynamax level
			var dynamaxLevel = parseInt(this.$chart.find('input[name=dynamaxlevel]').val(), 10);
			if (isNaN(dynamaxLevel) || dynamaxLevel > 10 || dynamaxLevel < 0) dynamaxLevel = 10;
			set.dynamaxLevel = dynamaxLevel;
			if (set.dynamaxLevel === 10) delete set.dynamaxLevel;

			// gigantamax
			var gmax = (this.$chart.find('input[name=gigantamax]:checked').val() === 'yes');
			if (gmax) {
				set.gigantamax = true;
			} else {
				delete set.gigantamax;
			}

			// gender
			var gender = this.$chart.find('input[name=gender]:checked').val();
			if (gender === 'M' || gender === 'F') {
				set.gender = gender;
			} else {
				delete set.gender;
			}

			// pokeball
			var pokeball = this.$chart.find('select[name=pokeball]').val();
			if (pokeball && this.curTeam.dex.items.get(pokeball).isPokeball) {
				set.pokeball = pokeball;
			} else {
				delete set.pokeball;
			}

			// HP type
			var hpType = this.$chart.find('select[name=hptype]').val();
			if (Dex.types.isName(hpType)) {
				set.hpType = hpType;
			} else {
				delete set.hpType;
			}

			// Tera type
			var teraType = this.$chart.find('select[name=teratype]').val();
			if (Dex.types.isName(teraType) && teraType !== species.types[0]) {
				set.teraType = teraType;
			} else {
				delete set.teraType;
			}

			// update details cell
			var buf = '';
			var GenderChart = {
				'M': 'Male',
				'F': 'Female',
				'N': '&mdash;'
			};
			buf += '<span class="detailcell detailcell-first"><label>Level</label>' + (set.level || 100) + '</span>';
			if (this.curTeam.gen > 1) {
				buf += '<span class="detailcell"><label>Gender</label>' + GenderChart[set.gender || 'N'] + '</span>';
				if (isLetsGo) {
					buf += '<span class="detailcell"><label>Happiness</label>70</span>';
				} else {
					if (this.curTeam.gen < 8 || isNatDex) buf += '<span class="detailcell"><label>Happiness</label>' + (typeof set.happiness === 'number' ? set.happiness : 255) + '</span>';
				}
				buf += '<span class="detailcell"><label>Shiny</label>' + (set.shiny ? 'Yes' : 'No') + '</span>';
				if (!isLetsGo && (this.curTeam.gen < 8 || isNatDex)) buf += '<span class="detailcell"><label>HP Type</label>' + (set.hpType || 'Dark') + '</span>';
				if (this.curTeam.gen === 8 && !isBDSP) {
					if (!species.cannotDynamax) {
						buf += '<span class="detailcell"><label>Dmax Level</label>' + (typeof set.dynamaxLevel === 'number' ? set.dynamaxLevel : 10) + '</span>';
					}
					if (species.canGigantamax || species.forme === 'Gmax') {
						buf += '<span class="detailcell"><label>Gmax</label>' + (set.gigantamax || species.forme === 'Gmax' ? 'Yes' : 'No') + '</span>';
					}
				}
				if (this.curTeam.gen === 9) {
					buf += '<span class="detailcell"><label>Tera Type</label>' + (species.forceTeraType || set.teraType || species.types[0]) + '</span>';
				}
			}
			this.$('button[name=details]').html(buf);

			this.save();
			this.updatePokemonSprite();
		},
		altForm: function (e) {
			var set = this.curSet;
			var i = 0;
			if (!set) {
				i = +$(e.currentTarget).closest('li').attr('value');
				set = this.curSetList[i];
			}
			app.addPopup(AltFormPopup, {curSet: set, index: i, room: this});
		},

		/*********************************************************
		 * Set charts
		 *********************************************************/

		chartTypes: {
			pokemon: 'pokemon',
			item: 'item',
			ability: 'ability',
			move1: 'move',
			move2: 'move',
			move3: 'move',
			move4: 'move',
			stats: 'stats',
			details: 'details'
		},
		chartClick: function (e) {
			if (this.search.addFilter(e.currentTarget)) {
				var curChart = this.$('input[name=' + this.curChartName + ']');
				// if we were searching for the filter, remove it
				if (this.search.q) curChart.val('');
				curChart.select();
				this.search.find('');
				return;
			}
			var entry = $(e.currentTarget).data('entry');
			var val = entry.slice(entry.indexOf("|") + 1);
			if (this.curChartType === 'move' && e.currentTarget.className === 'cur') {
				// clicked a move, remove it if we already have it
				var moves = [];
				for (var i = 0; i < this.curSet.moves.length; i++) {
					var curVal = this.curSet.moves[i];
					if (curVal === val) {
						this.unChooseMove(curVal);
						delete this.search.cur[toID(val)];
					} else if (curVal) {
						moves.push(curVal);
					}
				}
				if (moves.length < this.curSet.moves.length) {
					this.$('input[name=move1]').val(moves[0] || '');
					this.$('input[name=move2]').val(moves[1] || '');
					this.$('input[name=move3]').val(moves[2] || '');
					this.$('input[name=move4]').val(moves[3] || '');
					this.$('input[name=move' + Math.min(moves.length + 1, 4) + ']').focus();
					this.curSet.moves = moves;
					this.search.find('');
					return;
				}
			}
			this.chartSet(val, true);
		},
		chartKeydown: function (e) {
			var modifier = (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.cmdKey);
			if (e.keyCode === 13 || (e.keyCode === 9 && !modifier)) { // enter/tab
				if (!(this.curChartType in this.searchChartTypes)) return;
				this.updateChart();
				var $firstResult = this.$chart.find('a.hover');
				e.stopPropagation();
				e.preventDefault();
				if (!$firstResult.length) {
					this.chartChange(e, true);
					return;
				}

				if (this.search.addFilter($firstResult[0])) {
					$(e.currentTarget).val('').select();
					this.search.find('');
					return;
				}
				var entry = $firstResult.data('entry');
				var val = entry.slice(entry.indexOf("|") + 1);
				this.chartSet(val, true);
				return;
			} else if (e.keyCode === 38) { // up
				e.preventDefault();
				e.stopPropagation();
				var $active = this.$chart.find('a.hover');
				if (!$active.length) return this.$chart.find('a').first().addClass('hover');
				var $li = $active.parent().prev();
				while ($li[0] && $li[0].firstChild.tagName !== 'A') $li = $li.prev();
				if ($li[0] && $li.children()[0]) {
					$active.removeClass('hover');
					$active = $li.children();
					$active.addClass('hover');
				}
			} else if (e.keyCode === 40) { // down
				e.preventDefault();
				e.stopPropagation();
				var $active = this.$chart.find('a.hover');
				if (!$active.length) return this.$chart.find('a').first().addClass('hover');
				var $li = $active.parent().next();
				while ($li[0] && $li[0].firstChild.tagName !== 'A') $li = $li.next();
				if ($li[0] && $li.children()[0]) {
					$active.removeClass('hover');
					$active = $li.children();
					$active.addClass('hover');
				}
			} else if (e.keyCode === 27 || e.keyCode === 8) { // esc, backspace
				if (!e.currentTarget.value && this.search.removeFilter()) {
					this.search.find('');
					return;
				}
			} else if (e.keyCode === 188) {
				var $firstResult = this.$chart.find('a').first();
				if (!this.search.q) return;
				if (this.search.addFilter($firstResult[0])) {
					e.preventDefault();
					e.stopPropagation();
					$(e.currentTarget).val('').select();
					this.search.find('');
					return;
				}
			}
		},
		chartKeyup: function () {
			this.updateChart();
		},
		chartFocus: function (e) {
			var $target = $(e.currentTarget);
			var name = e.currentTarget.name;
			var type = this.chartTypes[name];
			var wasIncomplete = false;
			if ($target.hasClass('incomplete')) {
				wasIncomplete = true;
				$target.removeClass('incomplete');
			}

			if (this.curChartName === name) return;

			if (!this.curSet) {
				var i = +$target.closest('li').prop('value');
				this.curSet = this.curSetList[i];
				this.curSetLoc = i;
				this.update();
				if (type === 'stats' || type === 'details') {
					this.$('button[name=' + name + ']').click();
				} else {
					this.$('input[name=' + name + ']').select();
				}
				return;
			}

			this.curChartName = name;
			this.curChartType = type;
			this.updateChart(false, wasIncomplete);
		},
		chartChange: function (e, selectNext) {
			var name = e.currentTarget.name;
			if (this.curChartName !== name) return;
			var id = toID(e.currentTarget.value);
			if (id in BattleAliases) id = toID(BattleAliases[id]);
			var val = '';
			var format = this.curTeam.format;
			switch (name) {
			case 'pokemon':
				val = (id in BattlePokedex ? this.curTeam.dex.species.get(e.currentTarget.value).name : '');
				break;
			case 'ability':
				if (id in BattleItems && format && format.endsWith("dualwielding")) {
					val = BattleItems[id].name;
				} else if (id in BattleMovedex && format && format.endsWith("trademarked")) {
					val = BattleMovedex[id].name;
				} else {
					val = (id in BattleAbilities ? BattleAbilities[id].name : '');
				}
				break;
			case 'item':
				if (id in BattleMovedex && format && format.endsWith("fortemons")) {
					val = BattleMovedex[id].name;
				} else if (id in BattleAbilities && format && format.endsWith("multibility")) {
					val = BattleAbilities[id].name;
				} else {
					val = (id in BattleItems ? BattleItems[id].name : '');
				}
				break;
			case 'move1': case 'move2': case 'move3': case 'move4':
				if (id in BattlePokedex && format && format.endsWith("pokemoves")) {
					val = BattlePokedex[id].name;
				} else {
					val = (id in BattleMovedex ? BattleMovedex[id].name : '');
				}
				break;
			}
			if (!val) {
				if (name === 'pokemon' || name === 'ability' || id) {
					$(e.currentTarget).addClass('incomplete');
					return;
				}
			}
			this.chartSet(val, selectNext);
		},
		searchChange: function (e) {
			var DEBOUNCE_THRESHOLD_TEAMS = 500;
			var searchVal = e.currentTarget.value;
			var self = this;
			function updateTeamList() {
				// 91 for right CMD / 93 for left CMD / 17 for CTL
				if (e.keyCode !== 91 && e.keyCode !== 93 && e.keyCode !== 17) {
					self.curSearchVal = searchVal;
				}
				self.updateTeamList();
			}

			// If the user has a lot of teams, search is debounced to
			// ensure this isn't called too frequently while typing
			if (Storage.teams.length > DEBOUNCE_THRESHOLD_TEAMS) {
				if (this.searchTimeout) clearTimeout(this.searchTimeout);
				this.searchTimeout = setTimeout(updateTeamList, 400);
			} else updateTeamList();

		},
		chartSetCustom: function (val) {
			val = toID(val);
			if (val === 'cathy') {
				var set = this.curSet;
				set.name = "Cathy";
				set.species = 'Trevenant';
				delete set.level;
				var baseFormat = this.curTeam.format;
				if (baseFormat.substr(0, 3) === 'gen') baseFormat = baseFormat.substr(4);
				if (baseFormat.substr(0, 4) === 'bdsp') baseFormat = baseFormat.substr(4);
				if (baseFormat.substr(0, 8) === 'pokebank') baseFormat = baseFormat.substr(8);
				if (baseFormat.substr(0, 6) === 'natdex') baseFormat = baseFormat.substr(6);
				if (baseFormat.substr(0, 11) === 'nationaldex') baseFormat = baseFormat.substr(11);
				if (baseFormat.substr(-5) === 'draft') baseFormat = baseFormat.substr(0, baseFormat.length - 5);
				if (!baseFormat) baseFormat = 'ou';
				if (this.curTeam && this.curTeam.format) {
					if (baseFormat === 'battlespotsingles' || baseFormat === 'battlespotdoubles' || baseFormat.substr(0, 3) === 'vgc' ||
						baseFormat === 'battlefestivaldoubles') {
						set.level = 50;
					}
					if (baseFormat.startsWith('lc') || baseFormat.endsWith('lc')) set.level = 5;
				}
				set.gender = 'F';
				if (set.happiness) delete set.happiness;
				if (set.shiny) delete set.shiny;
				if (set.dynamaxLevel) delete set.dynamaxLevel;
				if (set.gigantamax) delete set.gigantamax;
				set.item = 'Starf Berry';
				set.ability = 'Harvest';
				set.moves = ['Substitute', 'Horn Leech', 'Earthquake', 'Phantom Force'];
				set.evs = {hp: 36, atk: 252, def: 0, spa: 0, spd: 0, spe: 220};
				set.ivs = {};
				set.nature = 'Jolly';
				this.updateSetTop();
				this.$(!this.$('input[name=item]').length ? (this.$('input[name=ability]').length ? 'input[name=ability]' : 'input[name=move1]') : 'input[name=item]').select();
				return true;
			}
			if (val === 'citizensnips' || val === 'snips') {
				var set = this.curSet;
				set.name = "citizen snips";
				set.species = 'Drapion';
				delete set.level;
				var baseFormat = this.curTeam.format;
				if (baseFormat.substr(0, 3) === 'gen') baseFormat = baseFormat.substr(4);
				if (baseFormat.substr(0, 4) === 'bdsp') baseFormat = baseFormat.substr(4);
				if (baseFormat.substr(0, 8) === 'pokebank') baseFormat = baseFormat.substr(8);
				if (baseFormat.substr(0, 6) === 'natdex') baseFormat = baseFormat.substr(6);
				if (baseFormat.substr(0, 11) === 'nationaldex') baseFormat = baseFormat.substr(11);
				if (baseFormat.substr(-5) === 'draft') baseFormat = baseFormat.substr(0, baseFormat.length - 5);
				if (!baseFormat) baseFormat = 'ou';
				if (this.curTeam && this.curTeam.format) {
					if (baseFormat === 'battlespotsingles' || baseFormat === 'battlespotdoubles' || baseFormat.substr(0, 3) === 'vgc' ||
						baseFormat === 'battlefestivaldoubles') {
						set.level = 50;
					}
					if (baseFormat.startsWith('lc') || baseFormat.endsWith('lc')) set.level = 5;
				}
				if (set.happiness) delete set.happiness;
				if (set.shiny) delete set.shiny;
				if (set.dynamaxLevel) delete set.dynamaxLevel;
				if (set.gigantamax) delete set.gigantamax;
				set.item = 'Leftovers';
				set.ability = 'Battle Armor';
				set.moves = ['Acupressure', 'Knock Off', 'Rest', 'Sleep Talk'];
				set.evs = {hp: 248, atk: 0, def: 96, spa: 0, spd: 108, spe: 56};
				set.ivs = {};
				set.nature = 'Impish';
				this.updateSetTop();
				this.$(!this.$('input[name=item]').length ? (this.$('input[name=ability]').length ? 'input[name=ability]' : 'input[name=move1]') : 'input[name=item]').select();
				return true;
			}
		},
		chartSet: function (val, selectNext) {
			var inputName = this.curChartName;
			var input = this.$('input[name=' + inputName + ']');
			if (this.chartSetCustom(input.val())) return;
			input.val(val).removeClass('incomplete');
			switch (inputName) {
			case 'pokemon':
				this.setPokemon(val, selectNext);
				break;
			case 'item':
				this.curSet.item = val;
				this.updatePokemonSprite();
				if (selectNext) this.$(this.$('input[name=ability]').length ? 'input[name=ability]' : 'input[name=move1]').select();
				break;
			case 'ability':
				this.curSet.ability = val;
				if (selectNext) this.$('input[name=move1]').select();
				break;
			case 'move1':
				this.unChooseMove(this.curSet.moves[0]);
				this.curSet.moves[0] = val;
				this.chooseMove(val);
				if (selectNext) this.$('input[name=move2]').select();
				break;
			case 'move2':
				if (!this.curSet.moves[0]) this.curSet.moves[0] = '';
				this.unChooseMove(this.curSet.moves[1]);
				this.curSet.moves[1] = val;
				this.chooseMove(val);
				if (selectNext) this.$('input[name=move3]').select();
				break;
			case 'move3':
				if (!this.curSet.moves[0]) this.curSet.moves[0] = '';
				if (!this.curSet.moves[1]) this.curSet.moves[1] = '';
				this.unChooseMove(this.curSet.moves[2]);
				this.curSet.moves[2] = val;
				this.chooseMove(val);
				if (selectNext) this.$('input[name=move4]').select();
				break;
			case 'move4':
				if (!this.curSet.moves[0]) this.curSet.moves[0] = '';
				if (!this.curSet.moves[1]) this.curSet.moves[1] = '';
				if (!this.curSet.moves[2]) this.curSet.moves[2] = '';
				this.unChooseMove(this.curSet.moves[3]);
				this.curSet.moves[3] = val;
				this.chooseMove(val);
				if (selectNext) {
					this.stats();
					this.$('button.setstats').focus();
				}
				break;
			}
			this.save();
		},
		unChooseMove: function (moveName) {
			var set = this.curSet;
			if (!moveName || !set || this.curTeam.format === 'gen7hiddentype') return;
			if (moveName.substr(0, 13) === 'Hidden Power ') {
				if (set.ivs) {
					for (var i in set.ivs) {
						if (set.ivs[i] === 30) set.ivs[i] = 31;
						if (set.ivs[i] <= 3) set.ivs[i] = 0;
					}
				}
			}
			var resetSpeed = false;
			if (moveName === 'Gyro Ball') {
				resetSpeed = true;
			}
			this.chooseMove('', resetSpeed);
		},
		canHyperTrain: function (set) {
			if (this.curTeam.gen < 7 || this.curTeam.format === 'gen7hiddentype') return false;
			var format = this.curTeam.format;
			if (!set.level || set.level === 100) return true;
			if (format.substr(0, 3) === 'gen') format = format.substr(4);
			if (format.substr(0, 10) === 'battlespot' || format.substr(0, 3) === 'vgc' || format === 'ultrasinnohclassic') {
				if (set.level === 50) return true;
			}
			return false;
		},
		chooseMove: function (moveName, resetSpeed) {
			var set = this.curSet;
			if (!set) return;
			var gen = this.curTeam.gen;

			var minSpe;
			if (resetSpeed) minSpe = false;
			if (moveName.substr(0, 13) === 'Hidden Power ') {
				if (!this.canHyperTrain(set)) {
					var hpType = moveName.substr(13);

					set.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
					if (this.curTeam.gen > 2) {
						var HPivs = this.curTeam.dex.types.get(hpType).HPivs;
						for (var i in HPivs) {
							set.ivs[i] = HPivs[i];
						}
					} else {
						var HPdvs = this.curTeam.dex.types.get(hpType).HPdvs;
						for (var i in HPdvs) {
							set.ivs[i] = HPdvs[i] * 2;
						}
						var atkDV = Math.floor(set.ivs.atk / 2);
						var defDV = Math.floor(set.ivs.def / 2);
						var speDV = Math.floor(set.ivs.spe / 2);
						var spcDV = Math.floor(set.ivs.spa / 2);
						var expectedHpDV = (atkDV % 2) * 8 + (defDV % 2) * 4 + (speDV % 2) * 2 + (spcDV % 2);
						set.ivs.hp = expectedHpDV * 2;
						if (set.ivs.hp === 30) set.ivs.hp = 31;
					}
				}
			} else if (moveName === 'Return') {
				this.curSet.happiness = 255;
			} else if (moveName === 'Frustration') {
				this.curSet.happiness = 0;
			} else if (moveName === 'Gyro Ball') {
				minSpe = true;
			}

			// only available through an event with 31 Spe IVs
			if (set.species.startsWith('Terapagos')) minSpe = false;

			if (this.curTeam.format === 'gen7hiddentype') return;

			var minAtk = true;
			// only available through an event with 31 Atk IVs
			if (set.ability === 'Battle Bond' || ['Koraidon', 'Miraidon'].includes(set.species)) minAtk = false;
			var hpModulo = (this.curTeam.gen >= 6 ? 2 : 4);
			var hasHiddenPower = false;
			var moves = set.moves;
			for (var i = 0; i < moves.length; ++i) {
				if (!moves[i]) continue;
				if (moves[i].substr(0, 13) === 'Hidden Power ') hasHiddenPower = true;
				var move = this.curTeam.dex.moves.get(moves[i]);
				if (move.id === 'transform') {
					hasHiddenPower = true; // A Pokemon with Transform can copy another Pokemon that knows Hidden Power

					var hasMoveBesidesTransform = false;
					for (var j = 0; j < moves.length; ++j) {
						if (j !== i && moves[j]) {
							hasMoveBesidesTransform = true;
							break;
						}
					}
					if (!hasMoveBesidesTransform) minAtk = false;
				} else if (move.category === 'Physical' && !move.damage && !move.ohko &&
					!['foulplay', 'endeavor', 'counter', 'bodypress', 'seismictoss', 'bide', 'metalburst', 'superfang'].includes(move.id) && !(this.curTeam.gen < 8 && move.id === 'rapidspin')) {
					minAtk = false;
				} else if (['metronome', 'assist', 'copycat', 'mefirst', 'photongeyser', 'shellsidearm', 'terablast'].includes(move.id) || (this.curTeam.gen === 5 && move.id === 'naturepower')) {
					minAtk = false;
				}
				if (minSpe === false && moveName === 'Gyro Ball') {
					minSpe = undefined;
				}
			}

			if (!set.ivs) {
				if (minSpe === undefined && (!minAtk || gen < 3)) return;
				set.ivs = {};
			}
			if (!set.ivs['spe'] && set.ivs['spe'] !== 0) set.ivs['spe'] = 31;
			if (minSpe) {
				// min Spe
				set.ivs['spe'] = (hasHiddenPower ? set.ivs['spe'] % hpModulo : 0);
			} else if (minSpe === false) {
				// max Spe
				set.ivs['spe'] = (hasHiddenPower ? 30 + (set.ivs['spe'] % 2) : 31);
			}
			if (gen < 3) return;
			if (!set.ivs['atk'] && set.ivs['atk'] !== 0) set.ivs['atk'] = 31;
			if (minAtk) {
				// min Atk
				if (['Gouging Fire', 'Iron Boulder', 'Iron Crown', 'Raging Bolt'].includes(set.species)) {
					// only available with 20 Atk IVs
					set.ivs['atk'] = 20;
				} else if (set.species.startsWith('Terapagos')) {
					// only available with 15 Atk IVs
					set.ivs['atk'] = 15;
				} else {
					set.ivs['atk'] = (hasHiddenPower ? set.ivs['atk'] % hpModulo : 0);
				}
			} else {
				// max Atk
				set.ivs['atk'] = (hasHiddenPower ? 30 + (set.ivs['atk'] % 2) : 31);
			}
		},
		setPokemon: function (val, selectNext) {
			var set = this.curSet;
			var species = this.curTeam.dex.species.get(val);
			if (!species.exists || set.species === species.name) {
				if (selectNext) this.$('input[name=item]').select();
				return;
			}

			set.name = "";
			set.species = val;
			if (set.level) delete set.level;
			if (this.curTeam && this.curTeam.format) {
				var baseFormat = this.curTeam.format;
				var format = window.BattleFormats && window.BattleFormats[baseFormat];
				if (baseFormat.substr(0, 3) === 'gen') baseFormat = baseFormat.substr(4);
				if (baseFormat.substr(0, 4) === 'bdsp') baseFormat = baseFormat.substr(4);
				if (baseFormat.substr(0, 8) === 'pokebank') baseFormat = baseFormat.substr(8);
				if (baseFormat.substr(0, 6) === 'natdex') baseFormat = baseFormat.substr(6);
				if (baseFormat.substr(0, 11) === 'nationaldex') baseFormat = baseFormat.substr(11);
				if (baseFormat.substr(-5) === 'draft') baseFormat = baseFormat.substr(0, baseFormat.length - 5);
				if (!baseFormat) baseFormat = 'ou';
				if (this.curTeam && this.curTeam.format) {
					if (baseFormat.substr(0, 10) === 'battlespot' && baseFormat.substr(0, 19) !== 'battlespotspecial13' ||
						baseFormat.substr(0, 3) === 'vgc' || baseFormat.substr(0, 14) === 'battlefestival') set.level = 50;
					if (baseFormat.startsWith('lc') || baseFormat.endsWith('lc')) set.level = 5;
					if (baseFormat.substr(0, 19) === 'battlespotspecial17') set.level = 1;
					if (format && format.teambuilderLevel) {
						set.level = format.teambuilderLevel;
					}
				}
			}
			if (set.gender) delete set.gender;
			if (species.gender && species.gender !== 'N') set.gender = species.gender;
			if (set.happiness) delete set.happiness;
			if (set.shiny) delete set.shiny;
			if (set.dynamaxLevel) delete set.dynamaxLevel;
			if (set.gigantamax) delete set.gigantamax;
			if (set.teraType) delete set.teraType;
			if (!(this.curTeam.format.includes('hackmons') || this.curTeam.format.endsWith('bh')) && species.requiredItems.length === 1) {
				set.item = species.requiredItems[0];
			} else {
				set.item = '';
			}
			set.ability = species.abilities['0'];

			set.moves = [];
			set.evs = {};
			set.ivs = {};
			set.nature = '';
			this.updateSetTop();
			if (selectNext) this.$(set.item || !this.$('input[name=item]').length ? (this.$('input[name=ability]').length ? 'input[name=ability]' : 'input[name=move1]') : 'input[name=item]').select();
		},

		/*********************************************************
		 * Utility functions
		 *********************************************************/

		// Stat calculator

		getStat: function (stat, set, evOverride, natureOverride) {
			var supportsEVs = !this.curTeam.format.includes('letsgo');
			var supportsAVs = !supportsEVs;
			if (!set) set = this.curSet;
			if (!set) return 0;

			if (!set.ivs) set.ivs = {
				hp: 31,
				atk: 31,
				def: 31,
				spa: 31,
				spd: 31,
				spe: 31
			};
			if (!set.evs) set.evs = {};

			// do this after setting set.evs because it's assumed to exist
			// after getStat is run
			var species = this.curTeam.dex.species.get(set.species);
			if (!species.exists) return 0;

			if (!set.level) set.level = 100;
			if (typeof set.ivs[stat] === 'undefined') set.ivs[stat] = 31;

			var baseStat = species.baseStats[stat];
			var iv = (set.ivs[stat] || 0);
			if (this.curTeam.gen <= 2) iv &= 30;
			var ev = set.evs[stat];
			if (evOverride !== undefined) ev = evOverride;
			if (ev === undefined) ev = (this.curTeam.gen > 2 ? 0 : 252);

			if (stat === 'hp') {
				if (baseStat === 1) return 1;
				if (!supportsEVs) return Math.floor(Math.floor(2 * baseStat + iv + 100) * set.level / 100 + 10) + (supportsAVs ? ev : 0);
				return Math.floor(Math.floor(2 * baseStat + iv + Math.floor(ev / 4) + 100) * set.level / 100 + 10);
			}
			var val = Math.floor(Math.floor(2 * baseStat + iv + Math.floor(ev / 4)) * set.level / 100 + 5);
			if (!supportsEVs) {
				val = Math.floor(Math.floor(2 * baseStat + iv) * set.level / 100 + 5);
			}
			if (natureOverride) {
				val *= natureOverride;
			} else if (BattleNatures[set.nature] && BattleNatures[set.nature].plus === stat) {
				val *= 1.1;
			} else if (BattleNatures[set.nature] && BattleNatures[set.nature].minus === stat) {
				val *= 0.9;
			}
			if (!supportsEVs) {
				var friendshipValue = Math.floor((70 / 255 / 10 + 1) * 100);
				val = Math.floor(val) * friendshipValue / 100 + (supportsAVs ? ev : 0);
			}
			return Math.floor(val);
		},

		// initialization

		getGen: function (format) {
			format = '' + format;
			if (!format) return 7;
			if (format.substr(0, 3) !== 'gen') return 6;
			return parseInt(format.substr(3, 1), 10) || 6;
		}
	});

	var MoveSetPopup = exports.MoveSetPopup = Popup.extend({
		initialize: function (data) {
			var buf = '<ul class="popupmenu">';
			this.i = data.i;
			this.team = data.team;
			for (var i = 0; i < data.team.length; i++) {
				var set = data.team[i];
				if (i !== data.i && i !== data.i + 1) {
					buf += '<li><button name="moveHere" value="' + i + '" class="option"><i class="fa fa-arrow-right"></i> Move here</button></li>';
				}
				buf += '<li' + (i === data.i ? ' style="opacity:.3"' : ' style="opacity:.6"') + '><span class="picon" style="display:inline-block;vertical-align:middle;' + Dex.getPokemonIcon(set) + '"></span> ' + BattleLog.escapeHTML(set.name || set.species) + '</li>';
			}
			if (i !== data.i && i !== data.i + 1) {
				buf += '<li><button name="moveHere" value="' + i + '" class="option"><i class="fa fa-arrow-right"></i> Move here</button></li>';
			}
			buf += '</ul>';
			this.$el.html(buf);
		},
		moveHere: function (i) {
			this.close();
			i = +i;

			var movedSet = this.team.splice(this.i, 1)[0];

			if (i > this.i) i--;
			this.team.splice(i, 0, movedSet);

			app.rooms['teambuilder'].save();
			if (app.rooms['teambuilder'].curSet) {
				app.rooms['teambuilder'].curSetLoc = i;
				app.rooms['teambuilder'].update();
				app.rooms['teambuilder'].updateChart();
			} else {
				app.rooms['teambuilder'].update();
			}
		}
	});

	var DeleteFolderPopup = this.DeleteFolderPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.room = data.room;
			this.folder = data.folder;
			var buf = '<form><p>Remove "' + data.folder.slice(0, -1) + '"?</p><p><label><input type="checkbox" name="addname" /> Add "' + BattleLog.escapeHTML(this.folder.slice(0, -1)) + '" before team names</label></p>';
			buf += '<p><button type="submit"><strong>Remove (keep teams)</strong></button> <!--button name="removeDelete"><strong>Remove (delete teams)</strong></button--> <button type="button" name="close" class="autofocus">Cancel</button></p></form>';
			this.$el.html(buf);
		},
		submit: function (data) {
			this.room.deleteFolder(this.folder, !!this.$('input[name=addname]')[0].checked);
			this.close();
		}
	});
	var AltFormPopup = this.AltFormPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.room = data.room;
			this.curSet = data.curSet;
			this.chartIndex = data.index;
			var species = this.room.curTeam.dex.species.get(this.curSet.species);
			var baseid = toID(species.baseSpecies);
			var forms = [baseid].concat(species.cosmeticFormes.map(toID));
			var spriteDir = Dex.resourcePrefix + 'sprites/';
			var spriteSize = 96;
			var spriteDim = 'width: 96px; height: 96px;';

			var gen = Math.max(this.room.curTeam.gen, species.gen);
			var dir = gen > 5 ? 'dex' : 'gen' + gen;
			if (Dex.prefs('nopastgens')) gen = 'dex';
			if (Dex.prefs('bwgfx') && dir === 'dex') gen = 'gen5';
			spriteDir += dir;
			if (dir === 'dex') {
				spriteSize = 120;
				spriteDim = 'width: 120px; height: 120px;';
			}

			var buf = '';
			buf += '<p>Pick a variant or <button name="close" class="button">Cancel</button></p>';
			buf += '<div class="formlist">';

			var formCount = forms.length;
			for (var i = 0; i < formCount; i++) {
				var formid = forms[i].substring(baseid.length);
				var form = (formid ? formid[0].toUpperCase() + formid.slice(1) : '');
				buf += '<button name="setForm" value="' + form + '" style="';
				buf += 'background-image: url(' + spriteDir + '/' + baseid + (form ? '-' + formid : '') + '.png); ' + spriteDim + '" class="option';
				buf += (form === (species.forme || '') ? ' cur' : '') + '"></button>';
			}
			buf += '<div style="clear:both"></div>';
			buf += '</div>';

			this.$el.html(buf).css({'max-width': (4 + spriteSize) * 7});
		},
		setForm: function (form) {
			var species = Dex.species.get(this.curSet.species);
			if (form && form !== species.form) {
				this.curSet.species = Dex.species.get(species.baseSpecies + form).name;
			} else if (!form) {
				this.curSet.species = species.baseSpecies;
			}
			this.close();
			if (this.room.curSet) {
				this.room.updatePokemonSprite();
			} else {
				this.room.update();
			}
			this.room.$('input[name=pokemon]').eq(this.chartIndex).val(this.curSet.species);
			this.room.curTeam.team = Storage.packTeam(this.room.curSetList);
			Storage.saveTeam(this.room.curTeam);
		}
	});

})(window, jQuery);
