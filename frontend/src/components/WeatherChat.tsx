'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChatMessage } from '@/types/chat';
import { WeatherReport, UnitSystem } from '@/types/weather';
import { WeatherContext } from '@/lib/weatherAssistant';
import ReactMarkdown from 'react-markdown';

export interface WeatherChatProps {
  locationName: string;
  weatherData?: WeatherReport | null;
  units?: UnitSystem;
}

export const QUICK_PROMPTS = [
  'Do I need an umbrella today?',
  'What should I wear?',
  'Best time for a walk?',
];

export function WeatherChat({ locationName, weatherData, units = 'metric' }: WeatherChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `Hello! I'm your WeatherGPT Assistant. Ask me anything about current weather in ${locationName}, forecast details, clothing recommendations, or outdoor planning.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of chat upon new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Construct weather context from live dashboard data
  const weatherContext: WeatherContext = useMemo(() => {
    const current = weatherData?.current;
    const hourly = weatherData?.hourly;
    const daily = weatherData?.daily;

    const hourlySummary = hourly && hourly.length > 0
      ? hourly.slice(0, 6).map((h) => `${h.time}: ${h.temperature}° (${h.condition})`).join('; ')
      : undefined;

    const dailySummary = daily && daily.length > 0
      ? daily.slice(0, 3).map((d) => `${d.date}: ${d.temperatureMin}°/${d.temperatureMax}° (${d.condition})`).join('; ')
      : undefined;

    return {
      locationName,
      temperature: current?.temperature,
      feelsLike: current?.feelsLike,
      condition: current?.condition,
      conditionDescription: current?.conditionDescription,
      humidity: current?.humidity,
      windSpeed: current?.windSpeed,
      precipitation: current?.precipitation,
      cloudCover: current?.cloudCover,
      units,
      hourlySummary,
      dailySummary,
    };
  }, [locationName, weatherData, units]);

  const messageSeqRef = useRef(1);

  // Send message to Next.js /api/chat route
  const sendMessage = useCallback(async (textToSend: string) => {
    const query = textToSend.trim();
    if (!query || isLoading) return;

    const msgId = messageSeqRef.current++;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: `user-${msgId}`,
      sender: 'user',
      text: query,
      timestamp: timeStr,
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          weatherContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status: ${response.status}`);
      }

      const data = await response.json();
      const replyId = messageSeqRef.current++;

      const assistantMessage: ChatMessage = {
        id: `assistant-${replyId}`,
        sender: 'assistant',
        text: data.reply || "I'm sorry, I couldn't generate a response for that weather query.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOffTopic: !!data.isOffTopic,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errId = messageSeqRef.current++;
      const errorMessage: ChatMessage = {
        id: `error-${errId}`,
        sender: 'assistant',
        text: "I'm having trouble connecting right now. Please check your network or try asking again in a moment.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, weatherContext]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">
                Weather Assistant
              </h3>
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                AI Active
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-normal">
              Weather & clothing advisor grounded in {locationName}
            </span>
          </div>
        </div>
        <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          Guardrailed
        </span>
      </div>

      {/* Messages List Area */}
      <div className="flex flex-col gap-3 max-h-64 min-h-48 overflow-y-auto pr-1 py-1 text-sm scrollbar-thin">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2 ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-xl rounded-br-xs'
                  : msg.isOffTopic
                  ? 'bg-amber-50/80 border border-amber-200 text-slate-800 rounded-xl rounded-bl-xs'
                  : 'bg-slate-100 border border-slate-200/80 text-slate-800 rounded-xl rounded-bl-xs'
              }`}
            >
              {msg.isOffTopic && (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 mb-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Weather-Only Scope Enforced</span>
                </div>
              )}
              {msg.sender === 'user' ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <div className="prose prose-sm max-w-none text-sm leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&>li]:mb-0.5 [&>strong]:font-semibold [&>strong]:text-slate-900">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}
            </div>
            <span suppressHydrationWarning className="text-[10px] text-slate-400 mt-1 px-1">
              {msg.timestamp}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="bg-slate-100 border border-slate-200/80 text-slate-500 rounded-xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-xs text-slate-500 ml-1.5">Consulting weather data...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Quick prompts:</span>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="rounded-full bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200/80 px-2.5 py-1 text-xs text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Form with Intentional Focus & Enter-key submission */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={`Ask about weather in ${locationName}...`}
            className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <span>Send</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </section>
  );
}

// Re-export alias for backward compatibility
export { WeatherChat as WeatherAssistant };
