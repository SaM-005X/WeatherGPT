'use client';

import React, { useState } from 'react';
import { ChatMessage } from '@/types/chat';

interface WeatherAssistantProps {
  locationName: string;
}

export function WeatherAssistant({ locationName }: WeatherAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `Hello! I'm your Weather Assistant. Ask me anything about current weather in ${locationName}, forecast details, or clothing recommendations.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Placeholder assistant response for Phase 1/2 preview (AI backend connects in Phase 9)
    const placeholderAssistantMsg: ChatMessage = {
      id: `assistant-${Date.now() + 1}`,
      sender: 'assistant',
      text: `[Preview] Weather Assistant UI is functional. The weather-only guardrailed AI backend will be connected in Phase 9.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, placeholderAssistantMsg]);
    setInput('');
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Weather Assistant
            </h3>
            <span className="text-[11px] text-slate-500 font-normal">Weather-only Advisor</span>
          </div>
        </div>
        <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          Preview
        </span>
      </div>

      {/* Messages List Area */}
      <div className="flex flex-col gap-3 max-h-56 overflow-y-auto pr-1 py-1 text-sm scrollbar-thin">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2 ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-xl rounded-br-xs'
                  : 'bg-slate-100 border border-slate-200/80 text-slate-800 rounded-xl rounded-bl-xs'
              }`}
            >
              <p className="text-sm leading-relaxed">{msg.text}</p>
            </div>
            <span suppressHydrationWarning className="text-[10px] text-slate-400 mt-1 px-1">
              {msg.timestamp}
            </span>
          </div>
        ))}
      </div>

      {/* Input Form with Intentional Focus & Readability */}
      <form onSubmit={handleSend} className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about weather in ${locationName}...`}
          className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <span>Send</span>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
    </section>
  );
}
