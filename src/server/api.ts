/** Wrapper commun des Route Handlers : CSRF, erreurs, pas de cache. */
import type { NextRequest } from "next/server";
import { assertSameOrigin, json, jsonError } from "@/server/http";

type RouteContext = { params: Promise<Record<string, string>> };

export function api(
  handler: (request: NextRequest, context: RouteContext) => Promise<Response>,
) {
  return async (request: NextRequest, context: RouteContext): Promise<Response> => {
    try {
      assertSameOrigin(request);
      const response = await handler(request, context);
      if (response.headers.get("Cache-Control") === null) {
        response.headers.set("Cache-Control", "no-store");
      }
      return response;
    } catch (error) {
      return jsonError(error);
    }
  };
}

export function ok<T>(data: T, status = 200): Response {
  return json(data, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function searchParams(request: NextRequest): URLSearchParams {
  return new URL(request.url).searchParams;
}
