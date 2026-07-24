import { Box, InlineStack, Text, Divider } from "@shopify/polaris";

export function Footer() {
  return (
    <Box paddingBlockStart="800" paddingBlockEnd="600">
      <Box paddingBlockEnd="400">
        <Divider />
      </Box>
      <InlineStack align="center" blockAlign="center" gap="100">
        <Text as="span" variant="bodySm" tone="subdued">
          Compressio © 2026 • Made with
        </Text>
        <span style={{ color: "#e11d48", fontSize: "14px", lineHeight: "1" }} aria-label="love" role="img">
          ❤️
        </span>
        <Text as="span" variant="bodySm" tone="subdued">
          for Merchants
        </Text>
      </InlineStack>
    </Box>
  );
}

export default Footer;
