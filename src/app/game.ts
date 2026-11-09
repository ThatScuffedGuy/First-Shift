import * as THREE from 'three';
import { HOUSE_LAYOUT as LAYOUT } from '../data/layout';
import { HOUSE_MENU } from '../data/menus';
import { languageByCode } from '../data/languages';
import { TIMING } from '../data/timing';
import { ACCIDENTS } from '../data/events';
import { MOODS } from '../data/hints';
import type { Point } from '../data/types';
import { settings, onSettingsChange, updateSettings } from '../settings';
import { createRenderer } from '../scene/renderer';
import { addLights } from '../scene/lights';
import { buildRestaurant } from '../scene/restaurant';
import { animatePerson, makeWaiter } from '../scene/characters';
import { CameraRig } from '../scene/camera';
import { TapMarker } from '../scene/tapMarker';
import { FloorView } from '../scene/floorView';
import { Pointer } from '../scene/pointer';
import { createWaiter, obstaclesOf, stepWaiter, tapDestination } from '../game/waiter';
import { placeAt } from '../game/zones';
import { formatClock } from '../game/clock';
import { Shift, type ShiftEvent } from '../game/shift';
import type { Guest } from '../game/guest';
import { chooseAction, type Act } from '../game/actions';
import { tutorialHint, type TutorialTarget } from '../game/tutorial';
import { pick } from '../game/random';
import type { Stage } from '../dialogue/conversation';
import { Keyboard } from '../input/keyboard';
import { onFloorTap } from '../input/pointer';
import { Speech } from '../audio/speech';
import { VoicePlayer, hasClip, type SpokenLine } from '../audio/voice';
import { Sfx } from '../audio/sfx';
import { Hud } from '../ui/hud';
import { ActionButton } from '../ui/actionButton';
import { Panels } from '../ui/panels';
import { Theme } from '../ui/theme';
import { Toasts } from '../ui/toasts';
import { GuestList } from '../ui/guestList';
import { TalkPanel, type TalkView } from '../ui/talkPanel';
import { BarPanel, MenuPanel, TicketPanel } from '../ui/stationPanels';
import { QuickReaction } from '../ui/qte';
import { SummaryPanel } from '../ui/summary';
import { StartScreen } from '../ui/startScreen';
import { SettingsPanel } from '../ui/settingsPanel';
import { Coachmark } from '../ui/coachmark';

