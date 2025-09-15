/**
 * Chrome extension specific types and interfaces
 */

export interface StorageKeys {
  VOCABULARY_DATA: 'vocabularyData';
  USER_CONFIG: 'userConfig';
  LEARNING_STATS: 'learningStats';
  REVIEW_HISTORY: 'reviewHistory';
}

export const STORAGE_KEYS: StorageKeys = {
  VOCABULARY_DATA: 'vocabularyData',
  USER_CONFIG: 'userConfig',
  LEARNING_STATS: 'learningStats',
  REVIEW_HISTORY: 'reviewHistory',
};

/**
 * Chrome notification options
 */
export interface NotificationOptions {
  type: 'basic';
  iconUrl: string;
  title: string;
  message: string;
  buttons?: Array<{
    title: string;
  }>;
}

/**
 * Chrome alarm info
 */
export interface AlarmInfo {
  name: string;
  when?: number;
  periodInMinutes?: number;
}

/**
 * TTS voice interface
 */
export interface TTSVoice {
  voiceName: string;
  lang: string;
  gender?: string;
  remote: boolean;
  extensionId?: string;
  eventTypes?: string[];
}

/**
 * Background script message types
 */
export enum MessageType {
  GET_VOCABULARY = 'GET_VOCABULARY',
  UPDATE_VOCABULARY = 'UPDATE_VOCABULARY',
  GET_CONFIG = 'GET_CONFIG',
  UPDATE_CONFIG = 'UPDATE_CONFIG',
  GET_STATS = 'GET_STATS',
  RECORD_REVIEW = 'RECORD_REVIEW',
  IMPORT_VOCABULARY = 'IMPORT_VOCABULARY',
  EXPORT_VOCABULARY = 'EXPORT_VOCABULARY',
}

/**
 * Message interface for communication between extension parts
 */
export interface ExtensionMessage {
  type: MessageType;
  payload?: any;
}

/**
 * Response interface for extension messages
 */
export interface ExtensionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}