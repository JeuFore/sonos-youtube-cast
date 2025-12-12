interface MusicInfo {
    id: string;
    title: string;
    size: number;
    filename: string;
    where?: keyof MusicInfoResponse;
    status: 'pending' | 'finished' | 'error';
    entry: {
        id: string;
        title: string;
        thumbnail: string;
        description: string;
        duration: number;
        album: string;
        artist: string;
        creator: string;
        artists: string[];
        track: string;
        release_date: string;
        duration_string: string;
    }
}

interface MusicInfoResponse {
    queue: MusicInfo[],
    done: MusicInfo[],
    pending: MusicInfo[]
}