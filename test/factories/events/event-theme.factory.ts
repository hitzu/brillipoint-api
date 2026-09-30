import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import type { DataSource } from 'typeorm';

import { EventTheme } from '../../../src/events/entities/event-themes.entity';

export class EventThemeFactory extends Factory<EventTheme> {
  protected entity = EventTheme;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<EventTheme> {
    return {
      key: `theme-${faker.string.alphanumeric(10)}`,
      name: faker.commerce.productName(),
      tokens: null,
      images: null,
    };
  }
}
