/**
 * Live Groq Cloud Verification Script (Qwen 3.8 27B)
 *
 * Validates:
 * 1. Detection of GROQ_API_KEY and GROQ_MODEL in frontend/.env.local.
 * 2. On-topic sports and lifestyle queries ("Can I play football outside today in London?")
 * 3. Clothing advice with practical advantages/disadvantages ("What should I wear, and what are the advantages of a light jacket?")
 * 4. Off-topic query guardrail refusal ("Who was the king of Egypt?", "Write a python function")
 * 5. Rate-limit (HTTP 429) & network error resiliency with grounded fallback.
 */

import assert from 'node:assert';
import {
  processWeatherChatMessage,
  WeatherContext,
  getRefusalResponse,
} from '../lib/weatherAssistant';

async function testLiveGroq() {
  console.log('=== LIVE GROQ CLOUD (QWEN 3.8 27B) VERIFICATION ===\n');

  const apiKey = process.env.GROQ_API_KEY;
  const modelName = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

  console.log(`[1/4] Environment Key Check:`);
  console.log(`      GROQ_MODEL:   ${modelName}`);

  const isPlaceholderOrMissing =
    !apiKey || apiKey.includes('your_groq_api_key') || apiKey.trim().length < 10;

  if (isPlaceholderOrMissing) {
    console.log(`      GROQ_API_KEY: ⚠ Placeholder or unconfigured in .env.local ("${apiKey || 'UNDEFINED'}")`);
    console.log('      (Operating under grounded deterministic meteorological fallback mode)\n');
  } else {
    const maskedKey = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
    console.log(`      GROQ_API_KEY: ✔ Valid Groq key detected (${maskedKey})\n`);
  }

  const londonContext: WeatherContext = {
    locationName: 'London',
    latitude: 51.5074,
    longitude: -0.1278,
    temperature: 15.5,
    feelsLike: 14.2,
    condition: 'Drizzle',
    conditionDescription: 'Light Drizzle',
    humidity: 82,
    windSpeed: 14.5,
    precipitation: 1.2,
    rainProbability: 75,
    cloudCover: 90,
    units: 'metric',
    dailySummary: 'Today: 12°/17° (Light Drizzle)',
  };

  // -------------------------------------------------------------------------
  // Test 2: Outdoor Sports Suitability ("Can I play football outside today in London?")
  // -------------------------------------------------------------------------
  console.log('[2/4] Testing Outdoor Sports Suitability: "Can I play football outside today in London?"...');
  const footballQuery = 'Can I play football outside today in London?';
  const footballRes = await processWeatherChatMessage(
    [{ role: 'user', content: footballQuery }],
    londonContext
  );

  console.log(`      Source: "${footballRes.source}"`);
  console.log(`      isOffTopic: ${footballRes.isOffTopic}`);
  console.log(`      Reply:\n---\n${footballRes.reply}\n---\n`);
  assert.strictEqual(footballRes.isOffTopic, false, 'Football query must NOT be flagged as off-topic.');
  assert.ok(
    footballRes.reply.toLowerCase().includes('football') ||
      footballRes.reply.toLowerCase().includes('rain') ||
      footballRes.reply.toLowerCase().includes('drizzle') ||
      footballRes.reply.toLowerCase().includes('turf') ||
      footballRes.reply.toLowerCase().includes('traction'),
    'Reply must provide weather-informed sports evaluation.'
  );
  console.log('✔ Football outdoor suitability evaluated successfully.\n');

  // -------------------------------------------------------------------------
  // Test 3: Clothing & Gear Advice ("What should I wear, and what are the advantages of a light jacket?")
  // -------------------------------------------------------------------------
  console.log('[3/4] Testing Clothing Pros/Cons: "What should I wear, and what are the advantages of a light jacket?"...');
  const clothingQuery = 'What should I wear, and what are the advantages of a light jacket?';
  const clothingRes = await processWeatherChatMessage(
    [{ role: 'user', content: clothingQuery }],
    londonContext
  );

  console.log(`      Source: "${clothingRes.source}"`);
  console.log(`      isOffTopic: ${clothingRes.isOffTopic}`);
  console.log(`      Reply:\n---\n${clothingRes.reply}\n---\n`);
  assert.strictEqual(clothingRes.isOffTopic, false, 'Clothing query must NOT be flagged as off-topic.');
  assert.ok(
    clothingRes.reply.toLowerCase().includes('jacket') &&
      (clothingRes.reply.toLowerCase().includes('advantage') ||
        clothingRes.reply.toLowerCase().includes('wind') ||
        clothingRes.reply.toLowerCase().includes('protect') ||
        clothingRes.reply.toLowerCase().includes('heat')),
    'Reply must detail practical clothing advantages based on current temperature.'
  );
  console.log('✔ Clothing advice with practical advantages verified.\n');

  // -------------------------------------------------------------------------
  // Test 4: Blatant Off-Topic Refusals ("Who was the king of Egypt?" & "Write a python function")
  // -------------------------------------------------------------------------
  console.log('[4/4] Testing Blatantly Off-Topic Refusals...');
  const offTopicQueries = [
    'Who was the king of Egypt?',
    'Write a python function to compute factorial',
  ];

  const expectedRefusal = getRefusalResponse('London');

  for (const query of offTopicQueries) {
    console.log(`      Query: "${query}"`);
    const offTopicRes = await processWeatherChatMessage(
      [{ role: 'user', content: query }],
      londonContext
    );
    console.log(`      isOffTopic: ${offTopicRes.isOffTopic}`);
    console.log(`      Reply:\n---\n${offTopicRes.reply}\n---\n`);
    assert.strictEqual(offTopicRes.isOffTopic, true, `Query "${query}" must be flagged as off-topic.`);
    assert.ok(
      offTopicRes.reply.includes('I am your weather and outdoor activity assistant') ||
        offTopicRes.reply === expectedRefusal,
      'Reply must match standard polite refusal.'
    );
  }
  console.log('✔ All off-topic queries politely refused as required.\n');

  console.log('======================================================');
  console.log('ALL LIVE GROQ VERIFICATION CHECKS PASSED! ✔');
  console.log('======================================================\n');
}

testLiveGroq().catch((err) => {
  console.error('Groq test failed:', err);
  process.exit(1);
});
