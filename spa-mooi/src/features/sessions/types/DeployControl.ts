/** Everything the workspace header shows of a session's preview deployment, derived once for the button and the menu. */
export interface DeployControl {
  label: string;
  /** Tooltip feedback: progress, failure or what the agent is doing. */
  hint: string | null;
  failure: string | null;
  /** The main action is unavailable right now. */
  blocked: boolean;
  /** Running or starting: the main action stops (or cancels) it. */
  canStop: boolean;
  starting: boolean;
  /** A request is in flight or the deployment is changing state. */
  loading: boolean;
  /** Deploying, running or preparing: phones keep the button in the header. */
  active: boolean;
  withLogs: boolean;
  logOpen: boolean;
  withSetup: boolean;
  setupBlocked: boolean;
  setupOpen: boolean;
  busy: boolean;
  error: string | null;
  run: () => void;
  toggleLogs: () => void;
  openSetup: () => void;
  closeSetup: () => void;
  submitSetup: (instructions: string) => void;
}
