
import path from 'path'; // path 모듈 임포트 추가
import type {NextConfig} from 'next';

// next.config.ts 파일 위치: /home/user/studio/src/
// 프로젝트 루트 위치 (예상): /home/user/studio/
// __dirname은 현재 파일의 디렉토리(/home/user/studio/src/)를 나타내므로,
// path.join(__dirname, '..')를 사용하여 프로젝트 루트(/home/user/studio/)의 절대 경로를 계산합니다.
const projectRoot = path.join(__dirname, '../'); 

const nextConfig: NextConfig = {
  /* config options here */
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
};

export default nextConfig;
