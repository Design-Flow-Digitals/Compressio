import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { 
  Page, Layout, Card, BlockStack, InlineStack, Text, Tabs, 
  Box, Divider, Icon
} from "@shopify/polaris";
import { 
  EmailIcon, ChevronDownIcon, ChevronUpIcon 
} from "@shopify/polaris-icons";

export interface FAQItem {
  id: string;
  category: "getting-started" | "optimization" | "billing" | "safety";
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: "faq-1",
    category: "optimization",
    question: "How does Compressio optimize store images?",
    answer: "Compressio re-encodes your store images using advanced libvips/Sharp compression algorithms and replaces the original file content in-place. Because it updates the file content directly, your Shopify file IDs and CDN image URLs remain exactly the same without touching your theme code.",
  },
  {
    id: "faq-2",
    category: "optimization",
    question: "Will optimizing images affect visual quality on my storefront?",
    answer: "No! Compressio uses perceptual quality encoding (default 80% quality target) to remove unnecessary metadata and invisible color data. This achieves a 50–70% reduction in file size with zero visible loss in image quality.",
  },
  {
    id: "faq-3",
    category: "getting-started",
    question: "Will my theme or store layout break after optimization?",
    answer: "Not at all. Compression happens completely behind-the-scenes at Shopify's storage level. No theme files, Liquid tags, or storefront scripts are modified.",
  },
  {
    id: "faq-4",
    category: "safety",
    question: "What happens to my original uncompressed photos?",
    answer: "Compressio never permanently deletes your original uploads. Whenever an image is optimized, an unattached backup copy suffixed with '_original' (e.g. photo_original.jpg) is preserved safely in your Shopify Admin Files library.",
  },
  {
    id: "faq-5",
    category: "getting-started",
    question: "How does automatic background optimization work?",
    answer: "When enabled in Settings, Compressio listens for Shopify product creation and update webhooks. As soon as you upload new product photos in Shopify Admin, Compressio automatically queues them for background optimization.",
  },
  {
    id: "faq-6",
    category: "optimization",
    question: "What image formats are supported?",
    answer: "Compressio supports JPEG, PNG, WebP, and animated GIFs. Additionally, PNG images without transparency can be automatically converted to WebP for up to 70% extra savings.",
  },
  {
    id: "faq-7",
    category: "billing",
    question: "Is there a limit to the number of images I can optimize?",
    answer: "The Free plan includes 100 lifetime image compressions. If your store catalog grows larger, you can upgrade to the Pro plan ($2/month) for unlimited compressions.",
  },
  {
    id: "faq-8",
    category: "safety",
    question: "Can I exclude specific images from auto-compression?",
    answer: "Yes! In the Image Library page (/app/images), click 'Exclude' on any image card or select multiple images and click 'Exclude Selected'. Excluded images are skipped during all bulk and automated compression runs.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { storeDomain: session.shop };
};

export default function SupportAndFAQ() {
  const { storeDomain } = useLoaderData<typeof loader>();

  // Category Tab State
  const [selectedTab, setSelectedTab] = useState(0);
  const categories = ["all", "getting-started", "optimization", "billing", "safety"];

  // Open Accordion State
  const [openFaqs, setOpenFaqs] = useState<Record<string, boolean>>({
    "faq-1": true, // First question open by default
  });

  const tabs = [
    { id: "all", content: "All FAQs" },
    { id: "getting-started", content: "Getting Started" },
    { id: "optimization", content: "Optimization" },
    { id: "billing", content: "Billing & Plans" },
    { id: "safety", content: "Safety & Backup" },
  ];

  const toggleFaq = (id: string) => {
    setOpenFaqs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const currentCategory = categories[selectedTab];
  const filteredFaqs = currentCategory === "all" 
    ? FAQ_DATA 
    : FAQ_DATA.filter((item) => item.category === currentCategory);

  return (
    <Page
      fullWidth
      title="Support & FAQs"
      subtitle="Find answers to common questions about Compressio or reach out to our support team."
    >
      <BlockStack gap="500">
        <Layout>
          {/* Main Column: FAQ Accordions */}
          <Layout.Section>
            <BlockStack gap="400">
              <Card padding="0">
                <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
                  <Box padding="400">
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">
                        Frequently Asked Questions
                      </Text>
                      
                      <BlockStack gap="300">
                        {filteredFaqs.map((faq) => {
                          const isOpen = Boolean(openFaqs[faq.id]);
                          return (
                            <Box 
                              key={faq.id} 
                              padding="400" 
                              background="bg-surface-secondary" 
                              borderRadius="200"
                            >
                              <BlockStack gap="300">
                                <button
                                  type="button"
                                  onClick={() => toggleFaq(faq.id)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    width: "100%",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "16px",
                                  }}
                                >
                                  <div style={{ flex: 1, paddingRight: "8px" }}>
                                    <Text as="span" variant="bodyMd" fontWeight="bold">
                                      {faq.question}
                                    </Text>
                                  </div>
                                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                                    <Icon source={isOpen ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
                                  </div>
                                </button>

                                {isOpen && (
                                  <BlockStack gap="200">
                                    <Divider />
                                    <Text as="p" variant="bodySm" tone="subdued">
                                      {faq.answer}
                                    </Text>
                                  </BlockStack>
                                )}
                              </BlockStack>
                            </Box>
                          );
                        })}
                      </BlockStack>
                    </BlockStack>
                  </Box>
                </Tabs>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Side Column: Direct Email Contact Card Only */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card padding="400">
                <BlockStack gap="300">
                  <InlineStack align="start" gap="200" blockAlign="center">
                    <Icon source={EmailIcon} tone="base" />
                    <Text as="h3" variant="headingSm">
                      Direct Email Support
                    </Text>
                  </InlineStack>

                  <Text as="p" variant="bodySm" tone="subdued">
                    Have a question, feedback, or custom request? Email our support team directly at:
                  </Text>

                  <Box padding="300" background="bg-surface-secondary" borderRadius="150">
                    <Text as="p" variant="bodySm" fontWeight="bold">
                      <a 
                        href="mailto:support@designflowdigitals.com" 
                        style={{ color: "#005bd3", textDecoration: "none" }}
                      >
                        support@designflowdigitals.com
                      </a>
                    </Text>
                  </Box>

                  <Text as="p" variant="bodyXs" tone="subdued">
                    We usually respond within 24 hours on business days.
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
