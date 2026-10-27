# STT issue: later dictations start late and lose the first words

The investigation went through two iterations. Both are kept here; the latest one comes first.

| Iteration | Status |
| --- | --- |
| **2 — engine deaf after a near-silent start** (section 0) | **Solved: confirmed in production on 2026-10-27 (commit `683d78b`)** |
| 1 — browser capture and server lock (sections 1–7, commit `cc2abb1`) | Deployed; did not solve the symptom. Its fixes stay (they remove real faults), but its browser hypothesis was not the cause |

## 0. Iteration 2: the engine goes deaf when a stream starts near-silent

Measured on the production instance with desktop Chrome and a real microphone. Every audio frame sent
by the page was recorded in the browser and replayed, paced in real time, through `/api/stt/stream`.

- **Production logs:** the server received the audio but the engine returned nothing for a long time
  (55 s of audio with no partial; 68 s with the first partial at 33 s), while `stop_to_final_ms` stayed
  at about 0.3 s. So there is no backlog and no browser stall: the engine ignores audio it has received.
- **The browser audio is good:** in the failed dictation the speech is loud from 0.9 s ("uno"), but the
  first partial is "Diez" at 6.5 s.
- **Deterministic:** replaying the failed recording always gives "Diez, once…", and the good one always
  transcribes from "1". The engine has no state that carries over between sessions.

| Replay of the failed recording | Result |
| --- | --- |
| unchanged | "Diez, once, doce, trece, catorce." |
| right after the good recording, in one stream | every word: "…un dos, tres … catorce" |
| first 0.1 s (near-silence, RMS 6) removed | every word |
| 1 s or 3 s of digital zeros in front | stuck (empty after 6 s) |
| synthetic noise at RMS 20/50 in front | stuck; RMS 100 works |
| cut exactly at the first word | works, but loses "uno" |
| **gated: from 0.2 s before the first frame with sound** | **every word** |

- **Cause** (reproduced deterministically by replay, confirmed by the production fix): a NeMo-Speech.cpp
  (`nemotron-3.5` streaming) realtime session whose first audio is near-silent stays deaf for several seconds and loses the words spoken meanwhile. Silence later in the
  stream is harmless.
- **Why only Chrome, and mostly after the first dictation** (observed, not isolated): Chrome's
  echo-cancelled capture opens with about 0.1–0.2 s of near-zero frames; the user sees the failure
  mostly once the page's shared audio engine is resumed rather than created. Safari on the Mac and on
  the phone do not show the problem.
- **Solution (server, `mic-speech` `features/dictation.py`, `_OnsetGate`):** audio is held back until the
  first frame with RMS ≥ `ONSET_RMS` (500), then forwarded with `PREROLL_BYTES` (0.2 s) before it.
  Leading silence carries no words, so nothing is lost; every client is covered, whatever its browser.
  A dictation that is only silence ends `empty` without touching the engine. The log line gains
  `lead_silence_s`.

### Production confirmation (2026-10-27, image `683d78b`)

- The user tested desktop Chrome with many start/stop dictations in a row on one page: every one
  transcribed from its first word, with no late start. Safari and the phone keep working.
- Server log of the first five dictations after the deploy:

| Audio | `lead_silence_s` | First partial | Stop to final |
| --- | --- | --- | --- |
| 5.3 s | 0.1 | 1.9 s | 0.34 s |
| 5.5 s | 0.0 | 2.6 s | 0.31 s |
| 3.4 s | 0.6 | 1.7 s | 0.43 s |
| 2.9 s | 0.1 | 1.5 s | 0.31 s |
| 6.7 s | 0.4 | 1.6 s | 0.24 s |

  Before the fix, failing dictations reached their first partial after 6.5–48 s, or never.

### Known limits

- The thresholds are empirical, from the recordings above: RMS 500 opens on every speech onset seen
  (1 570–14 000) and stays above the room noise seen (38–253). A mouse click can open the gate early,
  which was shown to be harmless. A very soft first syllable below RMS 500 would be dropped with the
  silence; the 0.2 s pre-roll covers the usual onset.
