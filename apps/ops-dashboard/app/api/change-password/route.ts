export async function POST(req: Request) {
  const body = await req.json();
  const opsApiUrl = process.env.NEXT_PUBLIC_OPS_API_URL;

  if (!opsApiUrl) {
    return Response.json({ error: "Server misconfiguration: API URL not set" }, { status: 500 });
  }

  let response: globalThis.Response;
  try {
    response = await fetch(`${opsApiUrl}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    return Response.json(
      { error: `Cannot reach API server. Check that ops-api is running at ${opsApiUrl}` },
      { status: 502 },
    );
  }

  const data = await response.json().catch(() => ({}));
  return Response.json(data, { status: response.status });
}
