import {MaelstromAbilityItemSheet} from "./MaelstromAbilityItemSheet"
import {MaelstromAbilityItem} from "../MaelstromAbilityItem"
import {MaelstromWeaponItem} from "../MaelstromWeaponItem"
import {MaelstromWeaponItemSheet} from "./MaelstromWeaponItemSheet"

export class MaelstromItemSheet extends ItemSheet {
    constructor(data, options) {
        super(data, options)

        const { type } = data
        if (!type)
            throw new Error('No item sheet type provided')

        //First, create an object of the appropriate type...
        let object = null
        switch (type) {
            case MaelstromAbilityItem.type:
                object = new MaelstromAbilityItemSheet(data, options)
                break
            case MaelstromWeaponItem.type:
                object = new MaelstromWeaponItemSheet(data, options)
                break
            case "equipment":
                object = null
                break
        }

        if (object === null)
            throw new Error(`Unhandled object type ${type}`);

        //...then merge that object into the current one
        mergeObject(this, object);
    }
}
