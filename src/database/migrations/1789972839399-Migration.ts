import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1789972839399 implements MigrationInterface {
  name = 'Migration1789972839399';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_type_enum" AS ENUM('internal', 'commercial')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "type" "public"."bookings_type_enum"`,
    );
    await queryRunner.query(
      `UPDATE "bookings" SET "type" = CASE WHEN "contract_id" IS NULL THEN 'internal' ELSE 'commercial' END::"public"."bookings_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "type" SET NOT NULL`,
    );
  }
}
