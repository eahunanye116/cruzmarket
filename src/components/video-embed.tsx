'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function getYouTubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
}

function getTikTokVideoId(url: string): string | null {
    const match = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
    return match ? match[1] : null;
}

function getInstagramShortcode(url: string): string | null {
    const match = url.match(/instagram\.com\/(p|reel)\/([a-zA-Z0-9_-]+)/);
    return match ? match[2] : null;
}


export function VideoEmbed({ url }: { url: string }) {
    const [replayKey, setReplayKey] = useState(0);

    const handleReplay = () => {
        setReplayKey(prevKey => prevKey + 1);
    };

    if (!url) {
        return null;
    }
    
    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
        return (
            <div className="space-y-4">
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleReplay}>
                        <RefreshCw />
                        Replay
                    </Button>
                </div>
                <div key={replayKey} className="aspect-video w-full">
                    <iframe
                        className="w-full h-full rounded-lg border"
                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        );
    }

    const tikTokId = getTikTokVideoId(url);
    if (tikTokId) {
        return (
            <div className="space-y-4">
                 <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleReplay}>
                        <RefreshCw />
                        Replay
                    </Button>
                </div>
                <div key={replayKey} className="aspect-[9/16] w-full max-w-sm mx-auto">
                    <iframe
                        className="w-full h-full rounded-lg border"
                        src={`https://www.tiktok.com/embed/v2/${tikTokId}`}
                        title="TikTok video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        )
    }
    
    const instagramShortcode = getInstagramShortcode(url);
    if (instagramShortcode) {
        return (
             <div className="space-y-4">
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleReplay}>
                        <RefreshCw />
                        Replay
                    </Button>
                </div>
                <div key={replayKey} className="aspect-square w-full max-w-sm mx-auto">
                    <iframe
                        className="w-full h-full rounded-lg border"
                        src={`https://www.instagram.com/p/${instagramShortcode}/embed`}
                        title="Instagram post embed"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        )
    }

    return (
        <div className="text-center text-muted-foreground p-4 border rounded-lg">
            <p>Could not embed video. Invalid or unsupported URL.</p>
            <p className="text-xs mt-1">Supports YouTube, TikTok, and Instagram.</p>
        </div>
    );
}
