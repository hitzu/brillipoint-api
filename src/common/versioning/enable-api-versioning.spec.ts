import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { enableApiVersioning } from './enable-api-versioning';

@Controller('things')
class NeutralThingsController {
  @Get()
  list() {
    return { version: 'neutral' };
  }
}

@Controller({ path: 'things', version: '2' })
class V2ThingsController {
  @Get()
  list() {
    return { version: '2' };
  }
}

describe('enableApiVersioning', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NeutralThingsController, V2ThingsController],
    }).compile();

    app = moduleRef.createNestApplication();
    enableApiVersioning(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps unversioned routes at their original path', async () => {
    const res = await request(app.getHttpServer()).get('/things').expect(200);

    expect(res.body).toEqual({ version: 'neutral' });
  });

  it('serves version 2 routes under the /v2 prefix', async () => {
    const res = await request(app.getHttpServer()).get('/v2/things').expect(200);

    expect(res.body).toEqual({ version: '2' });
  });

  it('does not prefix unversioned routes with /v1', async () => {
    await request(app.getHttpServer()).get('/v1/things').expect(404);
  });
});
