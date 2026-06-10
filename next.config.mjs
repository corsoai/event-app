/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 1,
    memoryBasedWorkersCount: false,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 10,
    webpackMemoryOptimizations: true,
    workerThreads: false
  }
};

export default nextConfig;
