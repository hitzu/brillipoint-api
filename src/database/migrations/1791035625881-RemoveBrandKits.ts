import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Removes the brand-kit feature (odd/tasks/remove-brand-kits.md, T2). The
 * feature never shipped to production, so no data is migrated.
 *
 * Generated statements (FK and column drops) come from `db:gen`. Two
 * statements are hand-added because TypeORM never emits them for a removed
 * entity or for JSONB contents:
 * - the `socialCta.brandKitKey` cleanup on `events.theme_overrides`: the key
 *   no longer exists in the theme contract, and a stored value would still
 *   leak into public theme output because the whole socialCta block is
 *   copied as-is;
 * - `DROP TABLE "brand_kits"`.
 *
 * The cleanup runs under the theme write lock (`THEME_WRITE_LOCK_KEY`), like
 * every other write that can affect public themes.
 *
 * `down()` recreates the table, columns, and FKs with their original names
 * (Migration1790613866934). Dropped rows, kit assignments, and removed
 * `brandKitKey` values are not restored.
 */
export class RemoveBrandKits1791035625881 implements MigrationInterface {
    name = 'RemoveBrandKits1791035625881'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT pg_advisory_xact_lock(1947326501)`);
        await queryRunner.query(`UPDATE "events" SET "theme_overrides" = "theme_overrides" #- '{socialCta,brandKitKey}' WHERE jsonb_typeof("theme_overrides" -> 'socialCta') = 'object' AND ("theme_overrides" -> 'socialCta') ? 'brandKitKey'`);
        await queryRunner.query(`ALTER TABLE "brands" DROP CONSTRAINT "FK_d633d3c387ea053f6d2d32c33e7"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_49a2390885cf0b1679c30f61a4b"`);
        await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN "brand_kit_id"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "brand_kit_id"`);
        await queryRunner.query(`DROP TABLE "brand_kits"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "brand_kits" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "key" text NOT NULL, "name" text NOT NULL, "overrides" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "UQ_f067f3552955a4a63532f969ea2" UNIQUE ("key"), CONSTRAINT "PK_abbe514f9ffbfdba652964132c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "events" ADD "brand_kit_id" integer`);
        await queryRunner.query(`ALTER TABLE "brands" ADD "brand_kit_id" integer`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_49a2390885cf0b1679c30f61a4b" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "brands" ADD CONSTRAINT "FK_d633d3c387ea053f6d2d32c33e7" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        // The `socialCta.brandKitKey` cleanup is not reversible: removed
        // values are not restored.
    }

}
