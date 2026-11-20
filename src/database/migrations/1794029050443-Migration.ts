import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1794029050443 implements MigrationInterface {
    name = 'Migration1794029050443'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "session_videos" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "session_id" integer NOT NULL, "storage_path" character varying(512) NOT NULL, "poster_storage_path" character varying(512) NOT NULL, "mime" character varying(100) NOT NULL DEFAULT 'video/mp4', "duration_ms" integer, CONSTRAINT "PK_afaf22fb67997412d28c4afbf76" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_session_videos_session_id" ON "session_videos" ("session_id") WHERE deleted_at IS NULL`);
        await queryRunner.query(`ALTER TABLE "session_videos" ADD CONSTRAINT "FK_c1d0cd882b71b262e41bc7b97c7" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session_videos" DROP CONSTRAINT "FK_c1d0cd882b71b262e41bc7b97c7"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_session_videos_session_id"`);
        await queryRunner.query(`DROP TABLE "session_videos"`);
    }

}
