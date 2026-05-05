import { NextResponse } from 'next/server';

const consumerApiUrl = process.env.CONSUMER_API_URL ?? 'http://127.0.0.1:3002';

export async function GET() {
  try {
    const response = await fetch(`${consumerApiUrl}/consumer/telegram-chats`, {
      cache: 'no-store',
    });
    const body = await response.json();

    return NextResponse.json(body, {
      status: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        statusCode: 503,
        message: error instanceof Error ? error.message : 'Consumer API is unavailable',
      },
      {
        status: 503,
      },
    );
  }
}
