import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Decoupled architecture: Admin makes direct CORS requests to backend at http://localhost:5000/api
};

export default nextConfig;
