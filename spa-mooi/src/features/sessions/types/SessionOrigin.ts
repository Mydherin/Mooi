/** The session whose agent opened this one (`Session.origin`); its branch outlives it once it closes. */
export interface SessionOrigin {
  sessionId: string;
  branch: string;
}
