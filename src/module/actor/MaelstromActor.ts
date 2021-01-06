import {MaelstromWeaponItem} from "../item/MaelstromWeaponItem"
import {MaelstromAbilityItem} from "../item/MaelstromAbilityItem"

export type MaelstromActorWoundsType = {
    wounds: number[],
    bloodloss: number,
    injuries: string,
    bleeding: string,
    longterm: string
}

export type MaelstromActorAttributeType = {
    orig: number,
    temp: number,
    used: boolean,
    test: object
}

export class MaelstromActor extends Actor {
    prepareData() {
        super.prepareData();

        const actorData = this.data
        const data = actorData.data
        const flags = data.flags

        if (actorData.type == 'character')
            this._prepareCharacterData(actorData)
    }

    _prepareCharacterData(actorData: ActorData<any>) {
        const data = actorData.data

        // Make modifications to data here ...

        for (let [key, attribute] of Object.entries(data.attributes)) {
            // calculate modifiers... d20 style
            //attribute.mod = Math.floor((attribute.orig - 10) / 2)
        }
    }

    rollAttribute(attributeName: string) {
        const attribute = this.data.data.attributes[attributeName]
        const orig = attribute.orig
        const temp = attribute.temp
        let rating = 0
        if (Number.isFinite(temp)) {
            rating = temp
        }
        else if (Number.isFinite(orig)) {
            rating = orig
        }

        const roll = new Roll('1d100').roll();
        const total = roll.total

        const attributeNameLocalized = game.i18n.localize("MAELSTROM.attribute.detail." + attributeName)

        roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                flavor: `${attributeNameLocalized}`,
            }, CONFIG.Dice.rollModes.PUBLIC).then((value => {}))
    }

}
