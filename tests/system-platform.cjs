// Explicit platform fixtures shared by playback tests. No native window/session claim.
const assert = require('node:assert/strict');
const state = { sessions: [], windows: [], nodes: [], calls: [], capabilities: {}, enabled: true,
  context: { abilityInfo: { bundleName: 'com.cineisle.app', name: 'EntryAbility' } } };
class Session {
  constructor() { this.handlers = {}; this.metadata = []; this.states = []; this.destroyed = 0; this.activations = 0; }
  on(event, fn) { this.handlers[event] = fn; }
  async emit(event, value) { return this.handlers[event]?.(value); }
  async setAVMetadata(value) { this.metadata.push(value); if (state.metadataWait) await state.metadataWait; }
  async setAVPlaybackState(value) { this.states.push(value); }
  async setLaunchAbility(agent) { this.agent = agent; }
  async activate() { if (state.failSession) throw new Error('activate failed'); this.activations++; this.active = true; }
  async deactivate() { this.active = false; }
  async destroy() { if (state.failDestroySession) throw new Error('destroy failed'); this.destroyed++; this.handlers = {}; }
}
state.uiContext = () => ({ scoped: 0, runScopedTask(fn) {
  this.scoped++; const previous = state.scope; state.scope = this;
  try { fn(); } finally { state.scope = previous; }
} });
class BuilderNode {
  constructor(context) { assert.ok(context); this.context = context; this.updates = []; this.disposed = 0; state.nodes.push(this); }
  build(builder, params) { if (state.failNodeBuild) throw new Error('build failed'); this.builder = builder; this.params = { ...params }; }
  getFrameNode() { return { builderNode: this }; }
  update(params) { assert.equal(state.scope, this.context, 'updates must use PiP UIContext'); assert.equal(this.disposed, 0); if (state.failNodeUpdate) throw new Error('update failed'); this.params = { ...params }; this.updates.push(this.params); }
  dispose() { if (state.failNodeDispose) throw new Error('dispose failed'); this.disposed++; }
}
class Window {
  constructor(config) { this.config = config; this.handlers = {}; this.controls = []; this.dimensions = []; this.started = 0; this.stopped = 0; }
  on(event, fn) { this.handlers[event] = fn; }
  off(event) { delete this.handlers[event]; }
  async emit(event, ...args) { return this.handlers[event]?.(...args); }
  setAutoStartEnabled(value) { this.auto = value; }
  updatePiPControlStatus(...args) { this.controls.push(args); }
  updateContentSize(...args) { this.dimensions.push(args); }
  setPiPControlEnabled(type, enabled) { (this.enabled ||= {})[type] = enabled; }
  async startPiP() { if (state.startPiPWait) await state.startPiPWait; if (state.failPiP) throw new Error('pip rejected'); this.started++;
    this.uiContext = state.uiContext(); this.captionNode = this.config.customUIController?.makeNode(this.uiContext); await this.emit('stateChange', 2); }
  async autoEnter() { if (!this.auto) return; this.autoStarted=(this.autoStarted||0)+1; this.uiContext=state.uiContext(); this.captionNode=this.config.customUIController?.makeNode(this.uiContext); await this.emit('stateChange',2); }
  async stopPiP() { if (state.failStopPiP) throw new Error('stop PiP failed'); this.stopped++; this.config.customUIController?.aboutToDisappear(); await this.emit('stateChange', 4); }
}
state.install = platform => {
  platform.set('@ohos.arkui.node', { NodeController: class {}, BuilderNode });
  platform.set('@ohos.arkui.UIContext', {});
  platform.set('@ohos.multimedia.audio', { StreamUsage: { STREAM_USAGE_MOVIE: 10 }, InterruptHint: { INTERRUPT_HINT_PAUSE: 2, INTERRUPT_HINT_STOP: 3, INTERRUPT_HINT_RESUME: 1 } });
  platform.set('@ohos.multimedia.avsession', { PlaybackState: { PLAYBACK_STATE_BUFFERING: 11, PLAYBACK_STATE_PLAY: 2,
    PLAYBACK_STATE_PAUSE: 3, PLAYBACK_STATE_PREPARE: 1, PLAYBACK_STATE_COMPLETED: 7, PLAYBACK_STATE_STOP: 6, PLAYBACK_STATE_ERROR: 9 },
    async createAVSession(context, tag, type) { state.calls.push(['session', type]); if (state.sessionWait) await state.sessionWait; const session = new Session(); session.tag = tag; session.context = context; state.sessions.push(session); return session; } });
  platform.set('@ohos.app.ability.wantAgent', { OperationType: { START_ABILITY: 1 }, WantAgentFlags: { UPDATE_PRESENT_FLAG: 4 },
    async getWantAgent(info) { state.want = info; if (state.failWant) throw new Error('agent failed'); return { id: 'launch' }; } });
  platform.set('@ohos.resourceschedule.backgroundTaskManager', { BackgroundMode: { AUDIO_PLAYBACK: 2 },
    async startBackgroundRunning(context, mode, agent) { state.calls.push(['taskStart', mode]); assert.equal(mode, 2); assert.ok(agent); if (state.taskWait) await state.taskWait; if (state.failTask) throw new Error('grant denied'); state.taskActive = true; },
    async stopBackgroundRunning() { state.calls.push(['taskStop']); if (state.failStopTask) throw new Error('stop denied'); state.taskActive = false; } });
  platform.set('@ohos.PiPWindow', { isPiPEnabled: () => state.enabled, PiPTemplateType: { VIDEO_PLAY: 0 },
    VideoPlayControlGroup: { VIDEO_PREVIOUS_NEXT: 101, FAST_FORWARD_BACKWARD: 102 },
    PiPControlType: { VIDEO_PLAY_PAUSE: 0, VIDEO_PREVIOUS: 1, VIDEO_NEXT: 2 }, PiPControlStatus: { PLAY: 1, PAUSE: 0 },
    PiPState: { STARTED: 2, STOPPED: 4, ABOUT_TO_RESTORE: 5, ERROR: 6 },
    async create(config) { state.calls.push(['pipCreate']); assert.ok(!(config.controlGroups?.includes(101)&&config.controlGroups?.includes(102)), 'SDK PiP groups are mutually exclusive'); if(state.failCreatePiP)throw Object.assign(Error('invalid PiP configuration'),{code:401}); if (state.createPiPWait) await state.createPiPWait; const window = new Window(config); state.windows.push(window); return window; } });
  platform.set('@ohos.app.ability.UIAbility', class {});
  platform.set('@ohos.app.ability.ConfigurationConstant', { ColorMode: { COLOR_MODE_DARK: 0 }, Direction: { DIRECTION_VERTICAL:0,DIRECTION_HORIZONTAL:1,DIRECTION_NOT_SET:-1 } });
  platform.set('@ohos.window', {});
};
state.reset = () => {
  for (const key of ['failCreatePiP', 'sessionWait', 'metadataWait', 'taskWait', 'createPiPWait', 'startPiPWait', 'failSession', 'failWant', 'failTask', 'failStopTask', 'failPiP', 'failStopPiP', 'failDestroySession', 'failNodeBuild', 'failNodeUpdate', 'failNodeDispose', 'scope']) delete state[key];
  state.nodes.length = 0;
  state.sessions.length = 0; state.windows.length = 0; state.calls.length = 0; state.taskActive = false;
  state.enabled = true; for (const key of Object.keys(state.capabilities)) delete state.capabilities[key];
};
module.exports = state;
