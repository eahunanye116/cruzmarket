
'use server';

import { Timestamp } from 'firebase/firestore';
import type { BetMatch } from '@/lib/types';

/**
 * Fetches upcoming matches. 
 * In a production environment, this would call a SportyBet scraper or official API.
 * Currently returns mock data structured like a real feed.
 */
export async function getUpcomingMatches(): Promise<{ success: boolean; matches: BetMatch[] }> {
    try {
        const now = Date.now();
        const hour = 3600000;

        const mockMatches: BetMatch[] = [
            {
                id: 'match_1',
                homeTeam: 'Real Madrid',
                awayTeam: 'Barcelona',
                league: 'La Liga',
                startTime: Timestamp.fromMillis(now + 2 * hour),
                sport: 'football',
                odds: { home: 1.85, draw: 3.40, away: 4.20 }
            },
            {
                id: 'match_2',
                homeTeam: 'Manchester City',
                awayTeam: 'Arsenal',
                league: 'Premier League',
                startTime: Timestamp.fromMillis(now + 5 * hour),
                sport: 'football',
                odds: { home: 1.60, draw: 3.80, away: 5.50 }
            },
            {
                id: 'match_3',
                homeTeam: 'Liverpool',
                awayTeam: 'Manchester United',
                league: 'Premier League',
                startTime: Timestamp.fromMillis(now + 24 * hour),
                sport: 'football',
                odds: { home: 1.45, draw: 4.50, away: 7.00 }
            },
            {
                id: 'match_4',
                homeTeam: 'Bayern Munich',
                awayTeam: 'Dortmund',
                league: 'Bundesliga',
                startTime: Timestamp.fromMillis(now + 48 * hour),
                sport: 'football',
                odds: { home: 1.30, draw: 5.20, away: 9.50 }
            },
            {
                id: 'match_5',
                homeTeam: 'PSG',
                awayTeam: 'Lyon',
                league: 'Ligue 1',
                startTime: Timestamp.fromMillis(now + 72 * hour),
                sport: 'football',
                odds: { home: 1.25, draw: 6.00, away: 12.00 }
            },
            {
                id: 'match_6',
                homeTeam: 'Inter Milan',
                awayTeam: 'AC Milan',
                league: 'Serie A',
                startTime: Timestamp.fromMillis(now + 12 * hour),
                sport: 'football',
                odds: { home: 2.10, draw: 3.20, away: 3.40 }
            }
        ];

        return { success: true, matches: mockMatches };
    } catch (error: any) {
        return { success: false, matches: [] };
    }
}
