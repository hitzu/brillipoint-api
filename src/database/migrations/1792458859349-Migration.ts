import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1792458859349 implements MigrationInterface {
  name = 'Migration1792458859349';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract_packages" ADD "items_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract_extras" ADD "items_snapshot" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract_extras" DROP COLUMN "items_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract_packages" DROP COLUMN "items_snapshot"`,
    );
  }
}
