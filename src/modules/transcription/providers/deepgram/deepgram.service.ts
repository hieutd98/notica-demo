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
    model: string = 'nova-2',
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
      console.log(
        `[Deepgram] Transcribing file: ${fileName} (${audioBuffer.length} bytes)`,
      );

      // Build transcription options
      const options: any = {
        model: model,
        smart_format: true,
        punctuate: true,
        diarize: true,
      };

      console.log(`[Deepgram] Using model: ${model}`);

      // Auto-detect language or use specified language
      if (languageCode === 'auto') {
        options.detect_language = true;
        console.log('[Deepgram] Using auto language detection');
      } else {
        options.language = languageCode;
        console.log(`[Deepgram] Using language: ${languageCode}`);
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

      // Safely access nested properties with null/undefined checks
      const channel = result?.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      const transcript = alternative?.transcript?.trim() || '';
      const detectedLanguage = channel?.detected_language;
      const confidence = alternative?.confidence || 0;

      console.log('[Deepgram] Response metadata:', result?.metadata);
      console.log(JSON.stringify(result, null, 2));

      // Check if we actually got a transcript
      if (!transcript) {
        console.warn('[Deepgram] No transcript returned - Response details:', {
          hasResult: !!result,
          hasChannels: !!result?.results?.channels,
          channelsLength: result?.results?.channels?.length,
          hasAlternatives: !!channel?.alternatives,
          alternativesLength: channel?.alternatives?.length,
          alternative: alternative,
        });
        return {
          provider: 'Deepgram',
          status: 'FAILED',
          transcript: null,
          error: 'No transcript returned from Deepgram',
          duration: `${duration.toFixed(2)}s`,
        };
      }

      console.log(
        `[Deepgram] Transcription successful - Length: ${transcript.length} chars, Confidence: ${confidence.toFixed(2)}`,
      );

      return {
        provider: 'Deepgram',
        status: 'COMPLETED',
        transcript,
        error: null,
        duration: `${duration.toFixed(2)}s`,
        confidence,
        detectedLanguage: detectedLanguage || null,
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.error('[Deepgram] Transcription failed:', {
        fileName,
        error: error.message,
        stack: error.stack,
        duration: `${duration.toFixed(2)}s`,
      });

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
