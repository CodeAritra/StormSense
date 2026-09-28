import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables from apps/web/.env
  const env = loadEnv(mode, process.cwd(), '');
  
  const apiUrl = env.VITE_API_URL || 'http://localhost:8000';
  
  // Extract base WS target from VITE_WS_URL or VITE_API_URL
  let wsTarget = apiUrl.replace(/^http/, 'ws');
  if (env.VITE_WS_URL) {
    try {
      const parsedWs = new URL(env.VITE_WS_URL);
      wsTarget = `${parsedWs.protocol}//${parsedWs.host}`;
    } catch {
      wsTarget = apiUrl.replace(/^http/, 'ws');
    }
  }

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT || '5173', 10),
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
