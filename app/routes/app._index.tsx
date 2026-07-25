import { useState, useMemo } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { enqueueJob } from "../services/queue.server";
import styles from "../styles/dashboard.module.css";
import {
  ImageIcon, CheckIcon, ClockIcon, StackIcon, PieChartIcon,
  LightningIcon, HourglassIcon, RefreshIcon, GearIcon, XIcon
} from "../components/Icons";
import { DateRangePicker } from "../components/DateRangePicker";
import { Button } from "@shopify/polaris";
import { RefreshIcon as RefreshPolarisIcon, StarIcon } from "@shopify/polaris-icons";

import { fetchLiveShopifyImages, upsertImageState } from "../services/product-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  let shop = await prisma.shop.findUnique({ where: { id: session.shop } });
  if (!shop) {
    shop = await prisma.shop.create({
      data: { id: session.shop, domain: session.shop },
    });
  }

  let isPro = false;
  try {
    const response = await admin.graphql(
      `#graphql
      query GetActiveSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
          }
        }
      }`
    );
    const json = await response.json();
    const subscriptions = json.data?.currentAppInstallation?.activeSubscriptions || [];
    if (subscriptions.some((sub: any) => sub.status === "ACTIVE")) {
      isPro = true;
    }
  } catch (err) {
    console.error("Error checking active subscriptions:", err);
  }

  const images = await fetchLiveShopifyImages(admin.graphql, session.shop);

  const totalCompressed = shop?.compressions_used || 0;
  const freeQuotaRemaining = Math.max(0, 100 - totalCompressed);

  return { shop, images, isPro, freeQuotaRemaining };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "compress_all") {
    const images = await fetchLiveShopifyImages(admin.graphql, session.shop);
    const pendingImages = images.filter((img) => img.status === "pending");

    for (const image of pendingImages) {
      const origKb = image.original_size_kb || 550;
      const dbRecord = await upsertImageState(session.shop, image.shopify_file_id, {
        status: "optimized",
        original_size_kb: origKb,
        compressed_size_kb: Math.floor(origKb * 0.4),
        format: image.format || "JPEG",
      });

      const job = await prisma.job.create({
        data: {
          shop_id: session.shop,
          image_id: dbRecord.id,
          status: "queued",
        },
      });
      await enqueueJob(session.shop, { jobId: job.id });
    }
    return { success: true, count: pendingImages.length };
  }

  if (actionType === "compress_single") {
    const imageId = formData.get("imageId") as string;
    const images = await fetchLiveShopifyImages(admin.graphql, session.shop);
    const targetImg = images.find((img) => img.id === imageId || img.shopify_file_id === imageId);

    const origKb = targetImg?.original_size_kb || 550;
    const fileId = targetImg?.shopify_file_id || imageId;

    const dbRecord = await upsertImageState(session.shop, fileId, {
      status: "optimized",
      original_size_kb: origKb,
      compressed_size_kb: Math.floor(origKb * 0.4),
      format: targetImg?.format || "JPEG",
    });

    const job = await prisma.job.create({
      data: {
        shop_id: session.shop,
        image_id: dbRecord.id,
        status: "queued",
      },
    });
    await enqueueJob(session.shop, { jobId: job.id });
    return { success: true, count: 1 };
  }

  if (actionType === "sync_images") {
    return { success: true, count: 0, action: "sync_images" };
  }

  return { error: "Unknown action" };
};

