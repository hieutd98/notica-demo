import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TranscriptionJob {
  id: string;
  status: JobStatus;
  fileName: string;
  filePath: string;
  languageCode: string;
  provider?: 'aws' | 'deepgram';
  result?: any;
  error?: string;
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
  ): string {
    const jobId = randomUUID();
    const job: TranscriptionJob = {
      id: jobId,
      status: JobStatus.PENDING,
      fileName,
      filePath,
      languageCode,
      provider,
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
