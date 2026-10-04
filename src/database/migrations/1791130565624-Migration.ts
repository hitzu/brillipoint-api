import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1791130565624 implements MigrationInterface {
    name = 'Migration1791130565624'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "brands" DROP CONSTRAINT "FK_d633d3c387ea053f6d2d32c33e7"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_49a2390885cf0b1679c30f61a4b"`);
        await queryRunner.query(`ALTER TABLE "events" RENAME COLUMN "brand_kit_id" TO "gallery_status"`);
        await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN "brand_kit_id"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "gallery_status"`);
        await queryRunner.query(`CREATE TYPE "public"."events_gallery_status_enum" AS ENUM('auto', 'demo')`);
        await queryRunner.query(`ALTER TABLE "events" ADD "gallery_status" "public"."events_gallery_status_enum" NOT NULL DEFAULT 'auto'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "gallery_status"`);
        await queryRunner.query(`DROP TYPE "public"."events_gallery_status_enum"`);
        await queryRunner.query(`ALTER TABLE "events" ADD "gallery_status" integer`);
        await queryRunner.query(`ALTER TABLE "brands" ADD "brand_kit_id" integer`);
        await queryRunner.query(`ALTER TABLE "events" RENAME COLUMN "gallery_status" TO "brand_kit_id"`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_49a2390885cf0b1679c30f61a4b" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "brands" ADD CONSTRAINT "FK_d633d3c387ea053f6d2d32c33e7" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
