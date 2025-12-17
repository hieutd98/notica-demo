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
    deepgramModel: string = 'nova-3',
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
        deepgramModel,
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
    deepgramModel: string = 'nova-3',
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
        deepgramModel,
      );
    }
  }

  // Async version that returns job ID immediately
  async startCompareTranscriptionsAsync(
    filePath: string,
    fileName: string,
    languageCode: string = 'en-US',
    deepgramModel: string = 'nova-3',
  ): Promise<string> {
    const jobId = this.jobManagerService.createComparisonJob(
      fileName,
      filePath,
      languageCode,
      deepgramModel,
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
    deepgramModel: string = 'nova-3',
  ): Promise<string> {
    const jobId = this.jobManagerService.createJob(
      fileName,
      filePath,
      languageCode,
      provider,
      deepgramModel,
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

    this.jobManagerService.updateJobStatus(jobId, JobStatus.PROCESSING);

    const startTime = Date.now();
    const deepgramModel = job.deepgramModel || 'nova-3';

    // Run both providers independently (fire-and-forget)
    // Each provider will update the job when it completes
    const awsPromise = this.runProviderTranscription(
      jobId,
      'aws',
      job.filePath,
      job.fileName,
      job.languageCode,
      deepgramModel,
    );

    const deepgramPromise = this.runProviderTranscription(
      jobId,
      'deepgram',
      job.filePath,
      job.fileName,
      job.languageCode,
      deepgramModel,
    );

    // Wait for both to complete (for cleanup purposes only)
    await Promise.allSettled([awsPromise, deepgramPromise]);

    // Clean up uploaded file after all providers are done
    if (fs.existsSync(job.filePath)) {
      fs.unlinkSync(job.filePath);
    }
  }

  // Run a single provider and update job immediately when done
  private async runProviderTranscription(
    jobId: string,
    provider: 'aws' | 'deepgram',
    filePath: string,
    fileName: string,
    languageCode: string,
    deepgramModel: string = 'nova-3',
  ): Promise<void> {
    try {
      let result;
      if (provider === 'aws') {
        result = await this.awsTranscribeService.transcribeFile(
          filePath,
          fileName,
          languageCode,
        );
      } else {
        result = await this.deepgramService.transcribeFile(
          filePath,
          fileName,
          languageCode.split('-')[0],
          deepgramModel,
        );
      }

      // Update job immediately when this provider completes
      this.jobManagerService.updateProviderResult(jobId, provider, result);
    } catch (error) {
      console.error(`Provider ${provider} failed for job ${jobId}:`, error);
      this.jobManagerService.failProviderResult(
        jobId,
        provider,
        error.message,
      );
    }
  }

  private async runTranscribeWithProviderJob(jobId: string): Promise<void> {
    const job = this.jobManagerService.getJob(jobId);
    if (!job || !job.provider) return;

    try {
      this.jobManagerService.updateJobStatus(jobId, JobStatus.PROCESSING);

      const deepgramModel = job.deepgramModel || 'nova-3';
      const result = await this.transcribeWithProvider(
        job.provider,
        job.filePath,
        job.fileName,
        job.languageCode,
        deepgramModel,
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
