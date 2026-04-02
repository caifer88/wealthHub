import { useState, useEffect } from 'react'
import { StockPortfolioSummaryDTO } from '../types'
import { api } from '../services/api'

interface UseStockPortfolioReturn {
  portfolio: StockPortfolioSummaryDTO | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Custom hook to fetch and manage stock portfolio data from backend.
 *
 * This hook provides the single source of truth for portfolio metrics
 * by consuming the `/api/stocks/portfolio` endpoint.
 *
 * @returns Object with portfolio data, loading state, error, and refetch function
 *
 * @example
 * const { portfolio, loading, error, refetch } = useStockPortfolio()
 *
 * if (loading) return <div>Loading...</div>
 * if (error) return <div>Error: {error}</div>
 *
 * return (
 *   <div>
 *     <h2>Total Value: €{portfolio?.totalValueEur}</h2>
 *     <button onClick={refetch}>Update Prices</button>
 *     <table>
 *       {portfolio?.tickers.map(ticker => (
 *         <tr key={ticker.ticker}>
 *           <td>{ticker.ticker}</td>
 *           <td>{ticker.shares}</td>
 *           <td>€{ticker.currentValueEur}</td>
 *         </tr>
 *       ))}
 *     </table>
 *   </div>
 * )
 */
export const useStockPortfolio = (): UseStockPortfolioReturn => {
  const [portfolio, setPortfolio] = useState<StockPortfolioSummaryDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPortfolio = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getStockPortfolioSummary()
      setPortfolio(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch portfolio'
      setError(errorMessage)
      console.error('Error fetching portfolio:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch on component mount
  useEffect(() => {
    fetchPortfolio()
  }, [])

  return {
    portfolio,
    loading,
    error,
    refetch: fetchPortfolio
  }
}
