import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useFetcher, useLoaderData } from "react-router";
import { authenticate, PRO_MONTHLY_PLAN, PRO_ANNUAL_PLAN } from "../shopify.server";
import prisma from "../db.server";
import { 
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, Badge, 
  Box, Divider, Icon, Banner
} from "@shopify/polaris";
import { 
  CheckIcon, StarIcon, ShieldCheckMarkIcon 
} from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let isPro = false;
  let activePlanName = "Free";
  let activeSubscriptionId: string | null = null;

  try {
    // Query Shopify GraphQL API for active app subscriptions
    const response = await admin.graphql(
      `#graphql
      query GetActiveSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
          }
        }
      }`
    );

    const json = await response.json();
    const subscriptions = json.data?.currentAppInstallation?.activeSubscriptions || [];
    const activeSub = subscriptions.find((sub: any) => sub.status === "ACTIVE");

    if (activeSub) {
      isPro = true;
      activePlanName = activeSub.name;
      activeSubscriptionId = activeSub.id;
    }
  } catch (err) {
    console.error("Error checking active subscriptions:", err);
  }

  // Get shop compression stats from DB using shop domain ID
  const shopData = await prisma.shop.findUnique({
    where: { id: session.shop },
  });

  const totalCompressed = shopData?.compressions_used || 0;
  const freeQuotaRemaining = Math.max(0, 100 - totalCompressed);

  return { 
    isPro, 
    activePlanName, 
    activeSubscriptionId, 
    totalCompressed, 
    freeQuotaRemaining,
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const subscriptionId = formData.get("subscriptionId") as string;

  const apiKey = process.env.SHOPIFY_API_KEY || "c096a55ea93ab53cd48a50437ee07b48";
  const returnUrl = `https://${session.shop}/admin/apps/${apiKey}/app/pricing`;

  if (intent === "upgrade_monthly" || intent === "upgrade_annual") {
    const isAnnual = intent === "upgrade_annual";
    const planName = isAnnual ? PRO_ANNUAL_PLAN : PRO_MONTHLY_PLAN;
    const amount = isAnnual ? 19.0 : 2.0;
    const interval = isAnnual ? "ANNUAL" : "EVERY_30_DAYS";

    const response = await admin.graphql(
      `#graphql
      mutation AppSubscriptionCreate(
        $name: String!
        $lineItems: [AppSubscriptionLineItemInput!]!
        $returnUrl: URL!
        $test: Boolean
      ) {
        appSubscriptionCreate(
          name: $name
          lineItems: $lineItems
          returnUrl: $returnUrl
          test: $test
        ) {
          userErrors {
            field
            message
          }
          confirmationUrl
          appSubscription {
            id
            status
          }
        }
      }`,
      {
        variables: {
          name: planName,
          returnUrl,
          test: true,
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: {
                    amount,
                    currencyCode: "USD",
                  },
                  interval,
                },
              },
            },
          ],
        },
      }
    );

    const json = await response.json();
    const data = json.data?.appSubscriptionCreate;

    if (data?.userErrors?.length > 0) {
      console.error("Subscription create userErrors:", data.userErrors);
      return { error: true, errorMessage: data.userErrors[0].message };
    }

    if (data?.confirmationUrl) {
      // Redirect merchant to Shopify payment confirmation screen
      return redirect(data.confirmationUrl, {
        headers: {
          "X-Shopify-API-Request-Failure-Reauthorize-Url": data.confirmationUrl,
        },
      });
    }
  }

  if (intent === "cancel" && subscriptionId) {
    await admin.graphql(
      `#graphql
      mutation AppSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          userErrors {
            field
            message
          }
          appSubscription {
            id
            status
          }
        }
      }`,
      {
        variables: { id: subscriptionId },
      }
    );
    return { cancelled: true };
  }

  return { success: true };
};

