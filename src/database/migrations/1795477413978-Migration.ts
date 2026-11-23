import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1795477413978 implements MigrationInterface {
    name = 'Migration1795477413978'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_analytics" ADD "contract_id" integer`);
        await queryRunner.query(`ALTER TABLE "event_analytics" DROP CONSTRAINT "FK_cb9de9c0a970034368dd0a5630a"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ea_event_action_source"`);
        await queryRunner.query(`ALTER TABLE "event_analytics" ALTER COLUMN "event_token" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_ea_contract_action" ON "event_analytics" ("contract_id", "action") `);
        await queryRunner.query(`CREATE INDEX "idx_ea_event_action_source" ON "event_analytics" ("event_token", "action", "source") `);
        await queryRunner.query(`ALTER TABLE "event_analytics" ADD CONSTRAINT "chk_ea_event_or_contract" CHECK ("event_token" IS NOT NULL OR "contract_id" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "event_analytics" ADD CONSTRAINT "FK_cb9de9c0a970034368dd0a5630a" FOREIGN KEY ("event_token") REFERENCES "events"("token") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_analytics" ADD CONSTRAINT "FK_1a19a30b73f8b320c9a11bdb4bb" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_analytics" DROP CONSTRAINT "FK_1a19a30b73f8b320c9a11bdb4bb"`);
        await queryRunner.query(`ALTER TABLE "event_analytics" DROP CONSTRAINT "FK_cb9de9c0a970034368dd0a5630a"`);
        await queryRunner.query(`ALTER TABLE "event_analytics" DROP CONSTRAINT "chk_ea_event_or_contract"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ea_event_action_source"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ea_contract_action"`);
        await queryRunner.query(`ALTER TABLE "event_analytics" ALTER COLUMN "event_token" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_ea_event_action_source" ON "event_analytics" ("event_token", "action", "source") `);
        await queryRunner.query(`ALTER TABLE "event_analytics" ADD CONSTRAINT "FK_cb9de9c0a970034368dd0a5630a" FOREIGN KEY ("event_token") REFERENCES "events"("token") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_analytics" DROP COLUMN "contract_id"`);
    }

}
