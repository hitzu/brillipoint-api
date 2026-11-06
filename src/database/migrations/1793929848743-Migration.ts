import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1793929848743 implements MigrationInterface {
    name = 'Migration1793929848743'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."contracts_transport_status_enum" AS ENUM('included', 'pending_quote', 'quoted')`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "transport_status" "public"."contracts_transport_status_enum" NOT NULL DEFAULT 'pending_quote'`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "transport_amount" numeric`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "transport_quoted_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "transport_quoted_at"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "transport_amount"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "transport_status"`);
        await queryRunner.query(`DROP TYPE "public"."contracts_transport_status_enum"`);
    }

}
