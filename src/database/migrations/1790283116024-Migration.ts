import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1790283116024 implements MigrationInterface {
    name = 'Migration1790283116024'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_bookings_contract_event" ON "bookings" ("contract_id") WHERE purpose = 'event' AND deleted_at IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_bookings_contract_event"`);
    }

}
