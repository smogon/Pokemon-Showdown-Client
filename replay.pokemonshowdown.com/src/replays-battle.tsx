/** @jsx preact.h */
import preact from 'preact';
import $ from 'jquery';
import {Net} from './utils';
import {PSRouter, PSReplays} from './replays';
import {Battle} from '../../play.pokemonshowdown.com/src/battle';
import {BattleLog} from '../../play.pokemonshowdown.com/src/battle-log';
import {BattleSound} from '../../play.pokemonshowdown.com/src/battle-sound';
declare function toID(input: string): string;

function showAd(id: string) {
  // @ts-expect-error
  window.top.__vm_add = window.top.__vm_add || [];

  //this is a x-browser way to make sure content has loaded.

  (function (success) {
    if (window.document.readyState !== "loading") {
      success();
    } else {
      window.document.addEventListener("DOMContentLoaded", function () {
        success();
      });
    }
  })(function () {
    var placement = document.createElement("div");
    placement.setAttribute("class", "vm-placement");
    if (window.innerWidth > 1000) {
      //load desktop placement
      placement.setAttribute("data-id", "6452680c0b35755a3f09b59b");
    } else {
      //load mobile placement
      placement.setAttribute("data-id", "645268557bc7b571c2f06f62");
    }
    document.querySelector("#" + id)!.appendChild(placement);
    // @ts-expect-error
    window.top.__vm_add.push(placement);
  });
}

export class BattleDiv extends preact.Component {
	override shouldComponentUpdate() {
		return false;
	}
	override render() {
		return <div class="battle" style={{position: 'relative'}}></div>;
	}
}
class BattleLogDiv extends preact.Component {
	override shouldComponentUpdate() {
		return false;
	}
	override render() {
		return <div class="battle-log"></div>;
	}
}

