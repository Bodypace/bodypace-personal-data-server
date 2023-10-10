import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { writeFile, unlink } from 'fs/promises';

@Injectable()
export class DocumentsService {
  readonly storagePath = 'database/documents';

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) {}

  async create(
    name: string,
    file: Express.Multer.File,
    keys: string,
  ): Promise<void> {
    const documents = await this.documentsRepository.findBy({
      name: name,
    });

    if (documents.length !== 0) {
      throw 'Cannot create document because name already exists: ' + name;
    }

    await writeFile(`${this.storagePath}/${name}`, file.buffer);
    const document = new Document();
    document.name = name;
    document.keys = keys;
    await this.documentsRepository.save(document);
  }

  async findAll(): Promise<Document[]> {
    return await this.documentsRepository.find();
  }

  async findOne(id: number): Promise<Document | null> {
    const documents = await this.documentsRepository.findBy({ id });
    if (documents.length === 0) {
      return null;
    }
    return documents[documents.length - 1];
  }

  async remove(id: number): Promise<void> {
    const document = await this.findOne(id);
    if (document === null) {
      throw 'Cannot remove document from database, unknown id #' + id;
    }
    await unlink(`${this.storagePath}/${document.name}`);
    await this.documentsRepository.remove(document);
  }
}
