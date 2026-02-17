
'use client';

import { useState, useEffect, useMemo } from 'react';
import { getUpcomingMatches } from '@/app/actions/betting-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Dribbble, Timer, ShieldAlert, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import type { BetMatch, BetSelection } from '@/lib/types';
import { BetSlip } from '@/components/betting/bet-slip';
import { cn } from '@/lib/utils';

export default function BettingPage() {
    const [matches, setMatches] = useState<BetMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [selections, setSelections] = useState<BetSelection[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const result = await getUpcomingMatches();
            if (result.success) setMatches(result.matches);
            setLoading(false);
        };
        fetch();
    }, []);

    const toggleSelection = (match: BetMatch, outcome: '1' | 'X' | '2', odds: number) => {
        setSelections(prev => {
            const existing = prev.find(s => s.matchId === match.id);
            // If already selected the same outcome, remove it
            if (existing && existing.outcome === outcome) {
                return prev.filter(s => s.matchId !== match.id);
            }
            // If selecting a different outcome for the same match, replace it
            const filtered = prev.filter(s => s.matchId !== match.id);
            return [...filtered, {
                matchId: match.id,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                outcome,
                odds
            }];
        });
    };

    const removeSelection = (matchId: string) => {
        setSelections(prev => prev.filter(s => s.matchId !== matchId));
    };

    return (
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-7xl pb-24">
            <div className="flex flex-col items-center text-center mb-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-none bg-primary/10 border-2 mb-4">
                    <Trophy className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-4xl font-bold font-headline">The Betting Arena</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    High-stakes outcomes. Pure internet leverage.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Matches Feed */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold font-headline flex items-center gap-2">
                            <Timer className="h-5 w-5 text-accent" /> Upcoming Fixtures
                        </h2>
                        <Badge variant="secondary" className="font-bold">LIVE ODDS</Badge>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                        </div>
                    ) : matches.length > 0 ? (
                        <div className="space-y-4">
                            {matches.map((match) => (
                                <Card key={match.id} className="overflow-hidden border-2 transition-all hover:border-primary/40">
                                    <div className="bg-muted/30 px-4 py-2 border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                                        <span>{match.league}</span>
                                        <span>{format(new Date(match.startTime), 'PPP p')}</span>
                                    </div>
                                    <CardContent className="p-4 sm:p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                            {/* Match Info */}
                                            <div className="flex items-center justify-center md:justify-start gap-4">
                                                <div className="text-right flex-1">
                                                    <p className="text-sm sm:text-base font-bold truncate">{match.homeTeam}</p>
                                                </div>
                                                <div className="h-8 w-8 rounded-none border-2 flex items-center justify-center text-[10px] font-bold bg-background shrink-0">
                                                    VS
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className="text-sm sm:text-base font-bold truncate">{match.awayTeam}</p>
                                                </div>
                                            </div>

                                            {/* Odds Buttons */}
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { label: '1', key: 'home', outcome: '1' as const },
                                                    { label: 'X', key: 'draw', outcome: 'X' as const },
                                                    { label: '2', key: 'away', outcome: '2' as const }
                                                ].map((opt) => {
                                                    const isSelected = selections.find(s => s.matchId === match.id && s.outcome === opt.outcome);
                                                    const oddsValue = match.odds[opt.key as keyof typeof match.odds];
                                                    
                                                    return (
                                                        <button
                                                            key={opt.outcome}
                                                            onClick={() => toggleSelection(match, opt.outcome, oddsValue)}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center py-2 rounded border-2 transition-all active:scale-95",
                                                                isSelected 
                                                                    ? "bg-primary border-primary text-primary-foreground shadow-hard-sm" 
                                                                    : "bg-background border-border hover:border-primary/50 text-foreground"
                                                            )}
                                                        >
                                                            <span className="text-[10px] font-bold opacity-70 mb-0.5">{opt.label}</span>
                                                            <span className="text-sm font-bold">{oddsValue.toFixed(2)}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-lg">
                            <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="text-muted-foreground">No matches scheduled at this time. Check back later!</p>
                        </div>
                    )}
                </div>

                {/* Bet Slip Sidebar */}
                <div className="lg:col-span-4">
                    <BetSlip 
                        selections={selections} 
                        onRemove={removeSelection} 
                        onClear={() => setSelections([])} 
                    />
                    
                    <div className="mt-6 p-4 rounded-lg bg-accent/5 border-2 border-accent/20 flex gap-4 items-start">
                        <div className="bg-accent/10 p-2 rounded-full">
                            <TrendingUp className="h-5 w-5 text-accent" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-sm">Strategic Note</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Odds are dynamic and inspired by SportyBet's market feed. Always double-check your slip before submitting.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
