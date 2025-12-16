import { Injectable } from '@nestjs/common';
import { AwsTranscribeService } from './providers/aws-transcribe/aws-transcribe.service';
import { DeepgramService } from './providers/deepgram/deepgram.service';

@Injectable()
export class TranscriptionService {
  constructor(
    private awsTranscribeService: AwsTranscribeService,
    private deepgramService: DeepgramService,
  ) {}

  async compareTranscriptions(
    filePath: string,
    fileName: string,
    languageCode: string = 'en-US',
  ) {
    const startTime = Date.now();

    // Run both services in parallel
    const [awsResult, deepgramResult] = await Promise.all([
      this.awsTranscribeService.transcribeFile(
        filePath,
        fileName,
        languageCode,
      ),
      this.deepgramService.transcribeFile(
        filePath,
        fileName,
        languageCode.split('-')[0],
      ), // Deepgram uses 'en' instead of 'en-US'
    ]);

    const totalTime = Date.now() - startTime;

    return {
      fileName,
      languageCode,
      totalComparisonTime: `${(totalTime / 1000).toFixed(2)}s`,
      results: {
        awsTranscribe: awsResult,
        deepgram: deepgramResult,
      },
      comparison: {
        faster:
          parseFloat(awsResult.duration) < parseFloat(deepgramResult.duration)
            ? 'AWS Transcribe'
            : 'Deepgram',
        timeDifference: `${Math.abs(parseFloat(awsResult.duration) - parseFloat(deepgramResult.duration)).toFixed(2)}s`,
      },
    };
  }

  async transcribeWithProvider(
    provider: 'aws' | 'deepgram',
    filePath: string,
    fileName: string,
    languageCode: string = 'en-US',
  ) {
    if (provider === 'aws') {
      return this.awsTranscribeService.transcribeFile(
        filePath,
        fileName,
        languageCode,
      );
    } else {
      return this.deepgramService.transcribeFile(
        filePath,
        fileName,
        languageCode.split('-')[0],
      );
    }
  }
}
