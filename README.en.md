# CineIsle · 映屿

[简体中文](README.md) | [English](README.en.md)

CineIsle is a personal media library client for HarmonyOS NEXT. It connects to your Jellyfin server to browse and play your movies and TV shows. Built with ArkTS and the ArkUI Stage model, it supports HarmonyOS 5.0 / API 12 and later. The application bundle name is `com.cineisle.app`.

The Chinese name, 映屿, evokes an island of images that belongs to you. CineIsle combines “cinema” and “isle.”

## Features

- **Navigation**: Access favorites and offline downloads from the home screen. The four bottom navigation tabs are Home, Recommendations, Actors, and More.
- **Media libraries**: Open libraries from More. The home screen shows Continue Watching, Next Up, and recently added items from each library.
- **Search**: Open search using the toolbar icon.
- **Media details**: View the original title, year, content rating and score, genres, directors, writers, and cast. Movie details also include file size and audio/video specifications.
- **Playback controls**: Choose a media source, audio track, and subtitles. Picture-in-picture, background audio playback, and lock screen controls are supported.
- **Offline downloads**: Download media and manage local downloads.
- **Language preferences**: Set your preferred audio and subtitle languages.
- **App lock**: Protect the app with a PIN and lock playback controls.

## Requirements

- HarmonyOS NEXT / API 12 or later
- DevEco Studio with a local API 12 or compatible SDK
- A Jellyfin server running version 10.8.9 or 10.10.0

## Getting Started

1. Clone the repository and switch to `develop`:

   ```bash
   git clone https://github.com/MiniTiny/cineisle.git
   cd cineisle
   git checkout develop
   ```

2. Open the project directory in DevEco Studio and configure Signing Configs using your Huawei developer account.

3. Select `entry` → `default` → `debug` and run the app on your target device.

4. On first launch, enter your Jellyfin server address, username, and password.

## Command-Line Build

```bash
./scripts/build.sh
```

Before the first build, the script checks the generated OpenAPI client and original icons for drift.

The generated package is located at `entry/build/default/outputs/default/entry-default-unsigned.hap`.

## Project Structure

```text
entry/src/main/ets/
├── api/                # HTTP transport, protocol mapping, and generated clients
├── components/         # Media cards, sections, metadata, and PiP subtitles
├── entryability/       # Application entry point
├── model/              # Domain models
├── pages/              # Login, home, recommendations, actors, settings, details, and player
├── service/            # Jellyfin client, sessions, storage, downloads, and playback
└── utils/              # Protocol, cache, playback, and language preference utilities
```

## Testing

Run the full regression suite:

```bash
node tests/run-regression.cjs
```

Run individual checks with Node.js and Python available on your `PATH`:

```bash
# Branding and icons
node tests/branding.test.cjs
# OpenAPI regression tests
node tests/openapi-regression.test.cjs
# Protocol tests
node tests/protocol.test.cjs
# Original icon checks
python3 tests/original-icons.test.py
# Build artifact branding checks
python3 tests/brand-package.test.py
```

## License

See [LICENSE](LICENSE) for the project's license terms.

Third-party materials and their sources are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Branding

CineIsle's original logo combines an island, a beam of light from a cinema screen, and warm points of light. See the [brand guide](docs/BRAND.md) for details.

## Further Reading

The following project guides are currently written in Chinese:

- [Branching conventions](docs/BRANCHING.md): Development and release workflow
- [Migration checklist](docs/MIGRATION.md): Feature progress and baseline comparison
- [Validation guide](docs/VALIDATION.md): Acceptance checks and evidence boundaries
- [OpenAPI guide](openapi/README.md): Jellyfin client version and upgrade workflow

## Platform References

- [HarmonyOS NEXT documentation](https://developer.huawei.com/consumer/en/)
- [File upload and download guide](https://developer.huawei.com/consumer/en/doc/harmonyos-guides-V13/app-file-upload-download-V13)
