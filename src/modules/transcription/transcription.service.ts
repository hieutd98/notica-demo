import { Injectable } from '@nestjs/common';
import { AwsTranscribeService } from './providers/aws-transcribe/aws-transcribe.service';
import { DeepgramService } from './providers/deepgram/deepgram.service';
import { JobManagerService, JobStatus } from './job-manager.service';
import * as fs from 'fs';

@Injectable()
export class TranscriptionService {
  constructor(
    private awsTranscribeService: AwsTranscribeService,
    private deepgramService: DeepgramService,
    private jobManagerService: JobManagerService,
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

  // Async version that returns job ID immediately
  async startCompareTranscriptionsAsync(
    filePath: string,
    fileName: string,
    languageCode: string = 'en-US',
  ): Promise<string> {
    const jobId = this.jobManagerService.createJob(
      fileName,
      filePath,
      languageCode,
    );

    // Run transcription in background
    this.runCompareTranscriptionsJob(jobId).catch((error) => {
      console.error(`Job ${jobId} failed:`, error);
    });

    return jobId;
  }

  // Async version for single provider
  async startTranscribeWithProviderAsync(
    provider: 'aws' | 'deepgram',
    filePath: string,
    fileName: string,
    languageCode: string = 'en-US',
  ): Promise<string> {
    const jobId = this.jobManagerService.createJob(
      fileName,
      filePath,
      languageCode,
      provider,
    );

    // Run transcription in background
    this.runTranscribeWithProviderJob(jobId).catch((error) => {
      console.error(`Job ${jobId} failed:`, error);
    });

    return jobId;
  }

  private async runCompareTranscriptionsJob(jobId: string): Promise<void> {
    const job = this.jobManagerService.getJob(jobId);
    if (!job) return;

    try {
      this.jobManagerService.updateJobStatus(jobId, JobStatus.PROCESSING);

      const result = await this.compareTranscriptions(
        job.filePath,
        job.fileName,
        job.languageCode,
      );

      this.jobManagerService.completeJob(jobId, result);

      // Clean up uploaded file after processing
      if (fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
    } catch (error) {
      this.jobManagerService.failJob(jobId, error.message);

      // Clean up uploaded file if error occurs
      if (fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
    }
  }

  private async runTranscribeWithProviderJob(jobId: string): Promise<void> {
    const job = this.jobManagerService.getJob(jobId);
    if (!job || !job.provider) return;

    try {
      this.jobManagerService.updateJobStatus(jobId, JobStatus.PROCESSING);

      const result = await this.transcribeWithProvider(
        job.provider,
        job.filePath,
        job.fileName,
        job.languageCode,
      );

      this.jobManagerService.completeJob(jobId, result);

      // Clean up uploaded file after processing
      if (fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
    } catch (error) {
      this.jobManagerService.failJob(jobId, error.message);

      // Clean up uploaded file if error occurs
      if (fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
    }
  }
}
