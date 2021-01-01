import {MaelstromActorMigrator} from "./MaelstromActorMigrator"


export async function migrateWorld() {
    if (!game.user.isGM)
        return

    const currentMaelstromActorVersion = MaelstromActorMigrator.forVersion;

    let maelstromActors = game.actors.entities.filter(actor =>
        actor.data.type === 'character' && actor.data.data.version < currentMaelstromActorVersion
    )

    if (maelstromActors && maelstromActors.length > 0) {
        ui.notifications.info(`Applying Maelstrom system migrations. Please be patient and do not close your game or shut down your server.`,
            {permanent: true});

        async function migrateCollection(migrator, collection, name) {
            try {
                if (collection && collection.length > 0) {
                    const updatedData = await Promise.all(collection.map(async obj => await migrator.migrate(obj)));

                    for (let i = 0; i < collection.length; i++) {
                        if (updatedData[i] !== null) {
                            await collection[i].update(updatedData[i]);
                        }
                    }

                    console.log(`${name} migration succeeded!`);
                }
            } catch (e) {
                console.error(`Error in ${name} migrations`, e);
            }
        }

        migrateCollection(MaelstromActorMigrator, maelstromActors, "character");

        ui.notifications.info(`Maelstrom system migration completed!`, {permanent: true});
    }
}
