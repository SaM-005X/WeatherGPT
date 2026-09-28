/**
 * Chatbot message models.
 * Designed to map to the future GraphQL askWeatherAssistant mutation.
 */

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isOffTopic?: boolean;
}
