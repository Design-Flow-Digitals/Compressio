import { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { enqueueJob } from "../services/queue.server";

export async function action({ request }: ActionFunctionArgs) {
  // 1. Verify this request comes from our Supabase Cron or is authorized
  // Skipping auth for MVP since it's just a trigger, but in prod we'd check an API key.

  // 2. Fetch all active shops
  const activeShops = await prisma.session.findMany({
    select: { shop: true },
    distinct: ['shop'],
    where: { isOnline: false }, // We want the offline sessions to get unique active shops
  });

  // 3. For each shop, enqueue a "sync_images" job
  for (const session of activeShops) {
    // For now, we'll queue a lightweight sync job to QStash
    // In our mock queue, this will just call api.jobs.sync
    // But since api.jobs.sync doesn't exist yet, we will just log it
    console.log(`Cron: Enqueueing sync job for ${session.shop}`);
    await enqueueJob(session.shop, { action: "sync_images" });
  }

  return Response.json({ success: true, shopsEnqueued: activeShops.length });
}
