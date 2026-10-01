import { NextRequest, NextResponse } from 'next/server';
import {
  processWeatherChatMessage,
  generateGroundedWeatherAdvice,
  ChatMessageInput,
  WeatherContext,
} from '@/lib/weatherAssistant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body?.messages as ChatMessageInput[];
    const weatherContext = body?.weatherContext as WeatherContext | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid request: "messages" must be a non-empty array of chat messages.',
        },
        { status: 400 }
      );
    }

    try {
      const result = await processWeatherChatMessage(messages, weatherContext);
      return NextResponse.json(result, { status: 200 });
    } catch (chatError) {
      console.error('[API /api/chat Process Error]: Seamlessly falling back to grounded advice:', chatError);
      const fallbackReply = generateGroundedWeatherAdvice(
        messages[messages.length - 1]?.content || '',
        weatherContext
      );
      return NextResponse.json(
        {
          reply: fallbackReply,
          isOffTopic: false,
          source: 'grounded-fallback',
        },
        { status: 200 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid request payload';
    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 }
    );
  }
}
