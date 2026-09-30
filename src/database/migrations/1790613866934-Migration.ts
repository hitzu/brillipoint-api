import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1790613866934 implements MigrationInterface {
    name = 'Migration1790613866934'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "brand_kits" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "key" text NOT NULL, "name" text NOT NULL, "overrides" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "UQ_f067f3552955a4a63532f969ea2" UNIQUE ("key"), CONSTRAINT "PK_abbe514f9ffbfdba652964132c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "decorative_icon"`);
        await queryRunner.query(`ALTER TABLE "brands" ADD "brand_kit_id" integer`);
        await queryRunner.query(`ALTER TABLE "events" ADD "brand_kit_id" integer`);
        await queryRunner.query(`ALTER TABLE "events" ADD "theme_overrides" jsonb`);
        await queryRunner.query(`ALTER TABLE "brands" ADD CONSTRAINT "FK_d633d3c387ea053f6d2d32c33e7" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_49a2390885cf0b1679c30f61a4b" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_49a2390885cf0b1679c30f61a4b"`);
        await queryRunner.query(`ALTER TABLE "brands" DROP CONSTRAINT "FK_d633d3c387ea053f6d2d32c33e7"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "theme_overrides"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "brand_kit_id"`);
        await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN "brand_kit_id"`);
        await queryRunner.query(`ALTER TABLE "events" ADD "decorative_icon" character varying(50)`);
        await queryRunner.query(`DROP TABLE "brand_kits"`);
    }

}
