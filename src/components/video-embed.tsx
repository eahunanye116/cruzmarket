'use client';

function getYouTubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
        return match[2];
    } else {
        return null;
    }
}

export function VideoEmbed({ url }: { url: string }) {
    const videoId = getYouTubeId(url);

    if (!videoId) {
        return (
            <div className="text-center text-muted-foreground p-4 border rounded-lg">
                <p>Could not embed video. Invalid or unsupported URL.</p>
            </div>
        );
    }

    return (
        <div className="aspect-video w-full">
            <iframe
                className="w-full h-full rounded-lg border"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            ></iframe>
        </div>
    );
}
