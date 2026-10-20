import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1792458717477 implements MigrationInterface {
  name = 'Migration1792458717477';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract_extras" ADD "is_gift" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract_extras" DROP COLUMN "is_gift"`,
    );
  }
}
