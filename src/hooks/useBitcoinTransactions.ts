import { useState, useCallback, useEffect } from 'react';
import { BitcoinTransaction } from '../types';
import { api } from '../services/api';

interface UseBitcoinTransactionsReturn {
  transactions: BitcoinTransaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (transaction: BitcoinTransaction) => Promise<BitcoinTransaction>;
  update: (id: string, transaction: BitcoinTransaction) => Promise<BitcoinTransaction>;
  delete: (id: string) => Promise<void>;
}

export const useBitcoinTransactions = (): UseBitcoinTransactionsReturn => {
  const [transactions, setTransactions] = useState<BitcoinTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBitcoinTransactions();
      setTransactions(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to fetch Bitcoin transactions';
      setError(errorMessage);
      console.error('Error fetching Bitcoin transactions:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (transaction: BitcoinTransaction) => {
      try {
        const result = await api.createBitcoinTransaction(transaction);
        setTransactions((prev) => [result, ...prev]);
        return result;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to create Bitcoin transaction';
        setError(errorMessage);
        throw e;
      }
    },
    []
  );

  const update = useCallback(
    async (id: string, transaction: BitcoinTransaction) => {
      try {
        const result = await api.updateBitcoinTransaction(id, transaction);
        setTransactions((prev) => prev.map((t) => (t.id === id ? result : t)));
        return result;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to update Bitcoin transaction';
        setError(errorMessage);
        throw e;
      }
    },
    []
  );

  const delete_ = useCallback(
    async (id: string) => {
      try {
        await api.deleteBitcoinTransaction(id);
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to delete Bitcoin transaction';
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
