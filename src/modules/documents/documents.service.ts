import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { mkdir, writeFile, readdir, rmdir, unlink } from 'fs/promises';

@Injectable()
export class DocumentsService {
  readonly storagePath = 'database/documents';

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) {}

  async create(
    name: Document['name'],
    file: Express.Multer.File,
    keys: Document['keys'],
    userId: Document['userId'],
  ): Promise<void> {
    if (!name) {
      throw new Error('`name` must be a non-empty string');
    }

    if (!keys) {
      throw new Error('`keys` must be a non-empty string');
    }

    if (!userId || userId <= 0 || typeof userId !== 'number') {
      throw new Error('`userId` must be a positive number');
    }

    const documents = await this.documentsRepository.findBy({
      name: name,
      userId: userId,
    });

    if (documents.length !== 0) {
      throw new Error(
        `Cannot create document because name already exists: ${name}`,
      );
    }

    await mkdir(`${this.storagePath}/${userId}`, { recursive: true });
    await writeFile(`${this.storagePath}/${userId}/${name}`, file.buffer);
    const document = new Document();
    document.name = name;
    document.keys = keys;
    document.userId = userId;
    await this.documentsRepository.save(document);
  }

  async findAll(userId: Document['userId']): Promise<Document[]> {
    return await this.documentsRepository.findBy({ userId });
  }

  async findOne(
    id: Document['id'],
    userId: Document['userId'],
  ): Promise<Document | null> {
    const documents = await this.documentsRepository.findBy({ id, userId });
    if (documents.length === 0) {
      return null;
    }
    return documents[documents.length - 1];
  }

  async remove(id: Document['id'], userId: Document['userId']): Promise<void> {
    const document = await this.findOne(id, userId);
    if (document === null) {
      throw new Error(
        `Cannot remove document from database, unknown document id #${id} or userId #${userId}`,
      );
    }
    const userDocumentsDir = `${this.storagePath}/${userId}`;
    await unlink(`${userDocumentsDir}/${document.name}`);
    if ((await readdir(userDocumentsDir)).length === 0) {
      await rmdir(userDocumentsDir);
    }
    await this.documentsRepository.remove(document);
  }
}
