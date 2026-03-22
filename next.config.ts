import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = []

if (supabaseUrl) {
  try {
    const parsedUrl = new URL(supabaseUrl)

    remotePatterns.push({
      protocol: parsedUrl.protocol.replace(':', '') as 'http' | 'https',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      pathname: '/**',
    })
  } catch (error) {
    console.error('Could not parse NEXT_PUBLIC_SUPABASE_URL for image config.', error)
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
