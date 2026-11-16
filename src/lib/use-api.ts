"use client";

import * as React from "react";
import { ApiError, apiFetch, errorMessage } from "@/lib/api-client";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Hook minimal de chargement (aucune dependance externe).
 * Les requetes obsoletes sont annulees et ignorees : une recherche rapide ou un
 * changement d'URL ne peut plus ecraser l'etat avec une reponse plus ancienne.
 */
export function useApi<T>(url: string | null, options?: { pollMs?: number }): ApiState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(url));
  const mountedRef = React.useRef(true);
  const requestRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const refresh = React.useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    try {
      const payload = await apiFetch<T>(url, { signal: controller.signal });
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setData(payload);
      setError(null);
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      if (caught instanceof ApiError && caught.code === "aborted") return;
      setError(errorMessage(caught));
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setLoading(false);
    }
  }, [url]);

  React.useEffect(() => {
    if (!url) {
      abortRef.current?.abort();
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
    return () => {
      abortRef.current?.abort();
    };
  }, [refresh, url]);

  React.useEffect(() => {
    if (!options?.pollMs || !url) return;
    const interval = setInterval(() => void refresh(), options.pollMs);
    return () => clearInterval(interval);
  }, [options?.pollMs, refresh, url]);

  return { data, error, loading, refresh, setData, setError };
}
