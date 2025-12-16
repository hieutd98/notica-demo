import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { AwsTranscribeService } from './providers/aws-transcribe/aws-transcribe.service';
import { DeepgramService } from './providers/deepgram/deepgram.service';
import { JobManagerService } from './job-manager.service';

@Module({
  imports: [ConfigModule],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    AwsTranscribeService,
    DeepgramService,
    JobManagerService,
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
