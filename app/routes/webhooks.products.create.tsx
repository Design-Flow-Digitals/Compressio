import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { syncProductImages } from "../services/product-sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    return new Response();
  }

  // The payload for products/create and products/update is a Product object
  // which contains an 'images' array.
  await syncProductImages(shop, shop, payload);

  return new Response();
};
