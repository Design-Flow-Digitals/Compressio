import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as AppBridgeProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";

import { authenticate } from "../shopify.server";
import { Footer } from "../components/Footer";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <PolarisProvider i18n={polarisTranslations}>
      <AppBridgeProvider embedded apiKey={apiKey}>
        <s-app-nav>
          <s-link href="/app">Dashboard</s-link>
          <s-link href="/app/images">Image Library</s-link>
          <s-link href="/app/settings">Settings</s-link>
          <s-link href="/app/pricing">Pricing</s-link>
          <s-link href="/app/support">Support & FAQ</s-link>
        </s-app-nav>
        <Outlet />
        <Footer />
      </AppBridgeProvider>
    </PolarisProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
