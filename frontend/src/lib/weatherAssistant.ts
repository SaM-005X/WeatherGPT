/**
 * Weather Assistant Core Module with Groq API (Qwen 3.8 27B) & Practical Lifestyle Guardrails
 *
 * Implements:
 * 1. Groq Cloud integration running `qwen/qwen3.8-27b` via OpenAI-compatible chat completions
 * 2. Balanced practical lifestyle guardrail system prompt (enthusiastic on sports, clothing pros/cons, weather; polite refusal for off-topic)
 * 3. Token-conscious context injection (compact weather summary, 3-4 turns, max_tokens: 300, temperature: 0.3)
 * 4. Resilient deterministic grounded fallback for missing API key, rate limits (HTTP 429), or network disruptions
 */

export interface WeatherContext {
  locationName: string;
  latitude?: number;
  longitude?: number;
  temperature?: number;
  feelsLike?: number;
  condition?: string;
  conditionDescription?: string;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  rainProbability?: number;
  highTemp?: number;
  lowTemp?: number;
  cloudCover?: number;
  units?: 'metric' | 'imperial';
  hourlySummary?: string;
  dailySummary?: string;
}

export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface WeatherAssistantResult {
  reply: string;
  isOffTopic: boolean;
  source: 'groq' | 'grounded-fallback';
}

/**
 * Standard polite refusal statement for off-topic queries
 */
export function getRefusalResponse(locationName: string = 'your location'): string {
  return `I am your weather and outdoor activity assistant. I can only help with questions regarding current weather, forecasts, outdoor sports suitability, and clothing advice for ${locationName}.`;
}

export const STANDARD_REFUSAL = getRefusalResponse('your location');

/**
 * Generates the balanced practical lifestyle guardrail system prompt
 * with compact JSON weather context to conserve tokens under Groq TPM limits.
 */
export function buildWeatherSystemPrompt(context?: WeatherContext): string {
  const locationName = context?.locationName || 'the current location';

  const compactWeatherContext = context
    ? {
        location: context.locationName,
        temperature:
          context.temperature !== undefined
            ? `${context.temperature}${context.units === 'imperial' ? '°F' : '°C'}`
            : undefined,
        feelsLike:
          context.feelsLike !== undefined
            ? `${context.feelsLike}${context.units === 'imperial' ? '°F' : '°C'}`
            : undefined,
        condition: context.conditionDescription || context.condition,
        humidity: context.humidity !== undefined ? `${context.humidity}%` : undefined,
        windSpeed:
          context.windSpeed !== undefined
            ? `${context.windSpeed} ${context.units === 'imperial' ? 'mph' : 'km/h'}`
            : undefined,
        precipitation:
          context.precipitation !== undefined ? `${context.precipitation} mm` : undefined,
        rainProbability:
          context.rainProbability !== undefined ? `${context.rainProbability}%` : undefined,
        highLow:
          context.highTemp !== undefined || context.lowTemp !== undefined
            ? `High: ${context.highTemp ?? 'N/A'}, Low: ${context.lowTemp ?? 'N/A'}`
            : context.dailySummary,
      }
    : { note: 'No live weather data available.' };

  const compactWeatherContextJson = JSON.stringify(compactWeatherContext, null, 2);

  return `You are WeatherGPT, a practical, friendly meteorological and outdoor activity assistant.
You have access to the active location's live weather summary:
${compactWeatherContextJson}

WHAT YOU SHOULD ENTHUSIASTICALLY ANSWER:
1. Current weather, hourly trends, and forecasts for ${locationName}.
2. Outdoor activity and sports suitability (e.g., football, running, cricket, cycling, beach trips) evaluated against current temperature, humidity, wind, and rain risk.
3. Clothing and gear advice, including practical advantages and disadvantages (e.g., benefits of wearing a breathable layer or carrying a windbreaker in current conditions).
4. Optimal times of day for walks, commuting, or outdoor events.

WHAT YOU MUST POLITELY REFUSE:
1. Blatantly unrelated queries such as computer programming/coding (e.g., "write Python code"), non-weather trivia/history (e.g., "who was the king of Egypt", "what is the tallest building"), mathematics, recipes, or creative writing.
2. For these unrelated topics ONLY, respond with:
"I am your weather and outdoor activity assistant. I can only help with questions regarding current weather, forecasts, outdoor sports suitability, and clothing advice for ${locationName}."`;
}

/**
 * Evaluates whether a user prompt is blatantly off-topic.
 * Generously accommodates weather, outdoor sports (football, cricket, running, cycling, etc.),
 * clothing advantages/disadvantages, walk timing, and conversational greetings.
 */
