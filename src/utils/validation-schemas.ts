/**
 * JSON Schema validation for data import/export
 * 
 * Provides comprehensive validation schemas for vocabulary data,
 * user configuration, and full extension data imports.
 */

import { VocabularyItem, UserConfig, SRSData, ReviewSession, ReviewQuality } from '@/types';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Schema validation utilities
 */
export class SchemaValidator {
  /**
   * Validate vocabulary item structure
   */
  static validateVocabularyItem(item: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Required fields validation
    if (!item || typeof item !== 'object') {
      result.isValid = false;
      result.errors.push('Item must be an object');
      return result;
    }

    if (!item.targetLanguageWord || typeof item.targetLanguageWord !== 'string' || item.targetLanguageWord.trim().length === 0) {
      result.isValid = false;
      result.errors.push('targetLanguageWord is required and must be a non-empty string');
    }

    if (!item.englishTranslation || typeof item.englishTranslation !== 'string' || item.englishTranslation.trim().length === 0) {
      result.isValid = false;
      result.errors.push('englishTranslation is required and must be a non-empty string');
    }

    // Optional fields validation
    if (item.id && typeof item.id !== 'string') {
      result.errors.push('id must be a string if provided');
      result.isValid = false;
    }

    if (item.pronunciationAudioUrl && typeof item.pronunciationAudioUrl !== 'string') {
      result.errors.push('pronunciationAudioUrl must be a string if provided');
      result.isValid = false;
    }

    if (item.tags) {
      if (!Array.isArray(item.tags)) {
        result.errors.push('tags must be an array if provided');
        result.isValid = false;
      } else if (!item.tags.every((tag: any) => typeof tag === 'string')) {
        result.errors.push('all tags must be strings');
        result.isValid = false;
      }
    }

    // SRS data validation
    if (item.srsData) {
      const srsValidation = this.validateSRSData(item.srsData);
      result.errors.push(...srsValidation.errors);
      result.warnings.push(...srsValidation.warnings);
      if (!srsValidation.isValid) {
        result.isValid = false;
      }
    }

    // Warnings for best practices
    if (item.targetLanguageWord && item.targetLanguageWord.length > 100) {
      result.warnings.push('targetLanguageWord is unusually long (>100 characters)');
    }

    if (item.englishTranslation && item.englishTranslation.length > 200) {
      result.warnings.push('englishTranslation is unusually long (>200 characters)');
    }

    if (item.tags && item.tags.length > 10) {
      result.warnings.push('Item has many tags (>10), consider consolidating');
    }

    return result;
  }

  /**
   * Validate SRS data structure
   */
  static validateSRSData(srsData: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!srsData || typeof srsData !== 'object') {
      result.isValid = false;
      result.errors.push('srsData must be an object');
      return result;
    }

    // Required numeric fields
    const requiredNumbers = [
      'nextReviewDate', 'interval', 'repetitions', 'easeFactor', 
      'lastReviewed', 'createdAt', 'updatedAt'
    ];

    for (const field of requiredNumbers) {
      if (typeof srsData[field] !== 'number' || !Number.isFinite(srsData[field])) {
        result.errors.push(`${field} must be a finite number`);
        result.isValid = false;
      }
    }

    // Value range validation
    if (result.isValid) {
      if (srsData.interval < 0) {
        result.errors.push('interval cannot be negative');
        result.isValid = false;
      }

      if (srsData.repetitions < 0) {
        result.errors.push('repetitions cannot be negative');
        result.isValid = false;
      }

      if (srsData.easeFactor < 1.3 || srsData.easeFactor > 3.0) {
        result.warnings.push('easeFactor outside typical range (1.3-3.0)');
      }

      if (srsData.nextReviewDate < 0 || srsData.lastReviewed < 0 || 
          srsData.createdAt < 0 || srsData.updatedAt < 0) {
        result.errors.push('timestamps cannot be negative');
        result.isValid = false;
      }

      // Logical validation
      if (srsData.updatedAt < srsData.createdAt) {
        result.errors.push('updatedAt cannot be before createdAt');
        result.isValid = false;
      }

      if (srsData.lastReviewed > Date.now() + 86400000) { // 1 day future
        result.warnings.push('lastReviewed is in the future');
      }
    }

