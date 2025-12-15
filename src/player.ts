import { Player } from "yt-cast-receiver";
import type { Video, Volume, Logger } from "yt-cast-receiver";
import { Sonos } from "sonos";
import { Timer } from "timer-node";
import axios from "axios";

export default class SonosPlayer extends Player {
    static readonly PLAYLIST_PULL_INTERVAL = process.env.PLAYLIST_PULL_INTERVAL
        ? parseInt(process.env.PLAYLIST_PULL_INTERVAL)
        : 30; // seconds
    static readonly PLAYLIST_MAX_AHEAD_DOWNLOAD = process.env.PLAYLIST_MAX_AHEAD_DOWNLOAD
        ? parseInt(process.env.PLAYLIST_MAX_AHEAD_DOWNLOAD)
        : 10; // items
    static readonly PLAYLIST_DOWNLOAD_INTERVAL = process.env.PLAYLIST_DOWNLOAD_INTERVAL
        ? parseInt(process.env.PLAYLIST_DOWNLOAD_INTERVAL)
        : 20; // seconds

    static readonly MEETUBE_API_BASE_URL = process.env.MEETUBE_API_BASE_URL
        || "http://localhost:8081";
    static readonly MEETUBE_AUDIO_URL = process.env.MEETUBE_AUDIO_URL || process.env.MEETUBE_API_BASE_URL + "/audio_download";

    readonly #device: Sonos;
    #playListInterval: NodeJS.Timeout | null = null;
    #nextTimeout: NodeJS.Timeout | null = null;
    #timer: Timer;
    #seekOffset: number = 0;
    #duration: number = 0;
    #tempPosition: number = 0;

    constructor(logger: Logger) {
        super();

        this.setLogger(logger);
        this.#timer = new Timer();

        this.logger.info("Initializing Sonos Player...");

        if (!process.env.SONOS_DEVICE_IP) {
            this.logger.error("SONOS_DEVICE_IP environment variable is not set.");
            process.exit(1);
        }

        this.#device = new Sonos(process.env.SONOS_DEVICE_IP, 1400, {});

        this.queue.on('playlistUpdated', async () => {
            this.logger.info('Playlist updated, pulling new items...');
            await this.#downloadPlaylist();
            await this.#setDeviceQueue();
        });
    }

    protected async doPlay(video: Video, position: number): Promise<boolean> {
        this.#tempPosition = position;
        this.logger.debug(`[SonosPlayer] Playing video id=${video.id} from position=${position}s`);

        this.#timer.stop();
        this.#resetTimeout();

        const music: MusicInfo | null = await this.#downloadMusic(video.id);

        if (!music?.filename) {
            this.logger.error(`[SonosPlayer] Music not found for video id=${video.id}`);
            this.next();
            return false;
        }

        const url = this.#convertUrlToUri(music.filename);

        const currentIndex = this.queue.videoIds.findIndex((id) => id === video.id) + 1;

        const deviceQueueIndex = await this.#checkTrackInDeviceQueue(url);

        try {
            this.logger.info(`[SonosPlayer] Playing music "${music.title}" on Sonos from URL: ${url}`);

            let condition = false;

            if (!deviceQueueIndex) {
                condition = await this.#device.play(url);
            } else {
                if (deviceQueueIndex === currentIndex) {
                    this.logger.info(`[SonosPlayer] Music is already at correct position in Sonos queue, playing from there.`);
                    condition = await this.#device.selectTrack(deviceQueueIndex) && await this.#device.play(undefined);
                }
                else {
                    this.logger.info(`[SonosPlayer] Moving music to correct position in Sonos queue.`);
                    await this.#device.reorderTracksInQueue(deviceQueueIndex, 1, currentIndex);
                    condition = await this.#device.selectTrack(currentIndex) && await this.#device.play(undefined);
                }
            }

            this.#tempPosition = 0;
            if (!condition) {
                this.logger.error('Error playing music on Sonos');
                return false;
            }

            this.#duration = music.entry.duration;
            await this.doSeek(position);

            this.startPlaylistInterval();
            this.#setDeviceQueue();

            return true;
        } catch (error) {
            this.logger.error('Error playing music on Sonos');
            return false;
        }

    }

    protected async doPause(): Promise<boolean> {
        try {
            await this.#device.pause();
        } catch (error) {
            return false;
        }

        this.#timer.pause();
        this.#resetTimeout();

        return true;
    }