export default function PricingPage() {
  const { 
    isPro, 
    activePlanName, 
    activeSubscriptionId, 
    freeQuotaRemaining 
  } = useLoaderData<typeof loader>();
  
  const fetcher = useFetcher<typeof action>();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const actionError = fetcher.data && "errorMessage" in fetcher.data ? fetcher.data.errorMessage : null;

  return (
    <Page
      fullWidth
      title="Plans & Pricing"
      subtitle="Choose the right plan to optimize all your store images and accelerate page load speeds."
    >
      <BlockStack gap="500">
        {/* Action Error Banner */}
        {actionError && (
          <Banner tone="critical" title="Billing Error">
            {actionError}
          </Banner>
        )}

        {/* Active Status Banner */}
        {isPro ? (
          <Banner tone="success" title={`Active Plan: ${activePlanName}`}>
            You are currently on the <strong>{activePlanName}</strong> with unlimited image compressions enabled.
          </Banner>
        ) : (
          <Banner tone="info" title="Free Plan Active">
            You are currently using the <strong>Free Plan</strong> ({freeQuotaRemaining} / 100 free compressions left). Upgrade to Pro for unlimited image compressions!
          </Banner>
        )}

        {/* Monthly vs Annual Billing Cycle Switcher */}
        <InlineStack align="center" blockAlign="center" gap="200">
          <Text as="span" variant="bodyMd" fontWeight="bold">
            Billing Cycle:
          </Text>
          <InlineStack gap="100">
            <Button
              pressed={billingCycle === "monthly"}
              onClick={() => setBillingCycle("monthly")}
            >
              Monthly ($2/mo)
            </Button>
            <Button
              pressed={billingCycle === "annual"}
              onClick={() => setBillingCycle("annual")}
            >
              Annual ($19/yr • Save ~20%)
            </Button>
          </InlineStack>
        </InlineStack>

        {/* Pricing Cards Grid */}
        <Layout>
          {/* Free Plan Card */}
          <Layout.Section variant="oneHalf">
            <Card padding="500">
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingLg">
                    Free Plan
                  </Text>
                  {!isPro && (
                    <Badge tone="info">Current Plan</Badge>
                  )}
                </InlineStack>

                <InlineStack align="start" blockAlign="baseline" gap="100">
                  <Text as="span" variant="heading2xl">
                    $0
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    / forever
                  </Text>
                </InlineStack>

                <Text as="p" variant="bodySm" tone="subdued">
                  Ideal for small stores with essential compression needs.
                </Text>

                <Divider />

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      100 Lifetime Free Compressions
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      Standard Quality Presets
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      Convert PNG to WebP
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      Manual Bulk Compression
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      Original Backup Safekeeping
                    </Text>
                  </div>
                </div>

                <Box paddingBlockStart="300">
                  {!isPro ? (
                    <Button disabled fullWidth>
                      Current Active Plan
                    </Button>
                  ) : (
                    <Form method="POST">
                      <input type="hidden" name="intent" value="cancel" />
                      <input type="hidden" name="subscriptionId" value={activeSubscriptionId || ""} />
                      <Button submit fullWidth tone="critical">
                        Downgrade to Free
                      </Button>
                    </Form>
                  )}
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Pro Plan Card */}
          <Layout.Section variant="oneHalf">
            <Card padding="500">
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack align="start" gap="200" blockAlign="center">
                    <Text as="h2" variant="headingLg">
                      Pro Unlimited
                    </Text>
                    <Icon source={StarIcon} tone="warning" />
                  </InlineStack>
                  <Badge tone="success">Recommended</Badge>
                </InlineStack>

                <InlineStack align="start" blockAlign="baseline" gap="100">
                  <Text as="span" variant="heading2xl">
                    {billingCycle === "monthly" ? "$2" : "$19"}
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {billingCycle === "monthly" ? "/ month" : "/ year (save 20%)"}
                  </Text>
                </InlineStack>

                <Text as="p" variant="bodySm" tone="subdued">
                  For growing merchants who want automated, unlimited catalog compression.
                </Text>

                <Divider />

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm" fontWeight="bold">
                      UNLIMITED Image Compressions
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      All Quality Presets (Balanced, High, Max Savings)
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      Auto-Compress New Uploads via Webhooks
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      Priority Background Queue Processing
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      PNG-to-WebP Format Conversion
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    <Text as="span" variant="bodySm">
                      Original Backup Safekeeping & 1-Click Restore
                    </Text>
                  </div>
                </div>

                <Box paddingBlockStart="300">
                  {isPro ? (
                    <Button disabled fullWidth variant="primary">
                      Current Active Plan
                    </Button>
                  ) : (
                    <Form method="POST">
                      <input 
                        type="hidden" 
                        name="intent" 
                        value={billingCycle === "monthly" ? "upgrade_monthly" : "upgrade_annual"} 
                      />
                      <Button 
                        variant="primary" 
                        submit 
                        fullWidth
                        icon={StarIcon}
                      >
                        Upgrade to Pro
                      </Button>
                    </Form>
                  )}
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Guarantee Info Banner */}
        <Card padding="400">
          <InlineStack align="start" gap="300" blockAlign="center">
            <Icon source={ShieldCheckMarkIcon} tone="success" />
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                Shopify Billing Security & 100% Risk-Free Guarantee
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                All subscriptions are billed directly through your official Shopify invoice. Start plan immediately and cancel anytime with 1 click right inside your Shopify Admin settings.
              </Text>
            </BlockStack>
          </InlineStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