- The cause sits in the engine; the gate works around it. Re-check it when NeMo-Speech.cpp or the
  model is upgraded (replay a recording that starts near-silent without the gate).
- If a failure ever comes back, record the page's frames and replay them as in this section: the gated replay
  tells at once whether the engine or the capture is at fault.

### Cleanup after the fix (no behaviour change)

The whole pipeline was reviewed once the fix was confirmed. It was already lean, and every iteration-1
safeguard still has a job, so it stays: microphone before engine, the shared suspended engine, the
signal check with one rebuild, and the pre-ready frame queue. These guard against iOS/WebKit silence and
a dead capture, which the onset gate does not cover. Only these changed:

- **Metrics fix:** a silence-only dictation ends at once without the engine, yet it recorded a
  `stop_to_final_ms` of about 0 ms. That pulled the p50/p95 down. Only dictations whose gate opened
  are now measured.
- **Unused field:** `sampleRate` was removed from the `ready` message. The page always sends 16 kHz and
  never read it.
- **Duplication:** the socket `onerror` and `onclose` share one handler. Escape (`cancel`) is `finish`
  plus the rollback. Pointer and keyboard toggles share one `end()`. `isActive` reads only the session,
  because the state leaves `idle` only together with it.

## Iteration 1 (commit `cc2abb1`)

Status at the time: **supposed problem and proposed solution**.

- The server-side causes were reproduced and the fix was measured.
- The browser-side cause is the most likely explanation of the reported symptom, but it was not
  reproduced directly: the test container has no real microphone and no Safari.
- The browser fix was verified in headless Chromium, against the real speech service and engine, with
  injected microphone faults.
- It still has to be confirmed on a physical iPhone/iPad and on desktop Chrome with a real microphone.

## 1. Symptom

- The first dictation of a page works: tap the microphone, speak, and words appear at once.
- After a few dictations, a new one shows the red bars (recording) but no words appear for a long
  time. Then it suddenly works and transcribes correctly from that point on.
- **The words spoken during that wait are lost.**
- Reproduced by the user on iPhone/iPad and on desktop Chrome, with the built-in microphone and with
  wired headphones.
- Several earlier fixes (commits `ef18d78`, `6b6a0dc`, `88401cb`) seemed to solve it, but it came back.

What the symptom already tells us:
- Red bars mean the server session was ready.
- Lost words mean the audio never reached the server during the wait. A slow server would deliver
  those words late, not drop them.
- So the main fault is in the browser's audio capture, not in the speech engine.

## 2. Architecture involved

```
microphone ─▶ AudioContext (shared by the page) ─▶ AudioWorklet ─▶ WebSocket /api/stt/stream ─▶ mic-speech ─▶ NeMo-Speech.cpp engine
             (native rate)                       (PCM16 16 kHz)                                 (FastAPI)     (child process, local WebSocket)
```

| Part | Files |
| --- | --- |
| Browser | `spa-mooi/src/features/dictation/` (`DictationSession`, `DictationCapture`, `DictationAudioHealth`, `dictationAudio`), `spa-mooi/public/dictation-worklet.js` |
| Server | `mic-speech/src/mic_speech/features/dictation.py` |
| Engine | NeMo-Speech.cpp `serve`, started once by `mic-speech/src/mic_speech/shared/engine.py`; the model stays loaded |

- One dictation at a time per machine, enforced by a server-side lock.
- The page keeps a single AudioContext for every dictation. It is only paused between dictations.
  This was introduced because iOS could give silence on a context created after another one was
  closed.

## 3. Investigation

`mic-speech` is not part of the dev stack, so I ran the real service and the real engine (CPU build,
`nemotron-3.5` model) in a scratch setup. I used synthesized Spanish speech and measured everything
rather than guessing. Four test angles:
- **Protocol level:** a client that behaves like the page, sending audio paced in real time and timing
  each phase.
- **Engine level:** clients talking to the engine's WebSocket directly.
- **Browser level:** the production `DictationSession` code, bundled from the SPA sources, run in
  headless Chromium with a fake microphone playing speech. I also injected faults, such as a
  microphone that delivers only zeros.
