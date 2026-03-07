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
  // Backend API URL (Database integration)
  backendUrl: getBackendUrl(),
}

console.log('🔧 Config loaded:', {
  backendUrl: config.backendUrl
})
