import {Migrator} from "./Migrator"
import {MaelstromActor} from "../actor/MaelstromActor"

//Keep migrators in order: v1 to v2, v2 to v3, etc.
const MaelstromActorV0ToV1Migrator = Object.create(Migrator);

MaelstromActorV0ToV1Migrator.forVersion = 1;
MaelstromActorV0ToV1Migrator.forType = MaelstromActor;

MaelstromActorV0ToV1Migrator.migrationFunction = async function(actor, obj = {}) {
    const newData = Object.assign({_id: actor._id}, obj)

    if (!actor.data.data.hasOwnProperty("wounds")) {
        newData["data.wounds"] = {
            "wounds": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "bloodloss": 0,
            "injuries": "",
            "bleeding": "",
            "longterm": ""
        }
    }

    if (!actor.data.data.wounds.hasOwnProperty("wounds")) {
        newData["data.wounds.wounds"] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    }

    if (!actor.data.data.wounds.hasOwnProperty("bloodloss")) {
        newData["data.wounds.bloodloss"] = 0
    }

    if (!actor.data.data.wounds.hasOwnProperty("injuries")) {
        newData["data.wounds.injuries"] = ""
    }

    if (!actor.data.data.wounds.hasOwnProperty("bleeding")) {
        newData["data.wounds.bleeding"] = ""
    }

    if (!actor.data.data.wounds.hasOwnProperty("longterm")) {
        newData["data.wounds.longterm"] = ""
    }

    if (!actor.data.data.hasOwnProperty("armour")) {
        newData["data.armour"] = {
            "armour": "",
            "ar": "",
            "penalty": ""
        }
    }

    newData["data.version"] = this.forVersion;

    return newData;
}

//Only export the latest migrator
export const MaelstromActorMigrator = MaelstromActorV0ToV1Migrator;
