import { SRSData } from '../types/srs';

// The quality of the user's response, from 0 (no recollection) to 5 (perfect recall).
export type PerformanceRating = 0 | 1 | 2 | 3 | 4 | 5;

const MINIMUM_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;

/**
 * Calculates the next review data based on the SM-2 algorithm.
 * @param srsData The current SRS data for the item.
 * @param quality The user's performance rating (0-5).
 * @returns The updated SRSData object.
 */
export function calculateSRSData(srsData: SRSData, quality: PerformanceRating): SRSData {
  const now = Date.now();

  if (quality < 3) {
    // User failed to recall the item. Reset progress.
    return {
      ...srsData,
      repetitions: 0,
      interval: 1,
      nextReviewDate: now + 24 * 60 * 60 * 1000, // 1 day from now
      lastReviewed: now,
      updatedAt: now,
    };
  }

  // User recalled the item. Calculate next interval.
  let newInterval: number;
  const newRepetitions = srsData.repetitions + 1;

  if (newRepetitions === 1) {
    newInterval = 1;
  } else if (newRepetitions === 2) {
    newInterval = 6;
  } else {
    newInterval = Math.round(srsData.interval * srsData.easeFactor);
  }

  // Update the ease factor.
  const newEaseFactor = srsData.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const clampedEaseFactor = Math.max(newEaseFactor, MINIMUM_EASE_FACTOR);

  const millisecondsInADay = 24 * 60 * 60 * 1000;
  const nextReviewDate = now + newInterval * millisecondsInADay;

  return {
    ...srsData,
    repetitions: newRepetitions,
    interval: newInterval,
    easeFactor: clampedEaseFactor,
    nextReviewDate,
    lastReviewed: now,
    updatedAt: now,
  };
}

/**
 * Creates the initial SRS data for a new vocabulary item.
 */
export function createInitialSRSData(): SRSData {
    const now = Date.now();
    return {
        nextReviewDate: now,
        interval: 0,
        repetitions: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        lastReviewed: 0,
        createdAt: now,
        updatedAt: now,
    };
}
