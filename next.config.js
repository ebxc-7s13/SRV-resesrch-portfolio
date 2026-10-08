/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const path = require("path");

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Preserve local image support, including versioned laboratory previews.
  // AVIF first (smallest), WebP fallback: negotiated by the Next image
  // optimizer per browser support. Same pixels, fewer bytes.
  images: {
    localPatterns: [{ pathname: "/**" }],
    formats: ["image/avif", "image/webp"],
  },
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname, "src");
    return config;
  },
  // Trim barrel-import cost (notably @react-three/drei) so shared chunks
  // only include modules actually referenced. No API or visual change.
  experimental: {
    optimizePackageImports: [
      "@react-three/drei",
      "@react-three/fiber",
      "motion",
      "three",
    ],
  },
  headers: async () => {
    const routes = [
      {
        source: "/(.*)",
        headers: [
          // Prevent browsers from MIME-sniffing responses
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Block all framing (clickjacking protection)
          { key: "X-Frame-Options", value: "DENY" },          // Control referrer information leakage
          {
            key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          // Strict Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // The shared home/lab decoder needs WebAssembly. Keep this in
              // the document policy because client navigation retains the
              // starting route's CSP. JavaScript eval is still dev-only.
              isProd
                ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Images from self and data URIs only; blog rich text restricts
              // uploads to local /research/ paths via isLocalMedia(), so no
              // external image hosts are needed.
              "img-src 'self' data:",
              // Fonts from self and data URIs only
              "font-src 'self' data:",
              // Only allow API calls to self
              "connect-src 'self'",
              // Block all iframe embedding
              "frame-ancestors 'none'",
              // Restrict base tag injection
              "base-uri 'self'",
              // Forms can only submit to self
              "form-action 'self'",
              // Block object/embed tags
              "object-src 'none'",
              // Block plugin content
            ].join("; "),
          },
          // HSTS — force HTTPS for 2 years, include subdomains, enable preload
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Prevent DNS prefetching leaks
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
    routes.push({
      source: "/3d/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=3600, must-revalidate",
        },
      ],
    });
    // Research/thesis media are static files versioned by content edits, not
    // by filename: same revalidation policy as /3d, so repeat visits skip
    // redownload without ever pinning a stale copy.
    for (const source of ["/research/:path*", "/theses/:path*"]) {
      routes.push({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      });
    }
    return routes;
  },
};

module.exports = nextConfig;
