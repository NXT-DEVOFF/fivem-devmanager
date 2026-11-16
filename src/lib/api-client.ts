/** Client HTTP cote navigateur : erreurs normalisees, JSON systematique. */

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  requestId: string | null;

  constructor(
    message: string,
    status: number,
    code = "error",
    details: unknown = null,
    requestId: string | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const isFormData = body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        ...(isFormData ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
        ...(headers ?? {}),
      },
      ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    });
  } catch (caught) {
    // `fetch` rejette sans reponse quand le serveur est arrete ou redemarre :
    // on remplace le « Failed to fetch » brut du navigateur par un message
    // exploitable, sans masquer l'erreur d'origine.
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw new ApiError("Requete interrompue avant la reponse du serveur.", 0, "aborted");
    }
    throw new ApiError(
      "Serveur injoignable. L'application redemarre peut-etre : patientez quelques secondes puis reessayez.",
      0,
      "network_error",
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const data = (payload ?? {}) as {
      error?: string;
      code?: string;
      details?: unknown;
      message?: string;
      requestId?: string;
    };
    throw new ApiError(
      data.error ?? data.message ?? `Erreur ${response.status}`,
      response.status,
      data.code ?? "error",
      data.details ?? null,
      data.requestId ?? response.headers.get("x-request-id"),
    );
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "validation_error" && Array.isArray(error.details)) {
      const first = error.details[0] as { message?: string } | undefined;
      return first?.message ?? error.message;
    }
    if (error.status >= 500 && error.requestId) {
      return `${error.message} (reference ${error.requestId})`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue";
}
