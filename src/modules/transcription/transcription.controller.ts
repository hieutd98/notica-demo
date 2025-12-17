import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { TranscriptionService } from './transcription.service';
import { JobManagerService } from './job-manager.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller('transcription')
export class TranscriptionController {
  constructor(
    private transcriptionService: TranscriptionService,
    private jobManagerService: JobManagerService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './public/uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            file.fieldname +
              '-' +
              uniqueSuffix +
              path.extname(file.originalname),
          );
        },
      }),
      fileFilter: (req, file, cb) => {
        // Expanded format list - supports formats from AWS Transcribe and Deepgram
        // AWS: AMR, FLAC, M4A, MP3, MP4, OGG, WebM, WAV
        // Deepgram: MP3, WAV, FLAC, OGG, M4A, AAC, WMA, OPUS, AMR, 3GP, and more
        const allowedTypes = /mp3|wav|m4a|mp4|webm|ogg|flac|amr|aac|wma|opus|3gp|aiff|aif|ape|avi|dss|m4p|m4v|mov|mpc|mpg|mpeg|qt|ra|rm|voc|wv/;
        const extname = allowedTypes.test(
          path.extname(file.originalname).toLowerCase(),
        );
        const mimetype = allowedTypes.test(file.mimetype);

        console.log('mimetype: ', mimetype);
        console.log('extension: ', extname);
        if (extname) {
          return cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Unsupported audio format. Supported formats: mp3, wav, m4a, mp4, webm, ogg, flac, amr, aac, wma, opus, 3gp, aiff, ape, avi, and more',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadAndCompare(
    @UploadedFile() file: Express.Multer.File,
    @Query('language') language?: string,
    @Query('deepgramModel') deepgramModel?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const languageCode = language || 'en-US';
    const model = deepgramModel || 'nova-2';

    try {
      // Return job ID immediately instead of waiting for transcription
      const jobId =
        await this.transcriptionService.startCompareTranscriptionsAsync(
          file.path,
          file.originalname,
          languageCode,
          model,
        );

      return {
        success: true,
        jobId,
        message: 'Transcription job started. Use GET /transcription/job/:jobId to check status',
      };
    } catch (error) {
      // Clean up uploaded file if error occurs
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      throw new BadRequestException(`Failed to start transcription: ${error.message}`);
    }
  }

  @Post('upload/:provider')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './public/uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            file.fieldname +
              '-' +
              uniqueSuffix +
              path.extname(file.originalname),
          );
        },
      }),
      fileFilter: (req, file, cb) => {
        // Expanded format list - supports formats from AWS Transcribe and Deepgram
        // AWS: AMR, FLAC, M4A, MP3, MP4, OGG, WebM, WAV
        // Deepgram: MP3, WAV, FLAC, OGG, M4A, AAC, WMA, OPUS, AMR, 3GP, and more
        const allowedTypes = /mp3|wav|m4a|mp4|webm|ogg|flac|amr|aac|wma|opus|3gp|aiff|aif|ape|avi|dss|m4p|m4v|mov|mpc|mpg|mpeg|qt|ra|rm|voc|wv/;
        const extname = allowedTypes.test(
          path.extname(file.originalname).toLowerCase(),
        );
        const mimetype = allowedTypes.test(file.mimetype);

        console.log('mimetype: ', mimetype);
        console.log('extension: ', extname);
        if (extname) {
          return cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Unsupported audio format. Supported formats: mp3, wav, m4a, mp4, webm, ogg, flac, amr, aac, wma, opus, 3gp, aiff, ape, avi, and more',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadWithProvider(
    @UploadedFile() file: Express.Multer.File,
    @Query('provider') provider: 'aws' | 'deepgram',
    @Query('language') language?: string,
    @Query('deepgramModel') deepgramModel?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!['aws', 'deepgram'].includes(provider)) {
      throw new BadRequestException(
        'Invalid provider. Choose "aws" or "deepgram"',
      );
    }

    const languageCode = language || 'en-US';
    const model = deepgramModel || 'nova-2';

    try {
      // Return job ID immediately instead of waiting for transcription
      const jobId =
        await this.transcriptionService.startTranscribeWithProviderAsync(
          provider,
          file.path,
          file.originalname,
          languageCode,
          model,
        );

      return {
        success: true,
        jobId,
        message: 'Transcription job started. Use GET /transcription/job/:jobId to check status',
      };
    } catch (error) {
      // Clean up uploaded file if error occurs
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      throw new BadRequestException(`Failed to start transcription: ${error.message}`);
    }
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = this.jobManagerService.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return {
      success: true,
      job: {
        id: job.id,
        status: job.status,
        fileName: job.fileName,
        languageCode: job.languageCode,
        provider: job.provider,
        result: job.result,
        providerResults: job.providerResults, // Include partial results for comparison jobs
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      },
    };
  }
}
