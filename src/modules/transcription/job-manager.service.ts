import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ProviderResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TranscriptionJob {
  id: string;
  status: JobStatus;
  fileName: string;
  filePath: string;
  languageCode: string;
  provider?: 'aws' | 'deepgram';
  deepgramModel?: string; // Deepgram model selection (nova-2, nova, base, etc.)
  result?: any; // For backward compatibility (single provider jobs)
  error?: string;
  // For comparison jobs - results per provider
  providerResults?: {
    aws?: ProviderResult;
    deepgram?: ProviderResult;
  };
  createdAt: Date;
  completedAt?: Date;
}

@Injectable()
export class JobManagerService {
  private jobs: Map<string, TranscriptionJob> = new Map();

  createJob(
    fileName: string,
    filePath: string,
    languageCode: string,
    provider?: 'aws' | 'deepgram',
    deepgramModel?: string,
  ): string {
    const jobId = randomUUID();
    const job: TranscriptionJob = {
      id: jobId,
      status: JobStatus.PENDING,
      fileName,
      filePath,
      languageCode,
      provider,
      deepgramModel,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  // Create a comparison job with both providers initialized
  createComparisonJob(
    fileName: string,
    filePath: string,
    languageCode: string,
    deepgramModel?: string,
  ): string {
    const jobId = randomUUID();
    const job: TranscriptionJob = {
      id: jobId,
      status: JobStatus.PENDING,
      fileName,
      filePath,
      languageCode,
      deepgramModel,
      providerResults: {
        aws: { status: 'pending' },
        deepgram: { status: 'pending' },
      },
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  getJob(jobId: string): TranscriptionJob | undefined {
    return this.jobs.get(jobId);
  }

  updateJobStatus(jobId: string, status: JobStatus): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      this.jobs.set(jobId, job);
    }
  }

  // Update result for a specific provider in comparison job
  updateProviderResult(
    jobId: string,
    provider: 'aws' | 'deepgram',
    result: any,
  ): void {
    const job = this.jobs.get(jobId);
    if (job && job.providerResults) {
      job.providerResults[provider] = {
        status: 'completed',
        result,
        completedAt: new Date(),
      };

      // Check if all providers are completed
      const allCompleted = this.areAllProvidersCompleted(jobId);
      if (allCompleted) {
        job.status = JobStatus.COMPLETED;
        job.completedAt = new Date();
      } else if (job.status === JobStatus.PENDING) {
        job.status = JobStatus.PROCESSING;
      }

      this.jobs.set(jobId, job);
    }
  }

  // Mark a provider as failed
  failProviderResult(
    jobId: string,
    provider: 'aws' | 'deepgram',
    error: string,
  ): void {
    const job = this.jobs.get(jobId);
    if (job && job.providerResults) {
      job.providerResults[provider] = {
        status: 'failed',
        error,
        completedAt: new Date(),
      };

      // Check if all providers are done (completed or failed)
      const allDone = this.areAllProvidersCompleted(jobId);
      if (allDone) {
        // If at least one succeeded, mark job as completed
        // If all failed, mark job as failed
        const hasSuccess =
          job.providerResults.aws?.status === 'completed' ||
          job.providerResults.deepgram?.status === 'completed';

        job.status = hasSuccess ? JobStatus.COMPLETED : JobStatus.FAILED;
        job.completedAt = new Date();
      } else if (job.status === JobStatus.PENDING) {
        job.status = JobStatus.PROCESSING;
      }

      this.jobs.set(jobId, job);
    }
  }

  // Check if all providers have completed (or failed)
  private areAllProvidersCompleted(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || !job.providerResults) return false;

    const awsStatus = job.providerResults.aws?.status;
    const deepgramStatus = job.providerResults.deepgram?.status;

    return (
      (awsStatus === 'completed' || awsStatus === 'failed') &&
      (deepgramStatus === 'completed' || deepgramStatus === 'failed')
    );
  }

  completeJob(jobId: string, result: any): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = JobStatus.COMPLETED;
      job.result = result;
      job.completedAt = new Date();
      this.jobs.set(jobId, job);
    }
  }

  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = JobStatus.FAILED;
      job.error = error;
      job.completedAt = new Date();
      this.jobs.set(jobId, job);
    }
  }

  // Clean up old jobs (completed/failed jobs older than 1 hour)
  cleanupOldJobs(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        job.completedAt &&
        job.completedAt < oneHourAgo &&
        [JobStatus.COMPLETED, JobStatus.FAILED].includes(job.status)
      ) {
        this.jobs.delete(jobId);
      }
    }
  }
}
