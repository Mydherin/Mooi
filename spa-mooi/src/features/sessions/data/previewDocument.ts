export const previewDocument = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Aurora checkout</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #0b0c10;
        background: #ffffff;
      }
      header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 20px;
        border-bottom: 1px solid rgba(11, 12, 16, 0.08);
      }
      .mark {
        width: 22px;
        height: 22px;
        border-radius: 7px;
        background: linear-gradient(135deg, #5b45f0, #6cb8ff);
      }
      .brand { font-weight: 600; font-size: 15px; letter-spacing: -0.01em; }
      main { padding: 24px 20px 32px; max-width: 560px; margin: 0 auto; }
      .steps { display: flex; gap: 8px; flex-wrap: wrap; }
      .step {
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        background: #f1f2f6;
        color: #5a5f6b;
      }
      .step.active { background: rgba(91, 69, 240, 0.12); color: #5b45f0; font-weight: 600; }
      h1 { font-size: 20px; letter-spacing: -0.02em; margin: 24px 0 4px; }
      p.lead { margin: 0 0 20px; font-size: 13px; color: #5a5f6b; }
      .card {
        border: 1px solid rgba(11, 12, 16, 0.09);
        border-radius: 14px;
        padding: 16px;
      }
      label { display: block; font-size: 12px; color: #5a5f6b; margin-bottom: 6px; }
      .field {
        width: 100%;
        height: 38px;
        border: 1px solid rgba(11, 12, 16, 0.12);
        border-radius: 10px;
        padding: 0 12px;
        font-size: 13px;
        background: #fbfbfd;
        margin-bottom: 14px;
      }
      .summary {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        padding-top: 12px;
        border-top: 1px solid rgba(11, 12, 16, 0.09);
      }
      .summary strong { font-size: 15px; }
      button {
        margin-top: 16px;
        width: 100%;
        height: 42px;
        border: 0;
        border-radius: 10px;
        background: #5b45f0;
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <header>
      <span class="mark"></span>
      <span class="brand">Aurora</span>
    </header>

    <main>
      <div class="steps">
        <span class="step">Address</span>
        <span class="step">Review</span>
        <span class="step active">Payment</span>
      </div>

      <h1>Payment</h1>
      <p class="lead">Last step. Your address and items are already confirmed.</p>

      <div class="card">
        <label for="card">Card number</label>
        <input id="card" class="field" value="4242 4242 4242 4242" readonly />

        <label for="expiry">Expiry</label>
        <input id="expiry" class="field" value="04 / 29" readonly />

        <div class="summary">
          <span>Total</span>
          <strong>€128.40</strong>
        </div>

        <button type="button">Pay €128.40</button>
      </div>
    </main>
  </body>
</html>`;