    return result;
  }

  /**
   * Validate user configuration
   */
  static validateUserConfig(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!config || typeof config !== 'object') {
      result.isValid = false;
      result.errors.push('config must be an object');
      return result;
    }

    // String fields
    if (config.ttsVoice !== undefined && typeof config.ttsVoice !== 'string') {
      result.errors.push('ttsVoice must be a string');
      result.isValid = false;
    }

    if (config.targetLanguage !== undefined && typeof config.targetLanguage !== 'string') {
      result.errors.push('targetLanguage must be a string');
      result.isValid = false;
    }

    // Numeric fields with ranges
    if (config.speechRate !== undefined) {
      if (typeof config.speechRate !== 'number' || !Number.isFinite(config.speechRate)) {
        result.errors.push('speechRate must be a number');
        result.isValid = false;
      } else if (config.speechRate < 0.1 || config.speechRate > 3.0) {
        result.warnings.push('speechRate outside recommended range (0.1-3.0)');
      }
    }

    if (config.speechPitch !== undefined) {
      if (typeof config.speechPitch !== 'number' || !Number.isFinite(config.speechPitch)) {
        result.errors.push('speechPitch must be a number');
        result.isValid = false;
      } else if (config.speechPitch < 0.1 || config.speechPitch > 2.0) {
        result.warnings.push('speechPitch outside recommended range (0.1-2.0)');
      }
    }

    // Boolean fields
    if (config.notificationsEnabled !== undefined && typeof config.notificationsEnabled !== 'boolean') {
      result.errors.push('notificationsEnabled must be a boolean');
      result.isValid = false;
    }

    // Hour validation (0-23)
    if (config.quietHoursStart !== undefined) {
      if (!Number.isInteger(config.quietHoursStart) || config.quietHoursStart < 0 || config.quietHoursStart > 23) {
        result.errors.push('quietHoursStart must be an integer between 0 and 23');
        result.isValid = false;
      }
    }

    if (config.quietHoursEnd !== undefined) {
      if (!Number.isInteger(config.quietHoursEnd) || config.quietHoursEnd < 0 || config.quietHoursEnd > 23) {
        result.errors.push('quietHoursEnd must be an integer between 0 and 23');
        result.isValid = false;
      }
    }

    if (config.newWordRepetitions !== undefined) {
      if (!Number.isInteger(config.newWordRepetitions) || config.newWordRepetitions < 1 || config.newWordRepetitions > 10) {
        result.errors.push('newWordRepetitions must be an integer between 1 and 10');
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Validate review session data
   */
  static validateReviewSession(session: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!session || typeof session !== 'object') {
      result.isValid = false;
      result.errors.push('session must be an object');
      return result;
    }

    // Required fields
    if (!session.itemId || typeof session.itemId !== 'string') {
      result.errors.push('itemId is required and must be a string');
      result.isValid = false;
    }

    if (typeof session.startTime !== 'number' || !Number.isFinite(session.startTime)) {
      result.errors.push('startTime must be a number');
      result.isValid = false;
    }

    // Optional fields
    if (session.endTime !== undefined) {
      if (typeof session.endTime !== 'number' || !Number.isFinite(session.endTime)) {
        result.errors.push('endTime must be a number if provided');
        result.isValid = false;
      } else if (session.endTime < session.startTime) {
        result.errors.push('endTime cannot be before startTime');
        result.isValid = false;
      }
    }

    if (session.quality !== undefined) {
      if (!Number.isInteger(session.quality) || session.quality < 1 || session.quality > 4) {
        result.errors.push('quality must be an integer between 1 and 4');
        result.isValid = false;
      }
    }

    if (session.responseTime !== undefined) {
      if (typeof session.responseTime !== 'number' || !Number.isFinite(session.responseTime) || session.responseTime < 0) {
        result.errors.push('responseTime must be a non-negative number if provided');
        result.isValid = false;
      } else if (session.responseTime > 600000) { // 10 minutes
        result.warnings.push('responseTime is unusually long (>10 minutes)');
      }
    }

    return result;
  }

  /**
   * Validate complete extension data export
   */
  static validateExportData(data: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!data || typeof data !== 'object') {
      result.isValid = false;
      result.errors.push('data must be an object');
      return result;
    }

    // Check required top-level fields
    if (!data.version || typeof data.version !== 'string') {
      result.errors.push('version is required and must be a string');
      result.isValid = false;
    }

    if (!data.exportDate || typeof data.exportDate !== 'string') {
      result.errors.push('exportDate is required and must be a string');
      result.isValid = false;
    } else {
      // Validate ISO date format
      const date = new Date(data.exportDate);
      if (isNaN(date.getTime())) {
        result.errors.push('exportDate must be a valid ISO date string');
        result.isValid = false;
      }
    }

    // Validate vocabulary array
    if (!data.vocabulary || !Array.isArray(data.vocabulary)) {
      result.errors.push('vocabulary is required and must be an array');
      result.isValid = false;
    } else {
      for (let i = 0; i < data.vocabulary.length; i++) {
        const itemValidation = this.validateVocabularyItem(data.vocabulary[i]);
        if (!itemValidation.isValid) {
          result.errors.push(`vocabulary[${i}]: ${itemValidation.errors.join(', ')}`);
          result.isValid = false;
        }
        result.warnings.push(...itemValidation.warnings.map(w => `vocabulary[${i}]: ${w}`));
      }

      // Check for duplicate IDs
      const ids = data.vocabulary.map((item: any) => item.id).filter(Boolean);
      const duplicateIds = ids.filter((id: string, index: number) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        result.errors.push(`Duplicate vocabulary IDs found: ${[...new Set(duplicateIds)].join(', ')}`);
        result.isValid = false;
      }
    }

    // Validate user config
    if (data.userConfig) {
      const configValidation = this.validateUserConfig(data.userConfig);
      if (!configValidation.isValid) {
        result.errors.push(`userConfig: ${configValidation.errors.join(', ')}`);
        result.isValid = false;
      }
      result.warnings.push(...configValidation.warnings.map(w => `userConfig: ${w}`));
    }

    // Validate review history
    if (data.reviewHistory) {
      if (!Array.isArray(data.reviewHistory)) {
        result.errors.push('reviewHistory must be an array if provided');
        result.isValid = false;
      } else {
        for (let i = 0; i < Math.min(data.reviewHistory.length, 100); i++) { // Validate first 100 sessions
          const sessionValidation = this.validateReviewSession(data.reviewHistory[i]);
          if (!sessionValidation.isValid) {
            result.errors.push(`reviewHistory[${i}]: ${sessionValidation.errors.join(', ')}`);
            result.isValid = false;
            break; // Stop on first error to avoid spam
          }
        }
        
        if (data.reviewHistory.length > 1000) {
          result.warnings.push('reviewHistory has many entries (>1000), consider pruning old data');
        }
      }
    }

    // Version compatibility warnings
    if (data.version && typeof data.version === 'string') {
      const versionParts = data.version.split('.').map(Number);
      if (versionParts.length >= 2) {
        const majorVersion = versionParts[0];
        if (majorVersion > 2) {
          result.warnings.push('Data exported from a newer version, compatibility may be limited');
        } else if (majorVersion < 2) {
          result.warnings.push('Data exported from an older version, some features may not be available');
        }
      }
    }

    return result;
  }

  /**
   * Validate and sanitize vocabulary array for import
   */
  static validateVocabularyArray(vocabularyArray: any): ValidationResult & { sanitizedData?: VocabularyItem[] } {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!Array.isArray(vocabularyArray)) {
      result.isValid = false;
      result.errors.push('vocabulary must be an array');
      return result;
    }

    if (vocabularyArray.length === 0) {
      result.warnings.push('vocabulary array is empty');
      return { ...result, sanitizedData: [] };
    }

    if (vocabularyArray.length > 10000) {
      result.warnings.push('vocabulary array is very large (>10,000 items), import may be slow');
    }

    const sanitizedItems: VocabularyItem[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < vocabularyArray.length; i++) {
      const itemValidation = this.validateVocabularyItem(vocabularyArray[i]);
      
      if (!itemValidation.isValid) {
        result.errors.push(`Item ${i + 1}: ${itemValidation.errors.join(', ')}`);
        result.isValid = false;
        continue;
      }

      result.warnings.push(...itemValidation.warnings.map(w => `Item ${i + 1}: ${w}`));

      const item = vocabularyArray[i];
      
      // Handle duplicate IDs
      if (item.id && seenIds.has(item.id)) {
        result.warnings.push(`Item ${i + 1}: Duplicate ID '${item.id}', will be reassigned`);
        delete item.id; // Remove duplicate ID, will be regenerated
      } else if (item.id) {
        seenIds.add(item.id);
      }

      sanitizedItems.push(item);
    }

    return { ...result, sanitizedData: sanitizedItems };
  }
}

