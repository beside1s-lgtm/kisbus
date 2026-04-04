/**
 * KIS Bus Manager Firebase Data Service
 * 
 * This file is now a facade that re-exports functionality from the split modules.
 * For new development, consider importing directly from '@/lib/firebase/<feature>'.
 */

export * from './firebase/core';
export * from './firebase/buses';
export * from './firebase/students';
export * from './firebase/routes';
export * from './firebase/attendance';
export * from './firebase/teachers';
export * from './firebase/lost-items';
export * from './firebase/group-leaders';
export * from './firebase/destinations';
export * from './firebase/assignments';
export * from './firebase/after-school-classes';
