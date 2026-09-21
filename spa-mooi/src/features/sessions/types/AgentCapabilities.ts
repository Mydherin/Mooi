export interface AgentCapabilities {
  streaming: boolean;
  thinking: boolean;
  permissions: boolean;
  questions: boolean;
  interrupt: boolean;
  editableToolInput: boolean;
  cost: boolean;
}
