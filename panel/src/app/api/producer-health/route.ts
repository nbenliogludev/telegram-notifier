import { NextResponse } from 'next/server';

const producerApiUrl = process.env.PRODUCER_API_URL ?? 'http://127.0.0.1:3000';

export async function GET() {
  try {
    const response = await fetch(`${producerApiUrl}/health`, {
      cache: 'no-store',
    });
    const body = await response.json();

    return NextResponse.json(body, {
      status: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unavailable',
        message: error instanceof Error ? error.message : 'Producer API is unavailable',
      },
      {
        status: 503,
      },
    );
  }
}
