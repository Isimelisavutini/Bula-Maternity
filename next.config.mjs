/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    const configured = process.env.BACKEND_API_URL;
    // Keep the current deployment working until Azure has passed readiness checks.
    if (!configured) return [];
    const url = new URL(configured);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      throw new Error("BACKEND_API_URL must be an HTTPS origin (localhost HTTP is allowed for development).");
    }
    return { beforeFiles: [{ source: "/api/:path*", destination: `${url.origin}/api/:path*` }] };
  }
};

export default nextConfig;
