import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { TrackContractActionDto } from './track-contract-action.dto';

describe('TrackContractActionDto', () => {
  it('should accept a reservation action', async () => {
    // Arrange
    const dto = plainToInstance(TrackContractActionDto, {
      action: 'reservation_viewed',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors).toHaveLength(0);
  });

  it('should reject an action from the guest analytics list', async () => {
    // Arrange
    const dto = plainToInstance(TrackContractActionDto, {
      action: 'gallery_opened',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.map((e) => e.property)).toEqual(['action']);
  });
});
