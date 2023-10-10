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
} from '@nestjs/common';
import { Express } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { createReadStream } from 'fs';
import type { Response } from 'express';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(@Body() body: any, @UploadedFile() file: Express.Multer.File) {
    return await this.documentService.create(body.name, file, body.keys);
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