export class BattlePanel extends preact.Component<{id: string}> {
  result: {
    uploadtime: number;
    id: string;
    format: string;
    players: string[];
    log: string;
    views: number;
    rating: number;
    private: number;
    password: string;
  } | null | undefined = undefined;
  resultError = '';
  battle: Battle | null;
  /** debug purposes */
  lastUsedKeyCode = '0';
  turnView: boolean | string = false;
  autofocusTurnView: 'select' | 'end' | null = null;
  override componentDidMount() {
    this.loadBattle(this.props.id);
    showAd('LeaderboardBTF');
    window.onkeydown = this.keyPressed;
  }
  override componentWillReceiveProps(nextProps) {
    if (this.stripQuery(this.props.id) !== this.stripQuery(nextProps.id)) {
      this.loadBattle(nextProps.id);
    }
  }
  stripQuery(id: string) {
    return id.includes('?') ? id.slice(0, id.indexOf('?')) : id;
  }
  loadBattle(id: string) {
    if (this.battle) this.battle.destroy();
    this.battle = null;
    this.result = undefined;
    this.resultError = '';
    this.forceUpdate();

    const elem = document.getElementById(`replaydata-${id}`);
    const logElem = document.getElementById(`replaylog-${id}`);
    if (elem) {
      // we actually do need to wait for that update to finish so
      // loadResult definitely has access to $frame and $logFrame
      setTimeout(() => this.loadResult(elem.innerText, id, logElem?.innerText.replace(/<\\\//g, '</')), 1);
      return;
    }

    Net(`/${this.stripQuery(id)}.json`).get().then(result => {
      this.loadResult(result, id);
    }).catch(err => {
      this.loadResult(err.statusCode === 404 ? '' : String(err?.body || ''), id);
    });
  }
  loadResult(result: string, id: string, log = '') {
    try {
      const replay: NonNullable<BattlePanel['result']> = JSON.parse(result);
      replay.log ||= log;
      this.result = replay;
      const $base = $(this.base!);
      this.battle = new Battle({
        id: replay.id,
        $frame: $base.find('.battle'),
        $logFrame: $base.find('.battle-log'),
        log: replay.log.split('\n'),
        isReplay: true,
        paused: true,
        autoresize: true,
      });
      // for ease of debugging
      (window as any).battle = this.battle;
      this.battle.subscribe(_ => {
        this.forceUpdate();
      });
      const query = Net.decodeQuery(id);
      if ('p2' in query) {
        this.battle.switchViewpoint();
      }
      if (query.turn || query.t) {
        this.battle.seekTurn(parseInt(query.turn || query.t, 10));
      }
    } catch (err) {
      this.result = null;
      this.resultError = result.startsWith('{') ? err.toString() : result;
    }
    this.forceUpdate();
  }
  override componentWillUnmount(): void {
    this.battle?.destroy();
    (window as any).battle = null;
    window.onkeydown = null;
  }
  override componentDidUpdate(): void {
    if (this.autofocusTurnView === 'select') {
      this.base?.querySelector<HTMLInputElement>('input[name=turn]')?.select();
      this.autofocusTurnView = null;
    }
    if (this.autofocusTurnView === 'end') {
      const turnbox = this.base?.querySelector<HTMLInputElement>('input[name=turn]');
      turnbox?.setSelectionRange(2, 2);
      turnbox?.focus();
      this.autofocusTurnView = null;
    }
  }
  keyPressed = (e: KeyboardEvent) => {
    // @ts-ignore
    this.lastUsedKeyCode = `${e.keyCode}`;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.keyCode === 27 && this.turnView) { // Esc
      this.closeTurn();
      return;
    }
    // @ts-ignore
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT') return;
    let target;
    switch (e.keyCode) {
    case 75: // k
      if (this.battle?.atQueueEnd) {
        this.replay();
      } else if (this.battle?.paused) {
        this.play();
      } else {
        this.pause();
      }
      break;
    case 74: // j
      if (e.shiftKey) this.firstTurn();
      else this.prevTurn();
      break;
    case 76: // l
      if (e.shiftKey) this.lastTurn();
      else this.nextTurn();
      break;
    case 188: // , (<)
      if (e.shiftKey) this.stepSpeed(-1);
      break;
    case 190: // . (>)
      if (e.shiftKey) this.stepSpeed(1);
      break;
    case 191: // / (?)
      if (e.shiftKey) {
        alert(
          'h = hyperfast speed\n' +
          'f = fast speed\n' +
          'n = normal speed\n' +
          's = slow speed\n' +
          'r = really slow speed\n' +
          'k = play/pause\n' +
          'j = previous turn\n' +
          'l = next turn\n' +
          'J = first turn\n' +
          'L = last turn\n' +
          'm = mute\n' +
          '< = slower\n' +
          '> = faster\n' +
          '1-9 = skip to turn\n' +
          '? = keyboard shortcuts (this)\n'
        );
      }
      break;
    case 48: case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 0-9
    case 96: case 97: case 98: case 99: case 100: case 101: case 102: case 103: case 104: case 105: // numpad 0-9
      this.turnView = String.fromCharCode(e.keyCode - (e.keyCode >= 96 ? 48 : 0));
      if (this.turnView === '0') this.turnView = '10';
      this.autofocusTurnView = 'end';
      e.preventDefault();
      this.forceUpdate();
      break;
    case 77: // m
      this.toggleMute();
      break;
    case 72: // h
      target = this.base?.querySelector<HTMLSelectElement>('select[name=speed]');
      if (!target) return;
      target.value = 'hyperfast';
      this.changeSpeed({target});
      break;
    case 70: // f
      target = this.base?.querySelector<HTMLSelectElement>('select[name=speed]');
      if (!target) return;
      target.value = 'fast';
      this.changeSpeed({target});
      break;
    case 78: // n
      target = this.base?.querySelector<HTMLSelectElement>('select[name=speed]');
      if (!target) return;
      target.value = 'normal';
      this.changeSpeed({target});
      break;
    case 83: // s
      target = this.base?.querySelector<HTMLSelectElement>('select[name=speed]');
      if (!target) return;
      target.value = 'slow';
      this.changeSpeed({target});
      break;
    case 82: // r
      target = this.base?.querySelector<HTMLSelectElement>('select[name=speed]');
      if (!target) return;
      target.value = 'reallyslow';
      this.changeSpeed({target});
      break;
    }
    this.forceUpdate();
  };
  play = () => {
    this.battle?.play();
  };
  replay = () => {
    this.battle?.reset();
    this.battle?.play();
    this.forceUpdate();
  };
  pause = () => {
    this.battle?.pause();
  };
  nextTurn = () => {
    this.battle?.seekBy(1);
  };
  prevTurn = () => {
    this.battle?.seekBy(-1);
  };
  firstTurn = () => {
    this.battle?.seekTurn(0);
  };
  lastTurn = () => {
    this.battle?.seekTurn(Infinity);
  };
  goToTurn = (e) => {
		const turn = this.base?.querySelector<HTMLInputElement>('input[name=turn]')?.value;
		if (!turn?.trim()) return this.closeTurn(e);
		let turnNum = Number(turn);
		if (turn === 'e' || turn === 'end' || turn === 'f' || turn === 'finish') turnNum = Infinity;
		if (isNaN(turnNum) || turnNum < 0) alert("Invalid turn");
		this.battle?.seekTurn(turnNum);
    this.closeTurn(e);
  };
  switchViewpoint = () => {
    this.battle?.switchViewpoint();
    if (this.battle?.viewpointSwitched) {
      PSRouter.replace(this.stripQuery(this.props.id) + '?p2');
    } else {
      PSRouter.replace(this.stripQuery(this.props.id));
    }
  };
	clickDownload = (e: MouseEvent) => {
    if (!this.battle) {
      // should never happen
      alert("Wait for the battle to finish loading before downloading.");
      return;
    }
		let filename = (this.battle.tier || 'Battle').replace(/[^A-Za-z0-9]/g, '');

		// ladies and gentlemen, JavaScript dates
		const timestamp = (this.result?.uploadtime || 0) * 1000;
		const date = new Date(timestamp);
		filename += '-' + date.getFullYear();
		filename += (date.getMonth() >= 9 ? '-' : '-0') + (date.getMonth() + 1);
		filename += (date.getDate() >= 10 ? '-' : '-0') + date.getDate();

		filename += '-' + toID(this.battle.p1.name);
		filename += '-' + toID(this.battle.p2.name);

    const a = e.currentTarget as HTMLAnchorElement;
		a.href = BattleLog.createReplayFileHref({battle: this.battle});
		a.download = filename + '.html';

		e.stopPropagation();
	};
  getSpeed() {
    if (!this.battle) return 'normal';
    if (this.battle.messageFadeTime <= 40) {
      return 'hyperfast';
    } else if (this.battle.messageFadeTime <= 50) {
      return 'fast';
    } else if (this.battle.messageFadeTime >= 500) {
      return 'slow';
    } else if (this.battle.messageFadeTime >= 1000) {
      return 'reallyslow';
    }
    return 'normal';
  }
  changeSpeed = (e: Event | {target: HTMLSelectElement}) => {
    const speed = (e.target as HTMLSelectElement).value;
    const fadeTable = {
      hyperfast: 40,
      fast: 50,
      normal: 300,
      slow: 500,
      reallyslow: 1000
    };
    const delayTable = {
      hyperfast: 1,
      fast: 1,
      normal: 1,
      slow: 1000,
      reallyslow: 3000
    };
    if (!this.battle) return;
    this.battle.messageShownTime = delayTable[speed];
    this.battle.messageFadeTime = fadeTable[speed];
    this.battle.scene.updateAcceleration();
  };
  stepSpeed(delta: number) {
    const target = this.base?.querySelector<HTMLSelectElement>('select[name=speed]');
    if (!target) return; // should never happen
    const values = ['reallyslow', 'slow', 'normal', 'fast', 'hyperfast'];
    const newValue = values[values.indexOf(target.value) + delta];
    if (newValue) {
      target.value = newValue;
      this.changeSpeed({target});
    }
  }
  toggleMute() {
    this.battle?.setMute(!BattleSound.muted);
    this.forceUpdate();
  }
  changeSound = (e: Event) => {
    const muted = (e.target as HTMLSelectElement).value;
    this.battle?.setMute(muted === 'off');
    // Wolfram Alpha says that default volume is 100 e^(-(2 log^2(2))/log(10)) which is around 65.881
    BattleSound.setBgmVolume(muted === 'musicoff' ? 0 : 65.881258001265573);
    this.forceUpdate();
  };
  changeDarkMode = (e: Event) => {
    const darkmode = (e.target as HTMLSelectElement).value as 'dark';
    PSReplays.darkMode = darkmode;
    PSReplays.updateDarkMode();
    this.forceUpdate();
  };
  openTurn = (e: Event) => {
    this.turnView = `${this.battle?.turn}` || true;
    this.autofocusTurnView = 'select';
    e.preventDefault();
    this.forceUpdate();
  };
  closeTurn = (e?: Event) => {
    this.turnView = false;
    e?.preventDefault();
    this.forceUpdate();
  };
  renderError(position: any) {
    if (this.resultError) {
      return <div class={PSRouter.showingLeft() ? 'mainbar has-sidebar' : 'mainbar'} style={position}><section class="section">
        <h1>Error</h1>
        <p>
          {this.resultError}
        </p>
      </section></div>;
    }

    // In theory, this should almost never happen, because Replays will
    // never link to a nonexistent replay, but this might happen if e.g.
    // a replay gets deleted or made private after you searched for it
    // but before you clicked it.
    return <div class={PSRouter.showingLeft() ? 'mainbar has-sidebar' : 'mainbar'} style={position}><section class="section" style={{maxWidth: '200px'}}>
      <div style={{textAlign: 'center'}}>
        <img src="//play.pokemonshowdown.com/sprites/gen5ani/unown-n.gif" alt="" style={{imageRendering: 'pixelated'}} />
        <img src="//play.pokemonshowdown.com/sprites/gen5ani/unown-o.gif" alt="" style={{imageRendering: 'pixelated'}} />
        <img src="//play.pokemonshowdown.com/sprites/gen5ani/unown-t.gif" alt="" style={{imageRendering: 'pixelated'}} />
      </div>
      <div style={{textAlign: 'center'}}>
        <img src="//play.pokemonshowdown.com/sprites/gen5ani/unown-f.gif" alt="" style={{imageRendering: 'pixelated'}} />
        <img src="//play.pokemonshowdown.com/sprites/gen5ani/unown-o.gif" alt="" style={{imageRendering: 'pixelated'}} />
        <img src="//play.pokemonshowdown.com/sprites/gen5ani/unown-u.gif" alt="" style={{imageRendering: 'pixelated'}} />
        <img src="//play.pokemonshowdown.com/sprites/gen5ani/unown-n.gif" alt="" style={{imageRendering: 'pixelated'}} />
        <img src="//play.pokemonshowdown.com/sprites/gen5ani/unown-d.gif" alt="" style={{imageRendering: 'pixelated'}} />
      </div>
    </section><section class="section">
			<h1>Not Found</h1>
			<p>
				The battle you're looking for has expired. Battles expire after 15 minutes of inactivity unless they're saved.
			</p>
			<p>
				In the future, remember to click <strong>Upload and share replay</strong> to save a replay permanently.
			</p>
    </section></div>;
  }
  renderControls() {
    const atEnd = !this.battle || this.battle.atQueueEnd;
    const atStart = !this.battle?.started;

    if (this.turnView) {
      const value = this.turnView === true ? undefined : this.turnView;
      this.turnView = true;
      return <div class="replay-controls"><section class="section">
        <form onSubmit={this.goToTurn}>
          Turn? <input name="turn" autofocus value={value} inputMode="numeric" class="textbox" size={5} /> {}
          <button type="submit" class="button"><strong>Go</strong></button> {}
          <button type="button" class="button" onClick={this.closeTurn}>Cancel</button>
        </form>
        <p>
          <em>Pro tip:</em> You don't need to click "Skip to turn" if you have a keyboard, just start typing the turn number and press <kbd>Enter</kbd>. For more shortcuts, press <kbd>Shift</kbd>+<kbd>/</kbd> when a text box isn't focused.
        </p>
      </section></div>;
    }

    return <div class="replay-controls">
      <p>
        {atEnd && this.battle ?
          <button onClick={this.replay} class="button" style={{width: '5em', marginRight: '3px'}}>
            <i class="fa fa-undo"></i><br />Replay
          </button>
        : (!this.battle || this.battle.paused) ?
          <button onClick={this.play} class="button" disabled={!this.battle} style={{width: '5em', marginRight: '3px'}}>
            <i class="fa fa-play"></i><br /><strong>Play</strong>
          </button>
        :
          <button onClick={this.pause} class="button" style={{width: '5em', marginRight: '3px'}}>
            <i class="fa fa-pause"></i><br /><strong>Pause</strong>
          </button>
        } {}
        <button class="button button-first" disabled={atStart} onClick={this.firstTurn}>
          <i class="fa fa-fast-backward"></i><br />First turn
        </button>
        <button class="button button-first" disabled={atStart} style={{marginLeft:'1px',position:'relative',zIndex:'1'}} onClick={this.prevTurn}>
          <i class="fa fa-step-backward"></i><br />Prev turn
        </button>
        <button class="button button-last" disabled={atEnd} style={{marginRight:'2px'}} onClick={this.nextTurn}>
          <i class="fa fa-step-forward"></i><br />Skip turn
        </button>
        <button class="button button-last" disabled={atEnd} onClick={this.lastTurn}>
          <i class="fa fa-fast-forward"></i><br />Skip to end
        </button> {}
        <button class="button" onClick={this.openTurn}>
          <i class="fa fa-repeat"></i> Go to turn...
        </button>
      </p>
      <p>
        <label class="optgroup">
          Speed:<br />
          <select name="speed" class="button" onChange={this.changeSpeed} value={this.getSpeed()}>
            <option value="hyperfast">Hyperfast</option>
            <option value="fast">Fast</option>
            <option value="normal">Normal</option>
            <option value="slow">Slow</option>
            <option value="reallyslow">Really slow</option>
          </select>
        </label> {}
        <label class="optgroup">
          Sound:<br />
          <select name="sound" class="button" onChange={this.changeSound} value={BattleSound.muted ? 'off' : BattleSound.bgmVolume ? 'on' : 'musicoff'}>
            <option value="on">On</option>
            <option value="musicoff">Music Off</option>
            <option value="off">Muted</option>
          </select>
        </label> {}
        <label class="optgroup">
          Dark mode:<br />
          <select name="darkmode" class="button" onChange={this.changeDarkMode} value={PSReplays.darkMode}>
            <option value="auto">Automatic</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label> {}
        <label class="optgroup">
          Viewpoint:<br />
          <button onClick={this.switchViewpoint} name="viewpoint" class={this.battle ? 'button' : 'button disabled'}>
            {(this.battle?.viewpointSwitched ? this.result?.players[1] : this.result?.players[0] || "Player")} {}
            <i class="fa fa-random" aria-label="Switch viewpoint"></i>
          </button>
        </label>
      </p>
      {this.result ? <h1>
        <strong>{this.result.format}</strong>: {this.result.players.join(' vs. ')}
      </h1> : <h1>
        <em>Loading...</em>
      </h1>}
      {this.result ? <p>
        <a class="button" href="#" onClick={this.clickDownload} style={{float: 'right'}}>
          <i class="fa fa-download" aria-hidden></i> Download
        </a>
        {this.result.uploadtime ? new Date(this.result.uploadtime * 1000).toDateString() : "Unknown upload date"}
        {this.result.rating ? [` | `, <em>Rating:</em>, ` ${this.result.rating}`] : ''}
        {/* {} <code>{this.keyCode}</code> */}
      </p> : <p>&nbsp;</p>}
      {!PSRouter.showingLeft() && <p>
        <a href={PSRouter.leftLoc || '.'} class="button"><i class="fa fa-caret-left"></i> More replays</a>
      </p>}
    </div>;
  }
  override render() {
    let position: any = {};
    if (PSRouter.showingLeft()) {
      if (PSRouter.stickyRight) {
        position = {position: 'sticky', top: '0'};
      } else {
        position = {position: 'sticky', bottom: '0'};
      }
    }

    if (this.result === null) return this.renderError(position);

    return <div class={PSRouter.showingLeft() ? 'mainbar has-sidebar' : 'mainbar'} style={position}><div style={{position: 'relative'}}>
      <BattleDiv />
      <BattleLogDiv />
      {this.renderControls()}
      <div id="LeaderboardBTF"></div>
    </div></div>;
  }
}
