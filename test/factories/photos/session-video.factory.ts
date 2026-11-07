import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import type { DataSource } from 'typeorm';

import { SessionVideo } from '../../../src/photos/entities/session-video.entity';
import { SessionFactory } from './session.factory';

export class SessionVideoFactory extends Factory<SessionVideo> {
  protected entity = SessionVideo;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<SessionVideo> {
    const fileId = faker.string.uuid();
    return {
      sessionId: 0,
      storagePath: `photobooth/1/videos/${fileId}.mp4`,
      posterStoragePath: `photobooth/1/videos/${fileId}.jpg`,
      mime: 'video/mp4',
      durationMs: 3000,
    };
  }

  async create(attrs?: Partial<SessionVideo>): Promise<SessionVideo> {
    const video = await this.make({ ...attrs });
    if (video.sessionId === 0) {
      const session = await new SessionFactory(this.dataSource).create();
      video.sessionId = session.id;
    }
    return this.dataSource.getRepository(SessionVideo).save(video);
  }
}
