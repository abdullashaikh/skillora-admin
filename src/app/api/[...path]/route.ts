import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || 'http://localhost:5000';

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const targetUrl = `${BACKEND_URL}/api/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== 'host' && lowerKey !== 'connection' && lowerKey !== 'content-length') {
      headers.set(key, value);
    }
  });

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
    // @ts-expect-error duplex is needed for node fetch body streaming
    duplex: 'half',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchOptions.body = req.body;
  }

  try {
    const backendRes = await fetch(targetUrl, fetchOptions);
    const resHeaders = new Headers();
    backendRes.headers.forEach((val, key) => {
      resHeaders.set(key, val);
    });

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Backend communication error';
    return NextResponse.json(
      { error: `Gateway Proxy Error: ${message}` },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
