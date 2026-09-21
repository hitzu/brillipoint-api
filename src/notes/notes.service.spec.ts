import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { Slot } from '../slots/entities/slot.entity';
import { SlotFactory } from '../../test/factories/slots/slot.factory';
import { Booking } from '../bookings/entities/booking.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { BookingFactory } from '../../test/factories/bookings/booking.factory';
import { BookingsService } from '../bookings/bookings.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { Note } from './entities/note.entity';
import { NotesService } from './notes.service';
import { NOTE_SCOPE } from './types/note-scope.types';
import { NOTE_KIND } from './types/note-kind.types';
import { SlotsService } from '../slots/slots.service';

describe('NotesService', () => {
  let service: NotesService;
  let notesRepository: Repository<Note>;
  let slotFactory: SlotFactory;
  let bookingFactory: BookingFactory;

  beforeEach(async () => {
    // The SLOT branch stands in a mock for SlotsService; that mock's
    // behaviour diverges from the real SlotsService.getById (it throws
    // SLOT_NOT_FOUND, the real service throws SLOT_NOT_AVAILABLE). This is
    // pre-existing drift, out of scope for the booking-scope addition below.
    const slotsServiceMock = {
      getById: jest.fn(async (id: number) => {
        if (id === 999999) {
          throw new NotFoundException(EXCEPTION_RESPONSE.SLOT_NOT_FOUND);
        }
        return;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: SlotsService,
          useValue: slotsServiceMock,
        },
        // Real BookingsService (no mock): it is a DB-backed collaborator,
        // so it is wired against TestDataSource like any other entity under
        // test, per the bookandsign-testing skill.
        BookingsService,
        {
          provide: getRepositoryToken(Note),
          useValue: TestDataSource.getRepository(Note),
        },
        {
          provide: getRepositoryToken(Slot),
          useValue: TestDataSource.getRepository(Slot),
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: TestDataSource.getRepository(Booking),
        },
        // `BookingsService` resolves a booking's contract when one is given,
        // so the real collaborator needs the contract repository too.
        {
          provide: getRepositoryToken(Contract),
          useValue: TestDataSource.getRepository(Contract),
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
    notesRepository = module.get<Repository<Note>>(getRepositoryToken(Note));
    slotFactory = new SlotFactory(TestDataSource);
    bookingFactory = new BookingFactory(TestDataSource);
  });

  describe('createForTarget', () => {
    it('should throw NotFoundException when slot does not exist', async () => {
      const dto: CreateNoteDto = { content: 'Hello' };
      await expect(
        service.createForTarget({
          scope: NOTE_SCOPE.SLOT,
          targetId: 999999,
          content: dto.content,
          kind: NOTE_KIND.INTERNAL,
          createdBy: null,
        } as any),
      ).rejects.toEqual(new NotFoundException(EXCEPTION_RESPONSE.SLOT_NOT_FOUND));
    });

    it('should create a slot note with createdBy', async () => {
      const slot = await slotFactory.create();
      const dto: CreateNoteDto = { content: 'Se envió PDF de paquetes' };
      const result = await service.createForTarget({
        scope: NOTE_SCOPE.SLOT,
        targetId: slot.id,
        content: dto.content,
        kind: NOTE_KIND.INTERNAL,
        createdBy: 23,
      } as any);
      expect(result.id).toBeDefined();
      expect(result.createdBy).toBe(23);
      expect(result.content).toBe(dto.content);
    });

    it('should create a contract note without validating contract existence', async () => {
      const dto: CreateNoteDto = { content: 'Contract note' };
      const result = await service.createForTarget({
        scope: NOTE_SCOPE.CONTRACT,
        targetId: 123,
        content: dto.content,
        kind: NOTE_KIND.INTERNAL,
        createdBy: null,
      } as any);
      expect(result.id).toBeDefined();
      expect(result.scope).toBe(NOTE_SCOPE.CONTRACT);
      expect(result.targetId).toBe(123);
    });

    it('should create a booking note with scope booking and kind internal', async () => {
      // Arrange
      const booking = await bookingFactory.create();
      const content = 'Called client to confirm venue';

      // Act
      const result = await service.createForTarget({
        scope: NOTE_SCOPE.BOOKING,
        targetId: booking.id,
        content,
        kind: NOTE_KIND.INTERNAL,
        createdBy: 23,
      } as any);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.scope).toBe(NOTE_SCOPE.BOOKING);
      expect(result.targetId).toBe(booking.id);
      expect(result.kind).toBe(NOTE_KIND.INTERNAL);
      expect(result.content).toBe(content);
    });

    it('should throw NotFoundException when booking does not exist', async () => {
      // Act & Assert
      await expect(
        service.createForTarget({
          scope: NOTE_SCOPE.BOOKING,
          targetId: 999999,
          content: 'Should fail',
          kind: NOTE_KIND.INTERNAL,
          createdBy: null,
        } as any),
      ).rejects.toEqual(new NotFoundException(EXCEPTION_RESPONSE.BOOKING_NOT_FOUND));
    });
  });

  describe('findTimelineByTarget', () => {
    it('should return notes ordered by createdAt asc', async () => {
      const slot = await slotFactory.create();
      await service.createForTarget({
        scope: NOTE_SCOPE.SLOT,
        targetId: slot.id,
        content: 'First',
        kind: NOTE_KIND.INTERNAL,
        createdBy: null,
      } as any);
      await service.createForTarget({
        scope: NOTE_SCOPE.SLOT,
        targetId: slot.id,
        content: 'Second',
        kind: NOTE_KIND.INTERNAL,
        createdBy: null,
      } as any);
      const notes = await service.findTimelineByTarget(NOTE_SCOPE.SLOT, slot.id);
      expect(notes).toHaveLength(2);
      expect(notes[0]?.content).toBe('First');
      expect(notes[1]?.content).toBe('Second');
    });

    it('should return empty array when target has no notes', async () => {
      const slot = await slotFactory.create();
      const notes = await service.findTimelineByTarget(NOTE_SCOPE.SLOT, slot.id);
      expect(notes).toEqual([]);
    });

    it('should throw NotFoundException when slot does not exist', async () => {
      await expect(
        service.findTimelineByTarget(NOTE_SCOPE.SLOT, 999999),
      ).rejects.toEqual(new NotFoundException(EXCEPTION_RESPONSE.SLOT_NOT_FOUND));
    });

    it('should persist notes in repository', async () => {
      const slot = await slotFactory.create();
      await service.createForTarget({
        scope: NOTE_SCOPE.SLOT,
        targetId: slot.id,
        content: 'Hello',
        kind: NOTE_KIND.INTERNAL,
        createdBy: null,
      } as any);
      const persisted = await notesRepository.find({
        where: { scope: NOTE_SCOPE.SLOT, targetId: slot.id },
      });
      expect(persisted).toHaveLength(1);
      expect(persisted[0]?.content).toBe('Hello');
    });

    it('should return internal notes for a booking with id, content, kind and scope', async () => {
      // Arrange
      const booking = await bookingFactory.create();
      await service.createForTarget({
        scope: NOTE_SCOPE.BOOKING,
        targetId: booking.id,
        content: 'Booking note',
        kind: NOTE_KIND.INTERNAL,
        createdBy: 23,
      } as any);

      // Act
      const notes = await service.findTimelineByTarget(
        NOTE_SCOPE.BOOKING,
        booking.id,
        NOTE_KIND.INTERNAL,
      );

      // Assert
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({
        content: 'Booking note',
        kind: NOTE_KIND.INTERNAL,
        scope: NOTE_SCOPE.BOOKING,
      });
      expect(notes[0]?.id).toBeDefined();
    });

    it('should throw NotFoundException when booking does not exist', async () => {
      // Act & Assert
      await expect(
        service.findTimelineByTarget(
          NOTE_SCOPE.BOOKING,
          999999,
          NOTE_KIND.INTERNAL,
        ),
      ).rejects.toEqual(new NotFoundException(EXCEPTION_RESPONSE.BOOKING_NOT_FOUND));
    });

    it('should not return notes of other scopes when listing a booking\'s notes', async () => {
      // Arrange: a slot note and a booking note deliberately share the same
      // numeric target id, to prove the scope branch actually filters and
      // does not just happen to return the right rows by coincidence.
      const booking = await bookingFactory.create();
      await service.createForTarget({
        scope: NOTE_SCOPE.SLOT,
        targetId: booking.id,
        content: 'Slot note with a colliding id',
        kind: NOTE_KIND.INTERNAL,
        createdBy: null,
      } as any);
      await service.createForTarget({
        scope: NOTE_SCOPE.BOOKING,
        targetId: booking.id,
        content: 'Booking note',
        kind: NOTE_KIND.INTERNAL,
        createdBy: null,
      } as any);

      // Act
      const notes = await service.findTimelineByTarget(
        NOTE_SCOPE.BOOKING,
        booking.id,
        NOTE_KIND.INTERNAL,
      );

      // Assert
      expect(notes).toHaveLength(1);
      expect(notes[0]?.content).toBe('Booking note');
      expect(notes[0]?.scope).toBe(NOTE_SCOPE.BOOKING);
    });
  });
});


