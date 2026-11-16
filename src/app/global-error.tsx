"use client";

/**
 * Dernier filet de securite : intercepte aussi les erreurs du RootLayout.
 * Il remplace entierement le document, donc on reste sur des styles inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#090B10",
          color: "#F8FAFC",
          fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "520px",
            border: "1px solid #252D3B",
            borderRadius: "16px",
            background: "#111722",
            padding: "28px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, color: "#818CF8", fontSize: "12px", letterSpacing: "0.12em" }}>
            ERREUR CRITIQUE
          </p>
          <h1 style={{ margin: "10px 0 0", fontSize: "20px" }}>L&apos;application doit etre rechargee</h1>
          <p style={{ margin: "10px 0 0", color: "#94A3B8", fontSize: "13px", lineHeight: 1.6 }}>
            Le socle de l&apos;interface n&apos;a pas pu demarrer. Reessayez, puis consultez les logs
            serveur si le probleme persiste.
          </p>
          {error.digest ? (
            <p style={{ margin: "12px 0 0", color: "#64748B", fontSize: "11px" }}>
              Reference : {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              height: "38px",
              padding: "0 18px",
              border: 0,
              borderRadius: "9px",
              background: "#5865F2",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recharger l&apos;application
          </button>
        </main>
      </body>
    </html>
  );
}
