import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import type { DataSource } from 'typeorm';

import { Session } from '../../../src/photos/entities/session.entity';
import { EventFactory } from '../events/event.factory';

export class SessionFactory extends Factory<Session> {
  protected entity = Session;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<Session> {
    return {
      sessionToken: faker.string.uuid(),
      status: 'active',
      photoCount: 0,
      completedAt: null,
      eventId: 0,
    };
  }

  async create(attrs?: Partial<Session>): Promise<Session> {
    const session = await this.make({ ...attrs });
    if (session.eventId === 0) {
      const eventFactory = new EventFactory(this.dataSource);
      const event = await eventFactory.create();
      session.eventId = event.id;
    }
    return this.dataSource.getRepository(Session).save(session);
  }
}
