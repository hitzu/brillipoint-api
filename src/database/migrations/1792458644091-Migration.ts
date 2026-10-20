import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1792458644091 implements MigrationInterface {
  name = 'Migration1792458644091';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."extra_products_action_enum" AS ENUM('add', 'remove')`,
    );
    await queryRunner.query(
      `CREATE TABLE "extra_products" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "extra_id" integer NOT NULL, "product_id" integer NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "action" "public"."extra_products_action_enum" NOT NULL, CONSTRAINT "PK_83eca13ea3f2beacf8352bce0c6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9a3b8bd6377d3da1d6a4cd1830" ON "extra_products" ("extra_id", "product_id", "action") `,
    );
    await queryRunner.query(
      `ALTER TABLE "extra_products" ADD CONSTRAINT "FK_0e23f18a236bf9936a95637089d" FOREIGN KEY ("extra_id") REFERENCES "extras"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "extra_products" ADD CONSTRAINT "FK_5013c71e70cf3503030ddfd3e4a" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "extra_products" DROP CONSTRAINT "FK_5013c71e70cf3503030ddfd3e4a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extra_products" DROP CONSTRAINT "FK_0e23f18a236bf9936a95637089d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a3b8bd6377d3da1d6a4cd1830"`,
    );
    await queryRunner.query(`DROP TABLE "extra_products"`);
    await queryRunner.query(`DROP TYPE "public"."extra_products_action_enum"`);
  }
}
