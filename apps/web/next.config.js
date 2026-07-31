/**
 * RFC-0003: Ordering Demo frontend configuration.
 *
 * T1 只保留 Next.js 基础配置，并启用 public/ 下 SVG 参考素材；后续 Adapter、Mock Runtime 和测试工具在不改变这里的情况下扩展。
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;
