export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

export function okJson(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
    status: init.status || 200,
  });
}

export function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(init.headers || {}),
    },
    status: init.status || 200,
  });
}

export function unauthorized(): Response {
  return okJson({ error: "unauthorized" }, { status: 401 });
}
