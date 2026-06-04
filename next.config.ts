import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Die deutsche Landingpage ist jetzt die Startseite (/). Die frühere
      // Keyword-URL bleibt als 308 erhalten, damit bestehende Links und
      // gesammelte SEO-Signale auf die Startseite konsolidiert werden.
      {
        source: "/geschaeftsidee-validieren",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
