/**
 * Configuration module for WealthHub
 * Loads environment variables and provides configuration objects
 */

const getBackendUrl = () => {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  // If no env var is set, or it is set to an internal docker hostname that browsers can't resolve,
  // we fallback to the current host dynamically to support Umbrel IP-agnostic setups.
  if (envUrl && envUrl !== 'http://backend:8000') {
    return envUrl;
  }
  return typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';
};

export const config = {
  // Google Apps Script URL for data persistence
  gasUrl: import.meta.env.VITE_GAS_URL || '',
  
  // Backend API URL
  backendUrl: getBackendUrl(),
}

// Validate that required environment variables are set
if (!config.gasUrl) {
  console.warn('⚠️ VITE_GAS_URL not configured. Cloud sync will be unavailable.')
}

console.log('🔧 Config loaded:', {
  gasUrl: config.gasUrl ? '✅ Configured' : '❌ Not configured',
  backendUrl: config.backendUrl
})