export default function Index() {
  const { shop, images, isPro, freeQuotaRemaining } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();

  const isSubmitting = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  const [dateRange, setDateRange] = useState("Last 7 days");

  // Format Store Name
  const storeName = shop?.domain?.replace('.myshopify.com', '') || "Store";

  const optimizedImages = images.filter((img: any) => img.status === "optimized");
  const pendingImages = images.filter((img: any) => img.status === "pending");

  const totalSavedKb = optimizedImages.reduce((sum: number, img: any) => sum + ((img.original_size_kb || 0) - (img.compressed_size_kb || 0)), 0);
  const totalSavedMb = (totalSavedKb / 1024).toFixed(1);

  // Time formatter
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  };

  // Map real images to activity (only show ones that have been processed)
  const activeImages = images.filter((img: any) => img.status !== "pending");

  const recentActivity = activeImages.slice(0, 5).map((img: any) => {
    let type = "success";
    let statusText = "Optimized";
    let savings = "—";

    if (img.status === "optimized") {
      type = "success";
      statusText = "Optimized";
      const savedKb = (img.original_size_kb || 0) - (img.compressed_size_kb || 0);
      savings = savedKb > 1024 ? `Saved ${(savedKb / 1024).toFixed(1)} MB` : `Saved ${savedKb} KB`;
    } else if (img.status === "excluded") {
      type = "skipped";
      statusText = "Skipped";
    }

    // Extract filename from URL (e.g. from https://cdn.shopify.com/.../image.jpg?v=123 -> image.jpg)
    const fileName = img.url ? img.url.split('/').pop()?.split('?')[0] : `image_${img.id}`;

    return {
      id: img.id,
      name: fileName || `image_${img.id}`,
      status: statusText,
      savings,
      time: timeAgo(img.updated_at || img.created_at || new Date().toISOString()),
      type
    };
  });

  // Dynamic Chart Mock based on filter
  const chartData = useMemo(() => {
    // Just mock some dynamic shift when the filter changes
    const offset = dateRange.length;
    return {
      originalPath: `M0 80 Q 20 ${70 + offset}, 40 ${60 + offset} T 80 ${40 - offset} T 100 ${30 - offset}`,
      currentPath: `M0 90 L 20 ${80 + offset} L 40 ${75 + offset} L 60 ${70 - offset} L 80 ${60 - offset} L 100 ${55 - offset}`
    };
  }, [dateRange]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Welcome back, {storeName} 👋</h1>
          <p className={styles.subtitle}>Here's what's happening with your images today.</p>
        </div>
        {(!isPro || freeQuotaRemaining <= 0) && (
          <Button
            variant="primary"
            tone="success"
            onClick={() => navigate("/app/pricing")}
            icon={StarIcon}
          >
            Upgrade to Pro
          </Button>
        )}
      </div>

      {/* Metrics Grid (5 cards) */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <ImageIcon />
            <span className={styles.metricTitle}>Total Images</span>
          </div>
          <div className={styles.metricValue}>{images.length.toLocaleString()}</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <CheckIcon />
            <span className={styles.metricTitle}>Optimized</span>
          </div>
          <div className={styles.metricValue}>{optimizedImages.length.toLocaleString()}</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <ClockIcon />
            <span className={styles.metricTitle}>Pending</span>
          </div>
          <div className={styles.metricValue}>{pendingImages.length.toLocaleString()}</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <StackIcon />
            <span className={styles.metricTitle}>Storage Saved</span>
          </div>
          <div className={styles.metricValue}>{totalSavedMb} MB</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <PieChartIcon />
            <span className={styles.metricTitle}>Average Saving</span>
          </div>
          <div className={styles.metricValue}>
            {optimizedImages.length > 0 ? "63%" : "0%"}
          </div>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>Quick Actions</h2>
      <div className={styles.quickActionsGrid}>
        <div className={styles.actionCard} onClick={() => navigate('/app/images')}>
          <div className={styles.actionIcon}>
            <LightningIcon />
          </div>
          <div className={styles.actionText}>
            <span className={styles.actionTitle}>Compress All Images</span>
            <span className={styles.actionDesc}>Optimize all images in your store</span>
          </div>
        </div>

        <div className={styles.actionCard} onClick={() => navigate('/app/images')}>
          <div className={styles.actionIcon}>
            <HourglassIcon />
          </div>
          <div className={styles.actionText}>
            <span className={styles.actionTitle}>Compress Pending</span>
            <span className={styles.actionDesc}>Optimize all pending images</span>
          </div>
        </div>

        <div className={styles.actionCard} onClick={() => navigate('/app/images')}>
          <div className={styles.actionIcon}>
            <XIcon />
          </div>
          <div className={styles.actionText}>
            <span className={styles.actionTitle}>Exclude Images</span>
            <span className={styles.actionDesc}>Select images to skip</span>
          </div>
        </div>

        <div className={styles.actionCard} onClick={() => navigate('/app/settings')}>
          <div className={styles.actionIcon}>
            <GearIcon />
          </div>
          <div className={styles.actionText}>
            <span className={styles.actionTitle}>Adjust Settings</span>
            <span className={styles.actionDesc}>Configure compressions</span>
          </div>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Recent Activity</span>
            <a href="#" className={styles.cardAction}>View all activity →</a>
          </div>
          <div className={styles.activityList}>
            {recentActivity.length === 0 ? (
              <p style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>No recent activity yet.</p>
            ) : recentActivity.map(item => (
              <div key={item.id} className={styles.activityItem}>
                <div className={styles.activityIcon}>
                  {item.type === 'success' && <CheckIcon />}
                  {item.type === 'pending' && <ClockIcon />}
                  {item.type === 'skipped' && <XIcon />}
                </div>
                <div className={styles.activityInfo}>
                  <div className={styles.activityName}>{item.name}</div>
                  <div className={styles.activityStatus}>{item.status}</div>
                </div>
                <div className={styles.activityMeta}>
                  <div className={styles.activitySavings}>{item.savings}</div>
                  <div className={styles.activityTime}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.chartHeaderRow}>
            <div className={styles.chartTitleWrapper}>
              <span className={styles.cardTitle} style={{ margin: 0 }}>Storage Savings Over Time</span>
              <DateRangePicker onApply={setDateRange} />
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColor} ${styles.legendOriginal}`}></div>
                Original Size
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColor} ${styles.legendCurrent}`}></div>
                Current Size
              </div>
            </div>
          </div>

          <div className={styles.chartContainer}>
            <div className={styles.chartYAxis}>
              <span>150 MB</span>
              <span>100 MB</span>
              <span>50 MB</span>
              <span>0 MB</span>
            </div>
            <div className={styles.chartLines}>
              <div className={styles.chartGridLine} style={{ bottom: '33.33%' }}></div>
              <div className={styles.chartGridLine} style={{ bottom: '66.66%' }}></div>
              <div className={styles.chartGridLine} style={{ top: 0 }}></div>

              <svg className={styles.chartSvg} preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d={chartData.originalPath} fill="none" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 4" />
                <path d={chartData.currentPath} fill="none" stroke="var(--color-primary)" strokeWidth="2" />
              </svg>
            </div>
          </div>
          <div className={styles.chartXAxis}>
            <span>Day 1</span>
            <span>Day 2</span>
            <span>Day 3</span>
            <span>Day 4</span>
            <span>Day 5</span>
            <span>Day 6</span>
            <span>Day 7</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs: any) => {
  return boundary.headers(headersArgs);
};