/**
 * Export validation utilities
 */
export class ExportValidator {
  /**
   * Validate export data before saving
   */
  static validateBeforeExport(data: any): ValidationResult {
    const validation = SchemaValidator.validateExportData(data);
    
    // Additional export-specific validations
    if (validation.isValid) {
      if (!data.vocabulary || data.vocabulary.length === 0) {
        validation.warnings.push('No vocabulary items to export');
      }

      if (!data.reviewHistory || data.reviewHistory.length === 0) {
        validation.warnings.push('No review history to export');
      }
    }

    return validation;
  }

  /**
   * Generate export summary
   */
  static generateExportSummary(data: any): string {
    if (!data || typeof data !== 'object') {
      return 'Invalid export data';
    }

    const vocabularyCount = Array.isArray(data.vocabulary) ? data.vocabulary.length : 0;
    const reviewCount = Array.isArray(data.reviewHistory) ? data.reviewHistory.length : 0;
    const hasConfig = !!data.userConfig;
    const hasStats = !!data.learningStats;

    return `Export contains: ${vocabularyCount} vocabulary items, ${reviewCount} review sessions${hasConfig ? ', user configuration' : ''}${hasStats ? ', learning statistics' : ''}. Exported from version ${data.version || 'unknown'} on ${data.exportDate || 'unknown date'}.`;
  }
}

/**
 * Import validation utilities  
 */
export class ImportValidator {
  /**
   * Pre-validate import data before processing
   */
  static preValidateImport(jsonString: string): ValidationResult & { parsedData?: any } {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Parse JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
      return result;
    }

    // Basic structure validation
    const validation = SchemaValidator.validateExportData(parsedData);
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);
    result.isValid = validation.isValid;

    return { ...result, parsedData };
  }

  /**
   * Generate import summary
   */
  static generateImportSummary(data: any): string {
    const validation = SchemaValidator.validateExportData(data);
    
    if (!validation.isValid) {
      return `Import failed: ${validation.errors.join('; ')}`;
    }

    const vocabularyCount = data.vocabulary?.length || 0;
    const reviewCount = data.reviewHistory?.length || 0;

    let summary = `Ready to import ${vocabularyCount} vocabulary items`;
    if (reviewCount > 0) {
      summary += ` and ${reviewCount} review sessions`;
    }
    if (data.userConfig) {
      summary += ' with user configuration';
    }

    if (validation.warnings.length > 0) {
      summary += `. Warnings: ${validation.warnings.length} issues found`;
    }

    return summary;
  }
}