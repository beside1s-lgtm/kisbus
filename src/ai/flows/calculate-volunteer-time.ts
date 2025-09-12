'use server';

/**
 * @fileOverview Calculates and tracks volunteer time for designated group leaders.
 *
 * - calculateVolunteerTime - Calculates the total volunteer time for a student.
 * - CalculateVolunteerTimeInput - The input type for the calculateVolunteerTime function.
 * - CalculateVolunteerTimeOutput - The return type for the calculateVolunteerTime function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalculateVolunteerTimeInputSchema = z.object({
  isGroupLeader: z.boolean().describe('Whether the student is a group leader.'),
  daysAsGroupLeader: z.number().describe('The number of days the student has been a group leader.'),
});

export type CalculateVolunteerTimeInput = z.infer<typeof CalculateVolunteerTimeInputSchema>;

const CalculateVolunteerTimeOutputSchema = z.object({
  totalVolunteerTimeMinutes: z
    .number()
    .describe('The total volunteer time in minutes, calculated as 20 minutes per day.'),
});

export type CalculateVolunteerTimeOutput = z.infer<typeof CalculateVolunteerTimeOutputSchema>;

export async function calculateVolunteerTime(input: CalculateVolunteerTimeInput): Promise<CalculateVolunteerTimeOutput> {
  return calculateVolunteerTimeFlow(input);
}

const calculateVolunteerTimeFlow = ai.defineFlow(
  {
    name: 'calculateVolunteerTimeFlow',
    inputSchema: CalculateVolunteerTimeInputSchema,
    outputSchema: CalculateVolunteerTimeOutputSchema,
  },
  async input => {
    const totalVolunteerTimeMinutes = input.isGroupLeader ? input.daysAsGroupLeader * 20 : 0;

    return {
      totalVolunteerTimeMinutes,
    };
  }
);
