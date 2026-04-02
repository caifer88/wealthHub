import { useState, useCallback, useEffect } from 'react';
import { StockTransaction } from '../types';
import { api } from '../services/api';

interface UseStockTransactionsReturn {
  transactions: StockTransaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (transaction: StockTransaction) => Promise<StockTransaction>;
  update: (id: string, transaction: StockTransaction) => Promise<StockTransaction>;
  delete: (id: string) => Promise<void>;
}

export const useStockTransactions = (): UseStockTransactionsReturn => {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStockTransactions();
      setTransactions(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to fetch Stock transactions';
      setError(errorMessage);
      console.error('Error fetching Stock transactions:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (transaction: StockTransaction) => {
      try {
        const result = await api.createStockTransaction(transaction);
        setTransactions((prev) => [result, ...prev]);
        return result;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to create Stock transaction';
        setError(errorMessage);
        throw e;
      }
    },
    []
  );

  const update = useCallback(
    async (id: string, transaction: StockTransaction) => {
      try {
        const result = await api.updateStockTransaction(id, transaction);
        setTransactions((prev) => prev.map((t) => (t.id === id ? result : t)));
        return result;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to update Stock transaction';
        setError(errorMessage);
        throw e;
      }
    },
    []
  );

  const delete_ = useCallback(
    async (id: string) => {
      try {
        await api.deleteStockTransaction(id);
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to delete Stock transaction';
        setError(errorMessage);
        throw e;
      }
    },
    []
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    transactions,
    loading,
    error,
    refetch,
    create,
    update,
    delete: delete_,
  };
};