    protected async doResume(): Promise<boolean> {
        try {
            await this.#device.play(undefined)
        } catch (error) {
            return false
        }

        if (this.#timer.isPaused()) {
            this.#timer.resume();
        } else if (this.#timer.isStopped() || !this.#timer.isStarted()) {
            this.#timer.start();
        }
        this.#startTimeout(this.#duration - this.#seekOffset);

        return true;
    }

    protected async doStop(): Promise<boolean> {
        try {
            await this.#device.stop();
        } catch (error) {
            return false;
        }

        this.#seekOffset = 0;
        this.#timer.stop().clear();
        this.#resetTimeout();

        this.stopPlaylistInterval();

        return true
    }

    protected async doSeek(position: number): Promise<boolean> {
        try {
            await this.#device.seek(position);
        } catch (error) {
            return false;
        }

        this.#timer.stop().clear();
        this.#seekOffset = position;
        this.#resetTimeout();
        this.#startTimeout(this.#duration - this.#seekOffset);

        return true;
    }

    protected async doSetVolume(volume: Volume): Promise<boolean> {
        try {
            await this.#device.setVolume(volume.level);
            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    protected async doGetVolume(): Promise<Volume> {
        try {
            return { level: await this.#device.getVolume(), muted: false };
        } catch (error) {
            this.logger.error(error);
            return { level: 0, muted: false };
        }
    }

    protected async doGetPosition(): Promise<number> {
        if (this.#tempPosition) {
            return this.#tempPosition;
        }

        try {
            const track = await this.#device.currentTrack();

            return track.position;
        } catch (error) {
            this.logger.error(error);
            return 0;
        }
    }

    protected async doGetDuration(): Promise<number> {
        try {
            const track = await this.#device.currentTrack();

            return track.duration;
        } catch (error) {
            this.logger.error(error);
            return 0;
        }
    }

    #resetTimeout() {
        if (this.#nextTimeout) {
            clearTimeout(this.#nextTimeout);
            this.#nextTimeout = null;
        }
    }

    #startTimeout(duration: number) {
        this.#resetTimeout();
        this.#nextTimeout = setTimeout(() => {
            void (async () => {
                this.#device.pause();
                this.#seekOffset = 0;
                this.#timer.stop().clear();
                this.logger.info('Track ended, moving to next...');
                await this.next();
            })();
        }, (duration + 1) * 1000);
    }

    #findMusicInList(queue: MusicInfoResponse, currentId: Video["id"], specificState?: MusicInfo["where"]): MusicInfo | null {
        this.logger.debug(`[SonosPlayer] Finding music in list for id=${currentId}`);

        let music: MusicInfo | null = null;

        Object.entries(queue).some(([key, musics]) => {
            if (specificState && key !== specificState) return false;
            return musics.some((currentMusic: MusicInfo) => {
                if (currentMusic.id === currentId) {
                    music = { ...currentMusic, where: key as MusicInfo["where"] };
                    return true;
                }
                return false;
            });
        });

