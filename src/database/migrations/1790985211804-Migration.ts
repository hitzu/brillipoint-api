import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Data migration: seeds the global Brillipoint brand kit
 * (odd/tasks/reward-promo-theme-block.md, T2c). This is the source of truth
 * for the `brillipoint` row: the earlier insert migrations named in
 * `brillipoint-kit.seed.ts` were never committed, so no environment built
 * from this repo gets the row otherwise.
 *
 * Non-destructive by design:
 * - the row is inserted only when no row with key `brillipoint` exists
 *   (the UNIQUE constraint on `key` also covers soft-deleted rows, so a
 *   soft-deleted kit is left alone);
 * - on an existing row only a missing `rewardPromo` key is added; existing
 *   data, including an explicit `rewardPromo: null`, is never overwritten.
 *
 * The payload is frozen inline on purpose (never import the seed constant):
 * a migration must not drift when `BRILLIPOINT_BRAND_KIT_OVERRIDES` changes.
 * `brillipoint-kit.seed.spec.ts` asserts the constant still equals this
 * literal; when the constant changes, ship a new migration for the delta.
 *
 * Runs under the theme write lock (`THEME_WRITE_LOCK_KEY`), like every other
 * write that can affect public themes.
 */
export const BRILLIPOINT_KIT_SEED_OVERRIDES = {
    socialCta: {
        brandKitKey: 'brillipoint',
        headline: {
            text: {
                es: '¿Y si las próximas fotos son las tuyas?',
                en: 'What if the next photos are yours?',
            },
        },
        subtitle: {
            text: {
                es: 'Reserva Brillipoint para tu próximo evento.',
                en: 'Book Brillipoint for your next event.',
            },
        },
        followText: {
            text: {
                es: 'Síguenos para no perderte nuestras promociones',
                en: "Follow us so you don't miss our promotions",
            },
        },
        primaryAction: {
            channel: 'whatsapp',
            label: {
                text: {
                    es: 'Reservar mi fecha',
                    en: 'Book my date',
                },
            },
            phone: '5212215775211',
            message: {
                text: {
                    es: 'Hola, te vi en la fiesta de {{honoreesName}} y me gustaría esto para mi fiesta',
                    en: "Hi, I saw you at {{honoreesName}}'s party and I would like this for my party",
                },
                fallback: {
                    text: {
                        es: 'Hola, vi una galería de Brillipoint y me gustaría esto para mi fiesta',
                        en: 'Hi, I saw a Brillipoint gallery and I would like this for my party',
                    },
                },
            },
        },
        socials: {
            instagram: 'https://www.instagram.com/brillipoint',
            tiktok: 'https://www.tiktok.com/@brillipoint.glitterbar',
            facebook: 'https://www.facebook.com/profile.php?id=61579380963496',
        },
    },
    rewardPromo: {
        handle: '@brillipoint',
        title: {
            text: {
                es: '¡Comparte y recibe un regalo!',
                en: 'Share it and get a gift!',
            },
        },
        disclaimer: {
            text: {
                es: 'Válido para tu próxima reservación con Brillipoint',
                en: 'Valid on your next Brillipoint booking',
            },
        },
    },
};

export class Migration1790985211804 implements MigrationInterface {
    name = 'Migration1790985211804'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT pg_advisory_xact_lock(1947326501)`);
        await queryRunner.query(
            `INSERT INTO "brand_kits" ("key", "name", "overrides") VALUES ('brillipoint', 'Brillipoint', $1::jsonb) ON CONFLICT ("key") DO NOTHING`,
            [JSON.stringify(BRILLIPOINT_KIT_SEED_OVERRIDES)],
        );
        await queryRunner.query(
            `UPDATE "brand_kits" SET "overrides" = jsonb_set("overrides", '{rewardPromo}', $1::jsonb, true) WHERE "key" = 'brillipoint' AND NOT ("overrides" ? 'rewardPromo')`,
            [JSON.stringify(BRILLIPOINT_KIT_SEED_OVERRIDES.rewardPromo)],
        );
    }

    /**
     * Only the `rewardPromo` key is removed. The row itself is kept: it may
     * have existed before `up()` ran (inserted by hand or by an older
     * environment), and there is no way to tell, so deleting it could lose
     * data that this migration never owned.
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT pg_advisory_xact_lock(1947326501)`);
        await queryRunner.query(
            `UPDATE "brand_kits" SET "overrides" = "overrides" - 'rewardPromo' WHERE "key" = 'brillipoint'`,
        );
    }

}
