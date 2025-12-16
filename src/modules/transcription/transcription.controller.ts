import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { TranscriptionService } from './transcription.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller('transcription')
export class TranscriptionController {
  constructor(private transcriptionService: TranscriptionService) {}

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
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const languageCode = language || 'en-US';

    try {
      const result = await this.transcriptionService.compareTranscriptions(
        file.path,
        file.originalname,
        languageCode,
      );

      // Clean up uploaded file after processing
      fs.unlinkSync(file.path);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Clean up uploaded file if error occurs
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      throw new BadRequestException(`Transcription failed: ${error.message}`);
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

    try {
      const result = await this.transcriptionService.transcribeWithProvider(
        provider,
        file.path,
        file.originalname,
        languageCode,
      );

      // Clean up uploaded file after processing
      fs.unlinkSync(file.path);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Clean up uploaded file if error occurs
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      throw new BadRequestException(`Transcription failed: ${error.message}`);
    }
  }
}