        return music;
    }

    async #retrieveMusicInfo(currentId: Video["id"], specificState?: MusicInfo["where"], wait?: boolean, attempt?: number): Promise<MusicInfo | null> {
        this.logger.debug(`[SonosPlayer] Retrieving music info for id=${currentId} (attempt ${attempt || 0})`);

        let music: MusicInfo | null = null;

        try {
            const { data } = await axios.get<MusicInfoResponse>(
                `${SonosPlayer.MEETUBE_API_BASE_URL}/history`,
            )

            music = this.#findMusicInList(data, currentId, specificState);
        } catch (error) {
            this.logger.error('Error retrieving music info');
            return null;
        }

        if (!music && wait && (attempt || 0) < 240) // wait up to 60 seconds
            return new Promise((resolve) =>
                setTimeout(() => {
                    resolve(this.#retrieveMusicInfo(currentId, specificState, true, (attempt || 0) + 1));
                }, 250)
            );

        return music;
    }

    async #downloadMusic(currentId: Video["id"]): Promise<MusicInfo | null> {
        this.logger.debug(`[SonosPlayer] Downloading music for id=${currentId}`);

        const existMusic: MusicInfo | null = await this.#retrieveMusicInfo(currentId);

        if (existMusic?.status === "finished") return existMusic;
        else if (existMusic?.status === "error") {
            axios.post(`${SonosPlayer.MEETUBE_API_BASE_URL}/delete`, {
                ids: [currentId],
                where: "done",
            }).catch(() => {
                this.logger.error('Error deleting errored music from done list');
            })
        }

        try {
            if (!existMusic?.where || !["queue", "pending"].includes(existMusic.where)) {
                this.logger.info(`[SonosPlayer] Music id=${currentId} not found in queue or pending. Adding to download queue...`);
                await axios.post(`${SonosPlayer.MEETUBE_API_BASE_URL}/add`, {
                    url: currentId,
                    quality: "best",
                    format: "mp3",
                    playlist_strict_mode: false,
                    auto_start: true,
                });
            }
        } catch (error) {
            this.logger.error('Error downloading music');
            return null;
        }

        return await this.#retrieveMusicInfo(currentId, "done", true);
    }

    async #downloadPlaylist(): Promise<void> {
        this.logger.debug('[SonosPlayer] Downloading playlist items...');
        if (!this.queue.current?.id) return;

        const currentIndex =
            this.queue.videoIds.findIndex((id) => id === this.queue.current!.id) + 1;

        try {
            const { data } = await axios.get(`${SonosPlayer.MEETUBE_API_BASE_URL}/history`);

            const musicId = this.queue.videoIds
                .slice(currentIndex, currentIndex + SonosPlayer.PLAYLIST_MAX_AHEAD_DOWNLOAD)
                .find((currentId) => {
                    const music = this.#findMusicInList(data, currentId);

                    return (!music || music.status === "error")
                });

            if (musicId) this.#downloadMusic(musicId);
        } catch (error) {
            this.logger.error('Error downloading playlist music');
        }
    }

    async #checkTrackInDeviceQueue(uri: string): Promise<number | null> {
        try {
            const queueItems = (await this.#device.getQueue()) as { items: SonosQueueItem[] | undefined, total: string };

            const foundItem = (queueItems.items || []).find((item) => item.uri === uri);

            if (foundItem) {
                const index = parseInt(foundItem.id.replace(foundItem.parentID + "/", ""));
                return index;
            }

            return null;
        } catch (error) {
            this.logger.error('Error checking track in Sonos device queue');
            return null;
        }
    }

    async #setDeviceQueue() {
        try {
            const queueItems = (await this.#device.getQueue()) as { items: SonosQueueItem[] | undefined, total: string };

            const currentDeviceQueue: Record<string, SonosQueueItem> = {};

            (queueItems.items || []).forEach((item) => {
                currentDeviceQueue[item.uri] = item;
            })

            const { data } = await axios.get(`${SonosPlayer.MEETUBE_API_BASE_URL}/history`);

            const playlistVideo: MusicInfo[] = []

            this.queue.videoIds.some((videoId) => {
                const music = this.#findMusicInList(data, videoId, "done");

                if (music && music.status === "finished")
                    playlistVideo.push(music);

                return !music || music.status !== "finished"
            });

            for (const [index, music] of playlistVideo.entries()) {
                const uri = this.#convertUrlToUri(music.filename);

                if (!currentDeviceQueue[uri]) {
                    this.logger.info(`[SonosPlayer] Adding music "${music.title}" to Sonos queue`);
                    await this.#device.queue(uri, index + 1);
                }
                else {
                    const existingItem = currentDeviceQueue[uri];
                    const existIndex = parseInt(existingItem.id.replace(existingItem.parentID + "/", ""));

                    if (existIndex !== index + 1) {
                        this.logger.info(`[SonosPlayer] Moving music "${music.title}" in Sonos queue from position ${existIndex} to ${index + 1}`);
                        await this.#device.reorderTracksInQueue(existIndex, 1, index + 1);
                    }
                }
            }

            this.logger.debug('[SonosPlayer] Sonos device queue updated successfully');
        } catch (error) {
            this.logger.error('Error setting Sonos device queue');
        }
    }

    #convertUrlToUri(filename: string): string {
        return new URL(
            `${SonosPlayer.MEETUBE_AUDIO_URL}/${filename}`
        ).href;
    }

    startPlaylistInterval() {
        if (this.#playListInterval) return;

        this.#playListInterval = setInterval(async () => {
            await this.#downloadPlaylist();
            await this.#setDeviceQueue();
        }, SonosPlayer.PLAYLIST_DOWNLOAD_INTERVAL * 1000);
    }

    stopPlaylistInterval() {
        if (this.#playListInterval) {
            clearInterval(this.#playListInterval);
            this.#playListInterval = null;
        }
    }

    clearDeviceQueue() {
        this.#device.getQueue().then((queue) => {
            this.logger.info(`[SonosPlayer] Current Sonos queue has ${queue.total} tracks. Clearing queue...`);
            if (Number(queue.total))
                this.#device.removeTracksFromQueue(1, Number(queue.total));
        }).catch(() => {
            this.logger.error("Error getting Sonos queue");
        });
    }
}