- **Load:** full CPU saturation, to imitate a server that is also running coding agents and Docker builds.

### Measured results

| Scenario | Result |
| --- | --- |
| 8–10 normal dictations in a row (server and browser) | Stable, about 0.9–1.8 s to the first words, no drift |
| Cancelled dictations, then a normal one | Stable |
| 20 s idle between dictations | Stable |
| Engine CPU between dictations | 0%: no leaked engine work |
| Engine: 5 sockets at once | The 5th hangs in the handshake. The engine serves at most **4** realtime sockets (`--threads 4`). An aborted socket frees its slot quickly |
| Engine: graceful close while it is still behind real time | It answers the close only **after transcribing its backlog** (the client waited its full 10 s timeout) |
| Engine: graceful close in normal conditions | Instant |
| **Dictation dropped mid-recording under CPU load, then a new one** | **The next dictation is rejected with "Dictation is busy" (4 out of 4 runs)** |

I could not reproduce the browser-side stall in Chromium with a fake device. That device has no real
audio route to change. WebKit could not run in the container because of missing system libraries.

## 4. Supposed root causes

### 4.1 Browser (supposed main cause of the reported symptom; deduced, not reproduced)

Why this is the most likely cause:
- It explains every reported fact: only later dictations fail, red bars are shown, the first words are
  lost, and it happens on both iOS and desktop Chrome.
- The server-side tests ruled out a server backlog: that would deliver the words late, not drop them.

1. **The shared audio engine was resumed before the microphone opened.**
   - `DictationSession.start()` called `resumeDictationAudio()` before `getUserMedia`.
   - The button's pointer-up handler also resumed the engine when no capture owned it yet.
   - Opening the microphone changes the audio route: the iOS audio session switches to play-and-record,
     and on desktop Chrome the input is echo-cancelled.
   - An engine already running across that change can deliver silence or stop processing.
   - The first dictation never hit this: the engine did not exist yet, so it was created *after* the
     microphone was open. That is why only later dictations failed.
2. **"Recording" did not mean audio was flowing.**
   - The red bars appeared when the *server* said `ready`.
   - The microphone was connected to the worklet only at that moment.
   - Nothing checked that real samples were arriving.
3. **Detection and recovery were slow and weak.**
   - The health check reacted after 3 s without signal (with 500 ms frames).
   - Its recovery paused and resumed the *same* engine (`restartDictationAudio`). That was the very
     state that had failed.
   - Everything said meanwhile was lost.

### 4.2 Server (secondary; reproduced and confirmed)

1. **No grace period on the lock.**
   - A dictation the browser had abandoned is only noticed after its queued audio frames are processed.
   - Any new dictation arriving in that window was rejected at once with `busy`.
   - This happens on the composer's normal paths: Send while recording, Escape, tab hidden.
2. **Release waited on the engine.**
   - `release()` awaited the engine socket's graceful close, holding the lock (default close timeout 10 s).
   - Under CPU load the engine acknowledges the close only after transcribing its backlog.

## 5. Proposed solution

The browser changes remove the supposed cause (the engine is never resumed before the microphone).
They also make the fix robust if that diagnosis is incomplete:
- the recording state is only shown once audio is heard;
- audio captured before the server is ready is buffered;
- a dead capture is detected quickly and rebuilt automatically.

### 5.1 Browser

**`lib/DictationCapture.ts` (new)** handles one microphone capture: stream → shared engine → worklet → frames.
- **The order is always: microphone first, then the audio engine** (`openMicrophone()` then
  `startAudio()`). Every dictation follows the proven path of the first one.
- `resume()` (user activation) only acts once the capture owns the engine, never before the microphone.
- `stop()` releases the microphone at once and resolves after the worklet's buffered tail (capped at 250 ms).
- `release(discard)` frees everything. `discard = true` closes the shared engine so the next capture
  builds a fresh one.

**`lib/DictationSession.ts` (rewritten around the capture)** keeps the protocol and lifecycle only.
- The microphone is requested inside the user gesture. After that, the WebSocket and the audio start
  run **in parallel**.
