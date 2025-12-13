import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */

  // 1. ⚠️ `eslint` 설정이 더 이상 지원되지 않으므로 이 부분을 제거했습니다.
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // 2. 🛠️ Turbopack 빌드 실패 오류를 해결하기 위해
  // 프로젝트 루트를 명시적으로 설정하는 코드를 추가했습니다.
  // 이는 Next.js 패키지(`next/package.json`)를 찾지 못하는 문제를 해결합니다.
  experimental: {
    // 프로젝트의 실제 루트 디렉토리(node_modules와 package.json이 있는 곳)로 설정합니다.
    turbopack: {
      root: '../',
    },
  },
};

export default nextConfig;