export function isQueryOffTopic(query: string, context?: WeatherContext): boolean {
  const q = query.toLowerCase().trim();

  // 1. Weather, outdoor sports/activities, clothing/gear, walk/commute, greetings are NEVER off-topic
  const isLifestyleOrWeather =
    /\b(weather|whether|forecast|temperature|temp|degrees?|rain|raining|umbrella|drizzle|shower|storm|snow|hail|wind|windy|breeze|cloud|cloudy|sun|sunny|humidity|humid|uv|air quality|visibility|fog|cold|warm|hot|cool|chilly|freezing|degrees)\b/i.test(q) ||
    /\b(football|soccer|cricket|tennis|basketball|baseball|golf|run|running|jog|jogging|walk|walking|cycle|cycling|bike|biking|swim|swimming|beach|hike|hiking|outdoor|outside|park|commute|drive|event|game|match|trip)\b/i.test(q) ||
    /\b(wear|clothes|clothing|outfit|jacket|coat|sweater|hoodie|windbreaker|breathable|layer|layers|shorts|pants|boots|shoes|sunglasses|hat|gear|advantage|advantages|disadvantage|disadvantages)\b/i.test(q) ||
    /^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings|help|yo)[\s!.,?]*$/i.test(q);

  if (isLifestyleOrWeather) {
    return false;
  }

  // Location awareness: If user query explicitly mentions the active location name, allow it
  if (context?.locationName && q.includes(context.locationName.toLowerCase())) {
    return false;
  }

  // 2. Blatantly unrelated topics to refuse: programming/coding, non-weather history/trivia, math, recipes, creative writing
  const blatantUnrelated = [
    /\b(code|coding|python|javascript|typescript|c\+\+|java\b|rust\b|html|css|sql|function|algorithm|binary search|sorting|debug|class\b|loop|array|git\b|react|docker|kubernetes|write a script|write.*code)\b/i,
    /\b(king of|queen of|president of|tallest building|capital of|who was|who is|history of|historical|ancient egypt|pharaoh|world war|empire)\b/i,
    /\b(equation|solve|integral|derivative|algebra|arithmetic|square root|calculate \d|math problem)\b/i,
    /\b(recipe|cook|bake|baking|ingredients|chocolate chip|pasta sauce|bake a cake)\b/i,
    /\b(write a poem|write a story|write an essay|tell me a joke|write fiction)\b/i,
  ];

  return blatantUnrelated.some((pattern) => pattern.test(q));
}

/**
 * Deterministic weather-grounded recommendation generator
 * Operates during rate limits (HTTP 429), offline conditions, or when GROQ_API_KEY is not configured.
 * Generously evaluates sports suitability, clothing advantages/disadvantages, umbrella, and walk timing.
 */
