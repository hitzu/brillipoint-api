import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import type { DataSource } from 'typeorm';

import { BrandKit } from '../../../src/brand-kits/entities/brand-kit.entity';

export class BrandKitFactory extends Factory<BrandKit> {
  protected entity = BrandKit;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<BrandKit> {
    return {
      key: faker.string.alphanumeric(10),
      name: faker.company.name(),
      overrides: {},
    };
  }
}
