import 'reflect-metadata';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { CreateEventDto } from './create-event.dto';
import { EventResponseDto } from './event-response.dto';
import { UpdateEventDto } from './update-event.dto';

/**
 * `odd/tasks/event-fields-deprecation.md` deprecates the legacy event
 * schedule/print fields in v1 Swagger metadata without changing v1
 * behavior. Phase 1b makes the contract's EVENT booking the only source
 * of schedule/status (see `EventsService.getPublicEventStatus`), so
 * `serviceStartsAt` is deprecated here too, alongside the fields deprecated
 * in phase 1. Schedule/location now live on bookings; see the v2 read
 * model (`EventV2ResponseDto`).
 */
const DEPRECATED_RESPONSE_FIELDS = [
  'serviceStartsAt',
  'serviceEndsAt',
  'venueName',
  'serviceLocationUrl',
  'serviceTypeId',
  'printTemplate',
  'printTemplates',
  'decorativeIcon',
  'serviceType',
] as const;

const DEPRECATED_CREATE_FIELDS = [
  'serviceStartsAt',
  'serviceEndsAt',
  'venueName',
  'serviceLocationUrl',
  'serviceTypeId',
  'printTemplate',
  'printTemplates',
] as const;

const DEPRECATED_UPDATE_FIELDS = [
  'serviceStartsAt',
  'serviceEndsAt',
  'venueName',
  'serviceLocationUrl',
  'serviceTypeId',
  'printTemplate',
  'printTemplates',
  'decorativeIcon',
] as const;

const NOT_DEPRECATED_RESPONSE_FIELDS = ['eventTypeId'] as const;

function isDeprecated(target: object, propertyKey: string): boolean {
  const metadata = Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES,
    target,
    propertyKey,
  ) as { deprecated?: boolean } | undefined;
  return metadata?.deprecated === true;
}

describe('v1 event DTO deprecation markers', () => {
  describe.each(DEPRECATED_RESPONSE_FIELDS)('EventResponseDto.%s', (field) => {
    it('is marked deprecated in Swagger metadata', () => {
      expect(isDeprecated(EventResponseDto.prototype, field)).toBe(true);
    });
  });

  describe.each(NOT_DEPRECATED_RESPONSE_FIELDS)('EventResponseDto.%s', (field) => {
    it('is NOT marked deprecated', () => {
      expect(isDeprecated(EventResponseDto.prototype, field)).toBe(false);
    });
  });

  describe.each(DEPRECATED_CREATE_FIELDS)('CreateEventDto.%s', (field) => {
    it('is marked deprecated in Swagger metadata', () => {
      expect(isDeprecated(CreateEventDto.prototype, field)).toBe(true);
    });
  });

  describe.each(DEPRECATED_UPDATE_FIELDS)('UpdateEventDto.%s', (field) => {
    it('is marked deprecated in Swagger metadata', () => {
      expect(isDeprecated(UpdateEventDto.prototype, field)).toBe(true);
    });
  });
});
