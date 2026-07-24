import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Cancel any pending/processing jobs for this shop
  await db.job.updateMany({
    where: { shop_id: shop, status: { in: ["queued", "processing"] } },
    data: { status: "failed", error: "App uninstalled" },
  });

  return new Response();
};
