/** Future adapters implement connect(), applyIntent(intent), disconnect().
 * Intent is { presetId, version: 1 }; it is NOT PWM, voltage, pixels, or a wire protocol.
 * Capabilities, two-bar mapping, discovery and acknowledgement must be negotiated
 * by a real adapter only after inspecting both bars and the LiWeBe controllers.
 */
export class SimulationAdapter {
  async connect(){ return {mode:'simulation',connected:false}; }
  async applyIntent(_intent){ return {applied:false,reason:'preview-only'}; }
  async disconnect(){}
}

// Optional pure conversion only; no physical output is performed.
export {mapLightField,UNIFORM_CAPABILITIES} from './hardware-mapping.js';
