/** A turn stopped on spent provider usage limits (`Session.limitsWait`); times are epoch seconds. */
export interface LimitsWait {
  /** When the last spent usage window renews; `null` when the provider did not say. */
  resetsAt: number | null;
  /** When Mooi continues the conversation by itself, if `autoResume`. */
  resumeAt: number;
  autoResume: boolean;
}
