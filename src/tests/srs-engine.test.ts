import { calculateSRSData, createInitialSRSData } from '../background/srs-engine';
import { SRSData } from '../types/srs';

// Mock Date.now() to control timestamps in tests
const MOCK_DATE_NOW = 1704067200000; // Jan 1, 2025 00:00:00 GMT
const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => MOCK_DATE_NOW);

describe('SRS Engine - SM-2 Algorithm', () => {

  let initialData: SRSData;

  beforeEach(() => {
    initialData = createInitialSRSData();
  });

  afterAll(() => {
    dateSpy.mockRestore();
  });

  test('should handle a perfect response (5) for a new item', () => {
    const quality = 5;
    const result = calculateSRSData(initialData, quality);

    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1); // First interval is 1 day
    expect(result.easeFactor).toBe(2.6); // 2.5 + 0.1
    expect(result.nextReviewDate).toBe(MOCK_DATE_NOW + 24 * 60 * 60 * 1000);
  });

  test('should handle a correct response (4) for an item reviewed once', () => {
    // First review was perfect
    const firstReviewData = calculateSRSData(initialData, 5);

    // Second review
    const quality = 4;
    const result = calculateSRSData(firstReviewData, quality);

    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6); // Second interval is 6 days
    expect(result.easeFactor).toBe(2.6); // EF for quality 4 is 2.5 + 0 = 2.5, but first was 2.6
  });

  test('should handle an incorrect response (2) and reset progress', () => {
    // Item has some progress
    const existingData: SRSData = {
      ...initialData,
      repetitions: 3,
      interval: 10,
      easeFactor: 2.5,
    };

    const quality = 2;
    const result = calculateSRSData(existingData, quality);

    expect(result.repetitions).toBe(0); // Progress is reset
    expect(result.interval).toBe(1); // Interval resets to 1 day
    expect(result.easeFactor).toBe(2.5); // Ease factor is not modified on failure in this model
  });

  test('should clamp the ease factor at the minimum of 1.3', () => {
    // An item with a low ease factor that would be pushed lower
     const existingData: SRSData = {
      ...initialData,
      repetitions: 5,
      interval: 20,
      easeFactor: 1.35,
    };

    // A difficult response (quality 3) that would lower EF below 1.3
    const quality = 3;
    const result = calculateSRSData(existingData, quality);

    expect(result.easeFactor).toBe(1.3); // EF is clamped
  });

});

// Note: This is a basic test suite. A production environment would require a testing framework like Jest to be set up.
// The code `jest.spyOn` is representative of how one would mock the date in such a framework.
