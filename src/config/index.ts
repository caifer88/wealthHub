/**
 * Configuration module for WealthHub
 * Loads environment variables and provides configuration objects
 */

const getBackendUrl = () => {
  return (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000');
};

export const config = {
  // Backend API URL
  backendUrl: getBackendUrl(),
}

console.log('🔧 Config loaded:', {
  backendUrl: config.backendUrl
})
