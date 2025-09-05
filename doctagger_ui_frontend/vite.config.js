import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/graph": "http://localhost:8000",
      "/admin/upload-targets": "http://localhost:8000",
      "/me": "http://localhost:8000",
      "/tag": "http://localhost:8000",
      "/upload-to-sharepoint": "http://localhost:8000",
      "/feedback": "http://localhost:8000"
    },
    fs: { strict: false },
    historyApiFallback: true, // 👈 add this
  }
});
