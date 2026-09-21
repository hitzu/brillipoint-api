import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1789957976518 implements MigrationInterface {
    name = 'Migration1789957976518'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."bookings_status_enum" AS ENUM('confirmed')`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_type_enum" AS ENUM('internal', 'commercial')`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_purpose_enum" AS ENUM('event', 'scouting', 'meeting', 'trial_makeup', 'trial_hair', 'trial_nail', 'other')`);
        await queryRunner.query(`CREATE TABLE "bookings" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'confirmed', "type" "public"."bookings_type_enum" NOT NULL, "purpose" "public"."bookings_purpose_enum", "event_date" date NOT NULL, "service_starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "service_ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "title" text, "venue_name" text, "maps_url" text, "contract_id" integer, CONSTRAINT "CHK_bookings_service_ends_after_starts" CHECK (service_ends_at > service_starts_at), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c1f45e80b7540e7c3daf512cbd" ON "bookings" ("service_starts_at", "service_ends_at") `);
        await queryRunner.query(`DROP INDEX "public"."IDX_290993a9f1db3f4ce949bf33fb"`);
        await queryRunner.query(`ALTER TYPE "public"."notes_scope_enum" RENAME TO "notes_scope_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notes_scope_enum" AS ENUM('slot', 'contract', 'booking')`);
        await queryRunner.query(`ALTER TABLE "notes" ALTER COLUMN "scope" TYPE "public"."notes_scope_enum" USING "scope"::"text"::"public"."notes_scope_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notes_scope_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_290993a9f1db3f4ce949bf33fb" ON "notes" ("scope", "target_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_fd37ec7748d0b8c558882935579" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_fd37ec7748d0b8c558882935579"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_290993a9f1db3f4ce949bf33fb"`);
        await queryRunner.query(`CREATE TYPE "public"."notes_scope_enum_old" AS ENUM('slot', 'contract')`);
        await queryRunner.query(`ALTER TABLE "notes" ALTER COLUMN "scope" TYPE "public"."notes_scope_enum_old" USING "scope"::"text"::"public"."notes_scope_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notes_scope_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notes_scope_enum_old" RENAME TO "notes_scope_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_290993a9f1db3f4ce949bf33fb" ON "notes" ("created_at", "scope", "target_id") `);
        await queryRunner.query(`DROP INDEX "public"."IDX_c1f45e80b7540e7c3daf512cbd"`);
        await queryRunner.query(`DROP TABLE "bookings"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_purpose_enum"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    }

}