- Frames captured before the server is `ready` are **queued and sent on ready**, so no spoken word is lost.
- `onReady` (red bars) fires only when **the server is ready and real signal was heard**, whichever
  comes last. Until then the spinner stays.
- A capture without signal is **rebuilt once**, with a new microphone stream and a fresh audio engine
  (the first-dictation path). If that also fails, a clear error is shown (`audioNoSignal`). The next
  tap starts clean.
- The maximum-length timer subtracts audio already captured before recording was announced, matching
  the server's own count.

**`lib/DictationAudioHealth.ts`**
- A fresh capture must deliver signal within **1.5 s** (it was 3 s).
- While recording, 3 s without signal is treated as a stall.
- There is one recovery per dictation, held to the start deadline. A second miss fails.
- `frame()` returns whether the frame had signal. An `active` flag ignores a recovery that finishes
  after the dictation ended.

**`lib/dictationAudio.ts`**
- Removed `resumeDictationAudio` (it resumed before the microphone) and `restartDictationAudio` (the
  pause/resume cycle of a failed engine).

**`public/dictation-worklet.js`**
- Frames are **100 ms** instead of 500 ms, so the first words and the signal check come sooner.
- The server still accepts up to 500 ms per frame.

### 5.2 Server (`mic-speech/src/mic_speech/features/dictation.py`)

- The `_busy` flag is replaced by an `asyncio.Lock`. A new dictation waits up to `LOCK_WAIT_SECONDS = 3`
  for the previous one to be released, and only then answers `busy` (close code 1013).
- The engine socket is opened with `close_timeout = ENGINE_CLOSE_TIMEOUT_SECONDS = 1`. An abandoned
  session therefore never holds the lock while the engine works through its backlog: after 1 s the
  connection is dropped, which frees the engine slot quickly (measured).
- The protocol and module docs are updated. The browser protocol is unchanged.

## 6. Verification (after the fix, in headless Chromium with a fake microphone)

| Scenario | Before | After |
| --- | --- | --- |
| Normal dictations in a row (Chromium) | about 1.8 s from click to first words | **about 1.4 s**, stable; recording shown about 120 ms after the click, once audio is heard |
| First capture delivers only silence | Red bars, words lost, recovery after 3 s or more | **Spinner stays**, capture rebuilt automatically, recording at about 1.6 s, full transcription |
| Both captures silent | Red bars and a long wait | **Clear error at about 3 s**; the next dictation works |
| Dictation dropped mid-recording under full CPU load, then a new one | **4/4 rejected as busy** | **All succeed**: the new one waits about 0.4 s, its audio is buffered, no words lost |
| Second dictation while another is really live | Immediate `busy` | `busy` after 3 s (correct) |
| Second dictation while the previous one is ending | Immediate `busy` | Waits about 1 s, then `ready` |
| 100 ms vs 500 ms frames under load | — | Same finalization time; no extra engine cost |

- The SPA type check (`bun run typecheck`) passes, and `mic-speech` imports cleanly.
- Under full CPU load, finalization takes 3–5 s whatever the frame size. That cost is CPU contention on
  the engine, not this fix.

## 7. Still to confirm and known limits

- **To confirm on real devices:** iPhone/iPad (Safari and the installed app) and desktop Chrome with a
  real microphone, over several dictations in a row. Expected:
  - the spinner while the microphone starts;
  - red bars only once you are actually being heard;
  - no lost first words;
  - no slow later dictations.
- If a device still fails, the new behaviour makes it visible. You get an `audioNoSignal` error after
  one automatic rebuild, never a silent recording.
- **Scalability (not changed):** dictation is one-at-a-time per Mooi server, and the engine allows at
  most 4 realtime sockets. Several users dictating at once get `busy` after 3 s. Serving concurrent
  users needs a decision on engine concurrency (threads and state slots) and on CPU budget.
- **CPU contention:** on a loaded server the CPU engine falls behind real time, so finalizing takes
  longer. Giving `mic-speech` reserved CPU in production would help.
