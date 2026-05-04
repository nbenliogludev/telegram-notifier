import { NextResponse } from 'next/server';

const producerApiUrl = process.env.PRODUCER_API_URL ?? 'http://127.0.0.1:3000';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const response = await fetch(`${producerApiUrl}/producer/telegram-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json();

    return NextResponse.json(body, {
      status: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        statusCode: 503,
        message: error instanceof Error ? error.message : 'Producer API request failed',
      },
      {
        status: 503,
      },
    );
  }
}
