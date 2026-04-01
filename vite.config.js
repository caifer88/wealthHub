import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    appType: 'spa',
    server: {
        port: 5173,
        open: false,
        host: '0.0.0.0',
        strictPort: true
    }
});
