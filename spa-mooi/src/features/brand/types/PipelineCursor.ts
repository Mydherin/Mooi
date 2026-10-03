/** The stage on screen; `cycle` changes on every stage start, even when the same stage restarts. */
export interface PipelineCursor {
  stage: number;
  cycle: number;
}
