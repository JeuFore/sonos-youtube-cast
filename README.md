# Sonos YouTube Cast

A bridge application that enables YouTube casting functionality to Sonos speakers by acting as a Chromecast Audio receiver and playing content through your Sonos system.

## Overview

This project combines the power of [yt-cast-receiver](https://github.com/patrickkfkan/yt-cast-receiver) with Sonos speakers to create a seamless YouTube casting experience. The application:

- Acts as a Chromecast Audio receiver on your network
- Receives YouTube cast requests from mobile devices, computers, or any Cast-enabled app
- Downloads audio content via [MeTube](https://github.com/alexta69/metube) API
- Plays the audio through your Sonos speaker system

## Features

- **YouTube Cast Support**: Cast YouTube videos from any device with Cast functionality
- **Sonos Integration**: Seamlessly plays audio through Sonos speakers
- **Queue Management**: Handles playlists and queue management automatically
- **Auto-discovery**: Appears as "Chromecast Audio" device on your network
- **Persistent Storage**: Maintains state across restarts
- **Docker Support**: Easy deployment with Docker and Docker Compose

## Prerequisites

- **Sonos Speaker**: A Sonos speaker or soundbar on your network
- **MeTube Instance**: A running [MeTube](https://github.com/alexta69/metube) server for YouTube audio downloading
- **Docker** (optional but recommended)

## Quick Start with Docker

1. **Clone the repository**:
   ```bash
   git clone git@github.com:JeuFore/sonos-youtube-cast.git
   cd sonos-youtube-cast
   ```

2. **Configure environment**:
   Edit the `docker-compose.yml` file and set your Sonos device IP:
   ```yaml
   environment:
     - SONOS_DEVICE_IP=192.168.1.100  # Replace with your Sonos IP
     - DEVICE_NAME=Living Room Sonos   # Optional: Custom device name
   ```

3. **Start the application**:
   ```bash
   docker compose up -d --build
   ```

4. **Cast from your device**:
   - Open YouTube on your phone, tablet, or computer
   - Look for the Cast button and select your device name
   - Start casting!

## Manual Setup

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```bash
# Required
SONOS_DEVICE_IP=192.168.1.100        # Your Sonos device IP address

# Optional
DEVICE_NAME=My YouTube Cast Receiver  # Name shown in cast devices list
LOG_LEVEL=info                        # debug, info, warn, error
MEETUBE_API_BASE_URL=http://localhost:8081
MEETUBE_AUDIO_URL=http://localhost:8081/audio_download
PLAYLIST_PULL_INTERVAL=30             # Seconds between playlist updates
PLAYLIST_MAX_AHEAD_DOWNLOAD=10        # Number of tracks to download ahead
PLAYLIST_DOWNLOAD_INTERVAL=20         # Seconds between downloads
```

### 3. Build and Run

```bash
# Development mode
npm run dev

# Production build and run
npm run build
npm start
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SONOS_DEVICE_IP` | *Required* | IP address of your Sonos device |
| `DEVICE_NAME` | "My YouTube Cast Receiver" | Name displayed in cast device list |
| `LOG_LEVEL` | "info" | Logging level (debug, info, warn, error) |
| `MEETUBE_API_BASE_URL` | "http://localhost:8081" | MeTube server URL |
| `MEETUBE_AUDIO_URL` | "{MEETUBE_API_BASE_URL}/audio_download" | MeTube audio download endpoint |
| `PLAYLIST_PULL_INTERVAL` | 30 | Seconds between playlist updates |
| `PLAYLIST_MAX_AHEAD_DOWNLOAD` | 10 | Number of tracks to pre-download |
| `PLAYLIST_DOWNLOAD_INTERVAL` | 20 | Seconds between track downloads |

### Network Configuration

The application uses:
- **Port 8099**: DIAL server for device discovery
- **Host network mode**: Required for proper Chromecast functionality

## How It Works

1. **Device Discovery**: The app runs a DIAL server that makes it discoverable as a Chromecast Audio device
2. **Cast Reception**: When you cast from YouTube, the app receives the media URLs
3. **Audio Processing**: Videos are processed through MeTube to extract high-quality audio
4. **Sonos Playback**: Audio is streamed to your Sonos speaker with queue management
5. **Synchronization**: The app maintains sync between the cast session and Sonos playback

## Troubleshooting

### Device Not Appearing in Cast List

- Ensure the application is running on the same network as your casting device
- Check that port 8099 is not blocked by firewall
- Verify host network mode is enabled (Docker)

### Sonos Connection Issues

- Confirm the Sonos device IP address is correct
- Ensure the Sonos speaker is on the same network
- Check Sonos speaker is not grouped (ungrouping may be required)

### Audio Download Problems

- Verify MeTube server is running and accessible
- Check `MEETUBE_API_BASE_URL` configuration
- Ensure sufficient disk space for audio downloads

### Logs

Enable debug logging for detailed troubleshooting:
```bash
LOG_LEVEL=debug
```

## Development

### Project Structure

```
src/
├── index.ts          # Main application entry point
├── player.ts         # Sonos player implementation
└── types/
    ├── metube.d.ts   # MeTube API type definitions
    └── sonos.d.ts    # Sonos queue type definitions
```

### Building

```bash
# Development with watch mode
npm run dev

# Production build
npm run build
```

### Scripts

- `npm run start`: Run production build
- `npm run build`: Build TypeScript to JavaScript
- `npm run dev`: Development mode with hot reload

## Dependencies

### Core Dependencies

- **yt-cast-receiver**: Chromecast receiver implementation
- **sonos**: Sonos device control library
- **dotenv**: Environment variable management
- **tracer**: Logging utility
- **timer-node**: Timing utilities

### Development Dependencies

- **TypeScript**: Type-safe JavaScript
- **Webpack**: Module bundler
- **tsx**: TypeScript execution for development

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section above
- Review application logs with debug level enabled
- Ensure all prerequisites are properly configured

---

*This project bridges YouTube casting with Sonos speakers, providing a seamless audio experience for your home entertainment system.*