import { QueryClient } from '@tanstack/react-query'

/**
 * Configuración centralizada de React Query
 * - Caché automático de datos
 * - Invalidación smart
 * - Manejo de errores y estados de carga por defecto
 * - Sin bloqueos síncronos en localStorage
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mantener datos en caché por 5 minutos
      staleTime: 5 * 60 * 1000,
      // Reintentar fallos automáticamente (máx 3 intentos)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Garbage collect después de 10 min sin uso
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      // Reintentar mutaciones fallidas
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
})
