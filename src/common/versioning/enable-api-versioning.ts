import { INestApplication, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';

/**
 * URI versioning with a neutral default: every existing route keeps its
 * unversioned path (e.g. `/events`), and only handlers that opt in with
 * `version: '2'` are served under a prefix (e.g. `/v2/events`). A default of
 * `'1'` would move every route to `/v1/...` and break current clients.
 */
export function enableApiVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });
}
