import prisma from "../db.server";

export interface ShopifyImageDetail {
  id: string; // shopify_file_id or local db id
  shopify_file_id: string;
  url: string;
  altText?: string;
  productTitle?: string;
  productId?: string;
  width?: number;
  height?: number;
  format?: string;
  original_size_kb?: number;
  compressed_size_kb?: number;
  status: string; // 'pending' | 'optimized' | 'excluded'
  backup_file_id?: string | null;
  created_at: Date;
}

function getFormatFromUrl(url: string): string {
  if (!url) return "JPEG";
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "PNG";
  if (clean.endsWith(".webp")) return "WEBP";
  if (clean.endsWith(".gif")) return "GIF";
  if (clean.endsWith(".svg")) return "SVG";
  return "JPEG";
}

/**
 * Webhook handler compatibility function.
 * Since images are fetched live from Shopify GraphQL, webhooks simply confirm receipt.
 */
export async function syncProductImages(shopDomain: string, shopId: string, payload: any) {
  // Live GraphQL queries pick up newly created/updated product images dynamically on load.
  return;
}

/**
 * Fetch all store images directly from Shopify Admin GraphQL API live on page load,
 * overlaying only modified/optimized records stored in our local database.
 * No unnecessary DB records are created for uncompressed/pending images!
 */
export async function fetchLiveShopifyImages(graphql: any, shopId: string): Promise<ShopifyImageDetail[]> {
  // 1. Fetch only modified/processed image metadata from local DB
  const dbImages = await prisma.image.findMany({
    where: { shop_id: shopId },
  });

  const dbMap = new Map(dbImages.map((img) => [img.shopify_file_id, img]));

  const imageList: ShopifyImageDetail[] = [];
  const seenFileIds = new Set<string>();

  // 2. Fetch live product images from Shopify GraphQL API
  try {
    const productsRes = await graphql(
      `query GetStoreProductImages {
        products(first: 50) {
          edges {
            node {
              id
              title
              images(first: 20) {
                edges {
                  node {
                    id
                    url
                    width
                    height
                    altText
                  }
                }
              }
            }
          }
        }
      }`
    );
    const pJson = await productsRes.json();
    const products = pJson.data?.products?.edges || [];

    for (const pEdge of products) {
      const productNode = pEdge.node;
      for (const imgEdge of productNode.images?.edges || []) {
        const img = imgEdge.node;
        const fileId = img.id;

        if (seenFileIds.has(fileId)) continue;
        seenFileIds.add(fileId);

        const dbRecord = dbMap.get(fileId);
        const estOriginalSize = Math.max(120, Math.min(3500, Math.floor((img.width || 1200) * (img.height || 1200) * 0.00035))) || 550;

        if (dbRecord) {
          // Compressed or Excluded image (found in DB)
          imageList.push({
            id: dbRecord.id,
            shopify_file_id: fileId,
            url: img.url,
            altText: img.altText || "",
            productTitle: productNode.title,
            productId: productNode.id,
            width: img.width,
            height: img.height,
            format: dbRecord.format || getFormatFromUrl(img.url),
            original_size_kb: dbRecord.original_size_kb || estOriginalSize,
            compressed_size_kb: dbRecord.compressed_size_kb || Math.floor(estOriginalSize * 0.4),
            status: dbRecord.status,
            backup_file_id: dbRecord.backup_file_id,
            created_at: dbRecord.created_at,
          });
        } else {
          // Live Shopify image (not in DB = default pending)
          imageList.push({
            id: fileId,
            shopify_file_id: fileId,
            url: img.url,
            altText: img.altText || "",
            productTitle: productNode.title,
            productId: productNode.id,
            width: img.width,
            height: img.height,
            format: getFormatFromUrl(img.url),
            original_size_kb: estOriginalSize,
            status: "pending",
            created_at: new Date(),
          });
        }
      }
    }
  } catch (err) {
    console.error("Error querying product images from Shopify GraphQL:", err);
  }

  // 3. Fetch live MediaImage files from Shopify GraphQL API
  try {
    const filesRes = await graphql(
      `query GetStoreMediaFiles {
        files(first: 50, query: "media_type:IMAGE") {
          edges {
            node {
              id
              createdAt
              alt
              ... on MediaImage {
                image {
                  id
                  url
                  width
                  height
                }
              }
            }
          }
        }
      }`
    );
    const fJson = await filesRes.json();
    const files = fJson.data?.files?.edges || [];

    for (const fEdge of files) {
      const node = fEdge.node;
      const mediaImg = node.image;
      if (mediaImg && mediaImg.url) {
        const fileId = node.id;
        if (seenFileIds.has(fileId)) continue;
        seenFileIds.add(fileId);

        const dbRecord = dbMap.get(fileId);
        const estOriginalSize = Math.max(100, Math.min(4000, Math.floor((mediaImg.width || 1000) * (mediaImg.height || 1000) * 0.0003))) || 450;

        if (dbRecord) {
          imageList.push({
            id: dbRecord.id,
            shopify_file_id: fileId,
            url: mediaImg.url,
            altText: node.alt || "",
            productTitle: "Store Media File",
            width: mediaImg.width,
            height: mediaImg.height,
            format: dbRecord.format || getFormatFromUrl(mediaImg.url),
            original_size_kb: dbRecord.original_size_kb || estOriginalSize,
            compressed_size_kb: dbRecord.compressed_size_kb || Math.floor(estOriginalSize * 0.4),
            status: dbRecord.status,
            backup_file_id: dbRecord.backup_file_id,
            created_at: dbRecord.created_at,
          });
        } else {
          imageList.push({
            id: fileId,
            shopify_file_id: fileId,
            url: mediaImg.url,
            altText: node.alt || "",
            productTitle: "Store Media File",
            width: mediaImg.width,
            height: mediaImg.height,
            format: getFormatFromUrl(mediaImg.url),
            original_size_kb: estOriginalSize,
            status: "pending",
            created_at: new Date(node.createdAt || Date.now()),
          });
        }
      }
    }
  } catch (err) {
    console.error("Error querying media files from Shopify GraphQL:", err);
  }

  return imageList;
}

/**
 * Upsert an Image record in DB only when a state-changing action occurs (e.g. compress or exclude).
 */
export async function upsertImageState(
  shopId: string,
  shopifyFileId: string,
  data: {
    status: string;
    original_size_kb?: number;
    compressed_size_kb?: number;
    format?: string;
    backup_file_id?: string;
  }
) {
  const existing = await prisma.image.findFirst({
    where: { shop_id: shopId, shopify_file_id: shopifyFileId },
  });

  if (existing) {
    return await prisma.image.update({
      where: { id: existing.id },
      data,
    });
  } else {
    return await prisma.image.create({
      data: {
        shop_id: shopId,
        shopify_file_id: shopifyFileId,
        ...data,
      },
    });
  }
}
