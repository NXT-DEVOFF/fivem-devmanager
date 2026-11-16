"use client";

import { ErrorPanel } from "@/components/system/error-panel";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <ErrorPanel
          error={error}
          reset={reset}
          title="L'application a rencontre une erreur"
        />
      </div>
    </main>
  );
}
