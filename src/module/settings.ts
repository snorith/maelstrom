export const registerSettings = function() {
	// Register any custom system settings here

    game.settings.register("maelstrom", "characterSheet", {
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
    });

    Handlebars.registerHelper('concat', function() {
        let outStr = ''
        for (let arg in arguments) {
            if (typeof arguments[arg] != 'object') {
                outStr += arguments[arg]
            }
        }
        return outStr
    });

    Handlebars.registerHelper('toLowerCase', function(str) {
        return str.toLowerCase()
    });

    Handlebars.registerHelper("disabled", value => value ? "disabled" : "")
}
