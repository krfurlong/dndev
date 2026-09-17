import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
export function useQuery<T>(query: () => Promise<T>, deps: unknown[], initial: T) {
  const [value, setValue] = useState(initial),
    [error, setError] = useState('');
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (e) => setError(e instanceof Error ? e.message : String(e)),
    });
    return () => subscription.unsubscribe();
  }, deps);
  return { value, error };
}
