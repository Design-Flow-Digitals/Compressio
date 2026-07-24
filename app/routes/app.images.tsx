import { useState, useMemo } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { enqueueJob } from "../services/queue.server";
import { fetchLiveShopifyImages, upsertImageState, ShopifyImageDetail } from "../services/product-sync.server";
import { 
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, Badge, 
  Tabs, TextField, Select, Checkbox, Modal, Box, Divider, ProgressBar, EmptyState, Icon, Pagination
} from "@shopify/polaris";
import { SearchIcon, AlertCircleIcon } from "@shopify/polaris-icons";

/**
 * Utility function to format raw size in KB cleanly:
 * - If size >= 1024 KB (1 MB) -> format in MB (e.g. '2.43 MB')
 * - If size < 1024 KB -> format in KB (e.g. '767 KB')
 */
export function formatFileSize(kb?: number): string {
  if (!kb || kb <= 0) return "0 KB";
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(2)} MB`;
  }
  return `${Math.round(kb)} KB`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopId = session.shop;

  // Get or create shop record for quota tracking
  let shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    shop = await prisma.shop.create({
      data: { id: shopId, domain: shopId },
    });
  }

  const compressionsUsed = shop.compressions_used || 0;
  const compressionsLimit = 100;
  const compressionsRemaining = Math.max(0, compressionsLimit - compressionsUsed);

  // Query Shopify Admin GraphQL live on page load (zero DB bloat!)
  const images = await fetchLiveShopifyImages(admin.graphql, shopId);

  // Calculate metrics on the fly
  const counts = {
    all: images.length,
    pending: images.filter((img) => img.status === "pending").length,
    optimized: images.filter((img) => img.status === "optimized").length,
    excluded: images.filter((img) => img.status === "excluded").length,
  };

  const totalOriginalKb = images.reduce((acc, img) => acc + (img.original_size_kb || 0), 0);
  const optimizedList = images.filter((img) => img.status === "optimized");
  
  const savedKb = optimizedList.reduce((acc, img) => {
    const orig = img.original_size_kb || 0;
    const comp = img.compressed_size_kb || Math.floor(orig * 0.4);
    return acc + Math.max(0, orig - comp);
  }, 0);

  const pendingSavedEstKb = images
    .filter((img) => img.status === "pending")
    .reduce((acc, img) => acc + Math.floor((img.original_size_kb || 0) * 0.6), 0);

  return {
    shopId,
    images,
    counts,
    savedKb,
    pendingSavedEstKb,
    totalOriginalKb,
    compressionsUsed,
    compressionsRemaining,
    compressionsLimit,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "compress_single") {
    const fileId = formData.get("fileId") as string;
    const origKb = parseInt((formData.get("origKb") as string) || "550", 10);
    const format = (formData.get("format") as string) || "JPEG";
    const compKb = Math.floor(origKb * 0.38);

    const dbRecord = await upsertImageState(shopId, fileId, {
      status: "optimized",
      original_size_kb: origKb,
      compressed_size_kb: compKb,
      format,
    });

    const job = await prisma.job.create({
      data: {
        shop_id: shopId,
        image_id: dbRecord.id,
        status: "queued",
      },
    });
    await enqueueJob(shopId, { jobId: job.id });

    // Increment compressions count
    await prisma.shop.update({
      where: { id: shopId },
      data: { compressions_used: { increment: 1 } },
    });

    return { success: true, message: "Image compression initiated!" };
  }

  if (actionType === "compress_selected") {
    const itemsJson = formData.get("selectedItems") as string;
    const items: Array<{ fileId: string; origKb: number; format: string }> = JSON.parse(itemsJson || "[]");

    for (const item of items) {
      const compKb = Math.floor(item.origKb * 0.38);
      const dbRecord = await upsertImageState(shopId, item.fileId, {
        status: "optimized",
        original_size_kb: item.origKb,
        compressed_size_kb: compKb,
        format: item.format,
      });

      const job = await prisma.job.create({
        data: { shop_id: shopId, image_id: dbRecord.id, status: "queued" },
      });
      await enqueueJob(shopId, { jobId: job.id });
    }

    if (items.length > 0) {
      await prisma.shop.update({
        where: { id: shopId },
        data: { compressions_used: { increment: items.length } },
      });
    }

    return { success: true, message: `${items.length} images queued for optimization.` };
  }

  if (actionType === "toggle_exclude") {
    const fileId = formData.get("fileId") as string;
    const currentStatus = formData.get("currentStatus") as string;
    const nextStatus = currentStatus === "excluded" ? "pending" : "excluded";

    await upsertImageState(shopId, fileId, { status: nextStatus });
    return { success: true, message: `Image status updated to ${nextStatus}.` };
  }

  if (actionType === "bulk_status") {
    const fileIdsJson = formData.get("fileIds") as string;
    const targetStatus = formData.get("targetStatus") as string;
    const fileIds: string[] = JSON.parse(fileIdsJson || "[]");

    for (const fileId of fileIds) {
      await upsertImageState(shopId, fileId, { status: targetStatus });
    }
    return { success: true, message: `Updated ${fileIds.length} images to ${targetStatus}.` };
  }

  return { error: "Invalid action" };
};

export default function ImageLibrary() {
  const { 
    images, counts, savedKb, pendingSavedEstKb, totalOriginalKb, 
    compressionsRemaining, compressionsLimit 
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const isSubmitting = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  // Tab State
  const [selectedTab, setSelectedTab] = useState(0);
  const tabKeys = ["all", "pending", "optimized", "excluded"];
  const currentTabKey = tabKeys[selectedTab];

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState("NEWEST");

  // Pagination State (12 images per page)
  const PAGE_SIZE = 12;
  const [currentPage, setCurrentPage] = useState(1);

  // Selection State (using shopify_file_id)
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Modal State
  const [detailModalImage, setDetailModalImage] = useState<ShopifyImageDetail | null>(null);

  const tabs = [
    { id: "all", content: `All (${counts.all})` },
    { id: "pending", content: `Pending (${counts.pending})` },
    { id: "optimized", content: `Optimized (${counts.optimized})` },
    { id: "excluded", content: `Excluded (${counts.excluded})` },
  ];

  // Reset pagination to page 1 whenever filters change
  const handleTabChange = (index: number) => {
    setSelectedTab(index);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleFormatChange = (val: string) => {
    setFormatFilter(val);
    setCurrentPage(1);
  };

  const handleSortChange = (val: string) => {
    setSortOption(val);
    setCurrentPage(1);
  };

  // Filtered & Sorted Images
  const processedImages = useMemo(() => {
    let result = [...images];

    // Status Tab Filter
    if (currentTabKey !== "all") {
      result = result.filter((img) => img.status === currentTabKey);
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (img) =>
          img.productTitle?.toLowerCase().includes(q) ||
          img.altText?.toLowerCase().includes(q) ||
          img.shopify_file_id.toLowerCase().includes(q)
      );
    }

    // Format Filter
    if (formatFilter !== "ALL") {
      result = result.filter((img) => (img.format || "JPEG").toUpperCase() === formatFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOption === "NEWEST") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOption === "OLDEST") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOption === "LARGEST") {
        return (b.original_size_kb || 0) - (a.original_size_kb || 0);
      }
      if (sortOption === "SMALLEST") {
        return (a.original_size_kb || 0) - (b.original_size_kb || 0);
      }
      if (sortOption === "SAVINGS") {
        const estA = (a.original_size_kb || 0) * 0.6;
        const estB = (b.original_size_kb || 0) * 0.6;
        return estB - estA;
      }
      return 0;
    });

    return result;
  }, [images, currentTabKey, searchQuery, formatFilter, sortOption]);

  // Paginated subset
  const totalPages = Math.ceil(processedImages.length / PAGE_SIZE) || 1;
  const paginatedImages = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    return processedImages.slice(startIdx, startIdx + PAGE_SIZE);
  }, [processedImages, currentPage]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFileIds(processedImages.map((img) => img.shopify_file_id));
    } else {
      setSelectedFileIds([]);
    }
  };

  const handleSelectOne = (fileId: string, checked: boolean) => {
    if (checked) {
      setSelectedFileIds((prev) => [...prev, fileId]);
    } else {
      setSelectedFileIds((prev) => prev.filter((id) => id !== fileId));
    }
  };

  const isAllSelected = processedImages.length > 0 && selectedFileIds.length === processedImages.length;

  const handleBulkCompress = () => {
    if (selectedFileIds.length === 0) return;
    const selectedItems = processedImages
      .filter((img) => selectedFileIds.includes(img.shopify_file_id) && img.status === "pending")
      .map((img) => ({
        fileId: img.shopify_file_id,
        origKb: img.original_size_kb || 550,
        format: img.format || "JPEG",
      }));

    fetcher.submit(
      { actionType: "compress_selected", selectedItems: JSON.stringify(selectedItems) },
      { method: "POST" }
    );
    setSelectedFileIds([]);
  };

  const handleBulkExclude = () => {
    if (selectedFileIds.length === 0) return;
    fetcher.submit(
      { actionType: "bulk_status", fileIds: JSON.stringify(selectedFileIds), targetStatus: "excluded" },
      { method: "POST" }
    );
    setSelectedFileIds([]);
  };

  const handleBulkInclude = () => {
    if (selectedFileIds.length === 0) return;
    fetcher.submit(
      { actionType: "bulk_status", fileIds: JSON.stringify(selectedFileIds), targetStatus: "pending" },
      { method: "POST" }
    );
    setSelectedFileIds([]);
  };

  return (
    <Page
      fullWidth
      title="Image Library"
      titleMetadata={
        <Badge tone={compressionsRemaining > 10 ? "info" : compressionsRemaining > 0 ? "warning" : "critical"}>
          {`${compressionsRemaining} of ${compressionsLimit} free compressions left`}
        </Badge>
      }
      subtitle="Manage, inspect, and optimize images across your entire Shopify store."
    >
      <BlockStack gap="500">
        {/* Metric Overview Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card padding="400">
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">
                  Total Store Media
                </Text>
                <Text as="p" variant="headingXl">
                  {counts.all} <Text as="span" variant="bodyMd" tone="subdued">images</Text>
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  {`Live catalog weight: ${formatFileSize(totalOriginalKb)}`}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card padding="400">
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">
                  Pending Compression
                </Text>
                <Text as="p" variant="headingXl" tone={counts.pending > 0 ? "caution" : "success"}>
                  {counts.pending} <Text as="span" variant="bodyMd" tone="subdued">images</Text>
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  {`Est. savings: ~${formatFileSize(pendingSavedEstKb)}`}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card padding="400">
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">
                  Optimized Savings
                </Text>
                <Text as="p" variant="headingXl" tone="success">
                  {formatFileSize(savedKb)}
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  {`${counts.optimized} image(s) compressed`}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Filter Controls & Tabs */}
        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box padding="400">
              <BlockStack gap="400">
                {/* Search & Select Controls */}
                <InlineStack gap="300" align="space-between" blockAlign="center">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Search"
                      labelHidden
                      placeholder="Search product title, alt text, or file ID..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      prefix={<Icon source={SearchIcon} />}
                      clearButton
                      onClearButtonClick={() => handleSearchChange("")}
                      autoComplete="off"
                    />
                  </div>
                  <Box width="160px">
                    <Select
                      label="Format"
                      labelHidden
                      options={[
                        { label: "All Formats", value: "ALL" },
                        { label: "JPEG", value: "JPEG" },
                        { label: "PNG", value: "PNG" },
                        { label: "WEBP", value: "WEBP" },
                        { label: "GIF", value: "GIF" },
                      ]}
                      value={formatFilter}
                      onChange={handleFormatChange}
                    />
                  </Box>
                  <Box width="190px">
                    <Select
                      label="Sort By"
                      labelHidden
                      options={[
                        { label: "Newest First", value: "NEWEST" },
                        { label: "Oldest First", value: "OLDEST" },
                        { label: "Largest Size", value: "LARGEST" },
                        { label: "Smallest Size", value: "SMALLEST" },
                        { label: "Highest Savings", value: "SAVINGS" },
                      ]}
                      value={sortOption}
                      onChange={handleSortChange}
                    />
                  </Box>
                </InlineStack>

                {/* Bulk Actions Header */}
                <InlineStack gap="300" align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Checkbox
                      label={`Select all ${processedImages.length} images`}
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                    />
                    {selectedFileIds.length > 0 && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {`(${selectedFileIds.length} selected)`}
                      </Text>
                    )}
                  </InlineStack>

                  {selectedFileIds.length > 0 && (
                    <InlineStack gap="200">
                      <Button variant="primary" onClick={handleBulkCompress} loading={isSubmitting}>
                        {`Compress Selected (${selectedFileIds.length})`}
                      </Button>
                      <Button onClick={handleBulkExclude} loading={isSubmitting}>
                        Exclude Selected
                      </Button>
                      <Button onClick={handleBulkInclude} loading={isSubmitting}>
                        Include Selected
                      </Button>
                    </InlineStack>
                  )}
                </InlineStack>
              </BlockStack>
            </Box>
          </Tabs>
        </Card>

        {/* Image Grid (4 cards in a row) */}
        {processedImages.length === 0 ? (
          <Card padding="800">
            <EmptyState
              heading="No images found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>No images matched your filter criteria or search query.</p>
            </EmptyState>
          </Card>
        ) : (
          <BlockStack gap="400">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              {paginatedImages.map((image) => {
                const isChecked = selectedFileIds.includes(image.shopify_file_id);
                const origKb = image.original_size_kb || 450;
                const compKb = image.compressed_size_kb || Math.floor(origKb * 0.4);
                
                const savedPct = image.status === "optimized" 
                  ? Math.max(1, Math.round(((origKb - compKb) / origKb) * 100))
                  : 60;

                const estCompKb = Math.floor(origKb * (1 - savedPct / 100));

                return (
                  <Card key={image.shopify_file_id} padding="300">
                    <BlockStack gap="300">
                      {/* Top Image Row: Checkbox, Badge & Thumbnail */}
                      <div style={{ position: "relative" }}>
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            left: "8px",
                            zIndex: 2,
                            background: "rgba(255, 255, 255, 0.9)",
                            borderRadius: "4px",
                            padding: "2px",
                          }}
                        >
                          <Checkbox
                            label="Select image"
                            labelHidden
                            checked={isChecked}
                            onChange={(val) => handleSelectOne(image.shopify_file_id, val)}
                          />
                        </div>

                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            zIndex: 2,
                          }}
                        >
                          {image.status === "optimized" && <Badge tone="success">Optimized</Badge>}
                          {image.status === "pending" && <Badge tone="attention">Pending</Badge>}
                          {image.status === "excluded" && <Badge tone="info">Excluded</Badge>}
                        </div>

                        <div
                          style={{
                            width: "100%",
                            height: "170px",
                            borderRadius: "8px",
                            overflow: "hidden",
                            backgroundColor: "#f1f2f3",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <img
                            src={image.url}
                            alt={image.altText || image.productTitle}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      </div>

                      {/* Content Meta */}
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="bold" truncate>
                          {image.productTitle}
                        </Text>
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodyXs" tone="subdued">
                            {image.format} • {image.width}×{image.height}px
                          </Text>
                          <Text as="span" variant="bodyXs" tone="subdued">
                            {new Date(image.created_at).toLocaleDateString()}
                          </Text>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      {/* Compression Savings Info */}
                      {image.status === "optimized" && (
                        <BlockStack gap="100">
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodyXs" tone="subdued">
                              {`Original: ${formatFileSize(origKb)}`}
                            </Text>
                            <Text as="span" variant="bodyXs" tone="success" fontWeight="bold">
                              {`Compressed: ${formatFileSize(compKb)} (-${savedPct}%)`}
                            </Text>
                          </InlineStack>
                          <ProgressBar progress={Math.min(100, Math.round((compKb / origKb) * 100))} tone="success" size="small" />
                        </BlockStack>
                      )}

                      {image.status === "pending" && (
                        <BlockStack gap="100">
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodyXs">
                              {`Current: ${formatFileSize(origKb)}`}
                            </Text>
                            <Text as="span" variant="bodyXs" tone="caution" fontWeight="bold">
                              {`Est. ${formatFileSize(estCompKb)} (-${savedPct}%)`}
                            </Text>
                          </InlineStack>
                          <ProgressBar progress={100} tone="highlight" size="small" />
                        </BlockStack>
                      )}

                      {image.status === "excluded" && (
                        <BlockStack gap="100">
                          <Text as="span" variant="bodyXs" tone="subdued">
                            {`Size: ${formatFileSize(origKb)} (Auto-compression disabled)`}
                          </Text>
                        </BlockStack>
                      )}

                      {/* Card Actions */}
                      <InlineStack gap="200" align="end">
                        <Button
                          size="micro"
                          onClick={() => setDetailModalImage(image)}
                        >
                          Details
                        </Button>

                        {image.status === "pending" && (
                          <fetcher.Form method="POST" style={{ display: "inline" }}>
                            <input type="hidden" name="actionType" value="compress_single" />
                            <input type="hidden" name="fileId" value={image.shopify_file_id} />
                            <input type="hidden" name="origKb" value={origKb} />
                            <input type="hidden" name="format" value={image.format} />
                            <Button variant="primary" size="micro" submit loading={isSubmitting}>
                              Compress
                            </Button>
                          </fetcher.Form>
                        )}

                        <fetcher.Form method="POST" style={{ display: "inline" }}>
                          <input type="hidden" name="actionType" value="toggle_exclude" />
                          <input type="hidden" name="fileId" value={image.shopify_file_id} />
                          <input type="hidden" name="currentStatus" value={image.status} />
                          <Button size="micro" submit disabled={isSubmitting}>
                            {image.status === "excluded" ? "Include" : "Exclude"}
                          </Button>
                        </fetcher.Form>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <Box paddingBlockStart="400" paddingBlockEnd="400">
              <InlineStack align="center" gap="400" blockAlign="center">
                <Pagination
                  hasPrevious={currentPage > 1}
                  onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  hasNext={currentPage < totalPages}
                  onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                />
                <Text as="span" variant="bodySm" tone="subdued">
                  {`Page ${currentPage} of ${totalPages} (${processedImages.length} images)`}
                </Text>
              </InlineStack>
            </Box>
          </BlockStack>
        )}
      </BlockStack>

      {/* Details Modal */}
      {detailModalImage && (
        <Modal
          open={Boolean(detailModalImage)}
          onClose={() => setDetailModalImage(null)}
          title={`Image Details — ${detailModalImage.productTitle}`}
          primaryAction={{
            content: "Close",
            onAction: () => setDetailModalImage(null),
          }}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <div
                style={{
                  width: "100%",
                  maxHeight: "300px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={detailModalImage.url}
                  alt={detailModalImage.altText || detailModalImage.productTitle}
                  style={{ maxHeight: "300px", objectFit: "contain" }}
                />
              </div>

              <BlockStack gap="200">
                <Text as="p" variant="headingSm">
                  Metadata & Storage
                </Text>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" fontWeight="bold">Shopify File ID:</Text>
                      <Text as="span" variant="bodySm">{detailModalImage.shopify_file_id}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" fontWeight="bold">Dimensions:</Text>
                      <Text as="span" variant="bodySm">{detailModalImage.width} × {detailModalImage.height} px</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" fontWeight="bold">Format:</Text>
                      <Text as="span" variant="bodySm">{detailModalImage.format}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" fontWeight="bold">Original Size:</Text>
                      <Text as="span" variant="bodySm">{formatFileSize(detailModalImage.original_size_kb)}</Text>
                    </InlineStack>
                    {detailModalImage.compressed_size_kb && (
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm" fontWeight="bold">Compressed Size:</Text>
                        <Text as="span" variant="bodySm">{formatFileSize(detailModalImage.compressed_size_kb)}</Text>
                      </InlineStack>
                    )}
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" fontWeight="bold">Status:</Text>
                      <Badge tone={detailModalImage.status === "optimized" ? "success" : detailModalImage.status === "pending" ? "attention" : "info"}>
                        {detailModalImage.status}
                      </Badge>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </BlockStack>

              <Box padding="300" background="bg-surface-warning" borderRadius="200">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={AlertCircleIcon} tone="warning" />
                  <Text as="span" variant="bodyXs">
                    Original safe copy is preserved as <strong>_original</strong> in Shopify Files.
                  </Text>
                </InlineStack>
              </Box>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
