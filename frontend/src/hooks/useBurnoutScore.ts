// Owned by Rishith. Live burnout score with polling.
//   const { score, loading, error, refresh } = useBurnoutScore(DEFAULT_USER_ID);
import { useCallback, useEffect, useRef, useState } from "react";
import { BurnoutResult } from "../types";
import { getScore } from "../services/api";
import { SCORE_POLL_MS } from "../services/config";

export function useBurnoutScore(userId: string, pollMs: number = SCORE_POLL_MS) {
  const [score, setScore] = useState<BurnoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getScore(userId);
      if (mounted.current) {
        setScore(data);
        setError(null);
      }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "failed to fetch score");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refresh, pollMs]);

  return { score, loading, error, refresh };
}
