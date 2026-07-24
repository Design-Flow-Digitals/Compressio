import { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { compressImage } from "../services/compression.server";
import { createBackupFile, uploadStagedFile, replaceFile } from "../services/shopify-api.server";

export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.json();
  const { shopDomain, jobId } = payload;
  
  if (!shopDomain || !jobId) {
    return Response.json({ error: "Missing shopDomain or jobId" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { image: true, shop: true },
  });

  if (!job || !job.image) {
    return Response.json({ error: "Job or image not found" }, { status: 404 });
  }

  try {
    await prisma.job.update({ where: { id: jobId }, data: { status: "processing", started_at: new Date() } });

    const { admin } = await unauthenticated.admin(shopDomain);
    
    // We need the original CDN URL. 
    // Shopify GraphQL node query to get the file url:
    const fileQuery = await admin.graphql(
      `query { node(id: "${job.image.shopify_file_id}") { ... on MediaImage { image { url, originalSrc: url } } ... on GenericFile { url } } }`
    );
    const fileData = await fileQuery.json();
    const originalUrl = fileData.data?.node?.image?.url || fileData.data?.node?.url;

    if (!originalUrl) {
      throw new Error("Could not fetch original image URL from Shopify");
    }

    // 1. Download original
    const response = await fetch(originalUrl);
    if (!response.ok) throw new Error("Failed to download original image");
    const originalBuffer = Buffer.from(await response.arrayBuffer());
    const originalSizeKb = Math.round(originalBuffer.length / 1024);

    // 2. Create backup if it doesn't exist
    let backupFileId = job.image.backup_file_id;
    if (!backupFileId) {
      const filename = new URL(originalUrl).pathname.split("/").pop() || "image.jpg";
      const backupFilename = filename.replace(/\.([a-zA-Z]+)$/, "_original.$1");
      backupFileId = await createBackupFile(admin.graphql, originalUrl, backupFilename);
      
      await prisma.image.update({
        where: { id: job.image.id },
        data: { backup_file_id: backupFileId, original_size_kb: originalSizeKb },
      });
    }

    // 3. Compress
    const compressedBuffer = await compressImage(originalBuffer, { 
      quality: 85,
      // Could read settings from shop.settings_json here
    });
    const compressedSizeKb = Math.round(compressedBuffer.length / 1024);

    // 4. Staged Upload and Replace
    const mimeType = "image/jpeg"; // To be precise, we should determine this from output format
    const stagedUrl = await uploadStagedFile(admin.graphql, compressedBuffer, "compressed.jpg", mimeType);
    await replaceFile(admin.graphql, job.image.shopify_file_id, stagedUrl);

    // 5. Update DB
    await prisma.image.update({
      where: { id: job.image.id },
      data: { status: "optimized", compressed_size_kb: compressedSizeKb, updated_at: new Date() },
    });
    
    await prisma.shop.update({
      where: { id: job.shop.id },
      data: { compressions_used: { increment: 1 } },
    });

    await prisma.job.update({ 
      where: { id: jobId }, 
      data: { status: "completed", finished_at: new Date() } 
    });

    return Response.json({ success: true, originalSizeKb, compressedSizeKb });
  } catch (error: any) {
    console.error("Job failed", error);
    await prisma.job.update({ 
      where: { id: jobId }, 
      data: { status: "failed", error: error.message, finished_at: new Date() } 
    });
    return Response.json({ error: error.message }, { status: 500 });
  }
}

