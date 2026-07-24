import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { 
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, Select, 
  Checkbox, Banner, Badge, Box, Divider, Icon
} from "@shopify/polaris";
import { CheckIcon, AlertCircleIcon, ShieldCheckMarkIcon } from "@shopify/polaris-icons";

export interface AppSettings {
  quality: string;
  convertPng: boolean;
  maxDimension: string;
  autoCompressNew: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  quality: "Balanced",
  convertPng: true,
  maxDimension: "2048",
  autoCompressNew: true,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;

  let shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    shop = await prisma.shop.create({
      data: { id: shopId, domain: shopId },
    });
  }

  let parsedSettings: AppSettings = DEFAULT_SETTINGS;
  if (shop.settings_json) {
    try {
      parsedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(shop.settings_json) };
    } catch (e) {
      parsedSettings = DEFAULT_SETTINGS;
    }
  }

  const compressionsUsed = shop.compressions_used || 0;
  const compressionsLimit = 100;
  const compressionsRemaining = Math.max(0, compressionsLimit - compressionsUsed);

  return { 
    settings: parsedSettings,
    shopDomain: shop.domain,
    plan: shop.plan,
    compressionsUsed,
    compressionsRemaining,
    compressionsLimit,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const quality = (formData.get("quality") as string) || "Balanced";
  const convertPng = formData.get("convertPng") === "true";
  const maxDimension = (formData.get("maxDimension") as string) || "2048";
  const autoCompressNew = formData.get("autoCompressNew") === "true";
  
  const updatedSettings: AppSettings = {
    quality,
    convertPng,
    maxDimension,
    autoCompressNew,
  };
  
  await prisma.shop.update({
    where: { id: session.shop },
    data: { settings_json: JSON.stringify(updatedSettings) },
  });
  
  return { success: true, settings: updatedSettings };
};

export default function Settings() {
  const { 
    settings, shopDomain, plan, compressionsUsed, compressionsRemaining, compressionsLimit 
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  
  const [quality, setQuality] = useState(settings.quality);
  const [convertPng, setConvertPng] = useState(settings.convertPng);
  const [maxDimension, setMaxDimension] = useState(settings.maxDimension);
  const [autoCompressNew, setAutoCompressNew] = useState(settings.autoCompressNew);

  const isSubmitting = ["loading", "submitting"].includes(fetcher.state);

  const handleSave = () => {
    fetcher.submit(
      { 
        quality, 
        convertPng: String(convertPng),
        maxDimension,
        autoCompressNew: String(autoCompressNew),
      },
      { method: "POST" }
    );
    shopify.toast.show("Settings saved successfully");
  };

  return (
    <Page
      title="Settings"
      subtitle="Configure compression quality, image size limits, and format optimization rules."
      titleMetadata={
        <Badge tone={compressionsRemaining > 10 ? "info" : "warning"}>
          {`${compressionsRemaining} of ${compressionsLimit} free compressions left`}
        </Badge>
      }
    >
      <BlockStack gap="500">
        <Layout>
          {/* Main Settings Form Column */}
          <Layout.Section>
            <BlockStack gap="400">
              {/* Compression Quality Card */}
              <Card padding="500">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Compression Quality
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Set the target compression preset. Higher compression yields smaller file sizes with visually lossy encoding.
                  </Text>

                  <Select
                    label="Quality Preset"
                    options={[
                      { label: "Balanced (Recommended — ~80% quality, 60% size reduction)", value: "Balanced" },
                      { label: "High Quality (90% quality — minimal reduction, max fidelity)", value: "High" },
                      { label: "Maximum Compression (70% quality — smallest file size)", value: "Low" },
                    ]}
                    value={quality}
                    onChange={setQuality}
                  />
                </BlockStack>
              </Card>

              {/* Format & Resizing Rules Card */}
              <Card padding="500">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Format & Resizing Rules
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Optimize file formats and cap oversized raw camera uploads.
                  </Text>

                  <BlockStack gap="300">
                    <Checkbox
                      label="Convert PNG to WebP when safe"
                      checked={convertPng}
                      onChange={setConvertPng}
                      helpText="Automatically converts non-transparent PNG product images to next-gen WebP format for up to 70% additional savings."
                    />

                    <Divider />

                    <Select
                      label="Maximum Image Dimension Cap"
                      options={[
                        { label: "2048 × 2048 px (Recommended for Shopify)", value: "2048" },
                        { label: "1920 × 1920 px (Full HD)", value: "1920" },
                        { label: "1600 × 1600 px (Medium Catalog)", value: "1600" },
                        { label: "Original (Do not resize dimensions)", value: "Original" },
                      ]}
                      value={maxDimension}
                      onChange={setMaxDimension}
                      helpText="Resizes oversized source files exceeding this dimension threshold prior to compression."
                    />
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Automation Settings Card */}
              <Card padding="500">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Automation & Detection
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Control how newly uploaded product media is handled by background workers.
                  </Text>

                  <Checkbox
                    label="Auto-compress new product image uploads"
                    checked={autoCompressNew}
                    onChange={setAutoCompressNew}
                    helpText="When enabled, Compressio webhooks will automatically queue and optimize new product photos when uploaded in Shopify Admin."
                  />
                </BlockStack>
              </Card>

              {/* Save Footer */}
              <InlineStack align="end">
                <Button 
                  variant="primary" 
                  size="large" 
                  onClick={handleSave} 
                  loading={isSubmitting}
                >
                  Save settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Layout.Section>

          {/* Side Overview & Safety Info Column */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Account Quota Summary */}
              <Card padding="400">
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Plan & Quota
                  </Text>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm" fontWeight="bold">Current Plan:</Text>
                        <Badge tone="info">{plan}</Badge>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm" fontWeight="bold">Compressions Used:</Text>
                        <Text as="span" variant="bodySm">{`${compressionsUsed} / ${compressionsLimit}`}</Text>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm" fontWeight="bold">Remaining:</Text>
                        <Text as="span" variant="bodySm" fontWeight="bold" tone={compressionsRemaining > 0 ? "success" : "critical"}>
                          {`${compressionsRemaining} left`}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Card>

              {/* Original Safekeeping Guarantee Card */}
              <Card padding="400">
                <BlockStack gap="300">
                  <InlineStack align="start" gap="200" blockAlign="center">
                    <Icon source={ShieldCheckMarkIcon} tone="success" />
                    <Text as="h3" variant="headingSm">
                      Original Safekeeping
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodyXs" tone="subdued">
                    Compressio never overwrites or deletes your original files permanently. Every time an image is optimized, an unattached backup copy ending in <strong>_original</strong> is preserved in your <strong>Shopify Admin Files</strong> library as a safety net.
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
