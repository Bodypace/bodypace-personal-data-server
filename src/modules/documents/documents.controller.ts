import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  Res,
  InternalServerErrorException,
  UnsupportedMediaTypeException,
  Headers,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { Express } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { DocumentMetadata } from './dto/document-metadata.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        skipMissingProperties: false,
      }),
    )
    body: DocumentMetadata,
    @UploadedFile() file: Express.Multer.File,
    @Headers('Content-Type') contentType: string,
  ) {
    // TODO: maybe this and file checks could be extracted to some decorators, interceptors, pipes etc.
    if (!contentType.startsWith('multipart/form-data; boundary=')) {
      throw new UnsupportedMediaTypeException(
        `Unsupported media type (Content-Type): ${contentType}`,
      );
    }
    if (file === undefined) {
      throw new BadRequestException(
        'Missing `file` field that should upload file',
      );
    }
    if (file.size === 0) {
      throw new BadRequestException('Uploaded file cannot be empty');
    }
    try {
      return await this.documentService.create(body.name, file, body.keys);
    } catch (error) {
      // TODO: add { cause: error } for debugging
      // https://docs.nestjs.com/exception-filters
      throw new InternalServerErrorException(
        'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
      );
    }
  }

  @Get()
  async findAll() {
    return await this.documentService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | void> {
    const document = await this.documentService.findOne(+id);
    if (document) {
      res.set({
        'Content-Disposition': `attachment; filename="${document.name}"`,
      });
      const file = createReadStream(
        `${this.documentService.storagePath}/${document.name}`,
      );
      return new StreamableFile(file);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.documentService.remove(+id);
  }
}
