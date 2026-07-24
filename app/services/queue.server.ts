export async function enqueueJob(shopDomain: string, payload: any) {
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!appUrl) {
    console.error("SHOPIFY_APP_URL is not set.");
    return;
  }

  // In production, this would use Upstash QStash to queue an HTTP request.
  // For local development, we mock it by fetching our own API directly.
  if (process.env.QSTASH_TOKEN) {
    // Example QStash implementation
    const qstashUrl = `https://qstash.upstash.io/v2/publish/${appUrl}/api/jobs/process`;
    await fetch(qstashUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shopDomain, ...payload }),
    });
  } else {
    console.log(`[Mock Queue] Enqueueing job for ${shopDomain}`, payload);
    // Don't await this fetch so it runs in the background
    fetch(`${appUrl}/api/jobs/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopDomain, ...payload }),
    }).catch((e) => console.error("Mock queue failed", e));
  }
}