export function generateGroundedWeatherAdvice(query: string, context?: WeatherContext): string {
  const loc = context?.locationName || 'your location';
  const temp = context?.temperature ?? 20;
  const feelsLike = context?.feelsLike ?? temp;
  const condition = (context?.conditionDescription || context?.condition || 'Clear').toLowerCase();
  const humidity = context?.humidity ?? 50;
  const windSpeed = context?.windSpeed ?? 10;
  const precipitation = context?.precipitation ?? 0;
  const tempUnit = context?.units === 'imperial' ? '°F' : '°C';
  const speedUnit = context?.units === 'imperial' ? 'mph' : 'km/h';

  const q = query.toLowerCase();

  // Guardrail check: Blatantly off-topic query check in fallback mode
  if (isQueryOffTopic(query, context)) {
    return getRefusalResponse(loc);
  }

  const isRaining =
    precipitation > 0 ||
    condition.includes('rain') ||
    condition.includes('drizzle') ||
    condition.includes('shower') ||
    condition.includes('thunderstorm');

  // 1. Outdoor Sports & Activity Suitability (Football, Running, Cricket, Cycling, etc.)
  if (
    q.includes('football') ||
    q.includes('soccer') ||
    q.includes('cricket') ||
    q.includes('tennis') ||
    q.includes('run') ||
    q.includes('cycling') ||
    q.includes('bike') ||
    q.includes('sport') ||
    q.includes('play')
  ) {
    if (isRaining) {
      return `For outdoor sports like football or running in ${loc} today, conditions are currently challenging due to ${condition} (${precipitation > 0 ? `${precipitation} mm rain` : 'active precipitation'}) and wet grass or turf. If you play, wear studded footwear or turf shoes for traction and a water-resistant layer, or consider postponing until rain clears.`;
    }

    if (windSpeed > 30) {
      return `Playing outdoor sports in ${loc} today is feasible at ${temp}${tempUnit}, but brisk winds of ${windSpeed} ${speedUnit} will significantly affect ball flight in sports like football, cricket, and tennis. Watch your footing and wear a wind-resistant training layer.`;
    }

    const tempCelsius = context?.units === 'imperial' ? ((temp - 32) * 5) / 9 : temp;
    if (tempCelsius >= 30) {
      return `Conditions in ${loc} are very warm (${temp}${tempUnit}, feels like ${feelsLike}${tempUnit}) with ${humidity}% humidity. You can play football or run, but stay well hydrated, take frequent shade breaks, and schedule games during early morning or evening hours to avoid heat exhaustion.`;
    } else if (tempCelsius <= 5) {
      return `Outdoor sports in ${loc} today will be cold (${temp}${tempUnit}). You can still play football or run, but warm up thoroughly to prevent muscle strain, and wear thermal compression wear, gloves, and a breathable jacket.`;
    }

    return `Conditions are great for playing football or outdoor sports in ${loc} today! It is currently ${condition} at ${temp}${tempUnit} with manageable winds of ${windSpeed} ${speedUnit} and ${humidity}% humidity. Enjoy the match!`;
  }

  // 2. Clothing & Gear Advice (including Practical Advantages and Disadvantages)
  if (
    q.includes('wear') ||
    q.includes('clothes') ||
    q.includes('clothing') ||
    q.includes('jacket') ||
    q.includes('coat') ||
    q.includes('outfit') ||
    q.includes('advantage') ||
    q.includes('gear')
  ) {
    const tempCelsius = context?.units === 'imperial' ? ((temp - 32) * 5) / 9 : temp;

    if (q.includes('jacket') || q.includes('advantage')) {
      if (tempCelsius <= 18) {
        return `For current conditions in ${loc} (${temp}${tempUnit}, ${condition}): A light jacket or windbreaker is strongly recommended. Advantages: It traps core body heat, blocks wind (${windSpeed} ${speedUnit}), and protects against light drizzle while remaining easy to unzip or pack if you warm up. Disadvantages: If precipitation intensifies into heavy downpours, a standard light jacket may lack complete waterproofing.`;
      } else {
        return `At ${temp}${tempUnit} in ${loc}, wearing a light jacket is optional. Advantage: Useful if you are in breezy areas (${windSpeed} ${speedUnit}) or air-conditioned indoors. Disadvantage: During outdoor walking or physical activity in ${temp}${tempUnit} weather, a jacket will quickly cause overheating and perspiration. A breathable cotton t-shirt is preferable.`;
      }
    }

    if (tempCelsius <= 5) {
      return `For ${loc} today (${temp}${tempUnit}): Bundle up with a heavy winter coat, thermal base layer, gloves, and a beanie. Advantage of layering: Retains heat in sub-freezing air. Disadvantage: Reduces mobility during brisk walking.`;
    } else if (tempCelsius <= 16) {
      return `For ${loc} today (${temp}${tempUnit}): A medium jacket, fleece, or layered sweater is ideal. It shields against chilly ${windSpeed} ${speedUnit} breezes while allowing breathability.`;
    } else if (tempCelsius <= 24) {
      return `For ${loc} today (${temp}${tempUnit}): Mild and pleasant. Comfortable pants and a light long-sleeve shirt or t-shirt are ideal. Carry a light layer for cooler evening hours.`;
    } else {
      return `For ${loc} today (${temp}${tempUnit}): Wear lightweight, breathable cotton or linen clothing like t-shirts and shorts. Advantage: Maximizes airflow and evaporative cooling under ${humidity}% humidity.`;
    }
  }

  // 3. Umbrella / Rain Queries
  if (q.includes('umbrella') || q.includes('rain') || q.includes('precipitation') || q.includes('shower')) {
    if (isRaining) {
      return `Yes, definitely carry an umbrella or waterproof jacket in ${loc}! Current conditions show ${condition} with ${precipitation > 0 ? `${precipitation} mm of precipitation` : 'active rain'}.`;
    }
    if (condition.includes('cloud') || condition.includes('overcast')) {
      return `An umbrella isn't strictly necessary right now in ${loc}, as it is currently ${condition} at ${temp}${tempUnit}. However, keeping a compact umbrella in your bag is sensible with overcast skies.`;
    }
    return `No umbrella needed in ${loc} today! Conditions are ${condition} with zero rain and a pleasant ${temp}${tempUnit}.`;
  }

  // 4. Walks, Commuting & Best Time of Day
  if (
    q.includes('walk') ||
    q.includes('commute') ||
    q.includes('outside') ||
    q.includes('park') ||
    q.includes('hike') ||
    q.includes('time')
  ) {
    if (isRaining || windSpeed > 35) {
      return `A walk in ${loc} right now will be damp and brisk due to ${condition} and ${windSpeed} ${speedUnit} winds. Best to wait for precipitation to pass or opt for covered outdoor routes.`;
    }

    const tempCelsius = context?.units === 'imperial' ? ((temp - 32) * 5) / 9 : temp;
    if (tempCelsius >= 28) {
      return `In ${loc}, the optimal time for an outdoor walk is during the cooler morning hours (6:00 AM – 8:30 AM) or after sunset, avoiding the midday heat peak around ${temp}${tempUnit}.`;
    } else if (tempCelsius <= 12) {
      return `In ${loc}, the optimal time for a walk today is during the early afternoon (12:00 PM – 3:00 PM), when solar warming brings temperatures to their daytime peak.`;
    }

    return `Current conditions are pleasant for a walk in ${loc}! It is ${condition} at ${temp}${tempUnit} with gentle winds around ${windSpeed} ${speedUnit} and ${humidity}% humidity.`;
  }

  // 5. Conversational Greetings
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings)[\s!.,?]*$/i.test(q)) {
    return `Hello! I am WeatherGPT for ${loc}. Current conditions are ${condition} at ${temp}${tempUnit} (feels like ${feelsLike}${tempUnit}). Ask me about weather trends, outdoor sports suitability, what to wear, or the best time for outdoor activities!`;
  }

  // 6. Forecast & Default Weather Summary
  if (context?.dailySummary) {
    return `In ${loc}, current conditions are ${condition} at ${temp}${tempUnit} (feels like ${feelsLike}${tempUnit}) with ${humidity}% humidity and ${windSpeed} ${speedUnit} winds. Today's forecast: ${context.dailySummary}.`;
  }

  return `Currently in ${loc}, it is ${temp}${tempUnit} (feels like ${feelsLike}${tempUnit}) with ${condition}. Humidity is ${humidity}%, and wind speed is ${windSpeed} ${speedUnit}.`;
}

