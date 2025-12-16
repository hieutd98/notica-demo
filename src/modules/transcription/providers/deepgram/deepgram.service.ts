import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@deepgram/sdk';
import * as fs from 'fs';

@Injectable()
export class DeepgramService {
  private deepgram: any;

  // Deepgram supports a very wide range of audio formats
  private readonly DEEPGRAM_SUPPORTED_FORMATS = [
    'mp3',
    'wav',
    'flac',
    'ogg',
    'm4a',
    'mp4',
    'aac',
    'wma',
    'opus',
    'amr',
    '3gp',
    'aiff',
    'aif',
    'ape',
    'avi',
    'dss',
    'm4p',
    'm4v',
    'mov',
    'mpc',
    'mpg',
    'mpeg',
    'qt',
    'ra',
    'rm',
    'voc',
    'wv',
    'webm',
  ];

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('deepgram.apiKey');
    this.deepgram = createClient(apiKey);
  }

  private isFormatSupported(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext ? this.DEEPGRAM_SUPPORTED_FORMATS.includes(ext) : false;
  }

  async transcribeFile(
    filePath: string,
    fileName: string,
    languageCode: string = 'en',
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Check if format is supported
      if (!this.isFormatSupported(fileName)) {
        const ext = fileName.split('.').pop()?.toLowerCase() || 'unknown';
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        return {
          provider: 'Deepgram',
          status: 'FAILED',
          transcript: null,
          error: `Unsupported format: ${ext}. Deepgram supports: ${this.DEEPGRAM_SUPPORTED_FORMATS.join(', ')}`,
          duration: `${duration.toFixed(2)}s`,
        };
      }

      const audioBuffer = fs.readFileSync(filePath);

      // Build transcription options
      const options: any = {
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        diarize: true,
      };

      // Auto-detect language or use specified language
      if (languageCode === 'auto') {
        options.detect_language = true;
      } else {
        options.language = languageCode;
      }

      const { result, error } =
        await this.deepgram.listen.prerecorded.transcribeFile(
          audioBuffer,
          options,
        );

      if (error) {
        throw error;
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const transcript = result.results.channels[0].alternatives[0].transcript;
      const detectedLanguage = result.results.channels[0].detected_language;

      console.log('deepgram result: ', result);
      return {
        provider: 'Deepgram',
        status: 'COMPLETED',
        transcript,
        error: null,
        duration: `${duration.toFixed(2)}s`,
        confidence: result.results.channels[0].alternatives[0].confidence,
        detectedLanguage: detectedLanguage || null,
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      return {
        provider: 'Deepgram',
        status: 'FAILED',
        transcript: null,
        error: error.message,
        duration: `${duration.toFixed(2)}s`,
      };
    }
  }
}
