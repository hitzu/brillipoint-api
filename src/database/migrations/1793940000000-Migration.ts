import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1793940000000 implements MigrationInterface {
    name = 'Migration1793940000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "receipt_path" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "receipt_path"`);
    }

}
