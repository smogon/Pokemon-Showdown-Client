(function ($) {

	var BattleRoom = this.BattleRoom = ConsoleRoom.extend({
		type: 'battle',
		title: '',
		minWidth: 320,
		minMainWidth: 956,
		maxWidth: 1180,
		initialize: function (data) {
			this.choice = undefined;
			/** are move/switch/team-preview controls currently being shown? */
			this.controlsShown = false;

			this.battlePaused = false;
			this.autoTimerActivated = false;

			this.isSideRoom = Dex.prefs('rightpanelbattles');

			this.$el.addClass('ps-room-opaque').html('<div class="battle">Battle is here</div><div class="foehint"></div><div class="battle-log" aria-label="Battle Log" role="complementary"></div><div class="battle-log-add">Connecting...</div><ul class="battle-userlist userlist userlist-minimized"></ul><div class="battle-controls" role="complementary" aria-label="Battle Controls"></div><button class="battle-chat-toggle button" name="showChat"><i class="fa fa-caret-left"></i> Chat</button>');

			this.$battle = this.$el.find('.battle');
			this.$controls = this.$el.find('.battle-controls');
			this.$chatFrame = this.$el.find('.battle-log');
			this.$chatAdd = this.$el.find('.battle-log-add');
			this.$foeHint = this.$el.find('.foehint');

			BattleSound.setMute(Dex.prefs('mute'));
			this.battle = new Battle({
				id: this.id,
				$frame: this.$battle,
				$logFrame: this.$chatFrame
			});
			this.battle.roomid = this.id;
			this.battle.joinButtons = true;
			this.tooltips = this.battle.scene.tooltips;
			this.tooltips.listen(this.$controls);

			var self = this;
			this.battle.subscribe(function () { self.updateControls(); });

			this.users = {};
			this.userCount = {users: 0};
			this.$userList = this.$('.userlist');
			this.userList = new UserList({
				el: this.$userList,
				room: this
			});
			this.userList.construct();

			this.$chat = this.$chatFrame.find('.inner');

			this.$options = this.battle.scene.$options.html('<div style="padding-top: 3px; padding-right: 3px; text-align: right"><button class="icon button" name="openBattleOptions" title="Options">Battle Options</button></div>');
		},
		events: {
			'click .replayDownloadButton': 'clickReplayDownloadButton',
			'change input[name=megaevox]': 'uncheckMegaEvoY',
			'change input[name=megaevoy]': 'uncheckMegaEvoX',
			'change input[name=zmove]': 'updateZMove',
			'change input[name=dynamax]': 'updateMaxMove'
		},
		battleEnded: false,
		join: function () {
			app.send('/join ' + this.id);
		},
		showChat: function () {
			this.$('.battle-chat-toggle').attr('name', 'hideChat').html('Battle <i class="fa fa-caret-right"></i>');
			this.$el.addClass('showing-chat');
		},
		hideChat: function () {
			this.$('.battle-chat-toggle').attr('name', 'showChat').html('<i class="fa fa-caret-left"></i> Chat');
			this.$el.removeClass('showing-chat');
		},
		leave: function () {
			if (!this.expired) app.send('/noreply /leave ' + this.id);
			if (this.battle) this.battle.destroy();
		},
		requestLeave: function (e) {
			if ((this.side || this.requireForfeit) && this.battle && !this.battleEnded && !this.expired && !this.battle.forfeitPending) {
				app.addPopup(ForfeitPopup, {room: this, sourceEl: e && e.currentTarget, gameType: 'battle'});
				return false;
			}
			return true;
		},
		updateLayout: function () {
			var width = this.$el.width();
			if (width < 950 || this.battle.hardcoreMode) {
				this.battle.messageShownTime = 500;
			} else {
				this.battle.messageShownTime = 1;
			}
			if (width && width < 640) {
				var scale = (width / 640);
				this.$battle.css('transform', 'scale(' + scale + ')');
				this.$foeHint.css('transform', 'scale(' + scale + ')');
				this.$controls.css('top', 360 * scale + 10);
			} else {
				this.$battle.css('transform', 'none');
				this.$foeHint.css('transform', 'none');
				this.$controls.css('top', 370);
			}
			this.$el.toggleClass('small-layout', width < 830);
			this.$el.toggleClass('tiny-layout', width < 640);
			if (this.$chat) this.$chatFrame.scrollTop(this.$chat.height());
		},
		show: function () {
			Room.prototype.show.apply(this, arguments);
			this.updateLayout();
		},
		receive: function (data) {
			this.add(data);
		},
		focus: function (e) {
			this.tooltips.hideTooltip();
			if (this.battle.paused && !this.battlePaused) {
				if (Dex.prefs('noanim')) this.battle.seekTurn(Infinity);
				this.battle.play();
			}
			ConsoleRoom.prototype.focus.call(this, e);
		},
		blur: function () {
			this.battle.pause();
		},
		init: function (data) {
			var log = data.split('\n');
			if (data.substr(0, 6) === '|init|') log.shift();
			if (log.length && log[0].substr(0, 7) === '|title|') {
				this.title = log[0].substr(7);
				log.shift();
				app.roomTitleChanged(this);
			}
			if (this.battle.stepQueue.length) return;
			this.battle.stepQueue = log;
			this.battle.seekTurn(Infinity, true);
			if (this.battle.ended) this.battleEnded = true;
			this.updateLayout();
			this.updateControls();
		},
		add: function (data) {
			if (!data) return;
			if (data.substr(0, 6) === '|init|') {
				return this.init(data);
			}
			if (data.substr(0, 11) === '|cantleave|') {
				this.requireForfeit = true;
				return;
			}
			if (data.substr(0, 12) === '|allowleave|') {
				this.requireForfeit = false;
				return;
			}
			if (data.substr(0, 9) === '|request|') {
				data = data.slice(9);

				var requestData = null;
				var choiceText = null;

				var nlIndex = data.indexOf('\n');
				if (/[0-9]/.test(data.charAt(0)) && data.charAt(1) === '|') {
					// message format:
					//   |request|CHOICEINDEX|CHOICEDATA
					//   REQUEST

					// This is backwards compatibility with old code that violates the
					// expectation that server messages can be streamed line-by-line.
					// Please do NOT EVER push protocol changes without a pull request.
					// https://github.com/Zarel/Pokemon-Showdown/commit/e3c6cbe4b91740f3edc8c31a1158b506f5786d72#commitcomment-21278523
					choiceText = '?';
					data = data.slice(2, nlIndex);
				} else if (nlIndex >= 0) {
					// message format:
					//   |request|REQUEST
					//   |sentchoice|CHOICE
					if (data.slice(nlIndex + 1, nlIndex + 13) === '|sentchoice|') {
						choiceText = data.slice(nlIndex + 13);
					}
					data = data.slice(0, nlIndex);
				}

				try {
					requestData = JSON.parse(data);
				} catch (err) {}
				return this.receiveRequest(requestData, choiceText);
			}

			var log = data.split('\n');
			for (var i = 0; i < log.length; i++) {
				var logLine = log[i];

				if (logLine === '|') {
					this.callbackWaiting = false;
					this.controlsShown = false;
					this.$controls.html('');
				}

				if (logLine.substr(0, 10) === '|callback|') {
					// TODO: Maybe a more sophisticated UI for this.
					// In singles, this isn't really necessary because some elements of the UI will be
					// immediately disabled. However, in doubles/triples it might not be obvious why
					// the player is being asked to make a new decision without the following messages.
					var args = logLine.substr(10).split('|');
					var pokemon = isNaN(Number(args[1])) ? this.battle.getPokemon(args[1]) : this.battle.nearSide.active[args[1]];
					var requestData = this.request.active[pokemon ? pokemon.slot : 0];
					this.choice = undefined;
					switch (args[0]) {
					case 'trapped':
						requestData.trapped = true;
						var pokeName = pokemon.side.n === 0 ? BattleLog.escapeHTML(pokemon.name) : "The opposing " + (this.battle.ignoreOpponent || this.battle.ignoreNicks ? pokemon.speciesForme : BattleLog.escapeHTML(pokemon.name));
						this.battle.stepQueue.push('|message|' + pokeName + ' is trapped and cannot switch!');
						break;
					case 'cant':
						for (var i = 0; i < requestData.moves.length; i++) {
							if (requestData.moves[i].id === args[3]) {
								requestData.moves[i].disabled = true;
							}
						}
						args.splice(1, 1, pokemon.getIdent());
						this.battle.stepQueue.push('|' + args.join('|'));
						break;
					}
				} else if (logLine.substr(0, 7) === '|title|') { // eslint-disable-line no-empty
				} else if (logLine.substr(0, 5) === '|win|' || logLine === '|tie') {
					this.battleEnded = true;
					this.battle.stepQueue.push(logLine);
				} else if (logLine.substr(0, 6) === '|chat|' || logLine.substr(0, 3) === '|c|' || logLine.substr(0, 4) === '|c:|' || logLine.substr(0, 9) === '|chatmsg|' || logLine.substr(0, 10) === '|inactive|') {
					this.battle.instantAdd(logLine);
				} else {
					this.battle.stepQueue.push(logLine);
				}
			}
			this.battle.add();
			if (Dex.prefs('noanim')) this.battle.seekTurn(Infinity);
			this.updateControls();
		},
		toggleMessages: function (user) {
			var $messages = $('.chatmessage-' + user + '.revealed');
			var $button = $messages.find('button');
			if (!$messages.is(':hidden')) {
				$messages.hide();
				$button.html('<small>(' + ($messages.length) + ' line' + ($messages.length > 1 ? 's' : '') + 'from ' + user + ')</small>');
				$button.parent().show();
			} else {
				$button.html('<small>(Hide ' + ($messages.length) + ' line' + ($messages.length > 1 ? 's' : '') + ' from ' + user + ')</small>');
				$button.parent().removeClass('revealed');
				$messages.show();
			}
		},
		setHardcoreMode: function (mode) {
			this.battle.setHardcoreMode(mode);
			var id = '#' + this.el.id + ' ';
			this.$('.hcmode-style').remove();
			this.updateLayout(); // set animation delay
			if (mode) this.$el.prepend('<style class="hcmode-style">' + id + '.battle .turn,' + id + '.battle-history{display:none !important;}</style>');
			if (this.choice && this.choice.waiting) {
				this.updateControlsForPlayer();
			}
		},

		/*********************************************************
		 * Battle stuff
		 *********************************************************/

		updateControls: function () {
			if (this.battle.scene.customControls) return;
			var controlsShown = this.controlsShown;
			var switchViewpointButton = '<p><button class="button" name="switchViewpoint"><i class="fa fa-random"></i> Switch viewpoint</button></p>';
			this.controlsShown = false;

			if (this.battle.seeking !== null) {

				// battle is seeking
				this.$controls.html('');
				return;

			} else if (!this.battle.atQueueEnd) {

				// battle is playing or paused
				if (!this.side || this.battleEnded) {
					// spectator
					if (this.battle.paused) {
						// paused
						this.$controls.html(
							'<p><button class="button" style="min-width:4.5em;margin-right:3px" name="resume"><i class="fa fa-play"></i><br />Play</button> ' +
							'<button class="button button-first" name="instantReplay"><i class="fa fa-undo"></i><br />First turn</button><button class="button button-first" style="margin-left:1px" name="rewindTurn"><i class="fa fa-step-backward"></i><br />Prev turn</button><button class="button button-last" style="margin-right:2px" name="skipTurn"><i class="fa fa-step-forward"></i><br />Skip turn</button><button class="button button-last" name="goToEnd"><i class="fa fa-fast-forward"></i><br />Skip to end</button></p>' +
							switchViewpointButton
						);
					} else {
						// playing
						this.$controls.html(
							'<p><button class="button" style="min-width:4.5em;margin-right:3px" name="pause"><i class="fa fa-pause"></i><br />Pause</button> ' +
							'<button class="button button-first" name="instantReplay"><i class="fa fa-undo"></i><br />First turn</button><button class="button button-first" style="margin-left:1px" name="rewindTurn"><i class="fa fa-step-backward"></i><br />Prev turn</button><button class="button button-last" style="margin-right:2px" name="skipTurn"><i class="fa fa-step-forward"></i><br />Skip turn</button><button class="button button-last" name="goToEnd"><i class="fa fa-fast-forward"></i><br />Skip to end</button></p>' +
							switchViewpointButton
						);
					}
				} else {
					// is a player
					this.$controls.html('<p>' + this.getTimerHTML() + '<button class="button" name="skipTurn"><i class="fa fa-step-forward"></i><br />Skip turn</button> <button class="button" name="goToEnd"><i class="fa fa-fast-forward"></i><br />Skip to end</button></p>');
				}
				return;

			}

			if (this.battle.ended) {

				var replayDownloadButton = '<span style="float:right;"><a href="//' + Config.routes.replays + '/" class="button replayDownloadButton"><i class="fa fa-download"></i> Download replay</a><br /><br /><button class="button" name="saveReplay"><i class="fa fa-upload"></i> Upload and share replay</button></span>';

				// battle has ended
				if (this.side) {
					// was a player
					this.closeNotification('choice');
					this.$controls.html('<div class="controls"><p>' + replayDownloadButton + '<button class="button" name="instantReplay"><i class="fa fa-undo"></i><br />Instant replay</button></p><p><button class="button" name="closeAndMainMenu"><strong>Main menu</strong><br /><small>(closes this battle)</small></button> <button class="button" name="closeAndRematch"><strong>Rematch</strong><br /><small>(closes this battle)</small></button></p></div>');
				} else {
					this.$controls.html('<div class="controls"><p>' + replayDownloadButton + '<button class="button" name="instantReplay"><i class="fa fa-undo"></i><br />Instant replay</button></p>' + switchViewpointButton + '</div>');
				}

			} else if (this.side) {

				// player
				this.controlsShown = true;
				if (!controlsShown || this.choice === undefined || this.choice && this.choice.waiting) {
					// don't update controls (and, therefore, side) if `this.choice === null`: causes damage miscalculations
					this.updateControlsForPlayer();
				} else {
					this.updateTimer();
				}

			} else if (!this.battle.nearSide.name || !this.battle.farSide.name) {

				// empty battle
				this.$controls.html('<p><em>Waiting for players...</em></p>');

			} else {

				// full battle
				if (this.battle.paused) {
					// paused
					this.$controls.html(
						'<p><button class="button" style="min-width:4.5em;margin-right:3px" name="resume"><i class="fa fa-play"></i><br />Play</button> ' +
						'<button class="button button-first" name="instantReplay"><i class="fa fa-undo"></i><br />First turn</button><button class="button button-first" style="margin-left:1px" name="rewindTurn"><i class="fa fa-step-backward"></i><br />Prev turn</button><button class="button button-last disabled" style="margin-right:2px" disabled><i class="fa fa-step-forward"></i><br />Skip turn</button><button class="button button-last disabled" disabled><i class="fa fa-fast-forward"></i><br />Skip to end</button></p>' +
						switchViewpointButton + '<p><em>Waiting for players...</em></p>'
					);
				} else {
					// playing
					this.$controls.html(
						'<p><button class="button" style="min-width:4.5em;margin-right:3px" name="pause"><i class="fa fa-pause"></i><br />Pause</button> ' +
						'<button class="button button-first" name="instantReplay"><i class="fa fa-undo"></i><br />First turn</button><button class="button button-first" style="margin-left:1px" name="rewindTurn"><i class="fa fa-step-backward"></i><br />Prev turn</button><button class="button button-last disabled" style="margin-right:2px" disabled><i class="fa fa-step-forward"></i><br />Skip turn</button><button class="button button-last disabled" disabled><i class="fa fa-fast-forward"></i><br />Skip to end</button></p>' +
						switchViewpointButton + '<p><em>Waiting for players...</em></p>'
					);
				}

			}

			// This intentionally doesn't happen if the battle is still playing,
			// since those early-return.
			app.topbar.updateTabbar();
		},
		updateControlsForPlayer: function () {
			this.callbackWaiting = true;

			var act = '';
			var switchables = [];
			if (this.request) {
				// TODO: investigate when to do this
				this.updateSide();
				if (this.request.ally) {
					this.addAlly(this.request.ally);
				}

				act = this.request.requestType;
				if (this.request.side) {
					switchables = this.battle.myPokemon;
				}
				if (!this.finalDecision) this.finalDecision = !!this.request.noCancel;
			}

			if (this.choice && this.choice.waiting) {
				act = '';
			}

			var type = this.choice ? this.choice.type : '';

			// The choice object:
			// !this.choice = nothing has been chosen
			// this.choice.choices = array of choice strings
			// this.choice.switchFlags = dict of pokemon indexes that have a switch pending
			// this.choice.switchOutFlags = ???
			// this.choice.freedomDegrees = in a switch request: number of empty slots that can't be replaced
			// this.choice.type = determines what the current choice screen to be displayed is
			// this.choice.waiting = true if the choice has been sent and we're just waiting for the next turn

			switch (act) {
			case 'move':
				if (!this.choice) {
					this.choice = {
						choices: [],
						switchFlags: {},
						switchOutFlags: {}
					};
				}
				this.updateMoveControls(type);
				break;

			case 'switch':
				if (!this.choice) {
					this.choice = {
						choices: [],
						switchFlags: {},
						switchOutFlags: {},
						freedomDegrees: 0,
						canSwitch: 0
					};

					if (this.request.forceSwitch !== true) {
						var faintedLength = _.filter(this.request.forceSwitch, function (fainted) {return fainted;}).length;
						var freedomDegrees = faintedLength - _.filter(switchables.slice(this.battle.pokemonControlled), function (mon) {return !mon.fainted;}).length;
						this.choice.freedomDegrees = Math.max(freedomDegrees, 0);
						this.choice.canSwitch = faintedLength - this.choice.freedomDegrees;
					}
				}
				this.updateSwitchControls(type);
				break;

			case 'team':
				if (this.battle.mySide.pokemon && !this.battle.mySide.pokemon.length) {
					// too early, we can't determine `this.choice.count` yet
					// TODO: send teamPreviewCount in the request object
					this.controlsShown = false;
					return;
				}
				if (!this.choice) {
					this.choice = {
						choices: null,
						teamPreview: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].slice(0, switchables.length),
						done: 0,
						count: 1
					};
					if (this.battle.gameType === 'multi') {
						this.choice.count = 1;
					}
					if (this.battle.gameType === 'doubles') {
						this.choice.count = 2;
					}
					if (this.battle.gameType === 'triples' || this.battle.gameType === 'rotation') {
						this.choice.count = 3;
					}
					// Request full team order if one of our Pokémon has Illusion
					for (var i = 0; i < switchables.length && i < 6; i++) {
						if (toID(switchables[i].baseAbility) === 'illusion') {
							this.choice.count = this.battle.myPokemon.length;
						}
					}
					if (this.battle.teamPreviewCount) {
						var requestCount = parseInt(this.battle.teamPreviewCount, 10);
						if (requestCount > 0 && requestCount <= switchables.length) {
							this.choice.count = requestCount;
						}
					}
					this.choice.choices = new Array(this.choice.count);
				}
				this.updateTeamControls(type);
				break;

			default:
				this.updateWaitControls();
				break;
			}
		},
		timerInterval: 0,
		getTimerHTML: function (nextTick) {
			var time = 'Timer';
			var timerTicking = (this.battle.kickingInactive && this.request && !this.request.wait && !(this.choice && this.choice.waiting)) ? ' timerbutton-on' : '';

			if (!nextTick) {
				var self = this;
				if (this.timerInterval) {
					clearInterval(this.timerInterval);
					this.timerInterval = 0;
				}
				if (timerTicking) this.timerInterval = setInterval(function () {
					var $timerButton = self.$('.timerbutton');
					if ($timerButton.length) {
						$timerButton.replaceWith(self.getTimerHTML(true));
					} else {
						clearInterval(self.timerInterval);
						self.timerInterval = 0;
					}
				}, 1000);
			} else if (this.battle.kickingInactive > 1) {
				this.battle.kickingInactive--;
				this.battle.currTurnTimeElapsed++;
				if (this.battle.graceTimeLeft) this.battle.graceTimeLeft--;
				else if (this.battle.totalTimeLeft) this.battle.totalTimeLeft--;
			}

			if (this.battle.kickingInactive) {
				var secondsLeft = this.battle.kickingInactive;
				if (secondsLeft !== true) {
					if (secondsLeft <= 10 && timerTicking) {
						timerTicking = ' timerbutton-critical';
					}
					var minutesLeft = Math.floor(secondsLeft / 60);
					secondsLeft -= minutesLeft * 60;
					time = '' + minutesLeft + ':' + (secondsLeft < 10 ? '0' : '') + secondsLeft;

					secondsLeft = this.battle.totalTimeLeft;
					if (secondsLeft) {
						minutesLeft = Math.floor(secondsLeft / 60);
						secondsLeft -= minutesLeft * 60;
						time += ' | ' + minutesLeft + ':' + (secondsLeft < 10 ? '0' : '') + secondsLeft + ' total';
					}
				} else {
					time = '-:--';
				}
			}
			return '<button name="openTimer" class="button timerbutton' + timerTicking + '"><i class="fa fa-hourglass-start"></i> ' + time + '</button>';
		},
		uncheckMegaEvoX: function () {
			this.$('input[name=megaevox]').prop('checked', false);
		},
		uncheckMegaEvoY: function () {
			this.$('input[name=megaevoy]').prop('checked', false);
		},
		updateMaxMove: function () {
			var dynaChecked = this.$('input[name=dynamax]')[0].checked;
			if (dynaChecked) {
				this.$('.movebuttons-nomax').hide();
				this.$('.movebuttons-max').show();
			} else {
				this.$('.movebuttons-nomax').show();
				this.$('.movebuttons-max').hide();
			}
		},
		updateZMove: function () {
			var zChecked = this.$('input[name=zmove]')[0].checked;
			if (zChecked) {
				this.$('.movebuttons-noz').hide();
				this.$('.movebuttons-z').show();
			} else {
				this.$('.movebuttons-noz').show();
				this.$('.movebuttons-z').hide();
			}
		},
		updateTimer: function () {
			this.$('.timerbutton').replaceWith(this.getTimerHTML());
		},
		openTimer: function () {
			app.addPopup(TimerPopup, {room: this});
		},
		updateMoveControls: function (type) {
			var switchables = this.request && this.request.side ? this.battle.myPokemon : [];

			if (type !== 'movetarget') {
				while (
					switchables[this.choice.choices.length] &&
					(switchables[this.choice.choices.length].fainted || switchables[this.choice.choices.length].commanding) &&
					this.choice.choices.length + 1 < this.battle.nearSide.active.length
				) {
					this.choice.choices.push('pass');
				}
			}

			var moveTarget = this.choice ? this.choice.moveTarget : '';
			var pos = this.choice.choices.length;
			if (type === 'movetarget') pos--;

			var hpRatio = switchables[pos].hp / switchables[pos].maxhp;

			var curActive = this.request && this.request.active && this.request.active[pos];
			if (!curActive) return;
			var trapped = curActive.trapped;
			var canMegaEvo = curActive.canMegaEvo || switchables[pos].canMegaEvo;
			var canMegaEvoX = curActive.canMegaEvoX || switchables[pos].canMegaEvoX;
			var canMegaEvoY = curActive.canMegaEvoY || switchables[pos].canMegaEvoY;
			var canZMove = curActive.canZMove || switchables[pos].canZMove;
			var canUltraBurst = curActive.canUltraBurst || switchables[pos].canUltraBurst;
			var canDynamax = curActive.canDynamax || switchables[pos].canDynamax;
			var maxMoves = curActive.maxMoves || switchables[pos].maxMoves;
			var gigantamax = curActive.gigantamax;
			var canTerastallize = curActive.canTerastallize || switchables[pos].canTerastallize;
			if (canZMove && typeof canZMove[0] === 'string') {
				canZMove = _.map(canZMove, function (move) {
					return {move: move, target: Dex.moves.get(move).target};
				});
			}
			if (gigantamax) gigantamax = Dex.moves.get(gigantamax);

			this.finalDecisionMove = curActive.maybeDisabled || false;
			this.finalDecisionSwitch = curActive.maybeTrapped || false;
			for (var i = pos + 1; i < this.battle.nearSide.active.length; ++i) {
				var p = this.battle.nearSide.active[i];
				if (p && !p.fainted) {
					this.finalDecisionMove = this.finalDecisionSwitch = false;
					break;
				}
			}

			var requestTitle = '';
			if (type === 'move2' || type === 'movetarget') {
				requestTitle += '<button name="clearChoice">Back</button> ';
			}

			// Target selector
			if (type === 'movetarget') {
				requestTitle += 'At who? ';

				var activePos = this.battle.mySide.n > 1 ? pos + this.battle.pokemonControlled : pos;

				var targetMenus = ['', ''];
				var nearActive = this.battle.nearSide.active;
				var farActive = this.battle.farSide.active;
				var farSlot = farActive.length - 1 - activePos;

				if ((moveTarget === 'adjacentAlly' || moveTarget === 'adjacentFoe') && this.battle.gameType === 'freeforall') {
					moveTarget = 'normal';
				}

				for (var i = farActive.length - 1; i >= 0; i--) {
					var pokemon = farActive[i];
					var tooltipArgs = 'activepokemon|1|' + i;

					var disabled = false;
					if (moveTarget === 'adjacentAlly' || moveTarget === 'adjacentAllyOrSelf') {
						disabled = true;
					} else if (moveTarget === 'normal' || moveTarget === 'adjacentFoe') {
						if (Math.abs(farSlot - i) > 1) disabled = true;
					}

					if (disabled) {
						targetMenus[0] += '<button disabled></button> ';
					} else if (!pokemon || pokemon.fainted) {
						targetMenus[0] += '<button name="chooseMoveTarget" value="' + (i + 1) + '"><span class="picon" style="' + Dex.getPokemonIcon('missingno') + '"></span></button> ';
					} else {
						targetMenus[0] += '<button name="chooseMoveTarget" value="' + (i + 1) + '" class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + (this.battle.ignoreOpponent || this.battle.ignoreNicks ? pokemon.speciesForme : BattleLog.escapeHTML(pokemon.name)) + '<span class="' + pokemon.getHPColorClass() + '"><span style="width:' + (Math.round(pokemon.hp * 92 / pokemon.maxhp) || 1) + 'px"></span></span>' + (pokemon.status ? '<span class="status ' + pokemon.status + '"></span>' : '') + '</button> ';
					}
				}
				for (var i = 0; i < nearActive.length; i++) {
					var pokemon = nearActive[i];
					var tooltipArgs = 'activepokemon|0|' + i;

					var disabled = false;
					if (moveTarget === 'adjacentFoe') {
						disabled = true;
					} else if (moveTarget === 'normal' || moveTarget === 'adjacentAlly' || moveTarget === 'adjacentAllyOrSelf') {
						if (Math.abs(activePos - i) > 1) disabled = true;
					}
					if (moveTarget !== 'adjacentAllyOrSelf' && activePos == i) disabled = true;

					if (disabled) {
						targetMenus[1] += '<button disabled style="visibility:hidden"></button> ';
					} else if (!pokemon || pokemon.fainted) {
						targetMenus[1] += '<button name="chooseMoveTarget" value="' + (-(i + 1)) + '"><span class="picon" style="' + Dex.getPokemonIcon('missingno') + '"></span></button> ';
					} else {
						targetMenus[1] += '<button name="chooseMoveTarget" value="' + (-(i + 1)) + '" class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + '<span class="' + pokemon.getHPColorClass() + '"><span style="width:' + (Math.round(pokemon.hp * 92 / pokemon.maxhp) || 1) + 'px"></span></span>' + (pokemon.status ? '<span class="status ' + pokemon.status + '"></span>' : '') + '</button> ';
					}
				}

				this.$controls.html(
					'<div class="controls">' +
					'<div class="whatdo">' + requestTitle + this.getTimerHTML() + '</div>' +
					'<div class="switchmenu" style="display:block">' + targetMenus[0] + '<div style="clear:both"></div> </div>' +
					'<div class="switchmenu" style="display:block">' + targetMenus[1] + '</div>' +
					'</div>'
				);
			} else {
				// Move chooser
				var hpBar = '<small class="' + (hpRatio < 0.2 ? 'critical' : hpRatio < 0.5 ? 'weak' : 'healthy') + '">HP ' + switchables[pos].hp + '/' + switchables[pos].maxhp + '</small>';
				requestTitle += ' What will <strong>' + BattleLog.escapeHTML(switchables[pos].name) + '</strong> do? ' + hpBar;

				var hasMoves = false;
				var moveMenu = '';
				var movebuttons = '';
				var activePos = this.battle.mySide.n > 1 ? pos + this.battle.pokemonControlled : pos;
				var typeValueTracker = new ModifiableValue(this.battle, this.battle.nearSide.active[activePos], this.battle.myPokemon[pos]);
				var currentlyDynamaxed = (!canDynamax && maxMoves);
				for (var i = 0; i < curActive.moves.length; i++) {
					var moveData = curActive.moves[i];
					var move = this.battle.dex.moves.get(moveData.move);
					var name = move.name;
					var pp = moveData.pp + '/' + moveData.maxpp;
					if (!moveData.maxpp) pp = '&ndash;';
					if (move.id === 'Struggle' || move.id === 'Recharge') pp = '&ndash;';
					if (move.id === 'Recharge') move.type = '&ndash;';
					if (name.substr(0, 12) === 'Hidden Power') name = 'Hidden Power';
					var moveType = this.tooltips.getMoveType(move, typeValueTracker)[0];
					var tooltipArgs = 'move|' + moveData.move + '|' + pos;
					if (moveData.disabled) {
						movebuttons += '<button disabled class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '">';
					} else {
						movebuttons += '<button class="type-' + moveType + ' has-tooltip" name="chooseMove" value="' + (i + 1) + '" data-move="' + BattleLog.escapeHTML(moveData.move) + '" data-target="' + BattleLog.escapeHTML(moveData.target) + '" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '">';
						hasMoves = true;
					}
					movebuttons += name + '<br /><small class="type">' + (moveType ? Dex.types.get(moveType).name : "Unknown") + '</small> <small class="pp">' + pp + '</small>&nbsp;</button> ';
				}
				if (!hasMoves) {
					moveMenu += '<button class="movebutton" name="chooseMove" value="0" data-move="Struggle" data-target="randomNormal">Struggle<br /><small class="type">Normal</small> <small class="pp">&ndash;</small>&nbsp;</button> ';
				} else {
					if (canZMove || canDynamax || currentlyDynamaxed) {
						var classType = canZMove ? 'z' : 'max';
						if (currentlyDynamaxed) {
							movebuttons = '';
						} else {
							movebuttons = '<div class="movebuttons-no' + classType + '">' + movebuttons + '</div><div class="movebuttons-' + classType + '" style="display:none">';
						}
						var specialMoves = canZMove ? canZMove : maxMoves.maxMoves;
						for (var i = 0; i < curActive.moves.length; i++) {
							if (specialMoves[i]) {
								// when possible, use Z move to decide type, for cases like Z-Hidden Power
								var baseMove = this.battle.dex.moves.get(curActive.moves[i].move);
								// might not exist, such as for Z status moves - fall back on base move to determine type then
								var specialMove = gigantamax || this.battle.dex.moves.get(specialMoves[i].move);
								var moveType = this.tooltips.getMoveType(specialMove.exists && !specialMove.isMax ? specialMove : baseMove, typeValueTracker, specialMove.isMax ? gigantamax || switchables[pos].gigantamax || true : undefined)[0];
								if (specialMove.isMax && specialMove.name !== 'Max Guard' && !specialMove.id.startsWith('gmax')) {
									specialMove = this.tooltips.getMaxMoveFromType(moveType);
								}
								var tooltipArgs = classType + 'move|' + baseMove.id + '|' + pos;
								if (specialMove.id.startsWith('gmax')) tooltipArgs += '|' + specialMove.id;
								var isDisabled = specialMoves[i].disabled ? 'disabled="disabled"' : '';
								movebuttons += '<button ' + isDisabled + ' class="type-' + moveType + ' has-tooltip" name="chooseMove" value="' + (i + 1) + '" data-move="' + BattleLog.escapeHTML(specialMoves[i].move) + '" data-target="' + BattleLog.escapeHTML(specialMoves[i].target) + '" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '">';
								var pp = curActive.moves[i].pp + '/' + curActive.moves[i].maxpp;
								if (canZMove) {
									pp = '1/1';
								} else if (!curActive.moves[i].maxpp) {
									pp = '&ndash;';
								}
								movebuttons += specialMove.name + '<br /><small class="type">' + (moveType ? Dex.types.get(moveType).name : "Unknown") + '</small> <small class="pp">' + pp + '</small>&nbsp;</button> ';
							} else {
								movebuttons += '<button disabled>&nbsp;</button>';
							}
						}
						if (!currentlyDynamaxed) movebuttons += '</div>';
					}
					moveMenu += movebuttons;
				}
				if (canMegaEvo) {
					moveMenu += '<br /><label class="megaevo"><input type="checkbox" name="megaevo" />&nbsp;Mega&nbsp;Evolution</label>';
				} else if (canMegaEvoX && canMegaEvoY) {
					moveMenu += '<br /><label class="megaevo"><input type="checkbox" name="megaevox" />&nbsp;Mega&nbsp;Evolution X</label>';
					moveMenu += '<label class="megaevo"><input type="checkbox" name="megaevoy" />&nbsp;Mega&nbsp;Evolution Y</label>';
				} else if (canMegaEvoX) {
					moveMenu += '<br /><label class="megaevo"><input type="checkbox" name="megaevox" />&nbsp;Mega&nbsp;Evolution X</label>';
				} else if (canMegaEvoY) {
					moveMenu += '<br /><label class="megaevo"><input type="checkbox" name="megaevoy" />&nbsp;Mega&nbsp;Evolution Y</label>';
				} else if (canZMove) {
					moveMenu += '<br /><label class="megaevo"><input type="checkbox" name="zmove" />&nbsp;Z-Power</label>';
				} else if (canUltraBurst) {
					moveMenu += '<br /><label class="megaevo"><input type="checkbox" name="ultraburst" />&nbsp;Ultra Burst</label>';
				} else if (canDynamax) {
					moveMenu += '<br /><label class="megaevo"><input type="checkbox" name="dynamax" />&nbsp;Dynamax</label>';
				} else if (canTerastallize) {
					moveMenu += '<br /><label class="megaevo"><input type="checkbox" name="terastallize" />&nbsp;Terastallize<br />' + Dex.getTypeIcon(canTerastallize) + '</label>';
				}
				if (this.finalDecisionMove) {
					moveMenu += '<em style="display:block;clear:both">You <strong>might</strong> have some moves disabled, so you won\'t be able to cancel an attack!</em><br/>';
				}
				moveMenu += '<div style="clear:left"></div>';

				var moveControls = (
					'<div class="movecontrols">' +
					'<div class="moveselect"><button name="selectMove">Attack</button></div>' +
					'<div class="movemenu">' + moveMenu + '</div>' +
					'</div>'
				);

				var shiftControls = '';
				if (this.battle.gameType === 'triples' && pos !== 1) {
					shiftControls = (
						'<div class="shiftcontrols">' +
						'<div class="shiftselect"><button name="chooseShift">Shift</button></div>' +
						'<div class="switchmenu"><button name="chooseShift">Shift to Center</button><div style="clear:left"></div></div>' +
						'</div>'
					);
				}

				var switchMenu = '';
				if (trapped) {
					switchMenu += '<em>You are trapped and cannot switch!</em><br />';
					switchMenu += this.displayParty(switchables, trapped);
				} else {
					switchMenu += this.displayParty(switchables, trapped);
					if (this.finalDecisionSwitch && this.battle.gen > 2) {
						switchMenu += '<em style="display:block;clear:both">You <strong>might</strong> be trapped, so you won\'t be able to cancel a switch!</em><br/>';
					}
				}
				var switchControls = (
					'<div class="switchcontrols">' +
					'<div class="switchselect"><button name="selectSwitch">Switch</button></div>' +
					'<div class="switchmenu">' + switchMenu + '</div>' +
					'</div>'
				);
				this.$controls.html(
					'<div class="controls">' +
					'<div class="whatdo">' + requestTitle + this.getTimerHTML() + '</div>' +
					moveControls + shiftControls + switchControls +
					'</div>'
				);
			}
		},
		displayParty: function (switchables, trapped) {
			var party = '';
			for (var i = 0; i < switchables.length; i++) {
				var pokemon = switchables[i];
				pokemon.name = pokemon.ident.substr(4);
				var tooltipArgs = 'switchpokemon|' + i;
				if (pokemon.fainted || i < this.battle.pokemonControlled || this.choice.switchFlags[i] || trapped) {
					party += '<button class="disabled has-tooltip" name="chooseDisabled" value="' + BattleLog.escapeHTML(pokemon.name) + (pokemon.fainted ? ',fainted' : trapped ? ',trapped' : i < this.battle.nearSide.active.length ? ',active' : '') + '" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + (pokemon.hp ? '<span class="' + pokemon.getHPColorClass() + '"><span style="width:' + (Math.round(pokemon.hp * 92 / pokemon.maxhp) || 1) + 'px"></span></span>' + (pokemon.status ? '<span class="status ' + pokemon.status + '"></span>' : '') : '') + '</button> ';
				} else {
					party += '<button name="chooseSwitch" value="' + i + '" class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + '<span class="' + pokemon.getHPColorClass() + '"><span style="width:' + (Math.round(pokemon.hp * 92 / pokemon.maxhp) || 1) + 'px"></span></span>' + (pokemon.status ? '<span class="status ' + pokemon.status + '"></span>' : '') + '</button> ';
				}
			}
			if (this.battle.mySide.ally) party += this.displayAllyParty();
			return party;
		},
		displayAllyParty: function () {
			var party = '';
			if (!this.battle.myAllyPokemon) return '';
			var allyParty = this.battle.myAllyPokemon;
			for (var i = 0; i < allyParty.length; i++) {
				var pokemon = allyParty[i];
				pokemon.name = pokemon.ident.substr(4);
				var tooltipArgs = 'allypokemon|' + i;
				party += '<button class="disabled has-tooltip" name="chooseDisabled" value="' + BattleLog.escapeHTML(pokemon.name) + ',notMine' + '" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + (pokemon.hp ? '<span class="' + pokemon.getHPColorClass() + '"><span style="width:' + (Math.round(pokemon.hp * 92 / pokemon.maxhp) || 1) + 'px"></span></span>' + (pokemon.status ? '<span class="status ' + pokemon.status + '"></span>' : '') : '') + '</button> ';
			}
			return party;
		},
		updateSwitchControls: function (type) {
			var pos = this.choice.choices.length;

			// Needed so it client does not freak out when only 1 mon left wants to switch out
			var atLeast1Reviving = false;
			for (var i = 0; i < this.battle.pokemonControlled; i++) {
				var pokemon = this.battle.myPokemon[i];
				if (pokemon.reviving) {
					atLeast1Reviving = true;
					break;
				}
			}

			if (type !== 'switchposition' && this.request.forceSwitch !== true && (!this.choice.freedomDegrees || atLeast1Reviving)) {
				while (!this.request.forceSwitch[pos] && pos < 6) {
					pos = this.choice.choices.push('pass');
				}
			}

			var switchables = this.request && this.request.side ? this.battle.myPokemon : [];
			var nearActive = this.battle.nearSide.active;
			var isReviving = !!switchables[pos].reviving;

			var requestTitle = '';
			if (type === 'switch2' || type === 'switchposition') {
				requestTitle += '<button name="clearChoice">Back</button> ';
			}

			// Place selector
			if (type === 'switchposition') {
				// TODO? hpbar
				requestTitle += "Which Pokémon will it switch in for?";
				var controls = '<div class="switchmenu" style="display:block">';
				for (var i = 0; i < this.battle.pokemonControlled; i++) {
					var pokemon = this.battle.myPokemon[i];
					var tooltipArgs = 'switchpokemon|' + i;
					if (pokemon && !pokemon.fainted || this.choice.switchOutFlags[i]) {
						controls += '<button disabled class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + (!pokemon.fainted ? '<span class="' + pokemon.getHPColorClass() + '"><span style="width:' + (Math.round(pokemon.hp * 92 / pokemon.maxhp) || 1) + 'px"></span></span>' + (pokemon.status ? '<span class="status ' + pokemon.status + '"></span>' : '') : '') + '</button> ';
					} else if (!pokemon) {
						controls += '<button disabled></button> ';
					} else {
						controls += '<button name="chooseSwitchTarget" value="' + i + '" class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + '<span class="' + pokemon.getHPColorClass() + '"><span style="width:' + (Math.round(pokemon.hp * 92 / pokemon.maxhp) || 1) + 'px"></span></span>' + (pokemon.status ? '<span class="status ' + pokemon.status + '"></span>' : '') + '</button> ';
					}
				}
				controls += '</div>';
				this.$controls.html(
					'<div class="controls">' +
					'<div class="whatdo">' + requestTitle + this.getTimerHTML() + '</div>' +
					controls +
					'</div>'
				);
			} else {
				if (isReviving) {
					requestTitle += "Choose a fainted Pokémon to revive!";
				} else if (this.choice.freedomDegrees >= 1) {
					requestTitle += "Choose a Pokémon to send to battle!";
				} else {
					requestTitle += "Switch <strong>" + BattleLog.escapeHTML(switchables[pos].name) + "</strong> to:";
				}

				var switchMenu = '';
				for (var i = 0; i < switchables.length; i++) {
					var pokemon = switchables[i];
					var tooltipArgs = 'switchpokemon|' + i;
					if (isReviving) {
						if (!pokemon.fainted || this.choice.switchFlags[i]) {
							switchMenu += '<button class="disabled has-tooltip" name="chooseDisabled" value="' + BattleLog.escapeHTML(pokemon.name) + (pokemon.reviving ? ',active' : !pokemon.fainted ? ',notfainted' : '') + '" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '">';
						} else {
							switchMenu += '<button name="chooseSwitch" value="' + i + '" class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '">';
						}
					} else {
						if (pokemon.fainted || i < this.battle.pokemonControlled || this.choice.switchFlags[i]) {
							switchMenu += '<button class="disabled has-tooltip" name="chooseDisabled" value="' + BattleLog.escapeHTML(pokemon.name) + (pokemon.fainted ? ',fainted' : i < this.battle.pokemonControlled ? ',active' : '') + '" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '">';
						} else {
							switchMenu += '<button name="chooseSwitch" value="' + i + '" class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '">';
						}
					}
					switchMenu += '<span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + (!pokemon.fainted ? '<span class="' + pokemon.getHPColorClass() + '"><span style="width:' + (Math.round(pokemon.hp * 92 / pokemon.maxhp) || 1) + 'px"></span></span>' + (pokemon.status ? '<span class="status ' + pokemon.status + '"></span>' : '') : '') + '</button> ';
				}

				var controls = (
					'<div class="switchcontrols">' +
					'<div class="switchselect"><button name="selectSwitch">' + (isReviving ? 'Revive' : 'Switch') + '</button></div>' +
					'<div class="switchmenu">' + switchMenu + '</div>' +
					'</div>'
				);
				this.$controls.html(
					'<div class="controls">' +
					'<div class="whatdo">' + requestTitle + this.getTimerHTML() + '</div>' +
					controls +
					'</div>'
				);
				this.selectSwitch();
			}
		},
		updateTeamControls: function (type) {
			var switchables = this.request && this.request.side ? this.battle.myPokemon : [];
			var maxIndex = Math.min(switchables.length, 24);

			var requestTitle = "";
			if (this.choice.done) {
				requestTitle = '<button name="clearChoice">Back</button> ' + "What about the rest of your team?";
			} else {
				requestTitle = "How will you start the battle?";
			}

			var switchMenu = '';
			for (var i = 0; i < maxIndex; i++) {
				var oIndex = this.choice.teamPreview[i] - 1;
				var pokemon = switchables[oIndex];
				var tooltipArgs = 'switchpokemon|' + oIndex;
				if (i < this.choice.done) {
					switchMenu += '<button disabled class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + '</button> ';
				} else {
					switchMenu += '<button name="chooseTeamPreview" value="' + i + '" class="has-tooltip" data-tooltip="' + BattleLog.escapeHTML(tooltipArgs) + '"><span class="picon" style="' + Dex.getPokemonIcon(pokemon) + '"></span>' + BattleLog.escapeHTML(pokemon.name) + '</button> ';
				}
			}

			var controls = (
				'<div class="switchcontrols">' +
				'<div class="switchselect"><button name="selectSwitch">' + (this.choice.done ? '' + "Choose a Pokémon for slot " + (this.choice.done + 1) : "Choose Lead") + '</button></div>' +
				'<div class="switchmenu">' + switchMenu + '</div>' +
				'</div>'
			);
			this.$controls.html(
				'<div class="controls">' +
				'<div class="whatdo">' + requestTitle + this.getTimerHTML() + '</div>' +
				controls +
				'</div>'
			);
			this.selectSwitch();
		},
		updateWaitControls: function () {
			var buf = '<div class="controls">';
			buf += this.getPlayerChoicesHTML();
			if (!this.battle.nearSide.name || !this.battle.farSide.name || !this.request) {
				if (this.battle.kickingInactive) {
					buf += '<p><button class="button" name="setTimer" value="off">Stop timer</button> <small>&larr; Your opponent has disconnected. This will give them more time to reconnect.</small></p>';
				} else {
					buf += '<p><button class="button" name="setTimer" value="on">Claim victory</button> <small>&larr; Your opponent has disconnected. Click this if they don\'t reconnect.</small></p>';
				}
			}
			this.$controls.html(buf + '</div>');
		},

		getPlayerChoicesHTML: function () {
			var buf = '<p>' + this.getTimerHTML();
			if (!this.choice || !this.choice.waiting) {
				return buf + '<em>Waiting for opponent...</em></p>';
			}
			buf += '<small>';

			if (this.choice.teamPreview) {
				var myPokemon = this.battle.mySide.pokemon;
				var leads = [];
				var back = [];
				var leadCount = this.battle.gameType === 'doubles' ? 2 : (this.battle.gameType === 'triples' ? 3 : 1);
				for (var i = 0; i < leadCount; i++) {
					leads.push(myPokemon[this.choice.teamPreview[i] - 1].speciesForme);
				}
				buf += leads.join(', ') + ' will be sent out first.<br />';
				for (var i = leadCount; i < this.choice.count; i++) {
					back.push(myPokemon[this.choice.teamPreview[i] - 1].speciesForme);
				}
				if (back.length) buf += back.join(', ') + ' are in the back.<br />';
			} else if (this.choice.choices && this.request && this.battle.myPokemon) {
				var myPokemon = this.battle.myPokemon;
				for (var i = 0; i < this.choice.choices.length; i++) {
					var parts = this.choice.choices[i].split(' ');
					switch (parts[0]) {
					case 'move':
						var move;
						if (this.request.active[i].maxMoves && !this.request.active[i].canDynamax) { // it's a max move
							move = this.request.active[i].maxMoves.maxMoves[parseInt(parts[1], 10) - 1].move;
						} else { // it's a normal move
							move = this.request.active[i].moves[parseInt(parts[1], 10) - 1].move;
						}
						var target = '';
						buf += myPokemon[i].speciesForme + ' will ';
						if (parts.length > 2) {
							var targetPos = parts[2];
							if (targetPos === 'mega') {
								buf += 'Mega Evolve, then ';
								targetPos = parts[3];
							}
							if (targetPos === 'megax') {
								buf += 'Mega Evolve X, then ';
								targetPos = parts[3];
							}
							if (targetPos === 'megay') {
								buf += 'Mega Evolve Y, then ';
								targetPos = parts[3];
							}
							if (targetPos === 'zmove') {
								move = this.request.active[i].canZMove[parseInt(parts[1], 10) - 1].move;
								targetPos = parts[3];
							}
							if (targetPos === 'ultra') {
								buf += 'Ultra Burst, then ';
								targetPos = parts[3];
							}
							if (targetPos === 'dynamax') {
								move = this.request.active[i].maxMoves.maxMoves[parseInt(parts[1], 10) - 1].move;
								buf += 'Dynamax, then ';
								targetPos = parts[3];
							}
							if (targetPos === 'terastallize') {
								buf += 'Terastallize, then ';
								targetPos = parts[3];
							}
							if (targetPos) {
								var targetActive = this.battle.farSide.active;
								if (targetPos < 0) {
									// Targeting your own side in doubles / triples
									targetActive = this.battle.nearSide.active;
									targetPos = -targetPos;
									if (this.battle.gameType !== 'freeforall') {
										target += 'your ';
									}
								}
								if (targetActive[targetPos - 1]) {
									target += targetActive[targetPos - 1].speciesForme;
								} else {
									target += 'slot ' + targetPos; // targeting an empty slot
								}
							}
						}
						buf += 'use ' + Dex.moves.get(move).name + (target ? ' at ' + target : '') + '.<br />';
						break;
					case 'switch':
						buf += '' + myPokemon[parts[1] - 1].speciesForme + ' will switch in';
						if (myPokemon[i]) {
							buf += ', replacing ' + myPokemon[i].speciesForme;
						}
						buf += '.<br />';
						break;
					case 'shift':
						buf += myPokemon[i].speciesForme + ' will shift position.<br />';
						break;
					}
				}
			}
			buf += '</small></p>';
			if (!this.finalDecision && !this.battle.hardcoreMode) {
				buf += '<p><small><em>Waiting for opponent...</em></small> <button class="button" name="undoChoice">Cancel</button></p>';
			}
			return buf;
		},

		/**
		 * Sends a decision; pass it an array of choices like ['move 1', 'switch 2']
		 * and it'll send `/choose move 1,switch 2|3`
		 * (where 3 is the rqid).
		 *
		 * (The rqid helps verify that the decision is sent in response to the
		 * correct request.)
		 */
		sendDecision: function (message) {
			if (!$.isArray(message)) return this.send('/' + message + '|' + this.request.rqid);
			var buf = '/choose ';
			for (var i = 0; i < message.length; i++) {
				if (message[i]) buf += message[i] + ',';
			}
			this.send(buf.substr(0, buf.length - 1) + '|' + this.request.rqid);
		},
		request: null,
		receiveRequest: function (request, choiceText) {
			if (!request) {
				this.side = '';
				return;
			}

			if (!this.autoTimerActivated && Storage.prefs('autotimer') && !this.battle.ended) {
				this.setTimer('on');
				this.autoTimerActivated = true;
			}

			request.requestType = 'move';
			if (request.forceSwitch) {
				request.requestType = 'switch';
			} else if (request.teamPreview) {
				request.requestType = 'team';
			} else if (request.wait) {
				request.requestType = 'wait';
			}

			this.choice = choiceText ? {waiting: true} : null;
			this.finalDecision = this.finalDecisionMove = this.finalDecisionSwitch = false;
			this.request = request;
			if (request.side) {
				this.updateSideLocation(request.side);
			}
			this.notifyRequest();
			this.controlsShown = false;
			this.updateControls();
		},
		notifyRequest: function () {
			var oName = this.battle.farSide.name;
			if (oName) oName = " against " + oName;
			switch (this.request.requestType) {
			case 'move':
				this.notify("Your move!", "Move in your battle" + oName, 'choice');
				break;
			case 'switch':
				this.notify("Your switch!", "Switch in your battle" + oName, 'choice');
				break;
			case 'team':
				this.notify("Team preview!", "Choose your team order in your battle" + oName, 'choice');
				break;
			}
		},
		updateSideLocation: function (sideData) {
			if (!sideData.id) return;
			this.side = sideData.id;
			if (this.battle.mySide.sideid !== this.side) {
				this.battle.setViewpoint(this.side);
				this.$chat = this.$chatFrame.find('.inner');
			}
		},
		updateSide: function () {
			var sideData = this.request.side;
			this.battle.myPokemon = sideData.pokemon;
			this.battle.setViewpoint(sideData.id);
			for (var i = 0; i < sideData.pokemon.length; i++) {
				var pokemonData = sideData.pokemon[i];
				if (this.request.active && this.request.active[i]) pokemonData.canGmax = this.request.active[i].gigantamax || false;
				this.battle.parseDetails(pokemonData.ident.substr(4), pokemonData.ident, pokemonData.details, pokemonData);
				this.battle.parseHealth(pokemonData.condition, pokemonData);
				pokemonData.hpDisplay = Pokemon.prototype.hpDisplay;
				pokemonData.getPixelRange = Pokemon.prototype.getPixelRange;
				pokemonData.getFormattedRange = Pokemon.prototype.getFormattedRange;
				pokemonData.getHPColorClass = Pokemon.prototype.getHPColorClass;
				pokemonData.getHPColor = Pokemon.prototype.getHPColor;
			}
		},
		addAlly: function (allyData) {
			this.battle.myAllyPokemon = allyData.pokemon;
			for (var i = 0; i < allyData.pokemon.length; i++) {
				var pokemonData = allyData.pokemon[i];
				this.battle.parseDetails(pokemonData.ident.substr(4), pokemonData.ident, pokemonData.details, pokemonData);
				this.battle.parseHealth(pokemonData.condition, pokemonData);
				pokemonData.hpDisplay = Pokemon.prototype.hpDisplay;
				pokemonData.getPixelRange = Pokemon.prototype.getPixelRange;
				pokemonData.getFormattedRange = Pokemon.prototype.getFormattedRange;
				pokemonData.getHPColorClass = Pokemon.prototype.getHPColorClass;
				pokemonData.getHPColor = Pokemon.prototype.getHPColor;
				pokemonData.side = this.battle.mySide.ally;
			}
		},

		// buttons
		joinBattle: function () {
			this.send('/joinbattle');
		},
		setTimer: function (setting) {
			this.send('/timer ' + setting);
		},
		forfeit: function () {
			this.send('/forfeit');
		},
		saveReplay: function () {
			this.send('/savereplay');
		},
		openBattleOptions: function () {
			app.addPopup(BattleOptionsPopup, {battle: this.battle, room: this});
		},
		clickReplayDownloadButton: function (e) {
			var filename = (this.battle.tier || 'Battle').replace(/[^A-Za-z0-9]/g, '');

			// ladies and gentlemen, JavaScript dates
			var date = new Date();
			filename += '-' + date.getFullYear();
			filename += (date.getMonth() >= 9 ? '-' : '-0') + (date.getMonth() + 1);
			filename += (date.getDate() >= 10 ? '-' : '-0') + date.getDate();

			filename += '-' + toID(this.battle.p1.name);
			filename += '-' + toID(this.battle.p2.name);

			e.currentTarget.href = BattleLog.createReplayFileHref(this);
			e.currentTarget.download = filename + '.html';

			e.stopPropagation();
		},
		switchViewpoint: function () {
			this.battle.switchViewpoint();
		},
		pause: function () {
			this.tooltips.hideTooltip();
			this.battlePaused = true;
			this.battle.pause();
			this.updateControls();
		},
		resume: function () {
			this.tooltips.hideTooltip();
			this.battlePaused = false;
			this.battle.play();
			this.updateControls();
		},
		instantReplay: function () {
			this.tooltips.hideTooltip();
			this.request = null;
			this.battlePaused = false;
			this.battle.reset();
			this.battle.play();
		},
		skipTurn: function () {
			this.battle.skipTurn();
		},
		rewindTurn: function () {
			if (this.battle.turn) {
				this.battle.seekTurn(this.battle.turn - 1);
			}
		},
		goToEnd: function () {
			this.battle.seekTurn(Infinity);
		},
		register: function (userid) {
			var registered = app.user.get('registered');
			if (registered && registered.userid !== userid) registered = false;
			if (!registered && userid === app.user.get('userid')) {
				app.addPopup(RegisterPopup);
			}
		},
		closeAndMainMenu: function () {
			this.close();
			app.focusRoom('');
		},
		closeAndRematch: function () {
			app.once('response:fullformat', function (data) {
				app.rooms[''].requestNotifications();
				if (data) {
					app.rooms[''].challenge(this.battle.farSide.name, data);
				} else {
					app.rooms[''].challenge(this.battle.farSide.name, this.battle.tier);
				}
				this.close();
				app.focusRoom('');
			}, this);
			app.send('/cmd fullformat ' + this.id);
		},

		// choice buttons
		chooseMove: function (pos, e) {
			if (!this.choice) return;
			this.tooltips.hideTooltip();

			if (pos !== undefined) { // pos === undefined if called by chooseMoveTarget()
				var nearActive = this.battle.nearSide.active;
				var isMega = !!(this.$('input[name=megaevo]')[0] || '').checked;
				var isMegaX = !!(this.$('input[name=megaevox]')[0] || '').checked;
				var isMegaY = !!(this.$('input[name=megaevoy]')[0] || '').checked;
				var isZMove = !!(this.$('input[name=zmove]')[0] || '').checked;
				var isUltraBurst = !!(this.$('input[name=ultraburst]')[0] || '').checked;
				var isDynamax = !!(this.$('input[name=dynamax]')[0] || '').checked;
				var isTerastal = !!(this.$('input[name=terastallize]')[0] || '').checked;

				var target = e.getAttribute('data-target');
				var choosableTargets = {normal: 1, any: 1, adjacentAlly: 1, adjacentAllyOrSelf: 1, adjacentFoe: 1};
				if (this.battle.gameType === 'freeforall') delete choosableTargets['adjacentAllyOrSelf'];

				this.choice.choices.push('move ' + pos + (isMega ? ' mega' : '') + (isMegaX ? ' megax' : isMegaY ? ' megay' : '') + (isZMove ? ' zmove' : '') + (isUltraBurst ? ' ultra' : '') + (isDynamax ? ' dynamax' : '') + (isTerastal ? ' terastallize' : ''));
				if (nearActive.length > 1 && target in choosableTargets) {
					this.choice.type = 'movetarget';
					this.choice.moveTarget = target;
					this.updateControlsForPlayer();
					return false;
				}
			}

			this.endChoice();
		},
		chooseMoveTarget: function (posString) {
			this.choice.choices[this.choice.choices.length - 1] += ' ' + posString;
			this.chooseMove();
		},
		chooseShift: function () {
			if (!this.choice) return;
			this.tooltips.hideTooltip();

			this.choice.choices.push('shift');
			this.endChoice();
		},
		chooseSwitch: function (pos) {
			if (!this.choice) return;
			this.tooltips.hideTooltip();

			if (this.battle.myPokemon[this.choice.choices.length].reviving) {
				this.choice.choices.push('switch ' + (parseInt(pos, 10) + 1));
				this.endChoice();
				return;
			}

			if (pos !== undefined) { // pos === undefined if called by chooseSwitchTarget()
				this.choice.switchFlags[pos] = true;
				if (this.choice.freedomDegrees >= 1) {
					// Request selection of a Pokémon that will be switched out.
					this.choice.type = 'switchposition';
					this.updateControlsForPlayer();
					return false;
				}
				// Default: left to right.
				this.choice.switchOutFlags[this.choice.choices.length] = true;
				this.choice.choices.push('switch ' + (parseInt(pos, 10) + 1));
				this.endChoice();
				return;
			}

			// After choosing the position to which a pokemon will switch in (Doubles/Triples end-game).
			if (!this.request || this.request.requestType !== 'switch') return false; //??
			if (this.choice.canSwitch > _.filter(this.choice.choices, function (choice) {return choice;}).length) {
				// More switches are pending.
				this.choice.type = 'switch2';
				this.updateControlsForPlayer();
				return false;
			}

			this.endTurn();
		},
		chooseSwitchTarget: function (posString) {
			var slotSwitchIn = 0; // one-based
			for (var i in this.choice.switchFlags) {
				if (this.choice.choices.indexOf('switch ' + (+i + 1)) === -1) {
					slotSwitchIn = +i + 1;
					break;
				}
			}
			this.choice.choices[posString] = 'switch ' + slotSwitchIn;
			this.choice.switchOutFlags[posString] = true;
			this.chooseSwitch();
		},
		chooseTeamPreview: function (pos) {
			if (!this.choice) return;
			pos = parseInt(pos, 10);
			this.tooltips.hideTooltip();
			if (this.choice.count) {
				var temp = this.choice.teamPreview[pos];
				this.choice.teamPreview[pos] = this.choice.teamPreview[this.choice.done];
				this.choice.teamPreview[this.choice.done] = temp;

				this.choice.done++;

				if (this.choice.done < Math.min(this.choice.teamPreview.length, this.choice.count)) {
					this.choice.type = 'team2';
					this.updateControlsForPlayer();
					return false;
				}
			} else {
				this.choice.teamPreview = [pos + 1];
			}

			this.endTurn();
		},
		chooseDisabled: function (data) {
			this.tooltips.hideTooltip();
			data = data.split(',');
			if (data[1] === 'fainted') {
				app.addPopupMessage("" + data[0] + " has no energy left to battle!");
			} else if (data[1] === 'notMine') {
				app.addPopupMessage("You cannot decide for your partner!");
			} else if (data[1] === 'trapped') {
				app.addPopupMessage("You are trapped and cannot select " + data[0] + "!");
			} else if (data[1] === 'active') {
				app.addPopupMessage("" + data[0] + " is already in battle!");
			} else if (data[1] === 'notfainted') {
				app.addPopupMessage("" + data[0] + " still has energy to battle!");
			} else {
				app.addPopupMessage("" + data[0] + " is already selected!");
			}
		},
		endChoice: function () {
			var choiceIndex = this.choice.choices.length - 1;
			if (!this.nextChoice()) {
				this.endTurn();
			} else if (this.request.partial) {
				for (var i = choiceIndex; i < this.choice.choices.length; i++) {
					this.sendDecision(this.choice.choices[i]);
				}
			}
		},
		nextChoice: function () {
			var choices = this.choice.choices;
			var nearActive = this.battle.nearSide.active;

			if (this.request.requestType === 'switch' && this.request.forceSwitch !== true) {
				while (choices.length < this.battle.pokemonControlled && !this.request.forceSwitch[choices.length]) {
					choices.push('pass');
				}
				if (choices.length < this.battle.pokemonControlled) {
					this.choice.type = 'switch2';
					this.updateControlsForPlayer();
					return true;
				}
			} else if (this.request.requestType === 'move') {
				var requestDetails = this.request && this.request.side ? this.battle.myPokemon : [];
				while (choices.length < this.battle.pokemonControlled &&
						(!nearActive[choices.length] || requestDetails[choices.length].commanding)) {
					choices.push('pass');
				}

				if (choices.length < this.battle.pokemonControlled) {
					this.choice.type = 'move2';
					this.updateControlsForPlayer();
					return true;
				}
			}

			return false;
		},
		endTurn: function () {
			var act = this.request && this.request.requestType;
			if (act === 'team') {
				if (this.choice.teamPreview.length >= 10) {
					this.sendDecision('team ' + this.choice.teamPreview.join(','));
				} else {
					this.sendDecision('team ' + this.choice.teamPreview.join(''));
				}
			} else {
				if (act === 'switch') {
					// Assert that the remaining Pokémon won't switch, even though
					// the player could have decided otherwise.
					for (var i = 0; i < this.battle.pokemonControlled; i++) {
						if (!this.choice.choices[i]) this.choice.choices[i] = 'pass';
					}
				}

				if (this.choice.choices.length >= (this.choice.count || this.battle.pokemonControlled || this.request.active.length)) {
					this.sendDecision(this.choice.choices);
				}

				if (!this.finalDecision) {
					var lastChoice = this.choice.choices[this.choice.choices.length - 1];
					if (lastChoice.substr(0, 5) === 'move ' && this.finalDecisionMove) {
						this.finalDecisionMove = true;
					} else if (lastChoice.substr(0, 7) === 'switch' && this.finalDecisionSwitch) {
						this.finalDecisionSwitch = true;
					}
				}
			}
			this.closeNotification('choice');

			this.choice.waiting = true;
			this.updateControlsForPlayer();
		},
		undoChoice: function (pos) {
			this.send('/undo');
			this.notifyRequest();

			this.clearChoice();
		},
		clearChoice: function () {
			this.choice = null;
			this.updateControlsForPlayer();
		},
		leaveBattle: function () {
			this.tooltips.hideTooltip();
			this.send('/leavebattle');
			this.side = '';
			this.closeNotification('choice');
		},
		selectSwitch: function () {
			this.tooltips.hideTooltip();
			this.$controls.find('.controls').attr('class', 'controls switch-controls');
		},
		selectMove: function () {
			this.tooltips.hideTooltip();
			this.$controls.find('.controls').attr('class', 'controls move-controls');
		}
	}, {
		readReplayFile: function (file) {
			var reader = new FileReader();
			reader.onload = function (e) {
				app.removeRoom('battle-uploadedreplay');
				var html = e.target.result;
				var titleStart = html.indexOf('<title>');
				var titleEnd = html.indexOf('</title>');
				var title = 'Uploaded Replay';
				if (titleStart >= 0 && titleEnd > titleStart) {
					title = html.slice(titleStart + 7, titleEnd - 1);
					var colonIndex = title.indexOf(':');
					var hyphenIndex = title.lastIndexOf('-');
					if (hyphenIndex > colonIndex + 2) {
						title = title.substring(colonIndex + 2, hyphenIndex - 1);
					} else {
						title = title.substring(colonIndex + 2);
					}
				}
				var index1 = html.indexOf('<script type="text/plain" class="battle-log-data">');
				var index2 = html.indexOf('<script type="text/plain" class="log">');
				if (index1 < 0 && index2 < 0) return alert("Unrecognized HTML file: Only replay files are supported.");
				if (index1 >= 0) {
					html = html.slice(index1 + 50);
				} else if (index2 >= 0) {
					html = html.slice(index2 + 38);
				}
				var index3 = html.indexOf('</script>');
				html = html.slice(0, index3);
				html = html.replace(/\\\//g, '/');
				app.receive('>battle-uploadedreplay\n|init|battle\n|title|' + title + '\n' + html);
				app.receive('>battle-uploadedreplay\n|expire|Uploaded replay');
			};
			reader.readAsText(file);
		}
	});

	var ForfeitPopup = this.ForfeitPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.room = data.room;
			this.gameType = data.gameType;
			var buf = '<form><p>';
			if (this.gameType === 'battle') {
				buf += 'Forfeiting makes you lose the battle.';
			} else if (this.gameType === 'help') {
				buf += 'Leaving the room will close the ticket.';
			} else if (this.gameType === 'room') {
				buf += 'Are you sure you want to exit this room?';
			} else {
				// game
				buf += 'Forfeiting makes you lose the game.';
			}
			if (this.gameType === 'help') {
				buf += ' Are you sure?</p><p><label><input type="checkbox" name="closeroom" checked /> Close room</label></p>';
				buf += '<p><button type="submit" class="button"><strong>Close ticket</strong></button> ';
			} else if (this.gameType === 'room') {
				buf += ' </p><p><button type="submit" name="leaveRoom" class="button"><strong>Close room</strong></button>';
			} else {
				buf += ' Are you sure?</p><p><label class="checkbox"><input type="checkbox" name="closeroom" checked /> Close after forfeiting</label></p>';
				buf += '<p><button type="submit" class="button"><strong>Forfeit</strong></button> ';
			}
			if (this.gameType === 'battle' && this.room.battle && !this.room.battle.rated) {
				buf += '<button type="button" name="replacePlayer" class="button">Replace player</button> ';
			}
			buf += '<button type="button" name="close" class="button autofocus">Cancel</button></p></form>';
			this.$el.html(buf);
		},
		replacePlayer: function (data) {
			var room = this.room;
			var self = this;
			app.addPopupPrompt("Replacement player's username", "Replace player", function (target) {
				if (!target) return;
				var side = (room.battle.mySide.id === room.battle.p1.id ? 'p1' : 'p2');
				room.leaveBattle();
				room.send('/addplayer ' + target + ', ' + side);
				self.close();
			});
		},
		submit: function (data) {
			this.room.send('/forfeit');
			if (this.gameType === 'battle') this.room.battle.forfeitPending = true;
			if (this.$('input[name=closeroom]')[0].checked) {
				app.removeRoom(this.room.id);
			}
			this.close();
		},
		leaveRoom: function (data) {
			this.close();
			return app.removeRoom(this.room.id);
		}
	});

	var BattleOptionsPopup = this.BattleOptionsPopup = Popup.extend({
		initialize: function (data) {
			this.battle = data.battle;
			this.room = data.room;
			var rightPanelBattlesPossible = (MainMenuRoom.prototype.bestWidth + BattleRoom.prototype.minWidth < $(window).width());
			var buf = '<p><strong>In this battle</strong></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="hardcoremode"' + (this.battle.hardcoreMode ? ' checked' : '') + '/> Hardcore mode (hide info not shown in-game)</label></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="ignorespects"' + (this.battle.ignoreSpects ? ' checked' : '') + '/> Ignore spectators</label></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="ignoreopp"' + (this.battle.ignoreOpponent ? ' checked' : '') + '/> Ignore opponent</label></p>';
			buf += '<p><strong>All battles</strong></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="ignorenicks"' + (Dex.prefs('ignorenicks') ? ' checked' : '') + ' /> Ignore nicknames</label></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="allignorespects"' + (Dex.prefs('ignorespects') ? ' checked' : '') + '/> Ignore spectators</label></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="allignoreopp"' + (Dex.prefs('ignoreopp') ? ' checked' : '') + '/> Ignore opponent</label></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="autotimer"' + (Dex.prefs('autotimer') ? ' checked' : '') + '/> Automatically start timer</label></p>';
			if (rightPanelBattlesPossible) buf += '<p><label class="checkbox"><input type="checkbox" name="rightpanelbattles"' + (Dex.prefs('rightpanelbattles') ? ' checked' : '') + ' /> Open new battles on the right side</label></p>';
			buf += '<p><button name="close" class="button">Done</button></p>';
			this.$el.html(buf);
		},
		events: {
			'change input[name=ignorespects]': 'toggleIgnoreSpects',
			'change input[name=ignorenicks]': 'toggleIgnoreNicks',
			'change input[name=ignoreopp]': 'toggleIgnoreOpponent',
			'change input[name=hardcoremode]': 'toggleHardcoreMode',
			'change input[name=allignorespects]': 'toggleAllIgnoreSpects',
			'change input[name=allignoreopp]': 'toggleAllIgnoreOpponent',
			'change input[name=autotimer]': 'toggleAutoTimer',
			'change input[name=rightpanelbattles]': 'toggleRightPanelBattles'
		},
		toggleHardcoreMode: function (e) {
			this.room.setHardcoreMode(!!e.currentTarget.checked);
			if (this.battle.hardcoreMode) {
				this.battle.add('Hardcore mode ON: Information not available in-game is now hidden.');
			} else {
				this.battle.add('Hardcore mode OFF: Information not available in-game is now shown.');
			}
		},
		toggleIgnoreSpects: function (e) {
			this.battle.ignoreSpects = !!e.currentTarget.checked;
			this.battle.add('Spectators ' + (this.battle.ignoreSpects ? '' : 'no longer ') + 'ignored.');
			var $messages = $('.battle-log').find('.chat').has('small').not(':contains(\u2605), :contains(\u2606)');
			if (!$messages.length) return;
			if (this.battle.ignoreSpects) {
				$messages.hide();
			} else {
				$messages.show();
			}
		},
		toggleAllIgnoreSpects: function (e) {
			var ignoreSpects = !!e.currentTarget.checked;
			Storage.prefs('ignorespects', ignoreSpects);
			if (ignoreSpects && !this.battle.ignoreSpects) this.$el.find('input[name=ignorespects]').click();
		},
		toggleIgnoreNicks: function (e) {
			this.battle.ignoreNicks = !!e.currentTarget.checked;
			Storage.prefs('ignorenicks', this.battle.ignoreNicks);
			this.battle.add('Nicknames ' + (this.battle.ignoreNicks ? '' : 'no longer ') + 'ignored.');
			this.battle.resetToCurrentTurn();
		},
		toggleIgnoreOpponent: function (e) {
			this.battle.ignoreOpponent = !!e.currentTarget.checked;
			this.battle.add('Opponent ' + (this.battle.ignoreOpponent ? '' : 'no longer ') + 'ignored.');
			this.battle.resetToCurrentTurn();
		},
		toggleAllIgnoreOpponent: function (e) {
			var ignoreOpponent = !!e.currentTarget.checked;
			Storage.prefs('ignoreopp', ignoreOpponent);
			if (ignoreOpponent && !this.battle.ignoreOpponent) this.$el.find('input[name=ignoreopp]').click();
		},
		toggleAutoTimer: function (e) {
			var autoTimer = !!e.currentTarget.checked;
			Storage.prefs('autotimer', autoTimer);
			if (autoTimer) {
				this.room.setTimer('on');
				this.room.autoTimerActivated = true;
			}
		},
		toggleRightPanelBattles: function (e) {
			Storage.prefs('rightpanelbattles', !!e.currentTarget.checked);
		}
	});

	var TimerPopup = this.TimerPopup = Popup.extend({
		initialize: function (data) {
			this.room = data.room;
			if (this.room.battle.kickingInactive) {
				this.$el.html('<p><button name="timerOff"><strong>Stop timer</strong></button></p>');
			} else {
				this.$el.html('<p><button name="timerOn"><strong>Start timer</strong></button></p>');
			}
		},
		timerOff: function () {
			this.room.setTimer('off');
			this.close();
		},
		timerOn: function () {
			this.room.setTimer('on');
			this.close();
		}
	});

}).call(this, jQuery);
