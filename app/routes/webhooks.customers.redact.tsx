import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`, payload);

  // Mandatory GDPR customer redact webhook
  // Compressio does not store customer personal data, so return 200 OK
  return new Response();
};
