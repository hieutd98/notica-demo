# Notica Demo - Speech-to-Text Comparison

Demo application to compare AWS Transcribe and Deepgram speech-to-text services.

## Features

- Upload audio files (mp3, wav, m4a, webm, ogg, flac)
- Compare transcription results from AWS Transcribe and Deepgram
- Display processing time and accuracy for each service
- Simple and intuitive web interface

## Tech Stack

- **Backend**: NestJS
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Speech-to-Text Services**:
  - AWS Transcribe
  - Deepgram
- **Infrastructure**: Docker (using notica-docker)

## Prerequisites

- Node.js 18+
- AWS Account with Transcribe and S3 access
- Deepgram API Key
- Docker and Docker Compose (for containerized deployment)

## Setup

### 1. Clone the repository

```bash
git clone git@github.com:hieutd98/notica-demo.git
cd notica-demo
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Update the following variables in `.env`:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your_s3_bucket_name

# Deepgram Configuration
DEEPGRAM_API_KEY=your_deepgram_api_key
```

### 4. Run the application

#### Development mode (standalone)

```bash
npm run start:dev
```

The application will be available at `http://localhost:3000`

#### Production mode

```bash
npm run build
npm run start:prod
```

### 5. Run with Docker (using notica-docker infrastructure)

Make sure you have cloned and configured the `notica-docker` repository.

From the `notica-docker` directory:

```bash
cd ../notica-docker
docker-compose up notica-demo
```

The application will be available at `http://localhost:3001`

## Usage

1. Open your browser and navigate to `http://localhost:3000` (or `http://localhost:3001` if using Docker)
2. Click "Choose Audio File" and select an audio file
3. Select the language of the audio
4. Click "Start Comparison"
5. Wait for the results to appear

## API Endpoints

### Compare both services

```bash
POST /transcription/upload?language=en-US
Content-Type: multipart/form-data

file: <audio_file>
```

### Use specific provider

```bash
POST /transcription/upload/:provider?language=en-US
Content-Type: multipart/form-data

file: <audio_file>
provider: aws | deepgram
```

## Project Structure

```
notica-demo/
├── src/
│   ├── config/
│   │   └── configuration.ts          # Environment configuration
│   ├── modules/
│   │   └── transcription/
│   │       ├── providers/
│   │       │   ├── aws-transcribe/   # AWS Transcribe service
│   │       │   └── deepgram/         # Deepgram service
│   │       ├── transcription.controller.ts
│   │       ├── transcription.service.ts
│   │       └── transcription.module.ts
│   ├── app.module.ts
│   └── main.ts
├── public/
│   ├── index.html                    # Frontend UI
│   └── uploads/                      # Temporary upload storage
├── .env
├── .env.example
├── Dockerfile
├── package.json
└── README.md
```

## Comparison Results

The application will display:

- **File Information**: Name, language, total processing time
- **AWS Transcribe Results**:
  - Status (COMPLETED/FAILED)
  - Processing time
  - Transcript text
  - Error messages (if any)
- **Deepgram Results**:
  - Status (COMPLETED/FAILED)
  - Processing time
  - Confidence score
  - Transcript text
  - Error messages (if any)
- **Comparison Summary**:
  - Faster provider
  - Time difference

## Supported Languages

- English (US) - en-US
- Vietnamese - vi-VN
- Spanish - es-ES
- French - fr-FR
- German - de-DE
- Japanese - ja-JP
- Korean - ko-KR
- Chinese (Simplified) - zh-CN

## Development

### Code Reference

This project references the logic from:
- **BE-Notica**: `/home/taduyhieu/projects/notica/BE-Notica`
- **Infrastructure**: `/home/taduyhieu/projects/notica/notica-docker`

### Key Files

- AWS Transcribe implementation: `src/modules/transcription/providers/aws-transcribe/aws-transcribe.service.ts`
- Deepgram implementation: `src/modules/transcription/providers/deepgram/deepgram.service.ts`
- Main comparison logic: `src/modules/transcription/transcription.service.ts`

## Troubleshooting

### AWS Transcribe errors

- Make sure your AWS credentials have permissions for Transcribe and S3
- Verify the S3 bucket exists and is in the same region as configured
- Check that the audio file format is supported

### Deepgram errors

- Verify your Deepgram API key is valid
- Check that you have sufficient credits

### Upload errors

- Ensure the audio file format is supported (mp3, wav, m4a, webm, ogg, flac)
- Check file size limits (default max size may need adjustment)

## License

UNLICENSED - Private project

## Author

Created for notica-demo project