const STAGE_END: Record<Stage, string> = {
  door: 'Lead the guest to a table',
  greet: 'Go get the drink',
  order: 'Write the ticket',
  checkin: 'Back to the floor',
  check: 'Back to the floor',
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * Connects the game: the shift simulation, the 3D view, the screens and the
 * audio. Each of those lives in its own module; this class only wires them.
 */
export class Game {
  // Scene
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private rig = new CameraRig(LAYOUT);
  private waiterModel = makeWaiter();
  private marker = new TapMarker();
  private pointer = new Pointer();
  private floor: FloorView;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // State
  private shift: Shift | null = null;
  private waiter = createWaiter(LAYOUT);
  private obstacles = obstaclesOf(LAYOUT);
  private talking: Guest | null = null;
  private tutorial: { on: boolean; guestId: number | null } = { on: false, guestId: null };

  // Audio
  private speech = new Speech();
  private sfx = new Sfx();
  private voice: VoicePlayer;

  // Interface
  private panels = new Panels();
  private theme = new Theme();
  private hud = new Hud();
  private action = new ActionButton();
  private toasts = new Toasts();
  private guestList = new GuestList();
  private talk: TalkPanel;
  private bar = new BarPanel(this.panels);
  private ticket = new TicketPanel(this.panels);
  private menuPanel = new MenuPanel(this.panels);
  private qte = new QuickReaction();
  private summary = new SummaryPanel(this.panels);
  private start: StartScreen;
  private settingsPanel: SettingsPanel;
  private coachmark: Coachmark;
  private keyboard: Keyboard;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    addLights(this.scene, LAYOUT);
    const restaurant = buildRestaurant(this.scene, LAYOUT);
    document.fonts?.ready.then(() => restaurant.redrawText());
    this.scene.add(this.waiterModel.root, this.marker.object, this.pointer.object, this.pointer.ring);
    this.floor = new FloorView(this.scene, LAYOUT, restaurant.tables, this.obstacles, this.waiterModel);
    this.placeWaiterAtStart();

    this.voice = new VoicePlayer(this.speech, (msg) => this.toasts.show(msg, 'bad'));
    this.talk = new TalkPanel(this.panels, {
      choose: (i) => this.choose(i),
      stepAway: () => this.stepAway(),
      next: () => this.finishTalk(),
      play: (i) => this.replay(i),
      reveal: (i) => this.reveal(i),
    });
    this.start = new StartScreen(this.panels, {
      start: () => this.startShift(),
      testSound: (report) => this.testSound(report),
      voiceStatus: () => this.voiceStatus(),
      openSettings: () => this.settingsPanel.open(() => this.start.sync()),
    });
    this.settingsPanel = new SettingsPanel(this.panels, this.theme, (report) => this.testSound(report));
    this.coachmark = new Coachmark(() => {
      this.tutorial.on = false;
      updateSettings({ tutorial: false });
    });
    this.speech.onVoicesChanged(() => this.start.sync());

    // Theme and settings
    const syncScene = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim();
      this.scene.background = new THREE.Color(bg || '#22343c');
    };
    this.theme.onChange(syncScene);
    syncScene();
    const syncSound = () => {
      this.sfx.enabled = settings.sfx;
      this.sfx.volume = settings.sfxVolume;
      const on = settings.voice || settings.sfx;
      $('soundBtn').textContent = on ? 'Sound on' : 'Sound off';
      $('soundBtn').setAttribute('aria-pressed', String(on));
      if (!settings.voice) this.voice.stop();
      if (this.talking && this.talk.isOpen) this.talk.render(this.talkView(this.talking));
    };
    onSettingsChange(syncSound);
    syncSound();

    // Top bar buttons
    $('soundBtn').addEventListener('click', () => {
      const on = settings.voice || settings.sfx;
      updateSettings({ voice: !on, sfx: !on });
    });
    $('menuBtn').addEventListener('click', () => this.menuPanel.open(this.shift?.menu ?? HOUSE_MENU, settings.lang));
    $('settingsBtn').addEventListener('click', () => this.settingsPanel.open());

    // Input
    const unlock = () => this.sfx.unlock();
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    this.keyboard = new Keyboard(() => this.canMove(), () => this.action.press());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.panels.anyOpen && this.shift && !this.qte.active) this.settingsPanel.open();
    });
    onFloorTap(canvas, this.rig.camera, () => this.canMove(), (tap) => {
      this.waiter.target = tapDestination(tap, this.waiter, LAYOUT);
      this.marker.show(this.waiter.target.x, this.waiter.target.z);
    });

    // Layout
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      const top = this.hud.element.getBoundingClientRect().bottom;
      document.documentElement.style.setProperty('--hud-bottom', `${Math.round(top + 6)}px`);
      this.rig.resize(w, h, { top, bottom: 0, left: 0, right: 0 });
      this.rig.update(0, this.waiter.x, true);
    };
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe(this.hud.element);
    resize();

    this.start.open();
    const timer = new THREE.Timer();
    this.renderer.setAnimationLoop((time) => {
      timer.update(time);
      this.frame(Math.min(0.05, timer.getDelta()), timer.getElapsed());
    });
  }

  // ------------------------------------------------------------------ Loop

  private canMove(): boolean {
    return !!this.shift && !this.shift.over && !this.panels.anyOpen && !this.qte.active;
  }

  private frame(dt: number, now: number): void {
    const shift = this.shift;
    const reduced = this.reducedMotion.matches;
    this.qte.update(performance.now());

    if (shift && this.canMove()) {
      const before = { x: this.waiter.x, z: this.waiter.z };
      this.waiter.carrying = !!shift.carrying;
      stepWaiter(this.waiter, this.keyboard.direction(), dt, LAYOUT, this.obstacles);
      const moved = Math.hypot(this.waiter.x - before.x, this.waiter.z - before.z);
      if (moved > 0 && shift.carryProgress(moved)) this.startAccident();
      shift.tick(dt * TIMING.gameRate);
    } else {
      this.waiter.moving = false;
    }

    // Action button, side list, top bar
    const act = shift && this.canMove() ? chooseAction(shift, placeAt(this.waiter, LAYOUT)) : null;
    this.action.show(act ? { label: act.label, hint: act.hint, run: act.act ? () => this.perform(act.act!) : undefined } : null);
    this.guestList.render(shift);
    this.hud.setClock(formatClock(shift?.time ?? 0, TIMING.shiftStartHour));
    if (shift) {
      this.hud.setGuests(shift.records.length, shift.total);
      this.hud.setTips(shift.tips);
    }

    // Tutorial
    const hint = shift && this.tutorial.on && !shift.over ? tutorialHint(shift, this.tutorial.guestId) : null;
    if (shift && this.tutorial.on && this.tutorial.guestId !== null && !hint) this.tutorial.on = false; // first guest is done
    this.coachmark.show(hint && !this.panels.anyOpen ? hint.text : null);
    this.pointer.show(hint && !this.panels.anyOpen ? this.targetPoint(hint.target) : null, hint?.target?.kind === 'table' ? 2.9 : 1.7);
    this.pointer.update(now, reduced);

    // 3D
    const m = this.waiterModel;
    m.root.position.set(this.waiter.x, 0, this.waiter.z);
    m.root.rotation.y = this.waiter.heading;
    animatePerson(m, { dt, speed: this.waiter.moving ? (shift?.carrying ? 4.2 : 5.2) : 0, carrying: !!shift?.carrying, reducedMotion: reduced });
    if (shift) this.floor.update(shift, this.waiter, dt, now, reduced);
    this.marker.update(dt, this.waiter.target !== null);
    this.rig.update(dt, this.waiter.x);
    this.renderer.render(this.scene, this.rig.camera);
  }

  private targetPoint(t: TutorialTarget): Point | null {
    if (!t) return null;
    if (t.kind === 'table') return this.floor.tablePoint(t.table) ?? null;
    const st = LAYOUT.stations.find((s) => s.kind === (t.kind === 'door' ? 'door' : t.kind));
    if (!st) return null;
    return t.kind === 'door' ? { x: -8.4, z: st.center.z } : { x: st.center.x, z: st.center.z + 1.2 };
  }

  private placeWaiterAtStart(): void {
    this.waiter = createWaiter(LAYOUT);
  }

  // ------------------------------------------------------------------ Shift

  private startShift(): void {
    const pack = languageByCode(settings.lang);
    this.start.close();
    this.summary.close();
    this.floor.reset();
    this.toasts.clear();
    this.placeWaiterAtStart();
    this.talking = null;
    this.tutorial = { on: settings.tutorial, guestId: null };
    const shift = new Shift({ pack, menu: HOUSE_MENU, tables: LAYOUT.tables.map((t) => t.number) });
    shift.on((e) => this.onShiftEvent(e));
    this.shift = shift;
    this.hud.setLanguage(pack.label);
    this.hud.setGuests(0, shift.total);
    this.hud.setTips(0);
    this.toasts.show(`Doors open at 6:00 PM. Guests will speak ${pack.label}. Watch the door.`);
  }

  private onShiftEvent(e: ShiftEvent): void {
    switch (e.type) {
      case 'toast':
        this.toasts.show(e.text, e.tone);
        break;
      case 'arrived':
        this.sfx.play('arrive');
        if (this.tutorial.on && this.tutorial.guestId === null) this.tutorial.guestId = e.guest.id;
        break;
      case 'orderUp':
        this.sfx.play('orderUp');
        break;
      case 'served':
        this.sfx.play(e.ok ? 'serve' : 'wrong');
        break;
      case 'answer':
        this.sfx.play(e.correct ? 'right' : 'wrong');
        break;
      case 'left':
        this.floor.guestLeft(e.guest);
        this.sfx.play(e.record.tip > 0 ? 'coins' : 'walkout');
        if (this.talking === e.guest) this.closeTalkPanel();
        break;
      case 'spill': {
        const colour = e.drinkId ? HOUSE_MENU.items.find((m) => m.id === e.drinkId)?.color ?? '#d94f6b' : '#d9822b';
        this.floor.spill(e.kind, colour, this.waiter);
        this.sfx.play('spill');
        break;
      }
      case 'saved':
        this.sfx.play('save');
        break;
      case 'moodDrop':
        break;
      case 'over':
        setTimeout(() => this.showSummary(), 1400);
        break;
    }
  }

  private showSummary(): void {
    const shift = this.shift;
    if (!shift) return;
    this.closeTalkPanel();
    this.summary.open(
      shift,
      formatClock(shift.time, TIMING.shiftStartHour),
      () => {
        this.summary.close();
        this.shift = null;
        this.floor.reset();
        this.guestList.render(null);
        this.start.open();
      },
      (text) => this.voice.say([{ text, who: 'you', voiceSeed: 0 }], this.voiceOptions()),
    );
  }

  // ------------------------------------------------------------------ Actions

  private perform(act: Act): void {
    const shift = this.shift;
    if (!shift) return;
    this.sfx.play('tap');
    const g = 'guestId' in act ? shift.guest(act.guestId) : undefined;
    switch (act.type) {
      case 'talk':
        if (g) this.openTalk(g, act.stage);
        break;
      case 'seat':
        if (g) shift.seat(g, act.table);
        break;
      case 'reassure':
        if (g) shift.reassure(g);
        break;
      case 'pickup':
        if (g) shift.pickUp(g);
        break;
      case 'ticket':
        if (g) this.openTicket(g);
        break;
      case 'bar': {
        const waiting = shift.guests.filter((x) => x.state === 'drinks' && x.table).map((x) => ({ guestId: x.id, table: x.table! }));
        if (!waiting.length) return;
        this.bar.open(waiting, shift.menu, shift.pack.code, (guestId, drinkId) => {
          const guest = shift.guest(guestId);
          if (!guest) return;
          shift.pour(guest, drinkId);
          this.sfx.play('pour');
        });
        break;
      }
      case 'serve': {
        const carry = shift.carrying;
        const guest = carry ? shift.guest(carry.guestId) : undefined;
        const openOrder = shift.serve();
        if (openOrder && guest) this.openTalk(guest, 'order');
        break;
      }
    }
  }

  private openTicket(g: Guest): void {
    const shift = this.shift!;
    this.ticket.open(g.table!, shift.menu, shift.pack.code, (dishIds, flags) => shift.sendTicket(g, dishIds, flags));
  }

  private startAccident(): void {
    this.sfx.play('alert');
    this.waiter.target = null;
    this.qte.start(pick(Math.random, ACCIDENTS), TIMING.accident.reactSeconds, (saved) => this.shift?.accident(saved));
  }

  // ------------------------------------------------------------------ Talking

  private openTalk(g: Guest, stage: Stage): void {
    const shift = this.shift!;
    const fresh = !(g.talk && g.talkStage === stage && !g.talk.done);
    shift.talk(g, stage);
    this.talking = g;
    this.talk.open(this.talkView(g));
    if (fresh) {
      const first = g.log[g.log.length - 1];
      if (first.who === 'guest') this.say([{ text: first.text, clipId: first.clipId, who: 'guest', voiceSeed: g.look }]);
    }
  }

  private talkView(g: Guest): TalkView {
    const t = g.talk;
    const over = g.mood === 0;
    return {
      title: g.table ? `Table ${g.table}` : 'At the door',
      subtitle: `${g.persona.label} · looks ${MOODS[g.mood].word}`,
      log: g.log,
      options: !over && t && !t.done ? t.turn!.options : null,
      nextLabel: over ? 'Let them go' : t?.done && g.talkStage ? STAGE_END[g.talkStage] : null,
      langCode: this.shift!.pack.code,
      showEnglish: settings.showEnglish,
      hasRecording: hasClip,
    };
  }

  private choose(i: number): void {
    const g = this.talking;
    const shift = this.shift;
    if (!g || !shift) return;
    const res = shift.answer(g, i);
    if (res.kind === 'right') {
      const lines: SpokenLine[] = [{ text: res.option.text, clipId: res.option.clipId, who: 'you', voiceSeed: 0 }];
      if (res.next) lines.push({ text: res.next.guest.text, clipId: res.next.guest.clipId, who: 'guest', voiceSeed: g.look });
      this.say(lines);
    }
    if (shift.guests.includes(g)) this.talk.render(this.talkView(g));
  }

  /** Closes the panel. A finished conversation moves on; an unfinished one can be resumed later. */
  private stepAway(): void {
    const g = this.talking;
    if (g?.talk?.done) return this.finishTalk();
    this.voice.stop();
    this.closeTalkPanel();
    if (g) this.shift?.endTalk(g);
  }

  private finishTalk(): void {
    const g = this.talking;
    const shift = this.shift;
    this.closeTalkPanel();
    if (!g || !shift) return;
    const stage = g.talkStage;
    shift.endTalk(g);
    if (stage === 'order' && g.state === 'ticket') this.openTicket(g);
  }

  private closeTalkPanel(): void {
    if (this.talk.isOpen) this.talk.close();
    this.talking = null;
  }

  private replay(i: number): void {
    const g = this.talking;
    const e = g?.log[i];
    if (!g || !e || e.who === 'coach') return;
    this.say([{ text: e.text, clipId: e.clipId, who: e.who, voiceSeed: e.who === 'you' ? 0 : g.look }]);
  }

  private reveal(i: number): void {
    const g = this.talking;
    const e = g?.log[i];
    if (!g || !e || e.who !== 'guest') return;
    e.revealed = true;
    this.talk.render(this.talkView(g));
  }

  // ------------------------------------------------------------------ Audio

  private voiceOptions() {
    const pack = this.shift?.pack ?? languageByCode(settings.lang);
    return { tag: pack.speechLang, enabled: settings.voice, volume: settings.voiceVolume, slow: settings.slow };
  }

  private say(lines: SpokenLine[]): void {
    void this.voice.say(lines, this.voiceOptions());
  }

  private voiceStatus(): { text: string; ok: boolean } {
    const pack = languageByCode(settings.lang);
    return this.speech.describe(pack.speechLang, pack.label);
  }

  /** Plays a test line and explains what happened in plain language. */
  private testSound(report: (text: string, ok: boolean) => void): void {
    this.sfx.unlock();
    this.sfx.play('orderUp');
    const pack = languageByCode(settings.lang);
    if (!this.speech.supported) return report("This browser can't read lines aloud. You'll still hear sound effects and any recorded lines.", false);
    this.voice.stop();
    let started = false;
    report('Playing a test line…', true);
    void this.speech
      .speak(pack.testLine, { tag: pack.speechLang, voiceIndex: 1, pitch: 1, rate: settings.slow ? 0.8 : 1, volume: settings.voiceVolume, onStart: () => (started = true) })
      .then((res) => {
        if (res === 'error') report(`The browser blocked speech (${this.speech.lastError || 'unknown error'}). Try Chrome, Edge or Safari, or open the game in its own tab.`, false);
        else if (started) {
          const s = this.voiceStatus();
          report(s.ok ? 'Sound works. You should have heard a greeting.' : `Sound works, but: ${s.text}`, s.ok);
        }
      });
    setTimeout(() => {
      if (!started) report('No speech started. Check your volume and your phone’s silent switch, then try again. If it still fails, open the game in Chrome, Edge or Safari.', false);
    }, 3500);
  }
}
