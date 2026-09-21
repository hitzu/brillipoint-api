import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { Note } from './entities/note.entity';
import { NOTE_SCOPE } from './types/note-scope.types';
import { NOTE_KIND } from './types/note-kind.types';
import { NoteDto } from './dto/note.dto';
import { SlotsService } from '../slots/slots.service';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class NotesService {
  private readonly _logger = new Logger(NotesService.name);

  constructor(
    @InjectRepository(Note)
    private notesRepository: Repository<Note>,
    private slotsService: SlotsService,
    private bookingsService: BookingsService,
  ) {}

  private async assertTargetExists(
    scope: NOTE_SCOPE,
    targetId: number,
  ): Promise<void> {
    if (scope === NOTE_SCOPE.SLOT) {
      await this.slotsService.getById(targetId);
    }
    if (scope === NOTE_SCOPE.BOOKING) {
      await this.bookingsService.findDetailById(targetId);
    }
  }

  async findTimelineByTarget(
    scope: NOTE_SCOPE,
    targetId: number,
    kind: NOTE_KIND,
  ): Promise<NoteDto[]> {
    await this.assertTargetExists(scope, targetId);
    const notes = await this.notesRepository.find({
      where: { scope, targetId, kind },
      order: { createdAt: 'ASC' },
    });
    return plainToInstance(NoteDto, notes, { excludeExtraneousValues: true });
  }

  async createForTarget({
    scope,
    targetId,
    content,
    kind,
    createdBy,
  }: {
    scope: NOTE_SCOPE;
    targetId: number;
    content: string;
    kind: NOTE_KIND;
    createdBy: number;
  }): Promise<NoteDto> {
    await this.assertTargetExists(scope, targetId);
    try {
      const noteToSave = this.notesRepository.create({
        scope,
        targetId,
        kind,
        content,
        createdBy,
      });
      const saved = await this.notesRepository.save(noteToSave);
      return plainToInstance(NoteDto, saved, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this._logger.error(error, 'Error creating note');
      throw error;
    }
  }
}