/**
 * Main Processing Function for Weather Chat Queries via Groq Cloud (Qwen 3.8 27B)
 * with graceful rate-limit (HTTP 429) & token conservation handling.
 */
export async function processWeatherChatMessage(
  messages: ChatMessageInput[],
  weatherContext?: WeatherContext
): Promise<WeatherAssistantResult> {
  const latestMessage = messages[messages.length - 1]?.content || '';

  if (!latestMessage.trim()) {
    return {
      reply: 'Please ask a weather or outdoor activity question.',
      isOffTopic: false,
      source: 'grounded-fallback',
    };
  }

  // Pre-flight guardrail: If query is blatantly off-topic, politely refuse immediately to conserve tokens
  if (isQueryOffTopic(latestMessage, weatherContext)) {
    return {
      reply: getRefusalResponse(weatherContext?.locationName),
      isOffTopic: true,
      source: 'grounded-fallback',
    };
  }

  // Inspect Groq API Key configuration
  const groqApiKey = process.env.GROQ_API_KEY;
  const isKeyValid =
    groqApiKey &&
    !groqApiKey.includes('your_groq_api_key') &&
    groqApiKey.trim().length > 10;

  if (isKeyValid) {
    try {
      const systemInstruction = buildWeatherSystemPrompt(weatherContext);
      const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

      // Token conservation: Retain only last 3-4 conversation turns (8K TPM / 200K TPD limits)
      const shortHistory = messages.slice(-4);
      const formattedMessages = [
        { role: 'system', content: systemInstruction },
        ...shortHistory.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ];

      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          max_tokens: 300,
          temperature: 0.3,
        }),
      });

      // Handle Rate-Limit HTTP 429 gracefully
      if (groqResponse.status === 429) {
        console.warn(
          '[Groq API Rate Limit (HTTP 429)]: Rate limit exceeded (30 RPM / 8K TPM). Falling back seamlessly to grounded meteorological advice.'
        );
      } else if (!groqResponse.ok) {
        const errorBody = await groqResponse.text().catch(() => '');
        console.warn(`[Groq API Call Error HTTP ${groqResponse.status}]: ${errorBody}`);
      } else {
        const data = await groqResponse.json();
        const replyText = data?.choices?.[0]?.message?.content?.trim();

        if (replyText) {
          const isDeclined =
            (replyText.includes('I am your weather and outdoor activity assistant') &&
              replyText.includes('only help with questions')) ||
            replyText.includes('can only help with questions regarding current weather') ||
            replyText.includes('I can only help with questions regarding');

          return {
            reply: replyText,
            isOffTopic: isDeclined,
            source: 'groq',
          };
        }
      }
    } catch (err: unknown) {
      console.warn('[Groq Network/Fetch Error]: Falling back to grounded advice:', err);
    }
  }

  // Clean fallback mode: Grounded meteorological response
  const advice = generateGroundedWeatherAdvice(latestMessage, weatherContext);
  return {
    reply: advice,
    isOffTopic: false,
    source: 'grounded-fallback',
  };
}
