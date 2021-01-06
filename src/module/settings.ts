import {MaelstromActorAttributeType, MaelstromActorWoundsType} from "./actor/MaelstromActor"

export const systemName = "maelstrom"
export const systemBasePath = `systems/${systemName}`

export const registerSettings = function() {
	// Register any custom system settings here

    game.settings.register(systemName, "characterSheet", {
        name: "Character Sheet",
        hint: "Select the PC character sheet to use.",
        scope: "world",
        config: true,
        type: Number,
        default: 1,
        choices: {
            1: "Domesday",
            2: "Gothic",
            3: "Rome"
        },
    });

    game.settings.register(systemName, "trademarkNotice", {
        name: "Trademark Notice",
        hint: "The Maelstrom RPG is © Alexander Scott all rights reserved. \n" +
            "The Maelstrom RPG is a trademark of Alexander Scott and is used under license. \n\n" +
            "This edition is printed and distributed, under license, by Arion Games\n" +
            "For further information about other Arion Games products check  out  our  website  and  forums  at http://www.arion-games.com\n" +
            "Content on this site or associated files derived from Arion Games publications is used under agreement with the license holder and should not be construed as a challenge to those trademarks or copyrights.\n" +
            "The contents of this site are for personal, non-commercial use only. Arion Games is not responsible for this site or any of the content.",
        scope: "world",
        config: true,
        type: null,
        default: null
    });

    // Register custom Handlebar helpers

    // Adds a simple Handlebars "for loop" block helper
    Handlebars.registerHelper('for', function (times: number, block: any) {
        let accum = ''
        for (let i = 0; i < times; i++) {
            block.data.index = i
            block.data.num = i + 1
            accum += block.fn(i)
        }
        return accum
    })

    Handlebars.registerHelper('concat', function() {
        let outStr = ''
        for (let arg in arguments) {
            if (typeof arguments[arg] != 'object') {
                outStr += arguments[arg]
            }
        }
        return outStr
    })

    Handlebars.registerHelper('toLowerCase', function(str) {
        return str.toLowerCase()
    })

    Handlebars.registerHelper("disabled", value => value ? "disabled" : "")

    // https://stackoverflow.com/questions/39766555/how-to-check-for-empty-string-null-or-white-spaces-in-handlebar
    Handlebars.registerHelper('ifEmptyOrWhitespace', function (value, options) {
        if (!value) { return options.fn(this); }
        return value.replace(/\s*/g, '').length === 0
            ? options.fn(this)
            : options.inverse(this)
    })

    Handlebars.registerHelper('isZeroThenBlank', function (value) {
        if (Number.isFinite(value)) {
            if (value == 0) {
                return ''
            }
            return value
        }
        return ''
    })

    Handlebars.registerHelper('isZero', (value) => {
        if (Number.isFinite(value)) {
            return value == 0;
        }
        return true
    })

    Handlebars.registerHelper('add', (a, b) => {
        if (Number.isFinite(a) && Number.isFinite(b)) {
            return a + b
        }
        return ''
    })

    Handlebars.registerHelper('sub', (a, b) => {
        if (Number.isFinite(a) && Number.isFinite(b)) {
            return a - b
        }
        return ''
    })

    Handlebars.registerHelper('calculateTotalWounds', function (wounds: MaelstromActorWoundsType) {
        let total = 0

        if (wounds?.wounds) {
            // array is passed in as an Object ){0: 1, 1: 1, 2: 1, 3: null}
            const w = Object.values(wounds.wounds)
            total += w.reduce((previousValue: number, currentValue: number) => {
                if (currentValue && Number.isFinite(currentValue)) {
                    return previousValue + currentValue
                }
                return previousValue
            }, 0)
        }

        return total
    })

    Handlebars.registerHelper('currentValueOfAttribute', (attributes: object, attributeName: string) => {
        if (attributes?.hasOwnProperty(attributeName)) {
            const attribute = attributes[attributeName] as MaelstromActorAttributeType
            let value = Number.isFinite(attribute.orig) ? attribute.orig : 0
            if (Number.isFinite(attribute.temp))
                value = attribute.temp
            return value
        }
        return null
    })
}

export function isEmptyOrSpaces(str: string): boolean {
    return str === null || str.match(/^[\s\n\r\t]*$/) !== null;
}
