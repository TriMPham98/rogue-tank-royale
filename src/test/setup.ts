import "@testing-library/jest-dom";

// Mock zustand store for testing
import { vi } from "vitest";

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
