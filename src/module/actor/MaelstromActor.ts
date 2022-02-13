import {MAELSTROM} from "../config"
import {isEmptyOrSpaces, referenceToGame} from "../settings"
import {INITIATIVE_FORMULA} from "../../maelstrom"
import {ActorData} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs"
import {getRollModifiers} from "../dialog/ModifiersDialog"

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
    current: number,
    used: boolean,
    test: object
}

export class MaelstromActor extends Actor {
	prepareDerivedData() {
		super.prepareDerivedData();

        const actorData = this.data

        if (actorData.type == 'character')
            this._prepareCharacterData(actorData)
    }

    /**
     * Calculate derived values
     *
     * @param actorData
     */
    _prepareCharacterData(actorData: ActorData) {
        const data = actorData.data as any

        // calculate actual value of an attribute between temp or orig
		for (let [key, attribute] of Object.entries(data.attributes)) {
            const att = attribute as MaelstromActorAttributeType
            if (Number.isFinite(att.temp))
                att.current = att.temp
            else if (Number.isFinite(att.orig))
                att.current = att.orig
            else
                att.current = 0
        }

		if (!Number.isFinite(data?.initiative?.modifier)) {
            if (!data.initiative) {
                data.initiative = {
                    modifier: 0
                }
            }
            else
                data.initiative.modifier = 0
        }

        if (!data?.hp) {
            data.hp = {
                value: 0,
                max: 0,
                wounds: 0
            }
        }
        data.hp.wounds = this._getTotalWounds(data)
        data.hp.max = data.attributes.endurance.current + 20
        data.hp.value = data.hp.max - data.hp.wounds

        if (!data?.roll) {
            data.roll = {
                modifier: 0
            }
        }
        data.roll.modifier = 0
    }

    _getTotalWounds(data: any) {
        let total = 0

        if (data?.wounds?.wounds) {
            // array is passed in as an Object ){0: 1, 1: 1, 2: 1, 3: null}
            const w = Object.values(data.wounds.wounds) as number[]
            total += w.reduce((previousValue: number, currentValue: number) => {
                if (currentValue && Number.isFinite(currentValue)) {
                    return previousValue + currentValue
                }
                return previousValue
            }, 0)
        }

        return total
    }

    _getAttributeValue(attributeName: string): number {
		// @ts-ignore
		const attribute = this.data?.data?.attributes[attributeName]
        return attribute.current
    }

    _getArmourPenaltyValue(): number {
        // @ts-ignore
		const penalty = this.data?.data?.armour?.penalty
        if (Number.isFinite(penalty))
            return penalty
        return 0
    }

    _getRollOutcome(roll: number, target: number): string {
        if (roll >= 96) {
            if (target <= 90)
                return 'criticalfail'
            return 'fail'
        }

        if (roll > target)
            return 'fail'

        const criticalLevel = Math.floor(target / 10)
        if (roll <= criticalLevel)
            return 'criticalsuccess'

        return 'success'
    }

    rollAttribute(attributeName: string, modifiers: number[] = [], itemName: string = ''): boolean {
        const attributeValue = this._getAttributeValue(attributeName)

        if (MAELSTROM.physicalAttributes.includes(attributeName)) {
            // add any armour penalty modifier
            const penalty = this._getArmourPenaltyValue()
            if (penalty != 0) {
                modifiers.unshift(penalty)
            }
        }

        // keep track of 'this'
        const actor = this

		// get modifier data
		getRollModifiers(0).then(dialogModifiers => {
			if (dialogModifiers.discriminator == "cancelled")
				return false

			modifiers.push(dialogModifiers.modifier)

			// filter modifiers to ensure that they are numbers
			modifiers = modifiers.filter(value => Number.isFinite(value))
			modifiers.unshift(attributeValue)

			// add all of the modifiers together
			let stackedModifersTotaled = modifiers.reduce((previousValue, currentValue) =>
				previousValue + currentValue, 0)
			if (stackedModifersTotaled < 0)
				stackedModifersTotaled = 0

			// convert stack of modifiers into a dice roll macro
			let stackedModifiersString = modifiers.reduce((previousValue, currentValue) =>
				previousValue.length > 0 ? `${previousValue} + ${currentValue}`: currentValue.toString(), '')
			if (modifiers.length > 1) {
				stackedModifiersString = `${stackedModifiersString} = ${stackedModifersTotaled}`
			}
			else {
				stackedModifiersString = stackedModifersTotaled.toString()
			}

			stackedModifiersString = game.i18n.format("MAELSTROM.roll.outcome.attribute.value.modified", {
				value: stackedModifiersString
			})

			const roll = new Roll('1d100').roll({ async: false });
			const total = roll.total !== undefined ? roll.total : 0

			let attributeNameLocalized = game.i18n.localize("MAELSTROM.attribute.detail." + attributeName)
			if (!isEmptyOrSpaces(itemName)) {
				attributeNameLocalized = game.i18n.format("MAELSTROM.roll.outcome.attribute.with.item", {
					attribute: attributeNameLocalized,
					item: (itemName) ? itemName.trim() : ''
				})
			}
			else {
				attributeNameLocalized = game.i18n.format("MAELSTROM.roll.outcome.attribute.without.item", {
					attribute: attributeNameLocalized
				})
			}

			const rollOutcomeLocalized = game.i18n.localize("MAELSTROM.roll.outcome." + actor._getRollOutcome(total, stackedModifersTotaled))

			const flavorText = `<h3>${Handlebars.Utils.escapeExpression(attributeNameLocalized)}</h3>
            ${Handlebars.Utils.escapeExpression(stackedModifiersString)}
            <h3 style="text-align: center; font-size: 140%; font-weight: bold;">${Handlebars.Utils.escapeExpression(rollOutcomeLocalized)}</h3>`

			roll.toMessage({
					speaker: ChatMessage.getSpeaker({ actor: actor }),
					flavor: flavorText
				},
				// @ts-ignore
				CONFIG.Dice.rollModes.publicroll).then((value => {}))

			return false
		})

        return false
    }

    rollItemDamage(name: string, damage: string = '') {
        name = name ? name.trim() : ''
        damage = damage ? damage.trim() : ''

		const nameLocalized = game.i18n.format("MAELSTROM.roll.item.with.damage", {
            item: name
        })
        let flavorText = `<h3>${Handlebars.Utils.escapeExpression(nameLocalized)}</h3>`

        let roll : Roll
        try {
            roll = new Roll(damage).roll({ async: false });
			roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                flavor: flavorText
            },
				// @ts-ignore
				c).then((value => {}))
        }
        catch (e) {
			const errorMsg = game.i18n.format("MAELSTROM.roll.item.damage.invalid", {
                formula: damage
            })
            flavorText += `<span style="color: red">${Handlebars.Utils.escapeExpression(errorMsg)}</span>`

			ChatMessage.create({
                user: game?.user?.id,
                speaker: ChatMessage.getSpeaker({ actor: this }),
                content: flavorText
            }).then((value => {}))
        }

        return false
    }

    rollActorInitiative() {
        let roll
        try {
            roll = new Roll(INITIATIVE_FORMULA, this.data?.data).roll({ async: false });
			roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this }),
				flavor: Handlebars.Utils.escapeExpression(game.i18n.localize("MAELSTROM.initiative.roll.message.flavour"))
            }, CONFIG.Dice.rollModes.publicroll).then((value => {}))
        }
        catch (e) {

        }

        return false
    }

}
