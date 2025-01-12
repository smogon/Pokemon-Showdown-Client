(function ($) {

	var ConsoleRoom = this.ConsoleRoom = Room.extend({
		type: 'chat',
		title: '',
		constructor: function () {
			if (!this.events) this.events = {};
			if (!this.events['click .username']) this.events['click .username'] = 'clickUsername';
			if (!this.events['submit form']) this.events['submit form'] = 'submit';
			if (!this.events['keydown textarea']) this.events['keydown textarea'] = 'keyDown';
			if (!this.events['keyup textarea']) this.events['keyup textarea'] = 'keyUp';
			if (!this.events['focus textarea']) this.events['focus textarea'] = 'focusText';
			if (!this.events['blur textarea']) this.events['blur textarea'] = 'blurText';
			if (!this.events['click .spoiler']) this.events['click .spoiler'] = 'clickSpoiler';
			if (!this.events['click .message-pm i']) this.events['click .message-pm i'] = 'openPM';

			this.initializeTabComplete();
			// create up/down history for this room
			this.chatHistory = new ChatHistory();

			// this MUST set up this.$chatAdd
			Room.apply(this, arguments);

			app.user.on('change', this.updateUser, this);
			this.updateUser();
		},
		updateUser: function () {
			var name = app.user.get('name');
			if (this.expired) {
				this.$chatAdd.html(this.expired === true ? 'This room is expired' : BattleLog.sanitizeHTML(this.expired));
				this.$chatbox = null;
			} else if (!name) {
				this.$chatAdd.html('Connecting...');
				this.$chatbox = null;
			} else if (!app.user.get('named')) {
				this.$chatAdd.html('<form><button name="login" class="button">Join chat</button></form>');
				this.$chatbox = null;
			} else {
				var color = app.user.get('away') ? 'color:#888;' : BattleLog.hashColor(app.user.get('userid'));
				this.$chatAdd.html('<form class="chatbox"><label style="' + color + '">' + BattleLog.escapeHTML(name) + ':</label> <textarea class="textbox" type="text" size="70" autocomplete="off"></textarea></form>');
				this.$chatbox = this.$chatAdd.find('textarea');
				this.$chatbox.autoResize({
					animate: false,
					extraSpace: 0
				});
				if (document.activeElement.tagName.toLowerCase() !== 'textarea' && (this === app.curSideRoom || this === app.curRoom)) {
					this.$chatbox.focus();
				}
			}
		},

		focus: function (e, focusTextbox) {
			var target = e && e.target;
			if (target && ['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName)) {
				// this workaround works for iOS 12 but not iOS 13
				/* if (window.isiOS) {
					// iOS will not bring up a keyboard unless you manually blur and refocus
					$(target).blur();
					setTimeout(function () {
						$(target).focus();
					}, 0);
				} */
				return;
			}
			if (!this.$chatbox) {
				this.$('button[name=login]').focus();
				return;
			}
			if (focusTextbox || $(target).closest('.chat-log-add, .battle-log-add').length) {
				this.$chatbox.focus();
				return;
			}

			if (window.isiOS) {
				// Preventing the on-screen keyboard leads to other bugs, so we have to
				// avoid focusing the textbox altogether. Sorry, Bluetooth keyboard users!
				return;
			}
			// this will prevent a on-screen keyboard from appearing (in Android and iOS,
			// and hopefully also Windows and Chrome OS in tablet mode)
			this.$chatbox.blur();
			this.$chatbox[0].readOnly = true;
			this.$chatbox.focus();
			var chatbox = this.$chatbox[0];
			setTimeout(function () {
				chatbox.readOnly = false;
			}, 0);
		},

		focusText: function () {
			if (this.$chatbox) {
				var rooms = app.roomList.concat(app.sideRoomList);
				var roomIndex = rooms.indexOf(this);
				var roomLeft = rooms[roomIndex - 1];
				var roomRight = rooms[roomIndex + 1];
				if (roomLeft || roomRight) {
					this.$chatbox.attr('placeholder', "  " + (roomLeft ? "\u2190 " + roomLeft.title : '') + (app.arrowKeysUsed ? " | " : " (use arrow keys) ") + (roomRight ? roomRight.title + " \u2192" : ''));
				} else {
					this.$chatbox.attr('placeholder', "");
				}
			}
		},
		blurText: function () {
			if (this.$chatbox) {
				this.$chatbox.attr('placeholder', "");
			}
		},
		clickSpoiler: function (e) {
			$(e.currentTarget).toggleClass('spoiler-shown');
		},

		login: function () {
			app.addPopup(LoginPopup);
		},
		submit: function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (e.currentTarget.getAttribute('data-submitsend')) {
				return app.submitSend(e);
			}
			var text = this.$chatbox.val();
			if (!text) return;
			if (!$.trim(text)) {
				this.$chatbox.val('');
				return;
			}
			this.tabComplete.reset();
			this.chatHistory.push(text);
			text = this.parseCommand(text);
			if (
				this.battle && this.battle.ignoreSpects &&
				app.user.get('userid') !== this.battle.p1.id && app.user.get('userid') !== this.battle.p2.id &&
				!(text.startsWith('/') && !text.startsWith('/me'))
			) {
				this.add("You can't chat in this battle as you're currently ignoring spectators");
			} else if (text.length > 80000) {
				app.addPopupMessage("Your message is too long.");
				return;
			} else if (text) {
				this.send(text);
			}
			this.$chatbox.val('');
			this.$chatbox.trigger('keyup'); // force a resize
		},
		keyUp: function (e) {
			// Android Chrome compose keycode
			// Android Chrome no longer sends keyCode 13 when Enter is pressed on
			// the soft keyboard, resulting in this annoying hack.
			// https://bugs.chromium.org/p/chromium/issues/detail?id=118639#c232
			if (!e.shiftKey && e.keyCode === 229 && this.$chatbox.val().slice(-1) === '\n') {
				this.submit(e);
			}
		},
		keyDown: function (e) {
			var cmdKey = (((e.cmdKey || e.metaKey) ? 1 : 0) + (e.ctrlKey ? 1 : 0) === 1) && !e.altKey && !e.shiftKey;
			var textbox = e.currentTarget;
			if (e.keyCode === 13 && !e.shiftKey) { // Enter key
				this.submit(e);
			} else if (e.keyCode === 73 && cmdKey) { // Ctrl + I key
				if (ConsoleRoom.toggleFormatChar(textbox, '_')) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (e.keyCode === 66 && cmdKey) { // Ctrl + B key
				if (ConsoleRoom.toggleFormatChar(textbox, '*')) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (e.keyCode === 192 && cmdKey) { // Ctrl + ` key
				if (ConsoleRoom.toggleFormatChar(textbox, '`')) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (e.keyCode === 33) { // Pg Up key
				this.$chatFrame.scrollTop(this.$chatFrame.scrollTop() - this.$chatFrame.height() + 60);
			} else if (e.keyCode === 34) { // Pg Dn key
				this.$chatFrame.scrollTop(this.$chatFrame.scrollTop() + this.$chatFrame.height() - 60);
			} else if (e.keyCode === 9 && !e.ctrlKey) { // Tab key
				var reverse = !!e.shiftKey; // Shift+Tab reverses direction
				if (this.handleTabComplete(this.$chatbox, reverse)) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (e.keyCode === 38 && !e.shiftKey && !e.altKey) { // Up key
				if (this.chatHistoryUp(this.$chatbox, e)) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (e.keyCode === 40 && !e.shiftKey && !e.altKey) { // Down key
				if (this.chatHistoryDown(this.$chatbox, e)) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (e.keyCode === 27 && !e.shiftKey && !e.altKey) { // Esc key
				if (this.undoTabComplete(this.$chatbox)) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (app.user.lastPM && (textbox.value === '/reply' || textbox.value === '/r' || textbox.value === '/R') && e.keyCode === 32) { // '/reply ' is being written
				e.preventDefault();
				e.stopPropagation();
				var val = '/pm ' + app.user.lastPM + ', ';
				textbox.value = val;
				textbox.setSelectionRange(val.length, val.length);
			}
		},
		clickUsername: function (e) {
			e.stopPropagation();
			e.preventDefault();
			var position;
			if (e.currentTarget.className === 'userbutton username') {
				position = 'right';
			}
			var roomGroup = $(e.currentTarget).data('roomgroup');
			var name = $(e.currentTarget).data('name') || $(e.currentTarget).text();
			var away = $(e.currentTarget).data('away') || false;
			var status = $(e.currentTarget).data('status');
			app.addPopup(UserPopup, {roomGroup: roomGroup, name: name, away: away, status: status, sourceEl: e.currentTarget, position: position});
		},
		openPM: function (e) {
			e.preventDefault();
			e.stopPropagation();
			app.focusRoom('');
			app.rooms[''].focusPM($(e.currentTarget).data('name'));
		},
		clear: function () {
			if (this.$chat) this.$chat.html('');
		},

		// support for buttons that can be sent by the server:

		joinRoom: function (room) {
			app.joinRoom(room);
		},
		avatars: function () {
			app.addPopup(AvatarsPopup);
		},
		openSounds: function () {
			app.addPopup(SoundsPopup, {type: 'semimodal'});
		},
		openOptions: function () {
			app.addPopup(OptionsPopup, {type: 'semimodal'});
		},

		// highlight

		getHighlight: function (message) {
			var highlights = Dex.prefs('highlights') || {};
			if (Array.isArray(highlights)) {
				highlights = {global: highlights};
				// Migrate from the old highlight system
				Storage.prefs('highlights', highlights);
			}
			if (!Dex.prefs('noselfhighlight') && app.user.nameRegExp) {
				if (app.user.nameRegExp.test(message)) return true;
			}
			if (!app.highlightRegExp) {
				try {
					this.updateHighlightRegExp(highlights);
				} catch (e) {
					// If the expression above is not a regexp, we'll get here.
					// Don't throw an exception because that would prevent the chat
					// message from showing up, or, when the lobby is initialising,
					// it will prevent the initialisation from completing.
					return false;
				}
			}
			var id = Config.server.id + '#' + this.id;
			var globalHighlightsRegExp = app.highlightRegExp['global'];
			var roomHighlightsRegExp = app.highlightRegExp[id];
			return (((globalHighlightsRegExp && globalHighlightsRegExp.test(message)) || (roomHighlightsRegExp && roomHighlightsRegExp.test(message))));
		},
		updateHighlightRegExp: function (highlights) {
			// Enforce boundary for match sides, if a letter on match side is
			// a word character. For example, regular expression "a" matches
			// "a", but not "abc", while regular expression "!" matches
			// "!" and "!abc".
			app.highlightRegExp = {};
			for (var i in highlights) {
				if (!highlights[i].length) {
					app.highlightRegExp[i] = null;
					continue;
				}
				app.highlightRegExp[i] = new RegExp('(?:\\b|(?!\\w))(?:' + highlights[i].join('|') + ')(?:\\b|(?!\\w))', 'i');
			}
		},

		// chat history

		chatHistory: null,
		chatHistoryUp: function ($textbox, e) {
			var idx = +$textbox.prop('selectionStart');
			var line = $textbox.val();
			if (e && !e.ctrlKey && idx !== 0 && idx !== line.length) return false;
			if (this.chatHistory.index === 0) return false;
			$textbox.val(this.chatHistory.up(line));
			return true;
		},
		chatHistoryDown: function ($textbox, e) {
			var idx = +$textbox.prop('selectionStart');
			var line = $textbox.val();
			if (e && !e.ctrlKey && idx !== 0 && idx !== line.length) return false;
			$textbox.val(this.chatHistory.down(line));
			return true;
		},

		// tab completion

		initializeTabComplete: function () {
			this.tabComplete = {
				candidates: null,
				index: 0,
				prefix: null,
				cursor: null,
				reset: function () {
					this.cursor = null;
				}
			};
			this.userActivity = [];
		},
		markUserActive: function (userid) {
			var idx = this.userActivity.indexOf(userid);
			if (idx !== -1) {
				this.userActivity.splice(idx, 1);
			}
			this.userActivity.push(userid);
			if (this.userActivity.length > 100) {
				// Prune the list.
				this.userActivity.splice(0, 20);
			}
		},
		tabComplete: null,
		userActivity: null,
		handleTabComplete: function ($textbox, reverse) {
			// Don't tab complete at the start of the text box.
			var idx = $textbox.prop('selectionStart');
			if (idx === 0) return false;

			var users = this.users || (app.rooms['lobby'] ? app.rooms['lobby'].users : {});

			var text = $textbox.val();
			var prefix = text.substr(0, idx);

			if (this.tabComplete.cursor !== null && prefix === this.tabComplete.cursor) {
				// The user is cycling through the candidate names.
				if (reverse) {
					this.tabComplete.index--;
				} else {
					this.tabComplete.index++;
				}
				if (this.tabComplete.index >= this.tabComplete.candidates.length) this.tabComplete.index = 0;
				if (this.tabComplete.index < 0) this.tabComplete.index = this.tabComplete.candidates.length - 1;
			} else {
				// This is a new tab completion.

				// There needs to be non-whitespace to the left of the cursor.
				// no command prefixes either, we're testing for usernames here.
				var m1 = /^([\s\S!/]*?)([A-Za-z0-9][^, \n]*)$/.exec(prefix);
				var m2 = /^([\s\S!/]*?)([A-Za-z0-9][^, \n]* [^, ]*)$/.exec(prefix);
				if (!m1 && !m2) return true;
				var cmds = this.tabComplete.commands;
				var currentLine = prefix.substr(prefix.lastIndexOf('\n') + 1);
				var shouldSearchCommands = !cmds || (cmds.length ? !!cmds.length && !cmds.filter(function (x) {
					return x.startsWith(currentLine);
				}).length : prefix != this.tabComplete.prefix);
				var isCommandSearch = (currentLine.startsWith('/') && !currentLine.startsWith('//')) || currentLine.startsWith('!');
				var resultsExist = this.tabComplete.lastSearch === text && this.tabComplete.commands;
				if (isCommandSearch && shouldSearchCommands && !resultsExist) {
					if (this.tabComplete.searchPending) return true; // wait
					this.tabComplete.isCommand = true;
					this.tabComplete.searchPending = true;
					this.tabComplete.lastSearch = text;
					var self = this;
					app.once('response:cmdsearch', function (data) {
						delete self.tabComplete.searchPending;
						if (data) {
							self.tabComplete.commands = data;
							self.tabComplete.prefix = prefix;
							self.handleTabComplete($textbox, reverse);
						}
					});
					this.send('/crq cmdsearch ' + currentLine);
					return true;
				} else if (!isCommandSearch) {
					delete this.tabComplete.isCommand;
					delete this.tabComplete.commands;
				}

				this.tabComplete.prefix = prefix;
				var idprefix = (m1 ? toID(m1[2]) : '');
				var spaceprefix = (m2 ? m2[2].replace(/[^A-Za-z0-9 ]+/g, '').toLowerCase() : '');
				var candidates = []; // array of [candidate userid, prefix length]

				// don't include command names in autocomplete
				if (m2 && (m2[0] === '/' || m2[0] === '!')) spaceprefix = '';

				for (var i in users) {
					if (spaceprefix && users[i].name.replace(/[^A-Za-z0-9 ]+/g, '').toLowerCase().substr(0, spaceprefix.length) === spaceprefix) {
						candidates.push([i, m2[1].length]);
					} else if (idprefix && i.substr(0, idprefix.length) === idprefix) {
						candidates.push([i, m1[1].length]);
					}
				}

				// Sort by most recent to speak in the chat, or, in the case of a tie,
				// in alphabetical order.
				var self = this;
				candidates.sort(function (a, b) {
					if (a[1] !== b[1]) {
						// shorter prefix length comes first
						return a[1] - b[1];
					}
					var aidx = self.userActivity.indexOf(a[0]);
					var bidx = self.userActivity.indexOf(b[0]);
					if (aidx !== -1) {
						if (bidx !== -1) {
							return bidx - aidx;
						}
						return -1; // a comes first
					} else if (bidx != -1) {
						return 1; // b comes first
					}
					return (a[0] < b[0]) ? -1 : 1; // alphabetical order
				});

				if (this.tabComplete.isCommand) {
					this.tabComplete.commands.sort(function (a, b) {
						return a.length < b.length ? 1 : -1;
					});
					for (var i = 0; i < this.tabComplete.commands.length; i++) {
						var cmd = this.tabComplete.commands[i];
						candidates.unshift([i, cmd]);
					}
				}

				this.tabComplete.candidates = candidates;
				this.tabComplete.index = 0;
				if (!candidates.length) {
					this.tabComplete.cursor = null;
					return true;
				}
			}

			// Substitute in the tab-completed name.
			var candidate = this.tabComplete.candidates[this.tabComplete.index];
			var substituteUserId = candidate[0];
			var substituteUser = users[substituteUserId] || candidate[1];
			if (!substituteUser) return true;
			var name = typeof substituteUser === 'object' ? substituteUser.name : substituteUser;
			name = Dex.getShortName(name);
			var prefixIndex = candidate[1].toString().charAt(0) === '/' ? prefix.lastIndexOf('\n') + 1 : candidate[1];
			var fullPrefix = this.tabComplete.prefix.substr(0, prefixIndex) + name;
			$textbox.val(fullPrefix + text.substr(idx));
			var pos = fullPrefix.length;
			$textbox[0].setSelectionRange(pos, pos);
			this.tabComplete.cursor = fullPrefix;
			return true;
		},
		undoTabComplete: function ($textbox) {
			var cursorPosition = $textbox.prop('selectionEnd');
			if (!this.tabComplete.cursor || $textbox.val().substr(0, cursorPosition) !== this.tabComplete.cursor) return false;
			$textbox.val(this.tabComplete.prefix + $textbox.val().substr(cursorPosition));
			$textbox.prop('selectionEnd', this.tabComplete.prefix.length);
			return true;
		},

		// command parsing
		checkBroadcast: function (cmd, text) {
			if (text.charAt(0) === '!') {
				this.add('|error|The command "!' + cmd + '" cannot be broadcast.');
				this.add('|error|Use /' + cmd + ' to use it normally.');
				return true;
			}
			return false;
		},
		parseCommand: function (text) {
			var cmd = '';
			var target = '';
			var noSpace = false;
			if (text.substr(0, 2) !== '//' && text.charAt(0) === '/' || text.charAt(0) === '!') {
				var spaceIndex = text.indexOf(' ');
				if (spaceIndex > 0) {
					cmd = text.substr(1, spaceIndex - 1);
					target = text.substr(spaceIndex + 1).trim();
				} else {
					cmd = text.substr(1);
					target = '';
					noSpace = true;
				}
			}

			switch (toID(cmd)) {
			case 'chal':
			case 'chall':
			case 'challenge':
				if (this.checkBroadcast(cmd, text)) return false;
				var targets = target.split(',');
				for (var i = 0; i < targets.length; i++) {
					targets[i] = $.trim(targets[i]);
				}

				var self = this;
				var challenge = function (targets) {
					target = toID(targets[0]);
					self.challengeData = {userid: target, format: targets.length > 1 ? targets.slice(1).join(',') : '', team: ''};
					app.on('response:userdetails', self.challengeUserdetails, self);
					app.send('/cmd userdetails ' + target);
				};

				if (!targets[0]) {
					app.addPopupPrompt("Who would you like to challenge?", "Challenge user", function (target) {
						if (!target) return;
						challenge([target]);
					});
					return false;
				}
				challenge(targets);
				return false;

			case 'accept':
				if (this.checkBroadcast(cmd, text)) return false;
				var userid = toID(target);
				if (userid) {
					var $challenge = $('.pm-window').filter('div[data-userid="' + userid + '"]').find('button[name="acceptChallenge"]');
					if (!$challenge.length) {
						this.add("You do not have any pending challenge from '" + toName(target) + "' to accept.");
						return false;
					}
					$challenge[0].click();
					return false;
				}

				var $challenges = $('.challenge').find('button[name=acceptChallenge]');
				if (!$challenges.length) {
					this.add('You do not have any pending challenges to accept.');
					return false;
				}
				if ($challenges.length > 1) {
					this.add('You need to specify a user if you have more than one pending challenge to accept.');
					this.parseCommand('/help accept');
					return false;
				}

				$challenges[0].click();
				return false;
			case 'reject':
				if (this.checkBroadcast(cmd, text)) return false;
				var userid = toID(target);
				if (userid) {
					var $challenge = $('.pm-window').filter('div[data-userid="' + userid + '"]').find('button[name="rejectChallenge"]');
					if (!$challenge.length) {
						this.add("You do not have any pending challenge from '" + toName(target) + "' to reject.");
						return false;
					}
					$challenge[0].click();
					return false;
				}

				var $challenges = $('.challenge').find('button[name="rejectChallenge"]');
				if (!$challenges.length) {
					this.add('You do not have any pending challenges to reject.');
					this.parseCommand('/help reject');
					return false;
				}
				if ($challenges.length > 1) {
					this.add('You need to specify a user if you have more than one pending challenge to reject.');
					this.parseCommand('/help reject');
					return false;
				}

				$challenges[0].click();
				return false;

			case 'user':
			case 'open':
				if (this.checkBroadcast(cmd, text)) return false;
				var openUser = function (target) {
					app.addPopup(UserPopup, {name: target});
				};
				target = toName(target);
				if (!target) {
					app.addPopupPrompt("Username", "Open", function (target) {
						if (!target) return;
						openUser(target);
					});
					return false;
				}
				openUser(target);
				return false;

			case 'pm':
			case 'whisper':
			case 'w':
			case 'msg':
				if (this.checkBroadcast(cmd, text)) return false;
				var commaIndex = target.indexOf(',');
				if (commaIndex < 0) break;
				if (!$.trim(target.slice(commaIndex + 1))) {
					app.rooms[''].focusPM(target.slice(0, commaIndex));
					return false;
				}
				break;

			case 'debug':
				if (this.checkBroadcast(cmd, text)) return false;
				if (target === 'extractteams') {
					app.addPopup(Popup, {
						type: 'modal',
						htmlMessage: "Extracted team data:<br /><textarea rows=\"10\" cols=\"60\">" + BattleLog.escapeHTML(JSON.stringify(Storage.teams)) + "</textarea>"
					});
				} else if (target === 'nw') {
					try {
						nw.Window.get().showDevTools();
					} catch (e) {
						this.add('|error|' + e.message);
					}
				} else {
					this.add('|error|Unknown debug command.');
					this.add('|error|Are you looking for /showdebug and /hidedebug?');
				}
				return false;

			case 'news':
				if (this.checkBroadcast(cmd, text)) return false;
				app.rooms[''].addNews();
				return false;
			case 'autojoin':
			case 'cmd':
			case 'crq':
			case 'query':
				if (this.checkBroadcast(cmd, text)) return false;
				this.add('This is a PS system command; do not use it.');
				return false;

			case 'ignore':
				if (this.checkBroadcast(cmd, text)) return false;
				if (!target) {
					this.parseCommand('/help ignore');
					return false;
				}
				if (toUserid(target) === app.user.get('userid')) {
					this.add("You are not able to ignore yourself.");
				} else if (app.ignore[toUserid(target)]) {
					this.add("User '" + toName(target) + "' is already on your ignore list. (Moderator messages will not be ignored.)");
				} else {
					app.ignore[toUserid(target)] = 1;
					this.add("User '" + toName(target) + "' ignored. (Moderator messages will not be ignored.)");
					app.saveIgnore();
				}
				return false;

			case 'clearignore':
				if (this.checkBroadcast(cmd, text)) return false;
				if (toID(target) !== 'confirm') {
					this.add("Are you sure you want to clear your ignore list?");
					this.add('|html|If you\'re sure, use <code>/clearignore confirm</code>');
					return false;
				}
				if (!Object.keys(app.ignore).length) {
					this.add("You have no ignored users.");
					return false;
				}
				app.ignore = {};
				app.saveIgnore();
				this.add("Your ignore list was cleared.");
				return false;
			case 'unignore':
				if (this.checkBroadcast(cmd, text)) return false;
				if (!target) {
					this.parseCommand('/help unignore');
					return false;
				}
				if (!app.ignore[toUserid(target)]) {
					this.add("User '" + toName(target) + "' isn't on your ignore list.");
				} else {
					delete app.ignore[toUserid(target)];
					this.add("User '" + toName(target) + "' no longer ignored.");
					app.saveIgnore();
				}
				return false;

			case 'ignorelist':
				if (this.checkBroadcast(cmd, text)) return false;
				var ignoreList = Object.keys(app.ignore);
				if (ignoreList.length === 0) {
					this.add('You are currently not ignoring anyone.');
				} else {
					this.add("You are currently ignoring: " + ignoreList.join(', '));
				}
				return false;

			case 'clear':
				if (this.checkBroadcast(cmd, text)) return false;
				if (this.clear) {
					this.clear();
				} else {
					this.add('||This room can\'t be cleared');
				}
				return false;

			case 'clearpms':
				if (this.checkBroadcast(cmd, text)) return false;
				var $pms = $('.pm-window');
				if (!$pms.length) {
					this.add('You do not have any PM windows open.');
					return false;
				}
				$pms.each(function () {
					var userid = $(this).data('userid');
					if (!userid) {
						var newsId = $(this).data('newsid');
						if (newsId) {
							$.cookie('showdown_readnews', '' + newsId, {expires: 365});
						}
						$(this).remove();
						return;
					}
					app.rooms[''].closePM(userid);
					$(this).find('.inner').empty();
				});
				this.add("All PM windows cleared and closed.");
				return false;

			case 'nick':
				if (this.checkBroadcast(cmd, text)) return false;
				if ($.trim(target)) {
					app.user.rename(target);
				} else {
					app.addPopup(LoginPopup);
				}
				return false;

			case 'logout':
				if (this.checkBroadcast(cmd, text)) return false;
				app.user.logout();
				return false;
			case 'showdebug':
				if (this.checkBroadcast(cmd, text)) return false;
				this.add('Debug battle messages: ON');
				Storage.prefs('showdebug', true);
				var debugStyle = $('#debugstyle').get(0);
				var onCSS = '.debug {display: block;}';
				if (!debugStyle) {
					$('head').append('<style id="debugstyle">' + onCSS + '</style>');
				} else {
					debugStyle.innerHTML = onCSS;
				}
				return false;
			case 'hidedebug':
				if (this.checkBroadcast(cmd, text)) return false;
				this.add('Debug battle messages: HIDDEN');
				Storage.prefs('showdebug', false);
				var debugStyle = $('#debugstyle').get(0);
				var offCSS = '.debug {display: none;}';
				if (!debugStyle) {
					$('head').append('<style id="debugstyle">' + offCSS + '</style>');
				} else {
					debugStyle.innerHTML = offCSS;
				}
				return false;

			case 'showjoins':
				if (this.checkBroadcast(cmd, text)) return false;
				var showjoins = Dex.prefs('showjoins') || {};
				var serverShowjoins = showjoins[Config.server.id] || {};
				if (target) {
					var room = toID(target);
					if (serverShowjoins['global']) {
						delete serverShowjoins[room];
					} else {
						serverShowjoins[room] = 1;
					}
					this.add('Join/leave messages on room ' + room + ': ALWAYS ON');
				} else {
					serverShowjoins = {global: 1};
					this.add('Join/leave messages: ALWAYS ON');
				}
				showjoins[Config.server.id] = serverShowjoins;
				Storage.prefs('showjoins', showjoins);
				return false;
			case 'hidejoins':
				if (this.checkBroadcast(cmd, text)) return false;
				var showjoins = Dex.prefs('showjoins') || {};
				var serverShowjoins = showjoins[Config.server.id] || {};
				if (target) {
					var room = toID(target);
					if (!serverShowjoins['global']) {
						delete serverShowjoins[room];
					} else {
						serverShowjoins[room] = 0;
					}
					this.add('Join/leave messages on room ' + room + ': AUTOMATIC');
				} else {
					serverShowjoins = {global: 0};
					this.add('Join/leave messages: AUTOMATIC');
				}
				showjoins[Config.server.id] = serverShowjoins;
				Storage.prefs('showjoins', showjoins);
				return false;

			case 'showbattles':
				if (this.checkBroadcast(cmd, text)) return false;
				this.add('Battle messages: ON');
				Storage.prefs('showbattles', true);
				return false;
			case 'hidebattles':
				if (this.checkBroadcast(cmd, text)) return false;
				this.add('Battle messages: HIDDEN');
				Storage.prefs('showbattles', false);
				return false;

			case 'unpackhidden':
				if (this.checkBroadcast(cmd, text)) return false;
				this.add('Locked/banned users\' chat messages: ON');
				Storage.prefs('nounlink', true);
				return false;
			case 'packhidden':
				if (this.checkBroadcast(cmd, text)) return false;
				this.add('Locked/banned users\' chat messages: HIDDEN');
				Storage.prefs('nounlink', false);
				return false;

			case 'timestamps':
				if (this.checkBroadcast(cmd, text)) return false;
				var targets = target.split(',');
				if ((['all', 'lobby', 'pms'].indexOf(targets[0]) === -1) || targets.length < 2 ||
					(['off', 'minutes', 'seconds'].indexOf(targets[1] = targets[1].trim()) === -1)) {
					this.add('Error: Invalid /timestamps command');
					this.parseCommand('/help timestamps'); // show help
					return false;
				}
				var timestamps = Dex.prefs('timestamps') || {};
				if (typeof timestamps === 'string') {
					// The previous has a timestamps preference from the previous
					// regime. We can't set properties of a string, so set it to
					// an empty object.
					timestamps = {};
				}
				switch (targets[0]) {
				case 'all':
					timestamps.lobby = targets[1];
					timestamps.pms = targets[1];
					break;
				case 'lobby':
					timestamps.lobby = targets[1];
					break;
				case 'pms':
					timestamps.pms = targets[1];
					break;
				}
				this.add("Timestamps preference set to: '" + targets[1] + "' for '" + targets[0] + "'.");
				Storage.prefs('timestamps', timestamps);
				return false;

			case 'hl':
			case 'highlight':
				if (this.checkBroadcast(cmd, text)) return false;
				var highlights = Dex.prefs('highlights') || {};
				if (target.includes(' ')) {
					var targets = target.split(' ');
					var subCmd = targets[0];
					targets = targets.slice(1).join(' ').match(/([^,]+?({\d*,\d*})?)+/g);
					// trim the targets to be safe
					for (var i = 0, len = targets.length; i < len; i++) {
						targets[i] = targets[i].replace(/\n/g, '').trim();
					}
					switch (subCmd) {
					case 'add': case 'roomadd':
						var key = subCmd === 'roomadd' ? (Config.server.id + '#' + this.id) : 'global';
						var highlightList = highlights[key] || [];
						for (var i = 0, len = targets.length; i < len; i++) {
							if (!targets[i]) continue;
							if (/[\\^$*+?()|{}[\]]/.test(targets[i])) {
								// Catch any errors thrown by newly added regular expressions so they don't break the entire highlight list
								try {
									new RegExp(targets[i]);
								} catch (e) {
									return this.add('|error|' + (e.message.substr(0, 28) === 'Invalid regular expression: ' ? e.message : 'Invalid regular expression: /' + targets[i] + '/: ' + e.message));
								}
							}
							if (highlightList.includes(targets[i])) {
								return this.add('|error|' + targets[i] + ' is already on your highlights list.');
							}
						}
						highlights[key] = highlightList.concat(targets);
						this.add("Now highlighting on " + (key === 'global' ? "(everywhere): " : "(in " + key + "): ") + highlights[key].join(', '));
						// We update the regex
						this.updateHighlightRegExp(highlights);
						break;
					case 'delete': case 'roomdelete':
						var key = subCmd === 'roomdelete' ? (Config.server.id + '#' + this.id) : 'global';
						var highlightList = highlights[key] || [];
						var newHls = [];
						for (var i = 0, len = highlightList.length; i < len; i++) {
							if (targets.indexOf(highlightList[i]) === -1) {
								newHls.push(highlightList[i]);
							}
						}
						highlights[key] = newHls;
						this.add("Now highlighting on " + (key === 'global' ? "(everywhere): " : "(in " + key + "): ") + highlights[key].join(', '));
						// We update the regex
						this.updateHighlightRegExp(highlights);
						break;
					default:
						if (this.checkBroadcast(cmd, text)) return false;
						// Wrong command
						this.add('|error|Invalid /highlight command.');
						this.parseCommand('/help highlight'); // show help
						return false;
					}
					Storage.prefs('highlights', highlights);
				} else {
					if (this.checkBroadcast(cmd, text)) return false;
					if (['clear', 'roomclear', 'clearall'].includes(target)) {
						var key = (target === 'roomclear' ? (Config.server.id + '#' + this.id) : (target === 'clearall' ? '' : 'global'));
						if (key) {
							highlights[key] = [];
							this.add("All highlights (" + (key === 'global' ? "everywhere" : "in " + key) + ") cleared.");
							this.updateHighlightRegExp(highlightList);
						} else {
							Storage.prefs('highlights', false);
							this.add("All highlights (in all rooms and globally) cleared.");
							this.updateHighlightRegExp({});
						}
					} else if (['show', 'list', 'roomshow', 'roomlist'].includes(target)) {
						// Shows a list of the current highlighting words
						var key = target.startsWith('room') ? (Config.server.id + '#' + this.id) : 'global';
						if (highlights[key] && highlights[key].length > 0) {
							this.add("Current highlight list " + (key === 'global' ? "(everywhere): " : "(in " + key + "): ") + highlights[key].join(", "));
						} else {
							this.add('Your highlight list' + (key === 'global' ? '' : ' in ' + key) + ' is empty.');
						}
					} else {
						// Wrong command
						this.add('|error|Invalid /highlight command.');
						this.parseCommand('/help highlight'); // show help
						return false;
					}
				}
				return false;

			case 'rank':
			case 'ranking':
			case 'rating':
			case 'ladder':
				if (this.checkBroadcast(cmd, text)) return false;
				if (app.localLadder) return text;
				if (!target) {
					target = app.user.get('userid');
				}
				if (this.battle && !target.includes(',')) {
					target += ", " + this.id.split('-')[1];
				}

				var targets = target.split(',');
				var formatTargeting = false;
				var formats = {};
				var gens = {};
				for (var i = 1, len = targets.length; i < len; i++) {
					targets[i] = $.trim(targets[i]);
					if (targets[i].length === 4 && targets[i].substr(0, 3) === 'gen') {
						gens[targets[i]] = 1;
					} else {
						formats[toID(targets[i])] = 1;
					}
					formatTargeting = true;
				}

				var self = this;
				$.get(app.user.getActionPHP(), {
					act: 'ladderget',
					user: targets[0]
				}, Storage.safeJSON(function (data) {
					if (!data || !$.isArray(data)) return self.add('|raw|Error: corrupted ranking data');
					var buffer = '<div class="ladder"><table><tr><td colspan="9">User: <strong>' + toName(targets[0]) + '</strong></td></tr>';
					if (!data.length) {
						buffer += '<tr><td colspan="9"><em>This user has not played any ladder games yet.</em></td></tr>';
						buffer += '</table></div>';
						return self.add('|raw|' + buffer);
					}
					buffer += '<tr><th>Format</th><th><abbr title="Elo rating">Elo</abbr></th><th><abbr title="user\'s percentage chance of winning a random battle (aka GLIXARE)">GXE</abbr></th><th><abbr title="Glicko-1 rating: rating±deviation">Glicko-1</abbr></th><th>COIL</th><th>W</th><th>L</th><th>Total</th>';
					var suspect = false;
					for (var i = 0; i < data.length; i++) {
						if ('suspect' in data[i]) suspect = true;
					}
					if (suspect) buffer += '<th>Suspect reqs possible?</th>';
					buffer += '</tr>';
					var hiddenFormats = [];
					for (var i = 0; i < data.length; i++) {
						var row = data[i];
						if (!row) return self.add('|raw|Error: corrupted ranking data');
						var formatId = toID(row.formatid);
						if (!formatTargeting || formats[formatId] || gens[formatId.slice(0, 4)] || (gens['gen6'] && formatId.substr(0, 3) !== 'gen')) {
							buffer += '<tr>';
						} else {
							buffer += '<tr class="hidden">';
							hiddenFormats.push(BattleLog.escapeFormat(formatId));
						}

						// Validate all the numerical data
						var values = [row.elo, row.rpr, row.rprd, row.gxe, row.w, row.l, row.t];
						for (var j = 0; j < values.length; j++) {
							if (typeof values[j] !== 'number' && typeof values[j] !== 'string' || isNaN(values[j])) return self.add('|raw|Error: corrupted ranking data');
						}

						buffer += '<td>' + BattleLog.escapeFormat(formatId) + '</td><td><strong>' + Math.round(row.elo) + '</strong></td>';
						if (row.rprd > 100) {
							// High rating deviation. Provisional rating.
							buffer += '<td>&ndash;</td>';
							buffer += '<td><span><em>' + Math.round(row.rpr) + '<small> &#177; ' + Math.round(row.rprd) + '</small></em> <small>(provisional)</small></span></td>';
						} else {
							var gxe = Math.round(row.gxe * 10);
							buffer += '<td>' + Math.floor(gxe / 10) + '<small>.' + (gxe % 10) + '%</small></td>';
							buffer += '<td><em>' + Math.round(row.rpr) + '<small> &#177; ' + Math.round(row.rprd) + '</small></em></td>';
						}
						var N = parseInt(row.w, 10) + parseInt(row.l, 10) + parseInt(row.t, 10);
						var COIL_B = LadderRoom.COIL_B[formatId];
						if (COIL_B) {
							buffer += '<td>' + Math.round(40.0 * parseFloat(row.gxe) * Math.pow(2.0, -COIL_B / N), 0) + '</td>';
						} else {
							buffer += '<td>--</td>';
						}
						buffer += '<td>' + row.w + '</td><td>' + row.l + '</td><td>' + N + '</td>';
						if (suspect) {
							if (typeof row.suspect === 'undefined') {
								buffer += '<td>--</td>';
							} else {
								buffer += '<td>';
								buffer += (row.suspect ? "Yes" : "No");
								buffer += '</td>';
							}
						}
						buffer += '</tr>';
					}
					if (hiddenFormats.length) {
						if (hiddenFormats.length === data.length) {
							buffer += '<tr class="no-matches"><td colspan="8"><em>This user has not played any ladder games that match "' + BattleLog.escapeHTML(Object.keys(gens).concat(Object.keys(formats)).join(', ')) + '".</em></td></tr>';
						}
						buffer += '<tr><td colspan="8"><button name="showOtherFormats">' + hiddenFormats.slice(0, 3).join(', ') + (hiddenFormats.length > 3 ? ' and ' + (hiddenFormats.length - 3) + ' other formats' : '') + ' not shown</button></td></tr>';
					}
					var userid = toID(targets[0]);
					var registered = app.user.get('registered');
					if (registered && registered.userid === userid) {
						buffer += '<tr><td colspan="8" style="text-align:right"><a href="//' + Config.routes.users + '/' + userid + '">Reset W/L</a></tr></td>';
					}
					buffer += '</table></div>';
					self.add('|raw|' + buffer);
				}), 'text');
				return false;

			case 'buttonban':
				if (this.checkBroadcast(cmd, text)) return false;
				var self = this;
				app.addPopupPrompt("Why do you wish to ban this user?", "Ban user", function (reason) {
					self.send('/ban ' + toName(target) + ', ' + (reason || ''));
				});
				return false;

			case 'buttonmute':
				if (this.checkBroadcast(cmd, text)) return false;
				var self = this;
				app.addPopupPrompt("Why do you wish to mute this user?", "Mute user", function (reason) {
					self.send('/mute ' + toName(target) + ', ' + (reason || ''));
				});
				return false;

			case 'buttonunmute':
				if (this.checkBroadcast(cmd, text)) return false;
				this.send('/unmute ' + target);
				return false;

			case 'buttonkick':
			case 'buttonwarn':
				if (this.checkBroadcast(cmd, text)) return false;
				var self = this;
				app.addPopupPrompt("Why do you wish to warn this user?", "Warn user", function (reason) {
					self.send('/warn ' + toName(target) + ', ' + (reason || ''));
				});
				return false;

			case 'joim':
			case 'join':
			case 'j':
				if (this.checkBroadcast(cmd, text)) return false;
				if (noSpace) return text;
				if (app.rooms[target]) {
					app.focusRoom(target);
					return false;
				}
				var roomid = toID(target);
				if (app.rooms[roomid]) {
					app.focusRoom(roomid);
					return false;
				}
				return text; // Send the /join command through to the server.

			case 'part':
			case 'leave':
				if (this.checkBroadcast(cmd, text)) return false;
				if (this.requestLeave && !this.requestLeave()) return false;
				return text;

			case 'avatar':
				if (this.checkBroadcast(cmd, text)) return false;
				var parts = target.split(',');
				var avatar = parts[0].toLowerCase().replace(/[^a-z0-9-]+/g, '');
				// Replace avatar number with name before sending it to the server, only the client knows what to do with the numbers
				if (window.BattleAvatarNumbers && Object.prototype.hasOwnProperty.call(window.BattleAvatarNumbers, avatar)) {
					avatar = window.BattleAvatarNumbers[avatar];
				}
				Storage.prefs('avatar', avatar);
				return '/avatar ' + avatar; // Send the command through to the server.

			case 'afd':
				if (this.checkBroadcast(cmd, text)) return false;
				var cleanedTarget = toID(target);
				if (cleanedTarget === 'off' || cleanedTarget === 'disable') {
					Storage.prefs('afd', false);
					if (typeof BattleTextNotAFD !== 'undefined') BattleText = BattleTextNotAFD;
					this.add('April Fools\' day mode disabled.');
				} else {
					Storage.prefs('afd', true);
					if (typeof BattleTextAFD !== 'undefined') BattleText = BattleTextAFD;
					this.add('April Fools\' day mode enabled.');
				}
				for (var roomid in app.rooms) {
					var battle = app.rooms[roomid] && app.rooms[roomid].battle;
					if (!battle) continue;
					battle.resetToCurrentTurn();
				}
				return false;

			case 'blitzanims':
				if (this.checkBroadcast(cmd, text)) return false;
				var blitzanims = (toID(target) === 'on');
				Storage.prefs('blitzanims', blitzanims);
				this.add('Fast animations ' + (blitzanims ? 'ON' : 'OFF') + " for next battle.");
				for (var roomid in app.rooms) {
					var battle = app.rooms[roomid] && app.rooms[roomid].battle;
					if (!battle) continue;
					battle.resetToCurrentTurn();
				}
				return false;

			// documentation of client commands
			case 'help':
			case 'h':
				switch (toID(target)) {
				case 'chal':
				case 'chall':
				case 'challenge':
					this.add('/challenge - Open a prompt to challenge a user to a battle.');
					this.add('/challenge [user] - Challenge the user [user] to a battle.');
					this.add('/challenge [user], [format] - Challenge the user [user] to a battle in the specified [format].');
					this.add('/challenge [user], [format] @@@ [rules] - Challenge the user [user] to a battle with custom rules.');
					this.add('[rules] can be a comma-separated list of: [added rule], ![removed rule], -[banned thing], *[restricted thing], +[unbanned/unrestricted thing]');
					this.add('/battlerules - Detailed information on what can go in [rules].');
					return false;
				case 'accept':
					this.add('/accept - Accept a challenge if only one is pending.');
					this.add('/accept [user] - Accept a challenge from the specified user.');
					return false;
				case 'reject':
					this.add('/reject - Reject a challenge if only one is pending.');
					this.add('/reject [user] - Reject a challenge from the specified user.');
					return false;
				case 'user':
				case 'open':
					this.add('/user [user] - Open a popup containing the user [user]\'s avatar, name, rank, and chatroom list.');
					return false;
				case 'news':
					this.add('/news - Opens a popup containing the news.');
					return false;
				case 'ignore':
				case 'unignore':
					this.add('/ignore [user] - Ignore all messages from the user [user].');
					this.add('/unignore [user] - Remove the user [user] from your ignore list.');
					this.add('/ignorelist - List all the users that you currently ignore.');
					this.add('/clearignore - Remove all users on your ignore list.');
					this.add('Note that staff messages cannot be ignored.');
					return false;
				case 'nick':
					this.add('/nick [new username] - Change your username.');
					return false;
				case 'clear':
					this.add('/clear - Clear the room\'s chat log.');
					return false;
				case 'showdebug':
				case 'hidedebug':
					this.add('/showdebug - Receive debug messages from battle events.');
					this.add('/hidedebug - Ignore debug messages from battle events.');
					return false;
				case 'showjoins':
				case 'hidejoins':
					this.add('/showjoins [room] - Receive users\' join/leave messages. Optionally for only specified room.');
					this.add('/hidejoins [room] - Ignore users\' join/leave messages. Optionally for only specified room.');
					return false;
				case 'showbattles':
				case 'hidebattles':
					this.add('/showbattles - Receive links to new battles in Lobby.');
					this.add('/hidebattles - Ignore links to new battles in Lobby.');
					return false;
				case 'unpackhidden':
				case 'packhidden':
					this.add('/unpackhidden - Suppress hiding locked or banned users\' chat messages after the fact.');
					this.add('/packhidden - Hide locked or banned users\' chat messages after the fact.');
					this.add('Hidden messages from a user can be restored by clicking the button underneath their lock/ban reason.');
					return false;
				case 'timestamps':
					this.add('Set your timestamps preference:');
					this.add('/timestamps [all|lobby|pms], [minutes|seconds|off]');
					this.add('all - Change all timestamps preferences, lobby - Change only lobby chat preferences, pms - Change only PM preferences.');
					this.add('off - Set timestamps off, minutes - Show timestamps of the form [hh:mm], seconds - Show timestamps of the form [hh:mm:ss].');
					return false;
				case 'highlight':
				case 'hl':
					this.add('Set up highlights:');
					this.add('/highlight add [word 1], [word 2], [...] - Add the provided list of words to your highlight list.');
					this.add('/highlight roomadd [word 1], [word 2], [...] - Add the provided list of words to the highlight list of whichever room you used the command in.');
					this.add('/highlight list - List all words that currently highlight you.');
					this.add('/highlight roomlist - List all words that currently highlight you in whichever room you used the command in.');
					this.add('/highlight delete [word 1], [word 2], [...] - Delete the provided list of words from your entire highlight list.');
					this.add('/highlight roomdelete [word 1], [word 2], [...] - Delete the provided list of words from the highlight list of whichever room you used the command in.');
					this.add('/highlight clear - Clear your global highlight list.');
					this.add('/highlight roomclear - Clear the highlight list of whichever room you used the command in.');
					this.add('/highlight clearall - Clear your entire highlight list (all rooms and globally).');
					return false;
				case 'rank':
				case 'ranking':
				case 'rating':
				case 'ladder':
					this.add('/rating - Get your own rating.');
					this.add('/rating [username] - Get user [username]\'s rating.');
					return false;
				case 'afd':
					this.add('/afd - Enable April Fools\' Day sprites.');
					this.add('/afd disable - Disable April Fools\' Day sprites.');
					return false;
				case 'blitzanims':
					this.add('/blitzanims [on|off] - Enable or disable fast animations.');
					return false;
				}
			}

			return text;
		},

		challengeData: {},
		challengeUserdetails: function (data) {
			app.off('response:userdetails', this.challengeUserdetails);

			if (!data) return;

			if (data.rooms === false) {
				this.add('This player does not exist or is not online.');
				return;
			}

			app.focusRoom('');
			// if foe has changed name, challengeData.userid will be wrong, so defer to data
			var name = data.name || data.userid;
			if (/^[a-z0-9]/i.test(name)) name = ' ' + name;
			app.rooms[''].challenge(name, this.challengeData.format, this.challengeData.team);
		},

		showOtherFormats: function (d, target) {
			var autoscroll = (this.$chatFrame.scrollTop() + 60 >= this.$chat.height() - this.$chatFrame.height());

			var $target = $(target);
			var $table = $target.closest('table');
			$table.find('tr.hidden').show();
			$table.find('tr.no-matches').remove();
			$target.closest('tr').remove();

			if (autoscroll) {
				this.$chatFrame.scrollTop(this.$chat.height());
			}
		},
		destroy: function (alreadyLeft) {
			app.user.off('change', this.updateUser, this);
			Room.prototype.destroy.call(this, alreadyLeft);
		}
	}, {
		toggleFormatChar: function (textbox, formatChar) {
			if (!textbox.setSelectionRange) return false;

			var value = textbox.value;
			var start = textbox.selectionStart;
			var end = textbox.selectionEnd;

			// make sure start and end aren't midway through the syntax
			if (value.charAt(start) === formatChar && value.charAt(start - 1) === formatChar &&
				value.charAt(start - 2) !== formatChar) {
				start++;
			}
			if (value.charAt(end) === formatChar && value.charAt(end - 1) === formatChar &&
				value.charAt(end - 2) !== formatChar) {
				end--;
			}

			// wrap in doubled format char
			var wrap = formatChar + formatChar;
			value = value.substr(0, start) + wrap + value.substr(start, end - start) + wrap + value.substr(end);
			start += 2;
			end += 2;

			// prevent nesting
			var nesting = wrap + wrap;
			if (value.substr(start - 4, 4) === nesting) {
				value = value.substr(0, start - 4) + value.substr(start);
				start -= 4;
				end -= 4;
			} else if (start !== end && value.substr(start - 2, 4) === nesting) {
				value = value.substr(0, start - 2) + value.substr(start + 2);
				start -= 2;
				end -= 4;
			}
			if (value.substr(end, 4) === nesting) {
				value = value.substr(0, end) + value.substr(end + 4);
			} else if (start !== end && value.substr(end - 2, 4) === nesting) {
				value = value.substr(0, end - 2) + value.substr(end + 2);
				end -= 2;
			}

			textbox.value = value;
			textbox.setSelectionRange(start, end);
			return true;
		}
	});

	var ChatRoom = this.ChatRoom = ConsoleRoom.extend({
		minWidth: 320,
		minMainWidth: 580,
		maxWidth: 1024,
		isSideRoom: true,
		initialize: function () {
			var buf = '<div class="tournament-wrapper"></div><div class="chat-log"><div class="inner message-log" role="log"></div></div></div><div class="chat-log-add">Connecting...</div><ul class="userlist"></ul>';
			this.$el.addClass('ps-room-light').html(buf);

			this.$chatAdd = this.$('.chat-log-add');
			this.$chatFrame = this.$('.chat-log');
			this.$chat = this.$('.inner');
			this.$chatbox = null;

			this.$tournamentWrapper = this.$('.tournament-wrapper');
			this.tournamentBox = null;

			this.users = {};
			this.userCount = {};

			this.$joinLeave = null;
			this.joinLeave = {
				'join': [],
				'leave': []
			};

			this.$userList = this.$('.userlist');
			this.userList = new UserList({
				el: this.$userList,
				room: this
			});
		},
		updateLayout: function () {
			if (this.$el.width() >= 570) {
				this.userList.show();
				this.$chatFrame.addClass('hasuserlist');
				this.$chatAdd.addClass('hasuserlist');
				this.$tournamentWrapper.addClass('hasuserlist');
			} else {
				this.userList.hide();
				this.$chatFrame.removeClass('hasuserlist');
				this.$chatAdd.removeClass('hasuserlist');
				this.$tournamentWrapper.removeClass('hasuserlist');
			}
			this.$chatFrame.scrollTop(this.$chat.height());
			if (this.tournamentBox) this.tournamentBox.updateLayout();
		},
		show: function () {
			Room.prototype.show.apply(this, arguments);
			this.updateLayout();
		},
		join: function () {
			app.send('/join ' + this.id);
		},
		leave: function () {
			app.send('/noreply /leave ' + this.id);
			app.updateAutojoin();
		},
		requestLeave: function (e) {
			if (app.rooms[''].games && app.rooms[''].games[this.id]) {
				app.addPopup(ForfeitPopup, {room: this, sourceEl: e && e.currentTarget, gameType: (this.id.substring(0, 5) === 'help-' ? 'help' : 'game')});
				return false;
			} else if (Dex.prefs('leavePopupRoom')) {
				app.addPopup(ForfeitPopup, {room: this, sourceEl: e && e.currentTarget, gameType: 'room'});
				return false;
			}
			return true;
		},
		receive: function (data) {
			this.add(data);
		},
		getUserGroup: function (userid) {
			return (app.rooms[this.id].users[userid] || {group: ' '}).group;
		},
		add: function (log) {
			if (typeof log === 'string') log = log.split('\n');
			var autoscroll = false;
			if (this.$chatFrame.scrollTop() + 60 >= this.$chat.height() - this.$chatFrame.height()) {
				autoscroll = true;
			}
			var userlist = '';
			for (var i = 0; i < log.length; i++) {
				if (log[i].substr(0, 7) === '|users|') {
					userlist = log[i];
				} else {
					this.addRow(log[i]);
				}
			}
			if (userlist) this.addRow(userlist);
			if (autoscroll) {
				this.$chatFrame.scrollTop(this.$chat.height());
			}
			var $children = this.$chat.children();
			if ($children.length > 900) {
				$children.slice(0, 100).remove();
			}
		},
		addPM: function (user, message, pm) {
			var autoscroll = false;
			if (this.$chatFrame.scrollTop() + 60 >= this.$chat.height() - this.$chatFrame.height()) {
				autoscroll = true;
			}
			if (!(message.substr(0, 4) === '/raw' || message.substr(0, 5) === '/html' || message.substr(0, 6) === '/uhtml' || message.substr(0, 12) === '/uhtmlchange')) this.addChat(user, message, pm);
			if (autoscroll) {
				this.$chatFrame.scrollTop(this.$chat.height());
			}
			if (!app.focused) app.playNotificationSound();
		},
		addRow: function (line) {
			var name, name2, silent;
			if (line && typeof line === 'string') {
				if (line.charAt(0) !== '|') line = '||' + line;
				var row = line.substr(1).split('|');
				switch (row[0]) {
				case 'init':
					// ignore (handled elsewhere)
					break;

				case 'title':
					this.title = row[1];
					app.roomTitleChanged(this);
					app.topbar.updateTabbar();
					break;

				case 'c':
				case 'chat':
					if (/[a-zA-Z0-9]/.test(row[1].charAt(0))) row[1] = ' ' + row[1];
					this.addChat(row[1], row.slice(2).join('|'));
					break;

				case ':':
					this.timeOffset = ~~(Date.now() / 1000) - (parseInt(row[1], 10) || 0);
					break;
				case 'c:':
					if (/[a-zA-Z0-9]/.test(row[2].charAt(0))) row[2] = ' ' + row[2];
					var msgTime = this.timeOffset + (parseInt(row[1], 10) || 0);
					this.addChat(row[2], row.slice(3).join('|'), false, msgTime);
					break;

				case 'tc':
					if (/[a-zA-Z0-9]/.test(row[2].charAt(0))) row[2] = ' ' + row[2];
					var msgTime = row[1] ? ~~(Date.now() / 1000) - (parseInt(row[1], 10) || 0) : 0;
					this.addChat(row[2], row.slice(3).join('|'), false, msgTime);
					break;

				case 'b':
				case 'B':
					var id = row[1];
					name = row[2];
					name2 = row[3];
					silent = (row[0] === 'B');

					var matches = ChatRoom.parseBattleID(id);
					if (!matches) {
						return; // bogus room ID could be used to inject JavaScript
					}
					var format = BattleLog.escapeFormat(matches[1]);

					if (silent && !Dex.prefs('showbattles')) return;

					this.addJoinLeave();
					var battletype = 'Battle';
					if (format) {
						battletype = format + ' battle';
						if (format === 'Random Battle') battletype = 'Random Battle';
					}
					this.$chat.append('<div class="notice"><a href="' + app.root + id + '" class="ilink">' + battletype + ' started between <strong style="' + BattleLog.hashColor(toUserid(name)) + '">' + BattleLog.escapeHTML(name) + '</strong> and <strong style="' + BattleLog.hashColor(toUserid(name2)) + '">' + BattleLog.escapeHTML(name2) + '</strong>.</a></div>');
					break;

				case 'j':
				case 'join':
				case 'J':
					this.addJoinLeave('join', row[1], null, row[0] === 'J');
					break;

				case 'l':
				case 'leave':
				case 'L':
					this.addJoinLeave('leave', row[1], null, row[0] === 'L');
					break;

				case 'n':
				case 'name':
				case 'N':
					this.addJoinLeave('rename', row[1], row[2], true);
					break;


				case 'users':
					this.parseUserList(row[1]);
					break;

				case 'usercount':
					if (this.id === 'lobby') {
						this.userCount.globalUsers = parseInt(row[1], 10);
						this.userList.updateUserCount();
					}
					break;

				case 'formats':
					// deprecated; please send formats to the global room
					app.parseFormats(row);
					break;

				case 'raw':
				case 'html':
					this.$chat.append('<div class="notice">' + BattleLog.sanitizeHTML(row.slice(1).join('|')) + '</div>');
					break;

				case 'notify':
					if (row[3] && !this.getHighlight(row[3])) return;
					app.playNotificationSound();
					this.notifyOnce(row[1], row[2], 'highlight');
					break;

				case 'tempnotify':
					var notifyOnce = row[4] !== '!';
					if (!notifyOnce) row[4] = '';
					if (row[4] && !this.getHighlight(row[4])) return;
					if (!this.notifications) app.playNotificationSound();
					this.notify(row[2], row[3], row[1], notifyOnce);
					break;

				case 'tempnotifyoff':
					this.closeNotification(row[1]);
					break;

				case 'error':
					this.$chat.append('<div class="notice message-error">' + BattleLog.parseMessage(row.slice(1).join('|'), true) + '</div>');
					break;

				case 'uhtml':
				case 'uhtmlchange':
					var $elements = this.$chat.find('div.uhtml-' + toID(row[1]));
					var html = row.slice(2).join('|');
					if (!html) {
						$elements.remove();
					} else if (!$elements.length) {
						if (row[0] === 'uhtmlchange') {
							this.$chat.prepend('<div class="notice uhtml-' + toID(row[1]) + '">' + BattleLog.sanitizeHTML(html) + '</div>');
						} else {
							this.$chat.append('<div class="notice uhtml-' + toID(row[1]) + '">' + BattleLog.sanitizeHTML(html) + '</div>');
						}
					} else if (row[0] === 'uhtmlchange') {
						$elements.html(BattleLog.sanitizeHTML(html));
					} else {
						$elements.remove();
						this.$chat.append('<div class="notice uhtml-' + toID(row[1]) + '">' + BattleLog.sanitizeHTML(html) + '</div>');
					}
					break;

				case 'unlink':
					// |unlink| is deprecated in favor of |hidelines|
					// note: this message has global effects, but it's handled here
					// so that it can be included in the scrollback buffer.
					if (Dex.prefs('nounlink')) return;
					var user = toID(row[2]) || toID(row[1]);
					var $messages = $('.chatmessage-' + user);
					if (!$messages.length) break;
					$messages.find('a').contents().unwrap();
					if (row[2]) {
						// there used to be a condition for
						// row[1] === 'roomhide'
						// but it's now always applied
						$messages = this.$chat.find('.chatmessage-' + user);
						if (!$messages.length) break;
						var lineCount = parseInt(row[3], 10) || 0;
						if (lineCount) $messages = $messages.slice(-lineCount);
						$messages.hide().addClass('revealed').find('button').parent().remove();
						this.$chat.children().last().append(' <button name="toggleMessages" value="' + user + '" class="subtle"><small>(' + $messages.length + ' line' + ($messages.length > 1 ? 's' : '') + ' from ' + user + ' hidden)</small></button>');
					}
					break;
				case 'hidelines':
					if (Dex.prefs('nounlink')) return;
					var user = toID(row[2]);
					var $messages = $('.chatmessage-' + user);
					if (!$messages.length) break;
					$messages.find('a').contents().unwrap();
					if (row[1] !== 'unlink') {
						$messages = this.$chat.find('.chatmessage-' + user);
						if (!$messages.length) break;
						var lineCount = parseInt(row[3], 10) || 0;
						if (lineCount) $messages = $messages.slice(-lineCount);
						$messages.hide().addClass('revealed').find('button').parent().remove();
						var staffGroups = Object.keys(Config.groups).filter(function (group) {
							return ['staff', 'leadership'].includes(Config.groups[group].type);
						});
						if (row[1] === 'hide' || staffGroups.includes(this.getUserGroup(app.user.get('userid')))) {
							this.$chat.children().last().append(' <button name="toggleMessages" value="' + user + '" class="subtle"><small>(' + $messages.length + ' line' + ($messages.length > 1 ? 's' : '') + ' from ' + user + ' hidden)</small></button>');
						}
					}
					break;
				case 'tournament':
				case 'tournaments':
					if (Dex.prefs('tournaments') === 'hide') {
						if (row[1] === 'create') {
							this.$chat.append('<div class="notice">' + BattleLog.escapeFormat(row[2]) + ' ' + BattleLog.escapeHTML(row[3]) + ' tournament created (and hidden because you have tournaments disabled).</div>');
						} else if (row[1] === 'start') {
							this.$chat.append('<div class="notice">Tournament started.</div>');
						} else if (row[1] === 'forceend') {
							this.$chat.append('<div class="notice">Tournament force-ended.</div>');
						} else if (row[1] === 'end') {
							this.$chat.append('<div class="notice">Tournament ended.</div>');
						}
						break;
					}
					if (!this.tournamentBox) this.tournamentBox = new TournamentBox(this, this.$tournamentWrapper);
					if (!this.tournamentBox.parseMessage(row.slice(1), row[0] === 'tournaments')) break;
					// fallthrough in case of unparsed message

				case '':
					this.$chat.append('<div class="notice">' + BattleLog.escapeHTML(row.slice(1).join('|')) + '</div>');
					break;

				default:
					this.$chat.append('<div class="notice"><code>|' + BattleLog.escapeHTML(row.join('|')) + '</code></div>');
					break;
				}
			}
		},
		toggleMessages: function (user, button) {
			var $messages = this.$('.chatmessage-' + user + '.revealed');
			var $button = $(button);
			if (!$messages.is(':hidden')) {
				$messages.hide();
				$button.html('<small>(' + ($messages.length) + ' line' + ($messages.length !== 1 ? 's' : '') + ' from ' + user + ' hidden)</small>');
			} else {
				$button.html('<small>(Hide ' + ($messages.length) + ' line' + ($messages.length !== 1 ? 's' : '') + ' from ' + user + ')</small>');
				$messages.show();
			}
		},
		tournamentButton: function (val, button) {
			if (this.tournamentBox) this.tournamentBox[$(button).data('type')](val, button);
		},
		parseUserList: function (userList) {
			this.userCount = {};
			this.users = {};
			var commaIndex = userList.indexOf(',');
			if (commaIndex >= 0) {
				this.userCount.users = parseInt(userList.substr(0, commaIndex), 10);
				var users = userList.substr(commaIndex + 1).split(',');
				for (var i = 0, len = users.length; i < len; i++) {
					if (users[i]) {
						var user = BattleTextParser.parseNameParts(users[i]);
						this.users[toUserid(user.name)] = user;
					}
				}
			} else {
				this.userCount.users = parseInt(userList, 10);
				this.userCount.guests = this.userCount.users;
			}
			this.userList.construct();
		},
		addJoinLeave: function (action, name, oldid, silent) {
			if (!action) {
				this.$joinLeave = null;
				this.joinLeave = {
					'join': [],
					'leave': []
				};
				return;
			}
			var user = BattleTextParser.parseNameParts(name);
			var userid = toUserid(user.name);
			if (action === 'join') {
				if (oldid) delete this.users[toUserid(oldid)];
				if (!this.users[userid]) this.userCount.users++;
				this.users[userid] = user;
				this.userList.add(userid);
				this.userList.updateUserCount();
				this.userList.updateNoUsersOnline();
			} else if (action === 'leave') {
				if (this.users[userid]) this.userCount.users--;
				delete this.users[userid];
				this.userList.remove(userid);
				this.userList.updateUserCount();
				this.userList.updateNoUsersOnline();
			} else if (action === 'rename') {
				if (oldid) delete this.users[toUserid(oldid)];
				this.users[userid] = user;
				this.userList.remove(oldid);
				this.userList.add(userid);
				return;
			}
			var allShowjoins = Dex.prefs('showjoins') || {};
			var showjoins = allShowjoins[Config.server.id];
			if (silent && (!showjoins || (!showjoins['global'] && !showjoins[this.id]) || showjoins[this.id] === 0)) {
				return;
			}
			if (!this.$joinLeave) {
				this.$chat.append('<div class="message"><small>Loading...</small></div>');
				this.$joinLeave = this.$chat.children().last();
			}

			var formattedUser = user.group + user.name;
			if (action === 'join' && this.joinLeave['leave'].includes(formattedUser)) {
				this.joinLeave['leave'].splice(this.joinLeave['leave'].indexOf(formattedUser), 1);
			} else {
				this.joinLeave[action].push(formattedUser);
			}

			var message = '';
			if (this.joinLeave['join'].length) {
				message += this.displayJoinLeaves(this.joinLeave['join'], 'joined');
			}
			if (this.joinLeave['leave'].length) {
				if (this.joinLeave['join'].length) message += '; ';
				message += this.displayJoinLeaves(this.joinLeave['leave'], 'left') + '<br />';
			}
			this.$joinLeave.html('<small style="color: #555555">' + message + '</small>');
		},
		displayJoinLeaves: function (preList, action) {
			var message = '';
			var list = [];
			var named = {};
			for (var j = 0; j < preList.length; j++) {
				if (!named[preList[j]]) list.push(preList[j]);
				named[preList[j]] = true;
			}
			for (var j = 0; j < list.length; j++) {
				if (j >= 5) {
					message += ', and ' + (list.length - 5) + ' others';
					break;
				}
				if (j > 0) {
					if (j == 1 && list.length == 2) {
						message += ' and ';
					} else if (j == list.length - 1) {
						message += ', and ';
					} else {
						message += ', ';
					}
				}
				message += BattleLog.escapeHTML(list[j]);
			}
			return message + ' ' + action;
		},
		addChat: function (name, message, pm, msgTime) {
			var userid = toUserid(name);

			var speakerHasAuth = !" +\u2606".includes(name.charAt(0));
			var user = (this.users && this.users[app.user.get('userid')]) || {};
			var readerHasAuth = !" +\u2606\u203D\u2716!".includes(user.group || ' ');
			if (app.ignore[userid] && !speakerHasAuth && !readerHasAuth) {
				if (!app.ignoreNotified) {
					this.$chat.append(
						'<div class="chat">A message from ' + BattleLog.escapeHTML(name) + ' was ignored. (to unignore use /unignore)</div>'
					);
					app.ignoreNotified = true;
				}
				return;
			}

			// Add this user to the list of people who have spoken recently.
			this.markUserActive(userid);

			this.$joinLeave = null;
			this.joinLeave = {
				'join': [],
				'leave': []
			};

			if (pm) {
				var pmuserid = toUserid(pm);
				var oName = pmuserid === app.user.get('userid') ? name : pm;
				var clickableName = '<span class="username" data-name="' + BattleLog.escapeHTML(name) + '">' + BattleLog.escapeHTML(name.substr(1)) + '</span>';
				this.$chat.append(
					'<div class="chat chatmessage-' + toID(name) + '">' + ChatRoom.getTimestamp('lobby', msgTime) +
					'<strong style="' + BattleLog.hashColor(userid) + '">' + clickableName + ':</strong>' +
					'<span class="message-pm"><i class="pmnote" data-name="' + BattleLog.escapeHTML(oName) + '">(Private to ' + BattleLog.escapeHTML(pm) + ')</i> ' + BattleLog.parseMessage(message) + '</span>' +
					'</div>'
				);
				return; // PMs independently notify in the main menu; no need to make them notify again with `inchatpm`.
			}

			var lastMessageDates = Dex.prefs('logtimes') || (Storage.prefs('logtimes', {}), Dex.prefs('logtimes'));
			if (!lastMessageDates[Config.server.id]) lastMessageDates[Config.server.id] = {};
			var lastMessageDate = lastMessageDates[Config.server.id][this.id] || 0;
			// because the time offset to the server can vary slightly, subtract it to not have it affect comparisons between dates
			var serverMsgTime = msgTime - (this.timeOffset || 0);
			var mayNotify = serverMsgTime > lastMessageDate && userid !== app.user.get('userid');

			if (app.focused && (this === app.curSideRoom || this === app.curRoom)) {
				this.lastMessageDate = 0;
				lastMessageDates[Config.server.id][this.id] = serverMsgTime;
				Storage.prefs.save();
			} else {
				// To be saved on focus
				this.lastMessageDate = Math.max(this.lastMessageDate || 0, serverMsgTime);
			}

			var isHighlighted = userid !== app.user.get('userid') && this.getHighlight(message);
			var parsedMessage = MainMenuRoom.parseChatMessage(message, name, ChatRoom.getTimestamp('chat', msgTime), isHighlighted, this.$chat, true);
			if (typeof parsedMessage.challenge === 'string') {
				this.$chat.append('<div class="chat message-error">The server sent a challenge but this isn\'t a PM window!</div>');
				return;
			}
			if (typeof parsedMessage === 'object' && 'noNotify' in parsedMessage) {
				mayNotify = mayNotify && !parsedMessage.noNotify;
				parsedMessage = parsedMessage.message;
			}
			if (!$.isArray(parsedMessage)) parsedMessage = [parsedMessage];
			for (var i = 0; i < parsedMessage.length; i++) {
				if (!parsedMessage[i]) continue;
				this.$chat.append(parsedMessage[i]);
			}

			if (mayNotify && isHighlighted) {
				app.playNotificationSound();
				var $lastMessage = this.$chat.children().last();
				var notifyTitle = "Mentioned by " + name + (this.id === 'lobby' ? '' : " in " + this.title);
				var notifyText = $lastMessage.html().indexOf('<span class="spoiler">') >= 0 ? '(spoiler)' : $lastMessage.children().last().text();
				this.notifyOnce(notifyTitle, "\"" + notifyText + "\"", 'highlight');
			} else if (mayNotify && this.id.substr(0, 5) === 'help-') {
				this.notifyOnce("Help message from " + name, "\"" + message + "\"", 'pm');
			} else if (mayNotify && name !== '~') { // |c:|~| prefixes a system message
				this.subtleNotifyOnce();
			}

			if (message.slice(0, 4) === '/me ' || message.slice(0, 5) === '/mee') {
				Storage.logChat(this.id, '* ' + name + (message.slice(0, 4) === '/me ' ? ' ' : '') + message);
			} else if (message.slice(0, 5) === '/log ') {
				Storage.logChat(this.id, '' + message.slice(5));
			} else {
				Storage.logChat(this.id, '' + name + ': ' + message);
			}
		},
		destroy: function (alreadyLeft) {
			if (this.tournamentBox) {
				app.user.off('saveteams', this.tournamentBox.updateTeams, this.tournamentBox);
			}
			ConsoleRoom.prototype.destroy.call(this, alreadyLeft);
		}
	}, {
		getTimestamp: function (section, msgTime) {
			var pref = Dex.prefs('timestamps') || {};
			var sectionPref = ((section === 'pms') ? pref.pms : pref.lobby) || 'off';
			if ((sectionPref === 'off') || (sectionPref === undefined)) return '';

			var date = (msgTime && !isNaN(msgTime) ? new Date(msgTime * 1000) : new Date());
			var components = [date.getHours(), date.getMinutes()];
			if (sectionPref === 'seconds') {
				components.push(date.getSeconds());
			}
			return '<small>[' + components.map(
				function (x) { return (x < 10) ? '0' + x : x; }
			).join(':') + '] </small>';
		},
		parseBattleID: function (id) {
			if (id.lastIndexOf('-') > 6) {
				return id.match(/^battle\-([a-z0-9]*)\-?[0-9]*$/);
			}
			return id.match(/^battle\-([a-z0-9]*[a-z])[0-9]*$/);
		}
	});

	// user list

	var UserList = this.UserList = Backbone.View.extend({
		initialize: function (options) {
			this.room = options.room;
		},
		events: {
			'click .userlist-count': 'toggleUserlist'
		},
		construct: function () {
			var plural = this.room.userCount.users === 1 ? ' user' : ' users';
			var buf = '';
			var usersString = "" + (this.room.userCount.users || '0') + plural;
			buf += '<li class="userlist-count" id="' + this.room.id + '-userlist-users" style="text-align:center;padding:2px 0">';
			buf += '<small id="' + this.room.id + '-usercount-users">' + usersString + '</small></li>';

			var users = [];
			if (this.room.users) {
				var self = this;
				users = Object.keys(this.room.users).sort(function (a, b) {
					return self.comparator(a, b);
				});
			}
			for (var i = 0; i < users.length; i++) {
				var userid = users[i];
				buf += this.constructItem(userid);
			}
			if (!users.length) {
				buf += this.getNoNamedUsersOnline();
			}
			if (this.room.userCount.guests) {
				buf += '<li id="' + this.room.id + '-userlist-guests" style="text-align:center;padding:2px 0"><small>(<span id="' + this.room.id + '-usercount-guests">' + this.room.userCount.guests + '</span> guest' + (this.room.userCount.guests == 1 ? '' : 's') + ')</small></li>';
			}
			this.$el.html(buf);
		},
		toggleUserlist: function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (this.$el.hasClass('userlist-minimized')) {
				this.$el.removeClass('userlist-minimized');
				this.$el.addClass('userlist-maximized');
			} else if (this.$el.hasClass('userlist-maximized')) {
				this.$el.removeClass('userlist-maximized');
				this.$el.addClass('userlist-minimized');
			}
		},
		show: function () {
			this.$el.removeClass('userlist-minimized');
			this.$el.removeClass('userlist-maximized');
		},
		hide: function () {
			this.$el.scrollTop(0);
			this.$el.removeClass('userlist-maximized');
			this.$el.addClass('userlist-minimized');
		},
		updateUserCount: function () {
			var users = Math.max(this.room.userCount.users || 0, this.room.userCount.globalUsers || 0);
			$('#' + this.room.id + '-usercount-users').html('' + users + (users === 1 ? ' user' : ' users'));
		},
		add: function (userid) {
			$('#' + this.room.id + '-userlist-user-' + userid).remove();
			var users = this.$el.children();
			// Determine where to insert the user using a binary search.
			var left = 0;
			var right = users.length - 1;
			while (right >= left) {
				var mid = Math.floor((right - left) / 2 + left);
				var cmp = this.elemComparator(users[mid], userid);
				if (cmp < 0) {
					left = mid + 1;
				} else if (cmp > 0) {
					right = mid - 1;
				} else {
					// The user is already in the list.
					return;
				}
			}
			$(this.constructItem(userid)).insertAfter($(users[right]));
		},
		remove: function (userid) {
			$('#' + this.room.id + '-userlist-user-' + userid).remove();
		},
		constructItem: function (userid) {
			var user = this.room.users[userid];
			var text = '';
			// Sanitising the `userid` here is probably unnecessary, because
			// IDs can't contain anything dangerous.
			text += '<li' + (this.room.userForm === userid ? ' class="cur"' : '') + ' id="' + this.room.id + '-userlist-user-' + BattleLog.escapeHTML(userid) + '">';
			text += '<button class="userbutton username" data-roomgroup="' + BattleLog.escapeHTML(user.group) + '" data-name="' + BattleLog.escapeHTML(user.name) + '"';
			text += (user.away ? ' data-away=true' : '') + (user.status ? ' data-status="' + BattleLog.escapeHTML(user.status) + '"' : '') + '>';
			var group = user.group;
			var details = Config.groups[group] || {type: 'user'};
			var color = user.away ? 'color:#888;' : BattleLog.hashColor(userid);
			text += '<em class="group' + (details.group === 2 ? ' staffgroup' : '') + '">' + BattleLog.escapeHTML(group) + '</em>';
			if (details.type === 'leadership') {
				text += '<strong><em style="' + color + '">' + BattleLog.escapeHTML(user.name) + '</em></strong>';
			} else if (details.type === 'staff') {
				text += '<strong style="' + color + '">' + BattleLog.escapeHTML(user.name) + '</strong>';
			} else {
				text += '<span style="' + color + '">' + BattleLog.escapeHTML(user.name) + '</span>';
			}
			text += '</button>';
			text += '</li>';
			return text;
		},
		elemComparator: function (elem, userid) {
			// look at the part of the `id` after the roomid
			var id = elem.id.substr(this.room.id.length + 1);
			switch (id) {
			case 'userlist-users':
				return -1; // `elem` comes first
			case 'userlist-empty':
			case 'userlist-unregistered':
			case 'userlist-guests':
				return 1; // `userid` comes first
			}
			// extract the portion of the `id` after 'userlist-user-'
			var elemuserid = id.substr(14);
			return this.comparator(elemuserid, userid);
		},
		comparator: function (a, b) {
			if (a === b) return 0;

			var aUser = this.room.users[a] || {group: Config.defaultGroup, away: false};
			var bUser = this.room.users[b] || {group: Config.defaultGroup, away: false};

			var aRank = (
				Config.groups[aUser.group || ' '] ||
				{order: (Config.defaultOrder || 10006.5)}
			).order;
			var bRank = (
				Config.groups[bUser.group || ' '] ||
				{order: (Config.defaultOrder || 10006.5)}
			).order;

			if (aRank !== bRank) return aRank - bRank;
			if ((aUser.away ? 1 : 0) !== (bUser.away ? 1 : 0)) return (aUser.away ? 1 : 0) - (bUser.away ? 1 : 0);
			return (a > b ? 1 : -1);
		},
		getNoNamedUsersOnline: function () {
			return '<li id="' + this.room.id + '-userlist-empty">Only guests</li>';
		},
		updateNoUsersOnline: function () {
			var elem = $('#' + this.room.id + '-userlist-empty');
			if ($("[id^=" + this.room.id + "-userlist-user-]").length === 0) {
				if (elem.length === 0) {
					var guests = $('#' + this.room.id + '-userlist-guests');
					if (guests.length === 0) {
						this.$el.append($(this.getNoNamedUsersOnline()));
					} else {
						guests.before($(this.getNoNamedUsersOnline()));
					}
				}
			} else {
				elem.remove();
			}
		}
	});

}).call(this, jQuery);

function ChatHistory() {
	this.lines = [];
	this.index = 0;
}

ChatHistory.prototype.push = function (line) {
	var duplicate = this.lines.indexOf(line);
	if (duplicate >= 0) this.lines.splice(duplicate, 1);
	if (this.lines.length > 100) this.lines.splice(0, 20);
	this.lines.push(line);
	this.index = this.lines.length;
};

ChatHistory.prototype.up = function (line) { // Ensure index !== 0 first!
	if (line !== '') this.lines[this.index] = line;
	return this.lines[--this.index];
};

ChatHistory.prototype.down = function (line) {
	if (line !== '') this.lines[this.index] = line;
	if (this.index === this.lines.length) return '';
	if (++this.index === this.lines.length) return '';
	return this.lines[this.index];
};
