import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`, payload);

  // Mandatory GDPR shop redact webhook (triggered 48 hours after uninstall)
  // Delete all database records associated with this shop
  try {
    await db.job.deleteMany({ where: { shop_id: shop } });
    await db.image.deleteMany({ where: { shop_id: shop } });
    await db.session.deleteMany({ where: { shop } });
    await db.shop.deleteMany({ where: { id: shop } });
  } catch (err) {
    console.error(`Error performing shop redact for ${shop}:`, err);
  }

  return new Response();
};
