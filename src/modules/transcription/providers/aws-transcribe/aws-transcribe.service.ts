import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  TranscriptionJob,
  LanguageCode,
} from '@aws-sdk/client-transcribe';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AwsTranscribeService {
  private transcribeClient: TranscribeClient;
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.region') || 'us-east-1';
    const credentials = {
      accessKeyId: this.configService.get<string>('aws.accessKeyId') || '',
      secretAccessKey: this.configService.get<string>('aws.secretAccessKey') || '',
    };

    this.transcribeClient = new TranscribeClient({ region, credentials });
    this.s3Client = new S3Client({ region, credentials });
    this.bucket = this.configService.get<string>('aws.s3Bucket') || '';
  }

  async uploadToS3(filePath: string, fileName: string): Promise<string> {
    const fileContent = fs.readFileSync(filePath);
    const key = `transcriptions/${Date.now()}-${fileName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileContent,
      }),
    );

    return `https://${this.bucket}.s3.${this.configService.get<string>('aws.region')}.amazonaws.com/${key}`;
  }

  async startTranscription(
    audioUrl: string,
    jobName: string,
    languageCode: string = 'en-US',
  ): Promise<string> {
    const commandInput: any = {
      TranscriptionJobName: jobName,
      MediaFormat: 'mp3',
      Media: {
        MediaFileUri: audioUrl,
      },
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 10,
      },
    };

    // Auto-detect language or use specified language
    if (languageCode === 'auto') {
      commandInput.IdentifyLanguage = true;
    } else {
      commandInput.LanguageCode = languageCode as LanguageCode;
    }

    const command = new StartTranscriptionJobCommand(commandInput);

    await this.transcribeClient.send(command);
    return jobName;
  }

  async getTranscriptionResult(
    jobName: string,
  ): Promise<{ status: string; transcript?: string; error?: string }> {
    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName,
    });

    const response = await this.transcribeClient.send(command);
    const job = response.TranscriptionJob;

    if (!job) {
      return {
        status: 'FAILED',
        error: 'Job not found',
      };
    }

    if (job.TranscriptionJobStatus === 'COMPLETED') {
      const transcriptUrl = job.Transcript?.TranscriptFileUri;
      if (!transcriptUrl) {
        return {
          status: 'FAILED',
          error: 'Transcript URL not found',
        };
      }

      const transcriptResponse = await fetch(transcriptUrl);
      const transcriptData = await transcriptResponse.json();

      return {
        status: 'COMPLETED',
        transcript: transcriptData.results.transcripts[0].transcript,
      };
    } else if (job.TranscriptionJobStatus === 'FAILED') {
      return {
        status: 'FAILED',
        error: job.FailureReason,
      };
    } else {
      return {
        status: job.TranscriptionJobStatus || 'UNKNOWN',
      };
    }
  }

  async transcribeFile(
    filePath: string,
    fileName: string,
    languageCode: string = 'en-US',
  ): Promise<any> {
    const startTime = Date.now();

    // Upload to S3
    const audioUrl = await this.uploadToS3(filePath, fileName);

    // Start transcription
    const jobName = `transcription-${Date.now()}`;
    await this.startTranscription(audioUrl, jobName, languageCode);

    // Poll for result
    let result;
    do {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      result = await this.getTranscriptionResult(jobName);
    } while (result.status === 'IN_PROGRESS');

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    return {
      provider: 'AWS Transcribe',
      status: result.status,
      transcript: result.transcript || null,
      error: result.error || null,
      duration: `${duration.toFixed(2)}s`,
      jobName,
    };
  }
}
