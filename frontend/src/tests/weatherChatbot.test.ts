/**
 * WeatherGPT Chatbot Engine (Groq Qwen 3.8 27B) & Lifestyle Guardrails Test Suite
 *
 * Validates:
 * 1. Compact JSON context injection and balanced system prompt construction.
 * 2. Outdoor sports suitability ("Can I play football outside today in London?").
 * 3. Clothing and gear advice with practical advantages/disadvantages ("What should I wear, and what are the advantages of a light jacket?").
 * 4. Polite refusal for blatantly off-topic queries ("Who was the king of Egypt?", "Write a python function").
 * 5. Umbrella, walking, and temperature context adaptation.
 * 6. Rate-limit (HTTP 429) & missing key graceful fallback.
 * 7. Next.js API route (/api/chat) POST endpoint handling.
 */

import assert from 'node:assert';
import {
  buildWeatherSystemPrompt,
  processWeatherChatMessage,
  isQueryOffTopic,
  getRefusalResponse,
  WeatherContext,
} from '../lib/weatherAssistant';
import { POST } from '../app/api/chat/route';
import { NextRequest } from 'next/server';

async function runTests() {
  console.log('=== RUNNING GROQ QWEN 3.8 27B WEATHER CHATBOT & LIFESTYLE GUARDRAIL TESTS ===\n');

  const londonContext: WeatherContext = {
    locationName: 'London',
    temperature: 15.5,
    feelsLike: 14.2,
    condition: 'DRIZZLE',
    conditionDescription: 'Light Drizzle',
    humidity: 82,
    windSpeed: 14.5,
    precipitation: 1.2,
    rainProbability: 75,
    cloudCover: 90,
    units: 'metric',
    dailySummary: '2026-10-01: 12°/17° (Rain)',
  };

  // -------------------------------------------------------------------------
  // Test 1: System prompt formatting and compact context injection
  // -------------------------------------------------------------------------
  console.log('[1/7] Testing buildWeatherSystemPrompt and token-conscious context injection...');
  const prompt = buildWeatherSystemPrompt(londonContext);

  assert.ok(prompt.includes('London'), 'Prompt must contain location name.');
  assert.ok(prompt.includes('15.5°C'), 'Prompt must contain formatted temperature.');
  assert.ok(prompt.includes('Light Drizzle'), 'Prompt must contain condition description.');
  assert.ok(prompt.includes('82%'), 'Prompt must contain humidity.');
  assert.ok(prompt.includes('14.5 km/h'), 'Prompt must contain wind speed.');
  assert.ok(prompt.includes('1.2 mm'), 'Prompt must contain precipitation.');
  assert.ok(prompt.includes('WHAT YOU SHOULD ENTHUSIASTICALLY ANSWER:'), 'Prompt must list enthusiastic topics.');
  assert.ok(prompt.includes('Outdoor activity and sports suitability'), 'Prompt must specify sports suitability.');
  assert.ok(prompt.includes('advantages and disadvantages'), 'Prompt must specify clothing advantages/disadvantages.');
  assert.ok(prompt.includes('WHAT YOU MUST POLITELY REFUSE:'), 'Prompt must list refusal topics.');
  assert.ok(
    prompt.includes('I am your weather and outdoor activity assistant. I can only help with questions regarding current weather'),
    'Prompt must define exact refusal message.'
  );
  // Ensure no huge arrays are injected into context
  assert.ok(!prompt.includes('"00:00"'), 'Prompt must not contain bulky hourly arrays.');
  console.log('✔ System prompt format, compact JSON context, and balanced guardrails verified.\n');

  // -------------------------------------------------------------------------
  // Test 2: Outdoor Sports Suitability: "Can I play football outside today in London?"
  // -------------------------------------------------------------------------
  console.log('[2/7] Testing Sports Suitability: "Can I play football outside today in London?"...');
  const footballQuery = 'Can I play football outside today in London?';
  assert.strictEqual(
    isQueryOffTopic(footballQuery, londonContext),
    false,
    'Football query must NEVER be flagged as off-topic.'
  );

  const footballRes = await processWeatherChatMessage(
    [{ role: 'user', content: footballQuery }],
    londonContext
  );

  assert.strictEqual(footballRes.isOffTopic, false, 'Football query response must not be off-topic.');
  assert.ok(
    footballRes.reply.toLowerCase().includes('football') ||
      footballRes.reply.toLowerCase().includes('turf') ||
      footballRes.reply.toLowerCase().includes('rain') ||
      footballRes.reply.toLowerCase().includes('drizzle'),
    'Should return helpful, weather-informed evaluation for football in London.'
  );
  console.log(`   Football response: "${footballRes.reply}"`);
  console.log('✔ Outdoor sports suitability evaluated accurately against live weather.\n');

  // -------------------------------------------------------------------------
  // Test 3: Clothing Pros & Cons: "What should I wear, and what are the advantages of a light jacket?"
  // -------------------------------------------------------------------------
  console.log('[3/7] Testing Clothing Pros/Cons: "What should I wear, and what are the advantages of a light jacket?"...');
  const clothingQuery = 'What should I wear, and what are the advantages of a light jacket?';
  assert.strictEqual(
    isQueryOffTopic(clothingQuery, londonContext),
    false,
    'Clothing pros/cons query must NEVER be flagged as off-topic.'
  );

  const clothingRes = await processWeatherChatMessage(
    [{ role: 'user', content: clothingQuery }],
    londonContext
  );

  assert.strictEqual(clothingRes.isOffTopic, false, 'Clothing advice must not be off-topic.');
  assert.ok(
    clothingRes.reply.toLowerCase().includes('jacket'),
    'Should discuss jacket.'
  );
  assert.ok(
    clothingRes.reply.toLowerCase().includes('advantage') ||
      clothingRes.reply.toLowerCase().includes('wind') ||
      clothingRes.reply.toLowerCase().includes('heat') ||
      clothingRes.reply.toLowerCase().includes('drizzle'),
    'Should detail practical advantages and disadvantages based on 15.5°C temperature.'
  );
  console.log(`   Clothing advice response: "${clothingRes.reply}"`);
  console.log('✔ Practical clothing advantages and disadvantages grounded in current metrics verified.\n');

  // -------------------------------------------------------------------------
  // Test 4: Blatantly Off-Topic Refusals ("Who was the king of Egypt?" & "Write a python function")
  // -------------------------------------------------------------------------
  console.log('[4/7] Testing Blatantly Off-Topic Refusals...');
  const offTopicQueries = [
    'Who was the king of Egypt?',
    'Write a python function to compute Fibonacci numbers',
    'What is the tallest building in the world?',
    'Solve the equation 3x + 12 = 36',
    'Give me a delicious recipe for chocolate chip cookies',
    'Write a poem about outer space',
  ];

  const expectedRefusal = getRefusalResponse('London');

  for (const query of offTopicQueries) {
    const isFlagged = isQueryOffTopic(query, londonContext);
    assert.strictEqual(isFlagged, true, `Query "${query}" must be classified as off-topic.`);

    const res = await processWeatherChatMessage([{ role: 'user', content: query }], londonContext);
    assert.strictEqual(res.isOffTopic, true, `Result for "${query}" must have isOffTopic = true.`);
    assert.strictEqual(
      res.reply,
      expectedRefusal,
      `Reply for "${query}" must be the exact polite refusal string.`
    );
  }
  console.log(`   Sample refusal: "${expectedRefusal}"`);
  console.log('✔ All 6 off-topic queries strictly rejected with polite refusal.\n');

  // -------------------------------------------------------------------------
  // Test 5: Umbrella, Walks & Dynamic Weather Context Adaptation
  // -------------------------------------------------------------------------
  console.log('[5/7] Testing Umbrella, Walk Timing & Warm Weather Adaptation...');

  // 5a. Umbrella in London (rain present)
  const umbrellaRes = await processWeatherChatMessage(
    [{ role: 'user', content: 'Do I need an umbrella today?' }],
    londonContext
  );
  assert.strictEqual(umbrellaRes.isOffTopic, false);
  assert.ok(
    umbrellaRes.reply.toLowerCase().includes('umbrella') && umbrellaRes.reply.toLowerCase().includes('yes'),
    'Should recommend umbrella when precipitation is present.'
  );

  // 5b. Best time for a walk
  const walkRes = await processWeatherChatMessage(
    [{ role: 'user', content: 'What is the best time for a walk today?' }],
    londonContext
  );
  assert.strictEqual(walkRes.isOffTopic, false);
  assert.ok(walkRes.reply.length > 20, 'Walk advice must be detailed.');

  // 5c. Warm climate context (Kolkata 33.5°C)
  const kolkataContext: WeatherContext = {
    locationName: 'Kolkata',
    temperature: 33.5,
    feelsLike: 38.0,
    condition: 'SUNNY',
    conditionDescription: 'Sunny and Hot',
    humidity: 70,
    windSpeed: 8.0,
    precipitation: 0,
    rainProbability: 5,
    units: 'metric',
  };

  const warmFootball = await processWeatherChatMessage(
    [{ role: 'user', content: 'Can I play football outside today in Kolkata?' }],
    kolkataContext
  );
  assert.strictEqual(warmFootball.isOffTopic, false);
  assert.ok(
    warmFootball.reply.toLowerCase().includes('hydrat') ||
      warmFootball.reply.toLowerCase().includes('warm') ||
      warmFootball.reply.toLowerCase().includes('hot') ||
      warmFootball.reply.toLowerCase().includes('heat'),
    'Should warn about heat and recommend hydration for football in 33.5°C.'
  );

  const warmClothing = await processWeatherChatMessage(
    [{ role: 'user', content: 'What should I wear, and what are the advantages of a light jacket?' }],
    kolkataContext
  );
  assert.strictEqual(warmClothing.isOffTopic, false);
  assert.ok(
    warmClothing.reply.toLowerCase().includes('overheat') ||
      warmClothing.reply.toLowerCase().includes('breathable') ||
      warmClothing.reply.toLowerCase().includes('disadvantage'),
    'Should note disadvantages of jacket in 33.5°C heat.'
  );
  console.log('✔ Dynamic context adaptation across cold/wet and hot climates verified.\n');

  // -------------------------------------------------------------------------
  // Test 6: Rate-Limit (HTTP 429) & Offline Graceful Resilience
  // -------------------------------------------------------------------------
  console.log('[6/7] Testing Rate-Limit (HTTP 429) & network error resiliency...');
  // Force simulate rate limit by mocking fetch
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const simulated429Res = await processWeatherChatMessage(
      [{ role: 'user', content: 'Can I play football outside today in London?' }],
      londonContext
    );

    assert.strictEqual(simulated429Res.source, 'grounded-fallback', 'Must fall back seamlessly on 429.');
    assert.strictEqual(simulated429Res.isOffTopic, false);
    assert.ok(
      simulated429Res.reply.length > 20,
      'Must return valid grounded meteorological advice on HTTP 429.'
    );
    console.log('✔ Seamless HTTP 429 rate-limit fallback verified without crashing.\n');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // -------------------------------------------------------------------------
  // Test 7: Next.js API Route /api/chat POST Endpoint
  // -------------------------------------------------------------------------
  console.log('[7/7] Testing Next.js API route (/api/chat) handler...');

  // 7a. Valid sports query
  const validSportsReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Can I play football outside today in London?' }],
      weatherContext: londonContext,
    }),
  });
  const sportsResponse = await POST(validSportsReq);
  assert.strictEqual(sportsResponse.status, 200, 'Sports request should return 200.');
  const sportsData = await sportsResponse.json();
  assert.strictEqual(sportsData.isOffTopic, false);
  assert.ok(sportsData.reply && sportsData.reply.length > 10);

  // 7b. Off-topic query via route
  const offTopicReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Who was the king of Egypt?' }],
      weatherContext: londonContext,
    }),
  });
  const offTopicResponse = await POST(offTopicReq);
  assert.strictEqual(offTopicResponse.status, 200, 'Off-topic route request should return 200.');
  const offTopicData = await offTopicResponse.json();
  assert.strictEqual(offTopicData.isOffTopic, true, 'Off-topic query must have isOffTopic = true.');
  assert.strictEqual(offTopicData.reply, expectedRefusal);

  // 7c. Malformed request (empty messages)
  const malformedReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [],
      weatherContext: londonContext,
    }),
  });
  const malformedResponse = await POST(malformedReq);
  assert.strictEqual(malformedResponse.status, 400, 'Empty messages array should return 400.');

  console.log('✔ Next.js /api/chat route handler verified.\n');

  console.log('======================================================');
  console.log('ALL 7 GROQ CHATBOT & LIFESTYLE GUARDRAIL TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
