export default function PrivacyPolicy() {
  return (
    <div style={{
      maxWidth: "800px",
      margin: "40px auto",
      padding: "0 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: "#202223",
      lineHeight: "1.6"
    }}>
      <h1 style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}>Privacy Policy for Compressio</h1>
      <p style={{ color: "#6d7175", fontSize: "14px", marginBottom: "32px" }}>Last updated: July 26, 2026</p>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px" }}>1. Introduction</h2>
        <p>
          Compressio ("we", "our", or "us") provides image optimization services to online merchants.
          This Privacy Policy describes how personal and store data is collected, used, and shared when you install or use the Compressio application.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px" }}>2. Information We Collect</h2>
        <p>When you install Compressio, we automatically collect certain information from your store, including:</p>
        <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
          <li>Shop domain name and unique identifier</li>
          <li>Store owner email address for service communications</li>
          <li>Product image URLs and metadata required for compression</li>
        </ul>
        <p style={{ marginTop: "12px" }}>
          We do <strong>not</strong> collect or store customer personal data, payment card details, or end-consumer browsing history.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px" }}>3. How We Use Your Information</h2>
        <p>We use the collected information solely to provide and improve the Compressio service, including:</p>
        <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
          <li>Processing, compressing, and optimizing your store's image files</li>
          <li>Managing billing, subscriptions, and usage quotas</li>
          <li>Providing merchant customer support</li>
        </ul>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px" }}>4. Data Retention & Deletion</h2>
        <p>
          We retain your store settings and image compression metadata only for as long as necessary to fulfill the service.
          If you uninstall Compressio, all associated store data is automatically deleted from our servers within 48 hours in compliance with GDPR data erasure requirements.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px" }}>5. Data Sharing & Security</h2>
        <p>
          We do not sell, rent, or trade your store data to third parties. We employ industry-standard encryption and security protocols to safeguard your store metadata.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px" }}>6. Contact Us</h2>
        <p>
          If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at
          {" "}<a href="mailto:support@designflowdigitals.com" style={{ color: "#005bd3" }}>support@designflowdigitals.com</a>.
        </p>
      </section>

      <footer style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #e1e3e5", color: "#6d7175", fontSize: "14px", textAlign: "center" }}>
        &copy; {new Date().getFullYear()} Compressio. All rights reserved.
      </footer>
    </div>
  );
}
